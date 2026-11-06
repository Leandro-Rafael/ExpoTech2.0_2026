/**
 * Esquemas zod reutilizáveis (espelham as regras do back-end).
 * Mensagens em PT-BR. Use com zodResolver do @hookform/resolvers.
 */
import { z } from 'zod';

const SENHA_MIN = 10;
const SENHA_MAX = 128;

const SENHAS_COMUNS = new Set([
  '1234567890', '12345678910', '0123456789', 'senha12345', 'senha123456', 'password123', 'password1234',
  'qwerty12345', 'abc1234567', 'abcdef1234', 'mudar12345', 'brasil2026', 'admin12345', 'qwertyuiop1',
]);

export const esquemaEmail = z
  .string({ required_error: 'Informe seu e-mail' })
  .trim()
  .min(1, 'Informe seu e-mail')
  .max(254, 'E-mail muito longo')
  .email('E-mail inválido');

export const esquemaNome = z
  .string({ required_error: 'Informe seu nome' })
  .trim()
  .min(2, 'Nome muito curto')
  .max(120, 'Nome muito longo')
  .regex(/^[\p{L}\p{M}' .-]+$/u, 'Use apenas letras, espaços e hífens');

/** Lista de verificações da política de senha (para checklist visual). */
export function verificacoesSenha(senha: string, email?: string) {
  const usuarioEmail = (email ?? '').split('@')[0]?.toLowerCase() ?? '';
  const senhaMinuscula = senha.toLowerCase();
  return [
    { id: 'len', label: `De ${SENHA_MIN} a ${SENHA_MAX} caracteres`, ok: senha.length >= SENHA_MIN && senha.length <= SENHA_MAX },
    { id: 'letter', label: 'Ao menos uma letra', ok: /\p{L}/u.test(senha) },
    { id: 'digit', label: 'Ao menos um número', ok: /\d/.test(senha) },
    { id: 'email', label: 'Não contém seu e-mail', ok: !email || usuarioEmail.length < 3 || (!senhaMinuscula.includes(usuarioEmail) && !senhaMinuscula.includes(email.toLowerCase())) },
  ];
}

/** Valida senha (sem e-mail). Para a regra do e-mail use `withPasswordNotContainingEmail`. */
export const esquemaSenha = z
  .string({ required_error: 'Crie uma senha' })
  .min(SENHA_MIN, `A senha deve ter ao menos ${SENHA_MIN} caracteres`)
  .max(SENHA_MAX, `A senha deve ter no máximo ${SENHA_MAX} caracteres`)
  .regex(/\p{L}/u, 'Inclua ao menos uma letra')
  .regex(/\d/, 'Inclua ao menos um número')
  .refine((p) => !SENHAS_COMUNS.has(p.toLowerCase()), 'Esta senha é muito comum. Escolha outra.');

/** Adiciona a regra "senha não pode conter o e-mail" a um objeto com { email, password }. */
export function senhaSemEmail<T extends { email: string; password: string }>(dados: T, ctx: z.RefinementCtx) {
  const verificacao = verificacoesSenha(dados.password, dados.email).find((c) => c.id === 'email');
  if (verificacao && !verificacao.ok) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['password'], message: 'A senha não pode conter seu e-mail' });
  }
}

export type NivelForca = 0 | 1 | 2 | 3 | 4;
export const rotulosForca = ['Muito fraca', 'Fraca', 'Razoável', 'Forte', 'Excelente'] as const;

/** Força estimada da senha (0..4), heurística leve sem dependências. */
export function forcaSenha(senha: string, email?: string): NivelForca {
  if (!senha) return 0;
  let pontuacao = 0;
  const tamanho = senha.length;
  if (tamanho >= SENHA_MIN) pontuacao++;
  if (tamanho >= 14) pontuacao++;
  if (tamanho >= 18) pontuacao++;
  const tipos = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(senha)).length;
  pontuacao += Math.max(0, tipos - 2);
  if (/(.)\1{2,}/.test(senha)) pontuacao--;
  if (/^(?:\d+|[a-z]+|[A-Z]+)$/.test(senha)) pontuacao--;
  if (SENHAS_COMUNS.has(senha.toLowerCase())) pontuacao = 0;
  if (!verificacoesSenha(senha, email).every((c) => c.ok)) pontuacao = Math.min(pontuacao, 1);
  return Math.max(0, Math.min(4, pontuacao)) as NivelForca;
}

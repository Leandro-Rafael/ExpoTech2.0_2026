/**
 * Esquemas zod reutilizáveis (espelham as regras do back-end).
 * Mensagens em PT-BR. Use com zodResolver do @hookform/resolvers.
 */
import { z } from 'zod';

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

const COMMON = new Set([
  '1234567890', '12345678910', '0123456789', 'senha12345', 'senha123456', 'password123', 'password1234',
  'qwerty12345', 'abc1234567', 'abcdef1234', 'mudar12345', 'brasil2026', 'admin12345', 'qwertyuiop1',
]);

export const emailSchema = z
  .string({ required_error: 'Informe seu e-mail' })
  .trim()
  .min(1, 'Informe seu e-mail')
  .max(254, 'E-mail muito longo')
  .email('E-mail inválido');

export const nameSchema = z
  .string({ required_error: 'Informe seu nome' })
  .trim()
  .min(2, 'Nome muito curto')
  .max(120, 'Nome muito longo')
  .regex(/^[\p{L}\p{M}' .-]+$/u, 'Use apenas letras, espaços e hífens');

/** Lista de verificações da política de senha (para checklist visual). */
export function passwordChecks(password: string, email?: string) {
  const local = (email ?? '').split('@')[0]?.toLowerCase() ?? '';
  const lower = password.toLowerCase();
  return [
    { id: 'len', label: `De ${PASSWORD_MIN} a ${PASSWORD_MAX} caracteres`, ok: password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX },
    { id: 'letter', label: 'Ao menos uma letra', ok: /\p{L}/u.test(password) },
    { id: 'digit', label: 'Ao menos um número', ok: /\d/.test(password) },
    { id: 'email', label: 'Não contém seu e-mail', ok: !email || local.length < 3 || (!lower.includes(local) && !lower.includes(email.toLowerCase())) },
  ];
}

/** Valida senha (sem e-mail). Para a regra do e-mail use `withPasswordNotContainingEmail`. */
export const passwordSchema = z
  .string({ required_error: 'Crie uma senha' })
  .min(PASSWORD_MIN, `A senha deve ter ao menos ${PASSWORD_MIN} caracteres`)
  .max(PASSWORD_MAX, `A senha deve ter no máximo ${PASSWORD_MAX} caracteres`)
  .regex(/\p{L}/u, 'Inclua ao menos uma letra')
  .regex(/\d/, 'Inclua ao menos um número')
  .refine((p) => !COMMON.has(p.toLowerCase()), 'Esta senha é muito comum. Escolha outra.');

/** Adiciona a regra "senha não pode conter o e-mail" a um objeto com { email, password }. */
export function passwordNotContainingEmail<T extends { email: string; password: string }>(data: T, ctx: z.RefinementCtx) {
  const check = passwordChecks(data.password, data.email).find((c) => c.id === 'email');
  if (check && !check.ok) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['password'], message: 'A senha não pode conter seu e-mail' });
  }
}

export type StrengthLevel = 0 | 1 | 2 | 3 | 4;
export const strengthLabels = ['Muito fraca', 'Fraca', 'Razoável', 'Forte', 'Excelente'] as const;

/** Força estimada da senha (0..4), heurística leve sem dependências. */
export function passwordStrength(password: string, email?: string): StrengthLevel {
  if (!password) return 0;
  let score = 0;
  const len = password.length;
  if (len >= PASSWORD_MIN) score++;
  if (len >= 14) score++;
  if (len >= 18) score++;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  score += Math.max(0, classes - 2);
  if (/(.)\1{2,}/.test(password)) score--;
  if (/^(?:\d+|[a-z]+|[A-Z]+)$/.test(password)) score--;
  if (COMMON.has(password.toLowerCase())) score = 0;
  if (!passwordChecks(password, email).every((c) => c.ok)) score = Math.min(score, 1);
  return Math.max(0, Math.min(4, score)) as StrengthLevel;
}

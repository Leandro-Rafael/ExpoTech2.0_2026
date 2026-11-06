/**
 * Política de senha (igual à do back-end) e "hash" de demonstração.
 * ATENÇÃO: o hash aqui NÃO é seguro — existe só para não guardar a senha em texto puro no localStorage
 * da demo. O back-end real usa Argon2/BCrypt.
 */
import type { ErroDeCampo } from '../http';

const SENHAS_COMUNS = new Set([
  '1234567890', '12345678910', '0123456789', 'qwertyuiop', 'password123', 'senha12345', 'senha123456',
  'abcdef1234', 'abc1234567', 'a123456789', '123456789a', 'qwerty1234', 'qwerty12345', 'iloveyou12',
  'mudar12345', 'brasil2024', 'brasil2025', 'brasil2026', 'admin12345', 'admin123456', 'password1234',
  'teste12345', 'senhasenha1', 'flamengo123', 'corinthians1', 'palmeiras10', '1q2w3e4r5t', 'q1w2e3r4t5',
]);

export function validarSenha(campo: string, senha: unknown, email: string | null): ErroDeCampo | null {
  if (typeof senha !== 'string' || senha.length === 0) return { field: campo, message: 'informe a senha' };
  if (senha.length < 10) return { field: campo, message: 'a senha deve ter ao menos 10 caracteres' };
  if (senha.length > 128) return { field: campo, message: 'a senha deve ter no máximo 128 caracteres' };
  if (!/\p{L}/u.test(senha) || !/\d/.test(senha)) return { field: campo, message: 'use ao menos 1 letra e 1 número' };
  const minuscula = senha.toLowerCase();
  const local = (email ?? '').toLowerCase().split('@')[0] ?? '';
  if (local.length >= 3 && minuscula.includes(local)) return { field: campo, message: 'a senha não pode conter o seu e-mail' };
  if (SENHAS_COMUNS.has(minuscula)) return { field: campo, message: 'esta senha é muito comum; escolha outra' };
  return null;
}

/** FNV-1a 32 bits repetido — suficiente para a demo, nunca para produção. */
export function hashDemo(senha: string, sal: string): string {
  let saida = '';
  let entrada = `${sal}:${senha}`;
  for (let rodada = 0; rodada < 4; rodada++) {
    let h = 0x811c9dc5;
    for (let i = 0; i < entrada.length; i++) {
      h ^= entrada.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    const parte = h.toString(16).padStart(8, '0');
    saida += parte;
    entrada = parte + entrada;
  }
  return `demo$${sal}$${saida}`;
}

export function conferirSenha(senha: string, hash: string): boolean {
  const sal = hash.split('$')[1] ?? '';
  return hashDemo(senha, sal) === hash;
}

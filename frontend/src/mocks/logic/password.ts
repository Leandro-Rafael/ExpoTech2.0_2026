/**
 * Política de senha (igual à do back-end) e "hash" de demonstração.
 * ATENÇÃO: o hash aqui NÃO é seguro — existe só para não guardar a senha em texto puro no localStorage
 * da demo. O back-end real usa Argon2/BCrypt.
 */
import type { FieldError } from '../http';

const COMMON_PASSWORDS = new Set([
  '1234567890', '12345678910', '0123456789', 'qwertyuiop', 'password123', 'senha12345', 'senha123456',
  'abcdef1234', 'abc1234567', 'a123456789', '123456789a', 'qwerty1234', 'qwerty12345', 'iloveyou12',
  'mudar12345', 'brasil2024', 'brasil2025', 'brasil2026', 'admin12345', 'admin123456', 'password1234',
  'teste12345', 'senhasenha1', 'flamengo123', 'corinthians1', 'palmeiras10', '1q2w3e4r5t', 'q1w2e3r4t5',
]);

export function validatePassword(field: string, password: unknown, email: string | null): FieldError | null {
  if (typeof password !== 'string' || password.length === 0) return { field, message: 'informe a senha' };
  if (password.length < 10) return { field, message: 'a senha deve ter ao menos 10 caracteres' };
  if (password.length > 128) return { field, message: 'a senha deve ter no máximo 128 caracteres' };
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) return { field, message: 'use ao menos 1 letra e 1 número' };
  const lower = password.toLowerCase();
  const local = (email ?? '').toLowerCase().split('@')[0] ?? '';
  if (local.length >= 3 && lower.includes(local)) return { field, message: 'a senha não pode conter o seu e-mail' };
  if (COMMON_PASSWORDS.has(lower)) return { field, message: 'esta senha é muito comum; escolha outra' };
  return null;
}

/** FNV-1a 32 bits repetido — suficiente para a demo, nunca para produção. */
export function demoHash(password: string, salt: string): string {
  let out = '';
  let input = `${salt}:${password}`;
  for (let round = 0; round < 4; round++) {
    let h = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    const part = h.toString(16).padStart(8, '0');
    out += part;
    input = part + input;
  }
  return `demo$${salt}$${out}`;
}

export function checkPassword(password: string, hash: string): boolean {
  const salt = hash.split('$')[1] ?? '';
  return demoHash(password, salt) === hash;
}

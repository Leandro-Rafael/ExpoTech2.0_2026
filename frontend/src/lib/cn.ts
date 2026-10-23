import { clsx, type ClassValue } from 'clsx';

/** Junta classes condicionalmente (wrapper do clsx). */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

import { Check, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { passwordChecks, passwordStrength, strengthLabels } from '@/lib/validation';

const colors = ['bg-danger', 'bg-danger', 'bg-warning', 'bg-brand-400', 'bg-brand-300'];
const text = ['text-danger', 'text-danger', 'text-warning', 'text-brand-300', 'text-brand-300'];

/** Medidor de força + checklist da política de senha. */
export function PasswordStrength({ password, email, className }: { password: string; email?: string; className?: string }) {
  const level = passwordStrength(password, email);
  const checks = passwordChecks(password, email);
  const active = password.length > 0;
  return (
    <div className={cn('space-y-2.5', className)} aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={cn('h-1.5 flex-1 rounded-full transition-colors duration-300', active && i < Math.max(1, level) ? colors[level] : 'bg-white/8')} />
          ))}
        </div>
        <span className={cn('w-20 text-right font-mono text-[11px] uppercase', active ? text[level] : 'text-subtle')}>
          {active ? strengthLabels[level] : 'Força'}
        </span>
      </div>
      <ul className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
        {checks.map((c) => (
          <li key={c.id} className={cn('flex items-center gap-1.5 text-xs transition-colors', !active ? 'text-subtle' : c.ok ? 'text-brand-300' : 'text-muted')}>
            {active && c.ok ? <Check className="size-3.5" aria-hidden /> : <X className="size-3.5 opacity-60" aria-hidden />}
            <span>{c.label}</span>
            <span className="sr-only">{c.ok ? '(atendido)' : '(pendente)'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

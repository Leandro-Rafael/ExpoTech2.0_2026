import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, LogOut, Settings2, Sparkles } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { Avatar, Badge, toast } from '@/components/ui';
import { formatNumber } from '@/lib/format';
import { role as roleLabels } from '@/lib/labels';
import { cn } from '@/lib/cn';

/** Chip com saldo de pontos e nível. */
export function PointsChip({ className }: { className?: string }) {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div
      className={cn('flex h-9 items-center gap-2 rounded-full border border-lime-300/20 bg-lime-300/[0.06] pr-3 pl-1 text-sm', className)}
      title={`${formatNumber(user.points)} pontos disponíveis · nível ${user.level.name}`}
    >
      <span className="inline-flex size-7 items-center justify-center rounded-full bg-brand-gradient text-bg-deep">
        <Sparkles className="size-3.5" aria-hidden />
      </span>
      <span className="font-display font-semibold text-fg tabular">{formatNumber(user.points)}</span>
      <span className="text-xs text-muted">pts</span>
      <span aria-hidden className="mx-0.5 h-4 w-px bg-line-strong" />
      <span className="text-xs font-medium text-lime-200">{user.level.name}</span>
    </div>
  );
}

export function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); ref.current?.querySelector<HTMLButtonElement>('button')?.focus(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
        const i = items.indexOf(document.activeElement as HTMLElement);
        items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus(), 20);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); clearTimeout(t); };
  }, [open]);

  if (!user) return null;

  const go = (to: string) => { setOpen(false); navigate(to); };
  const doLogout = async () => {
    setOpen(false);
    await logout();
    toast.success('Você saiu da sua conta.');
    navigate('/entrar', { replace: true });
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        className="flex items-center gap-2 rounded-full p-0.5 pr-1.5 transition-colors hover:bg-white/5"
      >
        <Avatar name={user.name} size="sm" />
        <span className="sr-only">Menu do usuário</span>
        <ChevronDown aria-hidden className={cn('hidden size-4 text-muted transition-transform sm:block', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={menuId}
            role="menu"
            aria-label="Conta"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            className="glass-strong absolute top-full right-0 z-50 mt-2 w-72 origin-top-right overflow-hidden rounded-2xl p-1.5"
          >
            <div className="flex items-center gap-3 px-3 pt-2.5 pb-3">
              <Avatar name={user.name} size="md" />
              <div className="min-w-0">
                <p className="truncate font-medium text-fg">{user.name}</p>
                <p className="truncate text-xs text-muted">{user.email}</p>
                <Badge tone={roleLabels[user.role].tone} className="mt-1.5">{roleLabels[user.role].label}</Badge>
              </div>
            </div>
            <div className="hairline mb-1" />
            <button role="menuitem" type="button" onClick={() => go('/app/perfil')} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-fg-soft hover:bg-white/5 hover:text-fg focus-visible:bg-white/5">
              <Settings2 className="size-4 text-muted" aria-hidden /> Meu perfil
            </button>
            <button role="menuitem" type="button" onClick={doLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-danger hover:bg-danger/10 focus-visible:bg-danger/10">
              <LogOut className="size-4" aria-hidden /> Sair
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

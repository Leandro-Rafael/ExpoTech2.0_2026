import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, LogOut, Settings2, Sparkles } from 'lucide-react';
import { useAutenticacao } from '@/auth/AuthProvider';
import { Avatar, Etiqueta, toast } from '@/components/ui';
import { formatarNumero } from '@/lib/format';
import { perfil as roleLabels } from '@/lib/labels';
import { cn } from '@/lib/cn';

/** Chip com saldo de pontos e nível. */
export function ChipPontos({ className }: { className?: string }) {
  const { user: usuario } = useAutenticacao();
  if (!usuario) return null;
  return (
    <div
      className={cn('flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm', className)}
      title={`${formatarNumero(usuario.points)} pontos disponíveis · nível ${usuario.level.name}`}
    >
      <Sparkles className="size-3.5 text-brand-300" aria-hidden />
      <span className="font-mono text-[13px] font-medium text-fg tabular">{formatarNumero(usuario.points)}</span>
      <span className="font-mono text-[11px] text-subtle uppercase">pts</span>
      <span aria-hidden className="mx-0.5 h-4 w-px bg-line-strong" />
      <span className="text-xs text-fg-soft">{usuario.level.name}</span>
    </div>
  );
}

export function MenuUsuario() {
  const { user: usuario, logout: sair } = useAutenticacao();
  const navegar = useNavigate();
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const idMenu = useId();

  useEffect(() => {
    if (!aberto) return;
    const aoPressionar = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setAberto(false); };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setAberto(false); ref.current?.querySelector<HTMLButtonElement>('button')?.focus(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const itens = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
        const i = itens.indexOf(document.activeElement as HTMLElement);
        itens[(i + (e.key === 'ArrowDown' ? 1 : -1) + itens.length) % itens.length]?.focus();
      }
    };
    document.addEventListener('pointerdown', aoPressionar);
    document.addEventListener('keydown', aoTeclar);
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus(), 20);
    return () => { document.removeEventListener('pointerdown', aoPressionar); document.removeEventListener('keydown', aoTeclar); clearTimeout(t); };
  }, [aberto]);

  if (!usuario) return null;

  const irPara = (destino: string) => { setAberto(false); navegar(destino); };
  const sairDaConta = async () => {
    setAberto(false);
    await sair();
    toast.success('Você saiu da sua conta.');
    navegar('/entrar', { replace: true });
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={idMenu}
        className="flex items-center gap-2 rounded-full p-0.5 pr-1.5 transition-colors hover:bg-white/5"
      >
        <Avatar nome={usuario.name} size="sm" />
        <span className="sr-only">Menu do usuário</span>
        <ChevronDown aria-hidden className={cn('hidden size-4 text-muted transition-transform sm:block', aberto && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {aberto && (
          <motion.div
            id={idMenu}
            role="menu"
            aria-label="Conta"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            className="glass-strong absolute top-full right-0 z-50 mt-2 w-72 origin-top-right overflow-hidden rounded-2xl p-1.5"
          >
            <div className="flex items-center gap-3 px-3 pt-2.5 pb-3">
              <Avatar nome={usuario.name} size="md" />
              <div className="min-w-0">
                <p className="truncate font-medium text-fg">{usuario.name}</p>
                <p className="truncate text-xs text-muted">{usuario.email}</p>
                <Etiqueta tone={roleLabels[usuario.role].tone} className="mt-1.5">{roleLabels[usuario.role].label}</Etiqueta>
              </div>
            </div>
            <div className="hairline mb-1" />
            <button role="menuitem" type="button" onClick={() => irPara('/app/perfil')} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-fg-soft hover:bg-white/5 hover:text-fg focus-visible:bg-white/5">
              <Settings2 className="size-4 text-muted" aria-hidden /> Meu perfil
            </button>
            <button role="menuitem" type="button" onClick={sairDaConta} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-danger hover:bg-danger/10 focus-visible:bg-danger/10">
              <LogOut className="size-4" aria-hidden /> Sair
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

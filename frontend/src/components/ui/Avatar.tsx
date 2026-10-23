import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';

const palettes = [
  ['#059669', '#bef264'], ['#0ea5e9', '#34d399'], ['#10b981', '#facc15'],
  ['#14b8a6', '#a3e635'], ['#22c55e', '#38bdf8'], ['#65a30d', '#fde047'],
];

function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

export interface AvatarProps { name: string | null | undefined; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; className?: string; ring?: boolean }
const sizes = { xs: 'size-6 text-[10px]', sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-lg', xl: 'size-20 text-2xl' };

/** Avatar com iniciais e gradiente determinístico pelo nome. */
export function Avatar({ name, size = 'md', className, ring }: AvatarProps) {
  const [a, b] = palettes[hash(name ?? '') % palettes.length];
  return (
    <span
      aria-hidden
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold text-bg-deep select-none', sizes[size], ring && 'ring-2 ring-bg ring-offset-2 ring-offset-brand-400/60', className)}
      style={{ backgroundImage: `linear-gradient(135deg, ${a}, ${b})` }}
    >
      {initials(name)}
    </span>
  );
}

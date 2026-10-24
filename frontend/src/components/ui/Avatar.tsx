import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';

// Tons sóbrios (fundo escuro tingido + texto claro): identificam sem competir com o acento.
const palettes = ['#1f3a2e', '#2b3324', '#1d3340', '#3a3124', '#2c2d3b', '#343026'];

function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

export interface AvatarProps { name: string | null | undefined; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; className?: string; ring?: boolean }
const sizes = { xs: 'size-6 text-[10px]', sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-lg', xl: 'size-20 text-2xl' };

/** Avatar com iniciais e gradiente determinístico pelo nome. */
export function Avatar({ name, size = 'md', className, ring }: AvatarProps) {
  const bg = palettes[hash(name ?? '') % palettes.length];
  return (
    <span
      aria-hidden
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full border border-line font-medium text-fg-soft select-none', sizes[size], ring && 'ring-2 ring-line-strong ring-offset-2 ring-offset-bg', className)}
      style={{ backgroundColor: bg }}
    >
      {initials(name)}
    </span>
  );
}

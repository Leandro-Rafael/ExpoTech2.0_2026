import { useId } from 'react';
import { cn } from '@/lib/cn';

/** Marca (anel + folha) inline — herda as fontes e escala sem perda. */
export function MarcaLogo({ size = 36, className, girar = false }: { size?: number; className?: string; girar?: boolean }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}r`} x1="8" y1="56" x2="56" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#059669" /><stop offset=".55" stopColor="#22c55e" /><stop offset="1" stopColor="#bef264" />
        </linearGradient>
        <linearGradient id={`${id}l`} x1="20" y1="46" x2="46" y2="18" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#10b981" /><stop offset="1" stopColor="#d9f99d" />
        </linearGradient>
      </defs>
      <g className={cn(girar && 'origin-center animate-spin-slow')} style={girar ? { transformBox: 'fill-box' } : undefined}>
        <path d="M48.7 12.1A26 26 0 1 1 27.5 6.4" stroke={`url(#${id}r)`} strokeWidth="5.5" strokeLinecap="round" />
        <path d="M33.9 5.3 26.6 1.9l1 8.6z" fill="#bef264" />
      </g>
      <g transform="matrix(1.12 0 0 1.12 -3.84 -3.84)">
        <path d="M19 45C19 29.5 29 19 46 18.5 46 35 35.5 45 19 45Z" fill={`url(#${id}l)`} />
        <g stroke="#04140d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.5 42.5 39 25" /><path d="M28 36h7.5" /><path d="M33 31v-6" />
        </g>
        <circle cx="37.2" cy="36" r="2" fill="#04140d" />
        <circle cx="33" cy="23.2" r="2" fill="#04140d" />
        <circle cx="40.6" cy="23.4" r="2" fill="#04140d" />
      </g>
    </svg>
  );
}

export interface PropsLogo {
  /** compact: só "EcoTech ZERO"; full: com tagline. */
  variant?: 'compact' | 'full' | 'mark';
  size?: number;
  className?: string;
  /** Mostra "Lixo Zero 2050" como subtítulo (app). */
  produto?: boolean;
}

/** Logo EcoTech Zero (marca + wordmark). */
export function Logo({ variant = 'compact', size = 36, className, produto }: PropsLogo) {
  if (variant === 'mark') return <MarcaLogo size={size} className={className} />;
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)} aria-label="EcoTech Zero" role="img">
      <MarcaLogo size={size} className="shrink-0" />
      <span className="flex flex-col leading-none" aria-hidden>
        <span className="font-logo font-bold tracking-tight" style={{ fontSize: size * 0.5 }}>
          <span style={{ backgroundImage: 'linear-gradient(90deg,#34d399,#bef264)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Eco</span><span className="text-fg">Tech</span>
          <span className="ml-1.5 align-middle font-logo text-[0.52em] font-semibold tracking-[0.32em] text-fg-soft">ZERO</span>
        </span>
        {variant === 'full' && (
          <span className="mt-1 text-[9px] font-medium tracking-[0.18em] text-muted uppercase">Tecnologia para um mundo sem desperdício</span>
        )}
        {produto && variant !== 'full' && (
          <span className="mt-1 text-[10px] font-medium tracking-[0.16em] text-muted uppercase">Lixo Zero 2050</span>
        )}
      </span>
    </span>
  );
}

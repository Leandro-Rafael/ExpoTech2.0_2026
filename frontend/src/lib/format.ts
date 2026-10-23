/**
 * Formatadores pt-BR. Sempre use estes helpers na UI (nunca toFixed direto),
 * para manter vírgula decimal, separador de milhar e unidades consistentes.
 */
const LOCALE = 'pt-BR';

const intFmt = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const compactFmt = new Intl.NumberFormat(LOCALE, { notation: 'compact', maximumFractionDigits: 1 });

export function formatNumber(value: number | null | undefined, maxFractionDigits = 0): string {
  if (value == null || Number.isNaN(value)) return '—';
  if (maxFractionDigits === 0) return intFmt.format(value);
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: maxFractionDigits }).format(value);
}

/** 1234567 → "1,2 mi" */
export function formatCompact(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return compactFmt.format(value);
}

/** Peso em kg; acima de 1000 kg vira toneladas. */
export function formatKg(value: number | null | undefined, opts: { tons?: boolean; digits?: number } = {}): string {
  if (value == null || Number.isNaN(value)) return '—';
  const { tons = true, digits } = opts;
  if (tons && Math.abs(value) >= 1000) {
    return `${formatNumber(value / 1000, digits ?? 1)} t`;
  }
  return `${formatNumber(value, digits ?? (Math.abs(value) < 10 ? 2 : 1))} kg`;
}

export function formatTons(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${formatNumber(value, digits)} t`;
}

/** Fração 0..1 → "42,5%" */
export function formatPercent(fraction: number | null | undefined, digits = 0): string {
  if (fraction == null || Number.isNaN(fraction)) return '—';
  return new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: digits }).format(fraction);
}

export function formatPoints(value: number | null | undefined): string {
  if (value == null) return '—';
  return `${formatNumber(value)} pts`;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatDistanceKm(km: number | null | undefined): string {
  if (km == null) return '—';
  if (km < 1) return `${formatNumber(km * 1000)} m`;
  return `${formatNumber(km, 1)} km`;
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${formatNumber(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

function toDate(input: string | Date): Date {
  if (input instanceof Date) return input;
  // "YYYY-MM-DD" deve ser interpretado como data local (não UTC)
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(input);
}

const dateFmt = new Intl.DateTimeFormat(LOCALE, { day: '2-digit', month: 'short', year: 'numeric' });
const dateShortFmt = new Intl.DateTimeFormat(LOCALE, { day: '2-digit', month: '2-digit' });
const dateTimeFmt = new Intl.DateTimeFormat(LOCALE, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const monthFmt = new Intl.DateTimeFormat(LOCALE, { month: 'short', year: '2-digit' });

/** "23 de out. de 2026" */
export function formatDate(input: string | Date | null | undefined): string {
  if (!input) return '—';
  return dateFmt.format(toDate(input));
}
/** "23/10" */
export function formatDateShort(input: string | Date | null | undefined): string {
  if (!input) return '—';
  return dateShortFmt.format(toDate(input));
}
/** "23 de out. de 2026, 14:00" */
export function formatDateTime(input: string | Date | null | undefined): string {
  if (!input) return '—';
  return dateTimeFmt.format(toDate(input));
}
/** "2026-01" → "jan. 26" */
export function formatMonth(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  return monthFmt.format(new Date(y, (m || 1) - 1, 1)).replace(' de ', ' ');
}

const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1],
];
/** "há 5 minutos", "ontem", "em 2 dias" */
export function formatRelative(input: string | Date | null | undefined, now: Date = new Date()): string {
  if (!input) return '—';
  const diffSec = (toDate(input).getTime() - now.getTime()) / 1000;
  const abs = Math.abs(diffSec);
  if (abs < 30) return 'agora mesmo';
  for (const [unit, sec] of UNITS) {
    if (abs >= sec || unit === 'second') return rtf.format(Math.round(diffSec / sec), unit);
  }
  return formatDate(input);
}

/** Data local de hoje em "YYYY-MM-DD" (para inputs type=date). */
export function todayISODate(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Iniciais para avatar: "Maria da Silva" → "MS" */
export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter((p) => p.length > 2 || /^[A-ZÀ-Ý]/.test(p));
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '?';
}

export function pluralize(n: number, singular: string, plural: string): string {
  return `${formatNumber(n)} ${n === 1 ? singular : plural}`;
}

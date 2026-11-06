/**
 * Formatadores pt-BR. Sempre use estes helpers na UI (nunca toFixed direto),
 * para manter vírgula decimal, separador de milhar e unidades consistentes.
 */
const LOCALIDADE = 'pt-BR';

const formatoInteiro = new Intl.NumberFormat(LOCALIDADE, { maximumFractionDigits: 0 });
const formatoCompacto = new Intl.NumberFormat(LOCALIDADE, { notation: 'compact', maximumFractionDigits: 1 });

export function formatarNumero(valor: number | null | undefined, maxCasasDecimais = 0): string {
  if (valor == null || Number.isNaN(valor)) return '—';
  if (maxCasasDecimais === 0) return formatoInteiro.format(valor);
  return new Intl.NumberFormat(LOCALIDADE, { maximumFractionDigits: maxCasasDecimais }).format(valor);
}

/** 1234567 → "1,2 mi" */
export function formatarCompacto(valor: number | null | undefined): string {
  if (valor == null || Number.isNaN(valor)) return '—';
  return formatoCompacto.format(valor);
}

/** Peso em kg; acima de 1000 kg vira toneladas. */
export function formatarKg(valor: number | null | undefined, opcoes: { tons?: boolean; digits?: number } = {}): string {
  if (valor == null || Number.isNaN(valor)) return '—';
  const { tons = true, digits } = opcoes;
  if (tons && Math.abs(valor) >= 1000) {
    return `${formatarNumero(valor / 1000, digits ?? 1)} t`;
  }
  return `${formatarNumero(valor, digits ?? (Math.abs(valor) < 10 ? 2 : 1))} kg`;
}

/** Fração 0..1 → "42,5%" */
export function formatarPercentual(fracao: number | null | undefined, casas = 0): string {
  if (fracao == null || Number.isNaN(fracao)) return '—';
  return new Intl.NumberFormat(LOCALIDADE, { style: 'percent', maximumFractionDigits: casas }).format(fracao);
}

export function formatarPontos(valor: number | null | undefined): string {
  if (valor == null) return '—';
  return `${formatarNumero(valor)} pts`;
}

export function formatarDistanciaKm(km: number | null | undefined): string {
  if (km == null) return '—';
  if (km < 1) return `${formatarNumero(km * 1000)} m`;
  return `${formatarNumero(km, 1)} km`;
}

export function formatarMinutos(minutos: number): string {
  if (minutos < 60) return `${formatarNumero(minutos)} min`;
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

function paraData(entrada: string | Date): Date {
  if (entrada instanceof Date) return entrada;
  // "YYYY-MM-DD" deve ser interpretado como data local (não UTC)
  if (/^\d{4}-\d{2}-\d{2}$/.test(entrada)) {
    const [y, m, d] = entrada.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(entrada);
}

const formatoData = new Intl.DateTimeFormat(LOCALIDADE, { day: '2-digit', month: 'short', year: 'numeric' });
const formatoDataCurta = new Intl.DateTimeFormat(LOCALIDADE, { day: '2-digit', month: '2-digit' });
const formatoDataHora = new Intl.DateTimeFormat(LOCALIDADE, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const formatoMes = new Intl.DateTimeFormat(LOCALIDADE, { month: 'short', year: '2-digit' });

/** "23 de out. de 2026" */
export function formatarData(entrada: string | Date | null | undefined): string {
  if (!entrada) return '—';
  return formatoData.format(paraData(entrada));
}
/** "23/10" */
export function formatarDataCurta(entrada: string | Date | null | undefined): string {
  if (!entrada) return '—';
  return formatoDataCurta.format(paraData(entrada));
}
/** "23 de out. de 2026, 14:00" */
export function formatarDataHora(entrada: string | Date | null | undefined): string {
  if (!entrada) return '—';
  return formatoDataHora.format(paraData(entrada));
}
/** "2026-01" → "jan. 26" */
export function formatarMes(anoMes: string): string {
  const [y, m] = anoMes.split('-').map(Number);
  return formatoMes.format(new Date(y, (m || 1) - 1, 1)).replace(' de ', ' ');
}

const formatoRelativo = new Intl.RelativeTimeFormat(LOCALIDADE, { numeric: 'auto' });
const UNIDADES: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1],
];
/** "há 5 minutos", "ontem", "em 2 dias" */
export function formatarRelativo(entrada: string | Date | null | undefined, agora: Date = new Date()): string {
  if (!entrada) return '—';
  const diferencaSeg = (paraData(entrada).getTime() - agora.getTime()) / 1000;
  const absoluto = Math.abs(diferencaSeg);
  if (absoluto < 30) return 'agora mesmo';
  for (const [unidade, segundos] of UNIDADES) {
    if (absoluto >= segundos || unidade === 'second') return formatoRelativo.format(Math.round(diferencaSeg / segundos), unidade);
  }
  return formatarData(entrada);
}

/** Data local de hoje em "YYYY-MM-DD" (para inputs type=date). */
export function dataHojeISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Iniciais para avatar: "Maria da Silva" → "MS" */
export function iniciais(nome: string | null | undefined): string {
  if (!nome) return '?';
  const partes = nome.trim().split(/\s+/).filter((p) => p.length > 2 || /^[A-ZÀ-Ý]/.test(p));
  const primeira = partes[0]?.[0] ?? '';
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primeira + ultima).toUpperCase() || '?';
}


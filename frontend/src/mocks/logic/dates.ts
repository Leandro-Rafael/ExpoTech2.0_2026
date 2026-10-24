/** Datas no fuso de São Paulo (como o back-end, `app.zone`). */
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });

/** "YYYY-MM-DD" no fuso local da aplicação. */
export function localDate(iso: string | Date): string {
  return dayFmt.format(typeof iso === 'string' ? new Date(iso) : iso);
}

/** "YYYY-MM" no fuso local da aplicação. */
export function localMonth(iso: string | Date): string {
  return localDate(iso).slice(0, 7);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const HOUR = 3600_000;
export const DAY = 24 * HOUR;

export function isoMinus(base: Date, ms: number): string {
  return new Date(base.getTime() - ms).toISOString();
}

/** Datas no fuso de São Paulo (como o back-end, `app.zone`). */
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });

/** "YYYY-MM-DD" no fuso local da aplicação. */
const memo = new Map<string, string>();
export function localDate(iso: string | Date): string {
  if (typeof iso !== 'string') return dayFmt.format(iso);
  let v = memo.get(iso);
  if (v === undefined) {
    v = dayFmt.format(new Date(iso)); // Intl é lento: memoriza (as datas dos registros se repetem muito)
    if (memo.size > 20_000) memo.clear();
    memo.set(iso, v);
  }
  return v;
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


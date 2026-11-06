/** Datas no fuso de São Paulo (como o back-end, `app.zone`). */
const formatoDia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });

/** "YYYY-MM-DD" no fuso local da aplicação. */
const cache = new Map<string, string>();
export function dataLocal(iso: string | Date): string {
  if (typeof iso !== 'string') return formatoDia.format(iso);
  let v = cache.get(iso);
  if (v === undefined) {
    v = formatoDia.format(new Date(iso)); // Intl é lento: memoriza (as datas dos registros se repetem muito)
    if (cache.size > 20_000) cache.clear();
    cache.set(iso, v);
  }
  return v;
}

/** "YYYY-MM" no fuso local da aplicação. */
export function mesLocal(iso: string | Date): string {
  return dataLocal(iso).slice(0, 7);
}

export function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export const HORA = 3600_000;
export const DIA = 24 * HORA;


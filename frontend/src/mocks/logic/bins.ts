/**
 * Lixeiras inteligentes simuladas: o nível sobe devagar com o tempo (calculado a partir dos timestamps,
 * uma leitura a cada 30 min) e, ao cruzar o limite, abre automaticamente uma solicitação de coleta SMART_BIN.
 */
import type { CategoryCode, SmartBinStatus } from '@/api/types';
import type { CollectionRequestRec, MockDb, SmartBinRec } from '../db';
import { audit } from './audit';
import { round } from './random';

const READING_INTERVAL_MS = 30 * 60_000;
const OFFLINE_AFTER_MS = 6 * 3600_000;
const MAX_READINGS = 48;
const DENSITY_KG_PER_LITER: Record<CategoryCode, number> = {
  PLASTICO: 0.04, PAPEL: 0.08, VIDRO: 0.3, METAL: 0.06, ORGANICO: 0.45, ELETRONICO: 0.25, REJEITO: 0.15,
};
export const OPEN_REQUEST: CollectionRequestRec['status'][] = ['REQUESTED', 'SCHEDULED', 'IN_ROUTE'];

export function binStatus(b: SmartBinRec, now = Date.now()): SmartBinStatus {
  if (!b.lastReadingAt || Date.parse(b.lastReadingAt) + OFFLINE_AFTER_MS < now) return 'OFFLINE';
  if (b.fillLevel >= 90) return 'FULL';
  if (b.fillLevel >= Math.min(b.autoRequestThreshold, 75) || b.batteryLevel <= 15) return 'ATTENTION';
  return 'OK';
}

/** Aplica uma leitura (do sensor simulado ou de POST /api/iot/readings). */
export function recordReading(d: MockDb, bin: SmartBinRec, fillLevel: number, batteryLevel: number, at: string) {
  bin.fillLevel = Math.max(0, Math.min(100, fillLevel));
  bin.batteryLevel = Math.max(0, Math.min(100, batteryLevel));
  bin.lastReadingAt = at;
  bin.readings.push({ fillLevel: Math.round(bin.fillLevel), batteryLevel: Math.round(bin.batteryLevel), at });
  if (bin.readings.length > MAX_READINGS) bin.readings.splice(0, bin.readings.length - MAX_READINGS);
  if (bin.fillLevel >= bin.autoRequestThreshold
    && !d.collectionRequests.some((r) => r.smartBinId === bin.id && OPEN_REQUEST.includes(r.status))) {
    openAutomaticRequest(d, bin, at);
  }
}

export function openAutomaticRequest(d: MockDb, bin: SmartBinRec, at: string) {
  const household = d.households.find((h) => h.id === bin.householdId);
  const category = d.categories.find((c) => c.id === bin.categoryId);
  if (!household || !category) return;
  const fill = Math.round(bin.fillLevel);
  const kg = Math.max(0.5, bin.capacityLiters * (fill / 100) * DENSITY_KG_PER_LITER[category.code]);
  d.collectionRequests.push({
    id: crypto.randomUUID(),
    address: household.address || `Residência ${household.name} – ${household.neighborhood}, ${household.city}`,
    latitude: household.latitude,
    longitude: household.longitude,
    categoryCodes: [category.code],
    estimatedKg: round(kg),
    status: 'REQUESTED',
    source: 'SMART_BIN',
    preferredDate: null,
    scheduledFor: null,
    routeId: null,
    notes: `Solicitação automática: a lixeira "${bin.name}" atingiu ${fill}%.`,
    createdAt: at,
    updatedAt: at,
    requesterId: household.ownerId,
    smartBinId: bin.id,
  });
  audit(d, 'sistema', 'SMART_BIN_AUTO_REQUEST', 'SmartBin', bin.id, `nível ${fill}%`, at, null);
}

/** Avança a simulação de todas as lixeiras até `now`. Retorna true se algo mudou. */
export function tickBins(d: MockDb, now = Date.now()): boolean {
  let changed = false;
  for (const bin of d.bins) {
    if (bin.fillRatePerHour <= 0 || !bin.lastReadingAt) continue;
    let last = Date.parse(bin.lastReadingAt);
    // lacunas muito grandes (aba fechada por dias): pula direto para as últimas leituras
    const steps = Math.floor((now - last) / READING_INTERVAL_MS);
    if (steps <= 0) continue;
    if (steps > MAX_READINGS) last += (steps - MAX_READINGS) * READING_INTERVAL_MS;
    const hoursPerStep = READING_INTERVAL_MS / 3600_000;
    while (last + READING_INTERVAL_MS <= now) {
      last += READING_INTERVAL_MS;
      const wobble = Math.sin(last / 3_600_000) * 0.15;
      const fill = Math.min(100, bin.fillLevel + bin.fillRatePerHour * hoursPerStep * (1 + wobble));
      const battery = Math.max(5, bin.batteryLevel - 0.04);
      recordReading(d, bin, fill, battery, new Date(last).toISOString());
      changed = true;
    }
  }
  return changed;
}

/** Após a coleta a lixeira volta a 0%. */
export function emptyBin(d: MockDb, binId: string, at: string) {
  const bin = d.bins.find((b) => b.id === binId);
  if (bin) recordReading(d, bin, 0, bin.batteryLevel, at);
}

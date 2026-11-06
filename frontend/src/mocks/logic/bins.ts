/**
 * Lixeiras inteligentes simuladas: o nível sobe devagar com o tempo (calculado a partir dos timestamps,
 * uma leitura a cada 30 min) e, ao cruzar o limite, abre automaticamente uma solicitação de coleta SMART_BIN.
 */
import type { CategoryCode, SmartBinStatus } from '@/api/types';
import type { RegistroSolicitacaoColeta, BancoSimulado, RegistroLixeira } from '../db';
import { registrarAuditoria } from './audit';
import { arredondar } from './random';

const INTERVALO_LEITURA_MS = 30 * 60_000;
const OFFLINE_APOS_MS = 6 * 3600_000;
const MAX_LEITURAS = 48;
const DENSIDADE_KG_POR_LITRO: Record<CategoryCode, number> = {
  PLASTICO: 0.04, PAPEL: 0.08, VIDRO: 0.3, METAL: 0.06, ORGANICO: 0.45, ELETRONICO: 0.25, REJEITO: 0.15,
};
export const SOLICITACAO_ABERTA: RegistroSolicitacaoColeta['status'][] = ['REQUESTED', 'SCHEDULED', 'IN_ROUTE'];

export function statusLixeira(b: RegistroLixeira, agora = Date.now()): SmartBinStatus {
  if (!b.lastReadingAt || Date.parse(b.lastReadingAt) + OFFLINE_APOS_MS < agora) return 'OFFLINE';
  if (b.fillLevel >= 90) return 'FULL';
  if (b.fillLevel >= Math.min(b.autoRequestThreshold, 75) || b.batteryLevel <= 15) return 'ATTENTION';
  return 'OK';
}

/** Aplica uma leitura (do sensor simulado ou de POST /api/iot/readings). */
export function registrarLeitura(d: BancoSimulado, lixeira: RegistroLixeira, nivel: number, nivelBateria: number, quando: string) {
  lixeira.fillLevel = Math.max(0, Math.min(100, nivel));
  lixeira.batteryLevel = Math.max(0, Math.min(100, nivelBateria));
  lixeira.lastReadingAt = quando;
  lixeira.readings.push({ fillLevel: Math.round(lixeira.fillLevel), batteryLevel: Math.round(lixeira.batteryLevel), at: quando });
  if (lixeira.readings.length > MAX_LEITURAS) lixeira.readings.splice(0, lixeira.readings.length - MAX_LEITURAS);
  if (lixeira.fillLevel >= lixeira.autoRequestThreshold
    && !d.collectionRequests.some((r) => r.smartBinId === lixeira.id && SOLICITACAO_ABERTA.includes(r.status))) {
    abrirSolicitacaoAutomatica(d, lixeira, quando);
  }
}

export function abrirSolicitacaoAutomatica(d: BancoSimulado, lixeira: RegistroLixeira, quando: string) {
  const residencia = d.households.find((h) => h.id === lixeira.householdId);
  const categoria = d.categories.find((c) => c.id === lixeira.categoryId);
  if (!residencia || !categoria) return;
  const nivel = Math.round(lixeira.fillLevel);
  const kg = Math.max(0.5, lixeira.capacityLiters * (nivel / 100) * DENSIDADE_KG_POR_LITRO[categoria.code]);
  d.collectionRequests.push({
    id: crypto.randomUUID(),
    address: residencia.address || `Residência ${residencia.name} – ${residencia.neighborhood}, ${residencia.city}`,
    latitude: residencia.latitude,
    longitude: residencia.longitude,
    categoryCodes: [categoria.code],
    estimatedKg: arredondar(kg),
    status: 'REQUESTED',
    source: 'SMART_BIN',
    preferredDate: null,
    scheduledFor: null,
    routeId: null,
    notes: `Solicitação automática: a lixeira "${lixeira.name}" atingiu ${nivel}%.`,
    createdAt: quando,
    updatedAt: quando,
    requesterId: residencia.ownerId,
    smartBinId: lixeira.id,
  });
  registrarAuditoria(d, 'sistema', 'SMART_BIN_AUTO_REQUEST', 'SmartBin', lixeira.id, `nível ${nivel}%`, quando, null);
}

/** Avança a simulação de todas as lixeiras até `now`. Retorna true se algo mudou. */
export function avancarLixeiras(d: BancoSimulado, agora = Date.now()): boolean {
  let mudou = false;
  for (const lixeira of d.bins) {
    if (lixeira.fillRatePerHour <= 0 || !lixeira.lastReadingAt) continue;
    let ultimo = Date.parse(lixeira.lastReadingAt);
    // lacunas muito grandes (aba fechada por dias): pula direto para as últimas leituras
    const passos = Math.floor((agora - ultimo) / INTERVALO_LEITURA_MS);
    if (passos <= 0) continue;
    if (passos > MAX_LEITURAS) ultimo += (passos - MAX_LEITURAS) * INTERVALO_LEITURA_MS;
    const horasPorPasso = INTERVALO_LEITURA_MS / 3600_000;
    while (ultimo + INTERVALO_LEITURA_MS <= agora) {
      ultimo += INTERVALO_LEITURA_MS;
      const oscilacao = Math.sin(ultimo / 3_600_000) * 0.15;
      const nivel = Math.min(100, lixeira.fillLevel + lixeira.fillRatePerHour * horasPorPasso * (1 + oscilacao));
      const bateria = Math.max(5, lixeira.batteryLevel - 0.04);
      registrarLeitura(d, lixeira, nivel, bateria, new Date(ultimo).toISOString());
      mudou = true;
    }
  }
  return mudou;
}

/** Após a coleta a lixeira volta a 0%. */
export function esvaziarLixeira(d: BancoSimulado, idLixeira: string, quando: string) {
  const lixeira = d.bins.find((b) => b.id === idLixeira);
  if (lixeira) registrarLeitura(d, lixeira, 0, lixeira.batteryLevel, quando);
}

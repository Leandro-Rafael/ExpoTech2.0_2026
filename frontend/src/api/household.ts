import { api } from './client';
import type { Household, SmartBin, SmartBinCreated, UUID } from './types';

export interface CreateHouseholdInput { name: string; neighborhood: string; city: string }
export interface CreateBinInput { name: string; categoryId: UUID; capacityLiters: number; autoRequestThreshold: number }

/** Residência (Smart Home) e lixeiras inteligentes. */
export const householdApi = {
  /** Retorna `null` quando o usuário não tem residência (API responde 204). */
  get: async (): Promise<Household | null> => (await api.get<Household | undefined>('/household')) ?? null,
  create: (body: CreateHouseholdInput) => api.post<Household>('/household', body),
  join: (inviteCode: string) => api.post<Household>('/household/join', { inviteCode }),
  leave: () => api.post<void>('/household/leave'),
  bins: () => api.get<SmartBin[]>('/household/bins'),
  createBin: (body: CreateBinInput) => api.post<SmartBinCreated>('/household/bins', body),
  deleteBin: (id: UUID) => api.delete(`/household/bins/${id}`),
  /**
   * Simula um dispositivo IoT enviando leitura (útil para a demo).
   * Usa as credenciais exibidas uma única vez em SmartBinCreated.
   */
  sendReading: (device: { deviceId: string; deviceKey: string }, reading: { fillLevel: number; batteryLevel: number }) =>
    api.post<void>('/iot/readings', reading, {
      headers: { 'X-Device-Id': device.deviceId, 'X-Device-Key': device.deviceKey },
      skipRefresh: true,
      silent401: true,
    }),
};

import { api } from './client';
import type { Household, SmartBin, SmartBinCreated, UUID } from './types';

export interface EntradaCriarResidencia {
  name: string; neighborhood: string; city: string;
  /** Opcionais: usados nas coletas automáticas das lixeiras inteligentes. */
  address?: string | null; latitude?: number | null; longitude?: number | null;
}
export interface EntradaCriarLixeira { name: string; categoryId: UUID; capacityLiters: number; autoRequestThreshold: number }

/** Residência (Smart Home) e lixeiras inteligentes. */
export const apiResidencia = {
  /** Retorna `null` quando o usuário não tem residência (API responde 204). */
  obter: async (): Promise<Household | null> => (await api.get<Household | undefined>('/household')) ?? null,
  criar: (body: EntradaCriarResidencia) => api.post<Household>('/household', body),
  entrar: (codigoConvite: string) => api.post<Household>('/household/join', { inviteCode: codigoConvite }),
  sair: () => api.post<void>('/household/leave'),
  lixeiras: () => api.get<SmartBin[]>('/household/bins'),
  criarLixeira: (body: EntradaCriarLixeira) => api.post<SmartBinCreated>('/household/bins', body),
  excluirLixeira: (id: UUID) => api.delete(`/household/bins/${id}`),
  /**
   * Simula um dispositivo IoT enviando leitura (útil para a demo).
   * Usa as credenciais exibidas uma única vez em SmartBinCreated.
   */
  enviarLeitura: (dispositivo: { deviceId: string; deviceKey: string }, leitura: { fillLevel: number; batteryLevel: number }) =>
    api.post<void>('/iot/readings', leitura, {
      headers: { 'X-Device-Id': dispositivo.deviceId, 'X-Device-Key': dispositivo.deviceKey },
      skipRefresh: true,
      silent401: true,
    }),
};

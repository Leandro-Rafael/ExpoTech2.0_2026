/**
 * Segurança: aviso de inspeção (morador/qualquer perfil), desbloqueio de conta e verificação de
 * integridade dos dados (admin). Hooks prontos para as páginas do painel:
 *
 *   const unlock = useUnlockUser();       unlock.mutate(user.id)
 *   const integrity = useIntegrityReport(); integrity.refetch()   // "Verificar agora"
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { AdminUser, InspectionEventResult, InspectionTrigger, IntegrityReport, UUID } from './types';

export const securityApi = {
  /** POST /security/inspection-events — o servidor conta avisos e bloqueia no 3º. */
  reportInspection: (trigger: InspectionTrigger) =>
    api.post<InspectionEventResult>('/security/inspection-events', { trigger }),
  /** POST /admin/users/{id}/unlock — limpa bloqueio por senha e por inspeção (e os avisos). */
  unlockUser: (id: UUID) => api.post<AdminUser>(`/admin/users/${encodeURIComponent(id)}/unlock`),
  /** GET /admin/integrity — verifica a cadeia HMAC do extrato/auditoria e os saldos. */
  integrity: () => api.get<IntegrityReport>('/admin/integrity'),
};

export const securityKeys = {
  integrity: ['admin', 'integrity'] as const,
};

/** Desbloqueia um usuário e atualiza a lista de usuários do admin. */
export function useUnlockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: UUID) => securityApi.unlockUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

/**
 * Relatório de integridade. A verificação percorre todo o extrato (é limitada por rate limit no
 * servidor), então só roda quando pedida: `enabled: false` por padrão e `refetch()` no botão.
 */
export function useIntegrityReport(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: securityKeys.integrity,
    queryFn: securityApi.integrity,
    enabled: opts.enabled ?? false,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

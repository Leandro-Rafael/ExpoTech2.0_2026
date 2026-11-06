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

export const apiSeguranca = {
  /** POST /security/inspection-events — o servidor conta avisos e bloqueia no 3º. */
  reportarInspecao: (gatilho: InspectionTrigger) =>
    api.post<InspectionEventResult>('/security/inspection-events', { trigger: gatilho }),
  /** POST /admin/users/{id}/unlock — limpa bloqueio por senha e por inspeção (e os avisos). */
  desbloquearUsuario: (id: UUID) => api.post<AdminUser>(`/admin/users/${encodeURIComponent(id)}/unlock`),
  /** GET /admin/integrity — verifica a cadeia HMAC do extrato/auditoria e os saldos. */
  integridade: () => api.get<IntegrityReport>('/admin/integrity'),
};

const chavesSeguranca = {
  integrity: ['admin', 'integrity'] as const,
};

/** Desbloqueia um usuário e atualiza a lista de usuários do admin. */
export function useDesbloquearUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: UUID) => apiSeguranca.desbloquearUsuario(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

/**
 * Relatório de integridade. A verificação percorre todo o extrato (é limitada por rate limit no
 * servidor), então só roda quando pedida: `enabled: false` por padrão e `refetch()` no botão.
 */
export function useRelatorioIntegridade(opcoes: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: chavesSeguranca.integrity,
    queryFn: apiSeguranca.integridade,
    enabled: opcoes.enabled ?? false,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

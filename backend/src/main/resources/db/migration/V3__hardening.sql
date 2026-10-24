-- =====================================================================
-- Endurecimento (auditoria de segurança): integridade extra e índices
-- para as consultas mais frequentes.
-- =====================================================================

-- Uma solicitação de coleta só pode ser parada de UMA rota (além da trava pessimista no serviço)
create unique index ux_route_stops_request on route_stops (request_id);

-- Regras antifraude (limite diário, deslocamento impossível) e desafios filtram por usuário + data do descarte
create index ix_disposals_user_disposed on disposals (user_id, disposed_at desc);

-- Fotos por dono (exclusão em cascata e checagem de dono)
create index ix_photos_owner on photos (owner_id);

-- Limpeza diária de refresh tokens expirados
create index ix_refresh_tokens_expires on refresh_tokens (expires_at);

-- Paradas/solicitações por rota (cancelamento e "on delete set null")
create index ix_collection_requests_route on collection_requests (route_id) where route_id is not null;

-- Lixeiras simuladas (consultadas pelo simulador IoT a cada ciclo)
create index ix_smart_bins_simulated on smart_bins (id) where simulated;

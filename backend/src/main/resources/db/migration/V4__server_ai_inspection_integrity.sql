-- =====================================================================
-- Blindagem: IA verificada no servidor, bloqueio por inspeção e colunas
-- da cadeia de integridade (preenchidas pela migração V5, em Java).
-- =====================================================================

-- ---------- IA verificada no servidor ----------
-- A foto guarda a classificação feita pelo PRÓPRIO servidor (modelo e data). Só ela vale para o bônus.
alter table photos
    add column ai_model         varchar(60),
    add column ai_classified_at timestamptz;

-- No descarte: ai_* = sugestão exibida (do servidor quando ai_verified; senão o palpite do cliente).
-- client_ai_* = palpite enviado pelo navegador, guardado só como informação (nunca conta pontos).
alter table disposals
    add column ai_verified          boolean not null default false,
    add column client_ai_code       varchar(20),
    add column client_ai_confidence numeric(4, 3) check (client_ai_confidence between 0 and 1),
    add column client_ai_source     varchar(10);

update disposals set ai_verified = true where ai_source = 'CLAUDE' and ai_suggested_code is not null;
update disposals set client_ai_code = ai_suggested_code, client_ai_confidence = ai_confidence, client_ai_source = ai_source
    where ai_source is not null and ai_source <> 'CLAUDE';

-- ---------- Dissuasão de inspeção (avisos e bloqueio de 30 min) ----------
alter table users
    add column security_warnings      integer not null default 0 check (security_warnings between 0 and 3),
    add column security_locked_until  timestamptz,
    add column security_last_event_at timestamptz;

-- ---------- Cadeia de integridade (HMAC-SHA256) ----------
-- seq: posição na cadeia (por usuário no extrato; global na auditoria); hash = HMAC(chave, prev_hash | campos)
alter table point_transactions
    add column seq       bigint,
    add column prev_hash varchar(64),
    add column hash      varchar(64);

alter table audit_log
    add column seq       bigint,
    add column prev_hash varchar(64),
    add column hash      varchar(64);

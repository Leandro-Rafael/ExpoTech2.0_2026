-- =====================================================================
-- Extrato de pontos e auditoria: cadeia obrigatória e tabelas APPEND-ONLY.
-- Depois da V5 (que selou as linhas existentes), nenhuma linha pode ser
-- alterada ou apagada, nem mesmo por SQL manual: o banco recusa.
-- =====================================================================

alter table point_transactions
    alter column seq set not null,
    alter column prev_hash set not null,
    alter column hash set not null;
create unique index ux_point_tx_chain on point_transactions (user_id, seq);

alter table audit_log
    alter column seq set not null,
    alter column prev_hash set not null,
    alter column hash set not null;
create unique index ux_audit_chain on audit_log (seq);

create or replace function lz_forbid_change() returns trigger
    language plpgsql as
$$
begin
    raise exception 'Tabela % é somente inserção (append-only): % não é permitido', tg_table_name, tg_op
        using errcode = 'insufficient_privilege';
end;
$$;

create trigger trg_point_tx_append_only
    before update or delete on point_transactions
    for each row execute function lz_forbid_change();
create trigger trg_point_tx_no_truncate
    before truncate on point_transactions
    for each statement execute function lz_forbid_change();

create trigger trg_audit_append_only
    before update or delete on audit_log
    for each row execute function lz_forbid_change();
create trigger trg_audit_no_truncate
    before truncate on audit_log
    for each statement execute function lz_forbid_change();

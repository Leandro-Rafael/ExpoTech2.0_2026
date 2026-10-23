-- =====================================================================
-- Lixo Zero 2050 - esquema inicial
-- Convenções: chaves primárias UUID, datas em timestamptz (UTC),
-- quantidades em numeric, CHECKs para garantir integridade no próprio banco.
-- =====================================================================

-- ---------- Organizações (turmas, empresas, condomínios, escolas) ----------
create table organizations (
    id          uuid primary key,
    name        varchar(120) not null,
    type        varchar(20)  not null check (type in ('TURMA', 'EMPRESA', 'CONDOMINIO', 'ESCOLA')),
    created_at  timestamptz  not null,
    updated_at  timestamptz  not null,
    constraint uq_organizations_name unique (name)
);

-- ---------- Residências (Smart Home) ----------
create table households (
    id           uuid primary key,
    name         varchar(80)  not null,
    neighborhood varchar(80)  not null,
    city         varchar(80)  not null,
    address      varchar(200),
    latitude     double precision check (latitude between -90 and 90),
    longitude    double precision check (longitude between -180 and 180),
    invite_code  varchar(12)  not null,
    owner_id     uuid,
    created_at   timestamptz  not null,
    updated_at   timestamptz  not null,
    constraint uq_households_invite unique (invite_code)
);

-- ---------- Usuários ----------
create table users (
    id                    uuid primary key,
    name                  varchar(100) not null,
    email                 varchar(254) not null,
    password_hash         varchar(255) not null,
    role                  varchar(20)  not null check (role in ('USER', 'COLLECTOR', 'ADMIN')),
    enabled               boolean      not null default true,
    points                bigint       not null default 0 check (points >= 0),
    total_earned          bigint       not null default 0 check (total_earned >= 0),
    household_id          uuid references households (id) on delete set null,
    organization_id       uuid references organizations (id) on delete set null,
    failed_login_attempts integer      not null default 0,
    locked_until          timestamptz,
    token_version         integer      not null default 0,
    last_login_at         timestamptz,
    created_at            timestamptz  not null,
    updated_at            timestamptz  not null,
    constraint uq_users_email unique (email)
);
create index ix_users_household on users (household_id);
create index ix_users_organization on users (organization_id);

alter table households
    add constraint fk_households_owner foreign key (owner_id) references users (id) on delete set null;

-- ---------- Refresh tokens (somente o hash SHA-256 é armazenado) ----------
create table refresh_tokens (
    id             uuid primary key,
    user_id        uuid        not null references users (id) on delete cascade,
    family_id      uuid        not null,
    token_hash     varchar(64) not null,
    expires_at     timestamptz not null,
    revoked_at     timestamptz,
    revoked_reason varchar(30),
    created_ip     varchar(64),
    user_agent     varchar(255),
    created_at     timestamptz not null,
    updated_at     timestamptz not null,
    constraint uq_refresh_tokens_hash unique (token_hash)
);
create index ix_refresh_tokens_user on refresh_tokens (user_id);
create index ix_refresh_tokens_family on refresh_tokens (family_id);

-- ---------- Categorias de resíduos ----------
create table categories (
    id                  uuid primary key,
    code                varchar(20)   not null check (code in ('PLASTICO', 'PAPEL', 'VIDRO', 'METAL', 'ORGANICO', 'ELETRONICO', 'REJEITO')),
    name                varchar(60)   not null,
    description         varchar(500)  not null,
    guidance            text          not null,
    points_per_kg       integer       not null check (points_per_kg between 0 and 1000),
    co2_factor_kg       numeric(8, 3) not null check (co2_factor_kg >= 0),
    recyclable          boolean       not null,
    color               varchar(7)    not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
    icon                varchar(40)   not null,
    max_kg_per_disposal numeric(8, 2) not null check (max_kg_per_disposal > 0),
    active              boolean       not null default true,
    created_at          timestamptz   not null,
    updated_at          timestamptz   not null,
    constraint uq_categories_code unique (code)
);

-- ---------- Ecopontos ----------
create table collection_points (
    id            uuid primary key,
    name          varchar(120)     not null,
    address       varchar(200)     not null,
    neighborhood  varchar(80)      not null,
    latitude      double precision not null check (latitude between -90 and 90),
    longitude     double precision not null check (longitude between -180 and 180),
    opening_hours varchar(120)     not null,
    active        boolean          not null default true,
    created_at    timestamptz      not null,
    updated_at    timestamptz      not null
);

create table collection_point_categories (
    collection_point_id uuid        not null references collection_points (id) on delete cascade,
    category_code       varchar(20) not null,
    primary key (collection_point_id, category_code)
);

-- ---------- Fotos (bytes no próprio banco para funcionar no Supabase) ----------
create table photos (
    id            uuid primary key,
    owner_id      uuid        not null references users (id) on delete cascade,
    content_type  varchar(30) not null,
    data          bytea       not null,
    width         integer     not null check (width > 0),
    height        integer     not null check (height > 0),
    size_bytes    integer     not null check (size_bytes > 0),
    dhash         bigint      not null,
    sha256        varchar(64) not null,
    ai_code       varchar(20),
    ai_confidence numeric(4, 3) check (ai_confidence between 0 and 1),
    ai_reasoning  varchar(500),
    ai_source     varchar(10),
    created_at    timestamptz not null,
    updated_at    timestamptz not null
);
create index ix_photos_sha256 on photos (sha256);
create index ix_photos_created on photos (created_at);

-- ---------- Descartes ----------
create table disposals (
    id                  uuid primary key,
    user_id             uuid           not null references users (id) on delete cascade,
    category_id         uuid           not null references categories (id),
    quantity_kg         numeric(10, 3) not null check (quantity_kg > 0),
    status              varchar(10)    not null check (status in ('PENDING', 'APPROVED', 'REJECTED')),
    points_awarded      integer        not null default 0 check (points_awarded >= 0),
    estimated_points    integer        not null default 0 check (estimated_points >= 0),
    photo_id            uuid references photos (id) on delete set null,
    latitude            double precision check (latitude between -90 and 90),
    longitude           double precision check (longitude between -180 and 180),
    collection_point_id uuid references collection_points (id) on delete set null,
    disposed_at         timestamptz    not null,
    reviewed_at         timestamptz,
    reviewed_by         uuid references users (id) on delete set null,
    rejection_reason    varchar(300),
    notes               varchar(500),
    ai_suggested_code   varchar(20),
    ai_confidence       numeric(4, 3) check (ai_confidence between 0 and 1),
    ai_source           varchar(10),
    fraud_score         integer        not null default 0 check (fraud_score between 0 and 100),
    fraud_flags         text,
    flagged             boolean        not null default false,
    idempotency_key     varchar(64),
    version             bigint         not null default 0,
    created_at          timestamptz    not null,
    updated_at          timestamptz    not null,
    -- uma foto só pode comprovar um único descarte
    constraint uq_disposals_photo unique (photo_id),
    -- Idempotency-Key: mesma chave + mesmo usuário = mesmo descarte
    constraint uq_disposals_idempotency unique (user_id, idempotency_key),
    constraint ck_disposals_coords check ((latitude is null) = (longitude is null)),
    constraint ck_disposals_points check (status = 'APPROVED' or points_awarded = 0)
);
create index ix_disposals_user_created on disposals (user_id, created_at desc);
create index ix_disposals_status_created on disposals (status, created_at desc);
create index ix_disposals_disposed_at on disposals (disposed_at);
create index ix_disposals_pending_flagged on disposals (created_at) where status = 'PENDING' and flagged;

-- ---------- Desafios ----------
create table challenges (
    id            uuid primary key,
    title         varchar(120)   not null,
    description   varchar(500)   not null,
    category_code varchar(20),
    metric        varchar(10)    not null check (metric in ('KG', 'COUNT')),
    target        numeric(10, 2) not null check (target > 0),
    bonus_points  integer        not null check (bonus_points >= 0),
    starts_at     date           not null,
    ends_at       date           not null,
    active        boolean        not null default true,
    created_at    timestamptz    not null,
    updated_at    timestamptz    not null,
    constraint ck_challenges_dates check (ends_at >= starts_at)
);

create table challenge_completions (
    id           uuid primary key,
    user_id      uuid        not null references users (id) on delete cascade,
    challenge_id uuid        not null references challenges (id) on delete cascade,
    completed_at timestamptz not null,
    created_at   timestamptz not null,
    updated_at   timestamptz not null,
    constraint uq_challenge_completion unique (user_id, challenge_id)
);

create table user_badges (
    id         uuid primary key,
    user_id    uuid        not null references users (id) on delete cascade,
    badge_code varchar(40) not null,
    awarded_at timestamptz not null,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint uq_user_badge unique (user_id, badge_code)
);

-- ---------- Recompensas ----------
create table rewards (
    id          uuid primary key,
    name        varchar(120) not null,
    description varchar(500) not null,
    cost_points integer      not null check (cost_points > 0),
    stock       integer      not null check (stock >= 0),
    icon        varchar(40)  not null,
    partner     varchar(120),
    active      boolean      not null default true,
    created_at  timestamptz  not null,
    updated_at  timestamptz  not null
);

create table redemptions (
    id         uuid primary key,
    user_id    uuid        not null references users (id) on delete cascade,
    reward_id  uuid        not null references rewards (id),
    cost       integer     not null check (cost > 0),
    code       varchar(20) not null,
    status     varchar(10) not null check (status in ('ISSUED', 'USED', 'CANCELLED')),
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint uq_redemptions_code unique (code)
);
create index ix_redemptions_user on redemptions (user_id, created_at desc);

-- ---------- Extrato de pontos (livro-razão) ----------
create table point_transactions (
    id            uuid primary key,
    user_id       uuid         not null references users (id) on delete cascade,
    type          varchar(10)  not null check (type in ('EARN', 'BONUS', 'REDEEM', 'ADJUST')),
    amount        integer      not null check (amount <> 0),
    balance_after bigint       not null check (balance_after >= 0),
    description   varchar(200) not null,
    disposal_id   uuid references disposals (id) on delete set null,
    challenge_id  uuid references challenges (id) on delete set null,
    redemption_id uuid references redemptions (id) on delete set null,
    created_at    timestamptz  not null,
    updated_at    timestamptz  not null
);
-- Regra de negócio garantida pelo banco: cada descarte gera pontos UMA única vez
create unique index ux_point_tx_disposal on point_transactions (disposal_id) where disposal_id is not null and type = 'EARN';
-- Bônus de cada desafio é pago uma única vez por usuário
create unique index ux_point_tx_challenge on point_transactions (user_id, challenge_id) where challenge_id is not null;
create index ix_point_tx_user_created on point_transactions (user_id, created_at desc);
create index ix_point_tx_created on point_transactions (created_at);

-- ---------- Lixeiras inteligentes (IoT) ----------
create table smart_bins (
    id                     uuid primary key,
    household_id           uuid        not null references households (id) on delete cascade,
    category_id            uuid        not null references categories (id),
    name                   varchar(60) not null,
    capacity_liters        integer     not null check (capacity_liters between 1 and 5000),
    fill_level             integer     not null default 0 check (fill_level between 0 and 100),
    battery_level          integer     not null default 100 check (battery_level between 0 and 100),
    auto_request_threshold integer     not null check (auto_request_threshold between 50 and 100),
    last_reading_at        timestamptz,
    device_id              uuid        not null,
    device_key_hash        varchar(64) not null,
    simulated              boolean     not null default false,
    created_at             timestamptz not null,
    updated_at             timestamptz not null,
    constraint uq_smart_bins_device unique (device_id)
);
create index ix_smart_bins_household on smart_bins (household_id);

create table bin_readings (
    id            uuid primary key,
    bin_id        uuid        not null references smart_bins (id) on delete cascade,
    fill_level    integer     not null check (fill_level between 0 and 100),
    battery_level integer     not null check (battery_level between 0 and 100),
    recorded_at   timestamptz not null,
    created_at    timestamptz not null,
    updated_at    timestamptz not null
);
create index ix_bin_readings_bin_time on bin_readings (bin_id, recorded_at desc);

-- ---------- Rotas de coleta ----------
create table routes (
    id                uuid primary key,
    name              varchar(120)     not null,
    status            varchar(12)      not null check (status in ('PLANNED', 'IN_PROGRESS', 'DONE')),
    collector_id      uuid references users (id) on delete set null,
    planned_date      date             not null,
    total_distance_km numeric(10, 2)   not null,
    naive_distance_km numeric(10, 2)   not null,
    estimated_minutes integer          not null,
    load_kg           numeric(10, 2)   not null,
    depot_latitude    double precision not null,
    depot_longitude   double precision not null,
    started_at        timestamptz,
    completed_at      timestamptz,
    created_at        timestamptz      not null,
    updated_at        timestamptz      not null
);
create index ix_routes_collector on routes (collector_id, planned_date);

-- ---------- Solicitações de coleta ----------
create table collection_requests (
    id             uuid primary key,
    requester_id   uuid references users (id) on delete set null,
    smart_bin_id   uuid references smart_bins (id) on delete set null,
    address        varchar(200)     not null,
    latitude       double precision not null check (latitude between -90 and 90),
    longitude      double precision not null check (longitude between -180 and 180),
    estimated_kg   numeric(10, 2)   not null check (estimated_kg > 0),
    collected_kg   numeric(10, 2) check (collected_kg >= 0),
    status         varchar(12)      not null check (status in ('REQUESTED', 'SCHEDULED', 'IN_ROUTE', 'COLLECTED', 'CANCELLED')),
    source         varchar(10)      not null check (source in ('USER', 'SMART_BIN')),
    preferred_date date,
    scheduled_for  date,
    route_id       uuid references routes (id) on delete set null,
    notes          varchar(500),
    version        bigint           not null default 0,
    created_at     timestamptz      not null,
    updated_at     timestamptz      not null
);
create index ix_collection_requests_status on collection_requests (status, created_at);
create index ix_collection_requests_requester on collection_requests (requester_id, created_at desc);
-- No máximo UMA solicitação aberta por lixeira inteligente (evita pedidos duplicados)
create unique index ux_open_request_per_bin on collection_requests (smart_bin_id)
    where smart_bin_id is not null and status in ('REQUESTED', 'SCHEDULED', 'IN_ROUTE');

create table collection_request_categories (
    collection_request_id uuid        not null references collection_requests (id) on delete cascade,
    category_code         varchar(20) not null,
    primary key (collection_request_id, category_code)
);

create table route_stops (
    id           uuid primary key,
    route_id     uuid        not null references routes (id) on delete cascade,
    request_id   uuid        not null references collection_requests (id) on delete cascade,
    sequence     integer     not null check (sequence > 0),
    status       varchar(10) not null check (status in ('PENDING', 'DONE')),
    completed_at timestamptz,
    collected_kg numeric(10, 2) check (collected_kg >= 0),
    created_at   timestamptz not null,
    updated_at   timestamptz not null,
    constraint uq_route_stop_sequence unique (route_id, sequence)
);
create index ix_route_stops_route on route_stops (route_id);

-- ---------- Metas de reciclagem ----------
create table goals (
    id                    uuid primary key,
    year                  integer        not null check (year between 2000 and 2100),
    title                 varchar(120)   not null,
    target_recycling_rate numeric(4, 3)  not null check (target_recycling_rate between 0 and 1),
    target_kg             numeric(14, 2) not null check (target_kg >= 0),
    created_at            timestamptz    not null,
    updated_at            timestamptz    not null
);

-- ---------- Auditoria (sem FK no ator: o registro sobrevive mesmo se a transação principal falhar) ----------
create table audit_log (
    id          uuid primary key,
    actor_id    uuid,
    actor_label varchar(160),
    action      varchar(60)  not null,
    entity      varchar(60),
    entity_id   varchar(64),
    details     varchar(1000),
    ip          varchar(64),
    created_at  timestamptz  not null,
    updated_at  timestamptz  not null
);
create index ix_audit_created on audit_log (created_at desc);

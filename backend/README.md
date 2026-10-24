# Lixo Zero 2050 — API (back-end)

API REST da plataforma **Lixo Zero 2050** (EcoTech Zero, ExpoTech 2026). Spring Boot 4.1 · Java 25 · PostgreSQL · Flyway.
Contrato da API: [`../docs/API.md`](../docs/API.md) (tipos do front-end em `../frontend/src/api/types.ts`).

## Como rodar

Pré-requisito: JDK 25. Nada mais: se `DB_URL` não for informado, um **PostgreSQL real embarcado** é iniciado
sozinho, com os dados guardados em `backend/data/pg` (a primeira inicialização pode levar alguns minutos).

```bash
cd backend
./mvnw spring-boot:run          # Windows: mvnw.cmd spring-boot:run
# API em http://localhost:8080  ·  health: GET /actuator/health
```

Front-end em modo desenvolvimento: `cd frontend && npm run dev` (o Vite encaminha `/api` para `localhost:8080`,
então cookies e CSRF funcionam como mesma origem).

Testes: `./mvnw test` (unitários + integração contra PostgreSQL embarcado; ~5 min em máquina modesta).
Só os rápidos: `./mvnw test -Dtest='!ApiIntegrationTest' -Dsurefire.failIfNoSpecifiedTests=false`.

### Contas de demonstração

Criadas automaticamente quando o banco está vazio (`APP_DEMO_SEED=true`), junto com moradores, descartes,
lixeiras simuladas e uma rota.

| Perfil   | E-mail                        | Senha          |
|----------|-------------------------------|----------------|
| Admin    | `admin@ecotechzero.com.br`    | `EcoTech@2050` |
| Coletor  | `coletor@ecotechzero.com.br`  | `Coleta@2050`  |
| Morador  | `morador@ecotechzero.com.br`  | `Recicla@2050` |

## Variáveis de ambiente

Copie `.env.example` para `backend/.env` (nunca versionado). Variáveis reais do sistema têm prioridade.

| Variável | Padrão | Para quê |
|---|---|---|
| `DB_URL`, `DB_USER`, `DB_PASSWORD` | vazio | Banco externo. Vazio = PostgreSQL embarcado. |
| `DB_POOL_SIZE` | `10` | Conexões no pool (Supabase gratuito: 5). |
| `APP_EMBEDDED_DB_PORT` | `54329` | Porta do PostgreSQL embarcado (só escuta em `localhost`). |
| `PORT` | `8080` | Porta HTTP. |
| `APP_DATA_DIR` | `./data` | Dados locais (banco embarcado e chave JWT gerada). |
| `APP_JWT_SECRET` | vazio | Segredo HS256 (≥ 32 bytes; `openssl rand -base64 48`). Vazio = gerado e salvo em `data/jwt-secret.key`. |
| `APP_INTEGRITY_KEY` | vazio | Chave HMAC da cadeia de integridade (≥ 32 bytes; `openssl rand -base64 48`). Vazio = gerada e salva em `data/integrity.key`. Fica fora do banco; não troque depois de criado o banco. |
| `APP_COOKIE_SECURE` | `auto` | Atributo `Secure` dos cookies: `auto` (só em HTTPS), `true`, `false`. |
| `APP_CORS_ORIGINS` | vazio | Origens CORS separadas por vírgula. Vazio = CORS desligado (mesma origem). |
| `APP_FORWARD_HEADERS` | `none` | Use `native` **somente** atrás de um proxy reverso confiável (senão o IP do `X-Forwarded-For` poderia ser falsificado). |
| `APP_REFRESH_GRACE_SECONDS` | `0` | Tolerância para reuso do refresh token em abas simultâneas. 0 = detecção estrita. |
| `APP_DEMO_SEED` | `true` | Cria os dados de demonstração em banco vazio. |
| `APP_AUTO_APPROVE` | `false` | Aprova sozinho descartes pequenos, com foto e de baixo risco. |
| `APP_FRAUD_THRESHOLD` | `50` | Risco (0–100) a partir do qual o descarte vai para revisão obrigatória. |
| `APP_IOT_SIMULATOR`, `APP_IOT_SIMULATOR_INTERVAL`, `APP_IOT_OFFLINE_HOURS` | `true`, `90s`, `6` | Simulador das lixeiras inteligentes. |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | vazio, `claude-haiku-5-5` | IA de classificação por foto. Sem chave, o front usa o modelo local no navegador. |

**Supabase (em espera):** o projeto está pronto para usar o Supabase, mas **desativado**. No `.env.example` há as três
linhas `DB_URL/DB_USER/DB_PASSWORD` comentadas (Session pooler, porta 5432, `sslmode=require`). Basta descomentar e
preencher; o Flyway cria o esquema na primeira execução. Enquanto estiverem comentadas, usa-se o banco embarcado.

## Arquitetura

Monólito em camadas, **organizado por funcionalidade** (cada pacote tem seu controller → service → repository):

```
br.com.ecotechzero.lixozero
├── auth, security     login, refresh token, JWT, CSRF, cabeçalhos, limites de requisição
├── user, organization perfil, organizações (turma, empresa, condomínio, escola)
├── category           categorias de resíduo e orientações de descarte
├── photo, ai          upload/sanitização de fotos, dHash, classificação por IA (Claude)
├── disposal, fraud    registro de descartes, moderação, motor antifraude (regras plugáveis)
├── points, reward     livro-razão de pontos, catálogo e resgate de recompensas
├── gamification       níveis, medalhas, desafios, sequência de dias, ranking
├── collection, route  ecopontos, solicitações de coleta, otimizador de rotas, área do coletor
├── household, iot     residência, lixeiras inteligentes, endpoint para sensores e simulador
├── impact, admin      indicadores, metas, simulador de cenários, painel e relatório CSV
├── audit              trilha de auditoria das ações sensíveis
├── integrity          cadeia HMAC (extrato e auditoria), verificação de integridade, migração de selagem
└── common, config     erros (RFC 7807), paginação, rate limiter, Jackson, banco embarcado, SPA
```

- **Controller**: só HTTP (rota, validação `@Valid`, usuário logado). Nunca expõe entidades: entra e sai **DTO** (`*Dtos.java`, records imutáveis).
- **Service**: regras de negócio e transações (`@Transactional`); a checagem de dono do recurso fica aqui.
- **Repository**: Spring Data JPA (consultas derivadas e JPQL parametrizado) e `NamedParameterJdbcTemplate` para agregações (ranking, impacto).
- **Banco**: esquema versionado por Flyway (`src/main/resources/db/migration`), com `CHECK`, `UNIQUE` e índices parciais que garantem as regras mesmo se o código falhar.

## Medidas de segurança (o quê e por quê)

| Medida | Onde | Por quê |
|---|---|---|
| Senhas com **Argon2id** (parâmetros OWASP) + política (10+ caracteres, letra e número, sem o e-mail, fora da lista de senhas comuns) | `SecurityConfig`, `PasswordPolicy` | Hash lento e com sal: mesmo com o banco vazado, quebrar as senhas é caríssimo. |
| **JWT curto (15 min) em cookie HttpOnly**, HS256 fixo (rejeita `none` e troca de algoritmo), emissor, expiração e `nbf` validados | `JwtService`, `AuthCookies` | JavaScript (e um XSS) não lê o token; tokens forjados ou vencidos não passam. |
| Usuário **recarregado do banco a cada requisição** (`token_version`) | `JwtAuthenticationFilter` | Desativar a conta, trocar o perfil ou a senha vale na hora, sem esperar o token vencer. |
| **Refresh token opaco com rotação e detecção de reuso**; só o SHA-256 vai para o banco; cookie restrito a `/api/auth` | `RefreshTokenService` | Se um token roubado for reutilizado, a "família" inteira é revogada e o ladrão (e a vítima) precisam logar de novo. |
| Troca de senha e desativação **revogam todas as sessões** | `AuthService`, `AdminService` | Recupera o controle da conta imediatamente. |
| **CSRF** (double-submit cookie `XSRF-TOKEN` + header `X-XSRF-TOKEN`) em todo POST/PUT/PATCH/DELETE, exceto o IoT | `SecurityConfig` | Outro site não consegue ler o cookie, então não forja requisições usando a sessão do usuário. |
| **Autorização por perfil** (`/api/admin/**` só ADMIN, `/api/collector/**` COLLECTOR/ADMIN) e **checagem de dono** (anti-IDOR) | `SecurityConfig`, serviços | Ninguém acessa descarte, foto, residência, solicitação ou rota de outra pessoa. Respondemos 404 (não 403) para não revelar que o recurso existe. |
| **Sem atribuição em massa**: DTOs só com campos permitidos e Jackson estrito (campo desconhecido = 400) | `*Dtos`, `JacksonConfig` | Não dá para mandar `"role":"ADMIN"` ou `"points":99999` no cadastro. |
| **Rate limiting (Token Bucket)** por IP, e-mail, usuário e dispositivo, com memória limitada | `TokenBucketRateLimiter`, `ApiRateLimitFilter` | Freia força bruta, spam e abuso; o mapa tem teto para não virar ataque de memória. |
| **Bloqueio de conta** após 5 senhas erradas (15 min) e tempo de resposta uniforme | `LoginAttemptService`, `AuthService` | Impede adivinhar senhas e não revela quais e-mails existem. |
| **Validação de toda entrada** (Bean Validation: tamanhos, faixas, lat/lon, datas, enums) e **limite de 64 KB** em corpos JSON | DTOs, `RequestBodyLimitFilter` | Dados sempre consistentes; um JSON gigante não derruba o servidor. |
| **Upload seguro**: 5 MB, assinatura binária (JPEG/PNG reais), dimensões checadas antes de decodificar, no máximo 2 decodificações simultâneas, reencode sem EXIF/GPS | `ImageProcessor` | Bloqueia arquivos disfarçados, "bombas de descompressão" e vazamento da localização da foto. |
| Fotos servidas como `image/jpeg`, `nosniff`, `inline`, cache privado, e só para o dono/admin | `PhotoController` | O navegador nunca interpreta a foto como HTML/script. |
| **Erros padronizados (RFC 7807)** sem stack trace, SQL ou detalhes; código de rastreio (`X-Request-Id`) nos logs | `GlobalExceptionHandler`, `RequestIdFilter` | Atacante não aprende nada com os erros; a equipe ainda consegue investigar. |
| **Cabeçalhos**: CSP restritiva, HSTS (HTTPS), `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy, COOP/CORP | `SecurityConfig` | Mitiga XSS, clickjacking e vazamento de dados entre sites. |
| **IoT**: chave do dispositivo guardada como hash, comparação em tempo constante, limites por IP e por dispositivo | `IotController` | Sensor falso não envia leituras; tentativas não inundam o log de auditoria. |
| **IA**: chave só no servidor e nunca logada; timeout; resposta validada contra o enum de categorias e texto truncado | `ClaudeVisionClassifier` | Uma foto com "instruções" (prompt injection) não consegue inventar categorias nem pontos. |
| **CSV** com neutralização de fórmulas (`= + - @ \|`) e tamanho limitado | `CsvReportService` | Abrir o relatório no Excel não executa fórmulas maliciosas. |
| **SQL só parametrizado** (JPQL/`:parametros`), nunca concatenado | repositórios | Elimina SQL injection. |
| **Concorrência**: locks pessimistas (saldo, estoque, aprovação, rotas, lixeiras, residência) + `UNIQUE`/`CHECK` no banco | `PointsService`, `RewardService`, `DisposalReviewService`, migrações | Dois cliques simultâneos não geram pontos em dobro, saldo negativo nem estoque negativo. |
| **Auditoria** das ações sensíveis em transação própria | `AuditService` | Quem fez o quê e quando, mesmo se a operação falhar. |
| Segredos fora do código (`.env`/variáveis), chave JWT local com permissão restrita, banco embarcado só em `localhost` | `application.yml`, `JwtService`, `EmbeddedPostgresConfig` | Nada sensível no Git nem exposto na rede. |
| **IA verificada no servidor**: a classificação é feita no upload e gravada na própria foto (modelo e horário); os campos de IA enviados pelo navegador viram só "palpite". Bônus de +10% só com foto do próprio usuário, enviada há ≤ 24 h, nunca usada em outro descarte (`UNIQUE`), e classificação do servidor que confirma a categoria **final** (reavaliada na aprovação) | `PhotoService`, `DisposalService`, `Disposal.aiBonusApplies`, `AiMismatchRule` | Antes, quem editasse a requisição (`aiSource: "CLAUDE"`) ganhava o bônus. Agora o cliente não consegue forjar pontos nem "limpar" o risco antifraude: o palpite dele só pode **aumentar** o risco. Limite: sem `ANTHROPIC_API_KEY` não há IA no servidor, então ninguém recebe o bônus. |
| **Cadeia de integridade HMAC-SHA256** no extrato de pontos (por usuário) e na auditoria (global): cada linha guarda `prev_hash` e `hash = HMAC(chave, campos + prev_hash)`; `GET /api/admin/integrity` confere tudo em fluxo e aponta a primeira linha quebrada; saldos conferidos (pontos = último saldo = soma) | `integrity/` (`LedgerChain`, `AuditChain`, `IntegrityService`, migração V5) | Alterar um valor direto no banco (ex.: dar pontos a alguém) é detectado: sem a chave, que fica fora do banco, não dá para recalcular os hashes. Limites: quem tiver a chave **e** o banco consegue refazer a cadeia; apagar as últimas linhas da auditoria só é percebido se ocorrer com o servidor rodando (ele lembra o último elo) — no extrato, a conferência de saldos denuncia. |
| **Tabelas append-only**: triggers no PostgreSQL recusam `UPDATE`, `DELETE` e `TRUNCATE` em `point_transactions` e `audit_log`; no JPA as entidades são `@Immutable` | `V6__append_only.sql` | Nem um bug nem um SQL manual "corrige" o extrato ou apaga rastros. Limite: o dono do banco pode desligar o trigger — e aí a cadeia HMAC denuncia a alteração. |
| **Bloqueio por inspeção + desbloqueio pelo admin**: na área logada, abrir o inspetor (F12, Ctrl+Shift+I/J/C, Ctrl+U) mostra "Não tente novamente"; o servidor conta os avisos (5 s de deduplicação), e no 3º bloqueia o acesso por 30 min, revoga todas as sessões e responde 423 a login, refresh e qualquer requisição. O admin desbloqueia em `POST /api/admin/users/{id}/unlock` | `InspectionService`, `JwtAuthenticationFilter`, `AuthService`, front `src/security/` | Desestimula a curiosidade e registra quem tentou (auditoria). **Limite honesto:** bloquear o inspetor no navegador é só um impedimento — dá para usar outro navegador, DevTools em janela separada ou ferramentas de rede. A proteção real dos dados está no servidor (autorização, validação, antifraude, integridade); o código do front não contém segredos. |

## Estruturas de dados e algoritmos

- **Otimizador de rotas** (`route/RouteOptimizer.java`): problema de roteamento com capacidade (CVRP, NP-difícil) resolvido por heurísticas —
  **matriz de distâncias** `double[][]` com **Haversine** (`common/GeoPoint.java`), **vizinho mais próximo** usando uma
  **`PriorityQueue` (min-heap)**, divisão em viagens pela capacidade do caminhão e melhoria **2-opt** (desfaz cruzamentos).
  Compara com a rota "ingênua" para mostrar a economia (%). Ao cancelar uma parada, a rota recalcula distância, tempo e carga.
- **dHash** (`photo/PerceptualHash.java`): hash perceptual de 64 bits; fotos parecidas têm **distância de Hamming** pequena (`Long.bitCount(a ^ b)`). Junto com o **SHA-256** detecta foto repetida.
- **Token Bucket** (`common/TokenBucketRateLimiter.java`): cada chave tem um balde que recarrega continuamente; `ConcurrentHashMap` com teto de memória.
- **Prioridade de coleta** (`collection/PriorityCalculator.java`): pontuação 0–100 (volume, espera, eletrônico, nível da lixeira, data).
- **Motor antifraude** (`fraud/`): soma de sinais de 8 regras (velocidade, limite diário, deslocamento impossível, foto repetida/parecida, divergência com a IA, quantidade fora do padrão...).
- **Sequência de dias** (`gamification/StreakCalculator.java`), **níveis** (`LevelCatalog`), **ranking** com `SUM ... GROUP BY` e CTEs no SQL.
- **Simulador de cenários** (`impact/ScenarioSimulator.java`): projeção ano a ano até 2050 (crescimento da geração × meta de reciclagem).
- **Idempotência** (`Idempotency-Key`) e **livro-razão** de pontos (cada lançamento guarda o saldo após a operação).

## Destaques de orientação a objetos

- **Interfaces + polimorfismo (Strategy)**:
  - `ai/WasteClassifier.java` → `ClaudeVisionClassifier` (IA na nuvem) e `UnavailableClassifier` (sem chave); `AiConfig` escolhe a implementação.
  - `fraud/FraudRule.java` → 8 regras em `fraud/rules/`; o `FraudEngine` recebe `List<FraudRule>` e não conhece nenhuma concreta (nova regra = nova classe).
  - `gamification/badge/BadgeRule.java` → `ThresholdBadge`, `CategoryKgBadge`, `AllRecyclablesBadge` (`BadgeCatalog.java`).
- **Herança**: `common/BaseEntity.java` (classe abstrata com id UUID e datas) é a superclasse de todas as entidades JPA;
  filtros de segurança estendem `OncePerRequestFilter` (`security/*Filter.java`).
- **Encapsulamento**: entidades sem setters públicos para estado crítico — mudanças passam por métodos com regra
  (`Disposal.approve/reject`, `User.earn/spend`, `Reward.decrementStock`, `CollectionRoute.removeStop`).
- **Imutabilidade**: DTOs e resultados como `record` (`DisposalDtos`, `RouteOptimizer.Plan`, `FraudSignal`...).
- **Injeção de dependências** por construtor em todos os serviços (fácil de testar e trocar implementações).

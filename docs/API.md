# Contrato da API — Lixo Zero 2050

Base: `/api` · JSON UTF-8 · datas em ISO-8601 (`2026-10-23T14:00:00Z`), datas simples `YYYY-MM-DD` · IDs são UUID.

## Convenções de segurança

- **Autenticação por cookies HttpOnly** (`ez_access` ~15 min, `ez_refresh` 7 dias, rotativo). O front-end **nunca** vê o token.
- **CSRF**: o back-end envia o cookie legível `XSRF-TOKEN`; toda requisição mutável (POST/PUT/PATCH/DELETE) deve mandar o header `X-XSRF-TOKEN` com o valor do cookie. Chame `GET /api/auth/csrf` no boot da aplicação.
- Se uma requisição retornar **401**, o cliente tenta `POST /api/auth/refresh` **uma vez** e repete a requisição; se falhar de novo → tela de login.
- `Idempotency-Key: <uuid>` em `POST /api/disposals` (evita descarte duplicado por clique duplo).
- Rate limit → **429** com header `Retry-After` (segundos).

## Formato de erro (RFC 7807)

```json
{ "status": 400, "title": "Dados inválidos", "detail": "Verifique os campos destacados.",
  "code": "VALIDATION_ERROR", "errors": [{ "field": "quantityKg", "message": "deve ser um número" }] }
```
Códigos (`code`): `VALIDATION_ERROR`, `BAD_CREDENTIALS`, `ACCOUNT_LOCKED`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INSUFFICIENT_POINTS`, `OUT_OF_STOCK`, `RATE_LIMITED`, `INVALID_IMAGE`, `BUSINESS_RULE`, `INTERNAL_ERROR`.

## Paginação

`?page=0&size=20` → `{ "content": [...], "page": 0, "size": 20, "totalElements": 134, "totalPages": 7 }`

## Perfis

`USER` (morador), `COLLECTOR` (coletor), `ADMIN`. Rotas `/api/admin/**` apenas ADMIN; `/api/collector/**` COLLECTOR ou ADMIN.

---

## Auth — `/api/auth`
| Método | Rota | Corpo | Resposta |
|---|---|---|---|
| GET | `/csrf` | — | 204 (define cookie XSRF-TOKEN) |
| POST | `/register` | `{name, email, password}` | 201 `UserMe` (já autenticado) |
| POST | `/login` | `{email, password}` | 200 `UserMe` |
| POST | `/refresh` | — | 200 `UserMe` |
| POST | `/logout` | — | 204 |
| GET | `/me` | — | 200 `UserMe` |

Regras de senha: 10–128 caracteres, ao menos 1 letra e 1 número, não pode conter o e-mail nem estar na lista de senhas comuns.

## Segurança — `/api/security`
| POST | `/inspection-events` | `{trigger: 'F12'\|'CTRL_SHIFT_I'\|'CTRL_SHIFT_J'\|'CTRL_SHIFT_C'\|'CTRL_U'\|'CONTEXT_MENU'\|'DEVTOOLS_OPEN'}` | `InspectionEventResult` `{warnings, maxWarnings: 3, locked, lockedUntil}` |

Enviado pelo guarda da área logada (`/app/**`) quando o usuário tenta abrir o inspetor ou o código-fonte. O **servidor** conta:
eventos a menos de 5 s do último aviso contado valem um só; no 3º aviso o acesso fica bloqueado por **30 minutos** e todas as
sessões são revogadas (auditado: `SECURITY_INSPECTION_WARNING`, `SECURITY_INSPECTION_LOCK`). Limite: 20 eventos/min por usuário.
Enquanto bloqueado, login (com a senha correta), refresh e **toda** requisição autenticada (exceto `/auth/csrf`, `/auth/logout`,
`/auth/login`, `/auth/register`) respondem **423** `ACCOUNT_LOCKED` com `Retry-After` (segundos) e
`detail: "Acesso bloqueado por 30 minutos por tentativa de inspeção do sistema."`. Ao vencer o bloqueio, os avisos voltam a 0.
`UserMe.securityWarnings` traz os avisos vigentes.

## Perfil — `/api/me`
| PATCH | `/api/me` | `{name?, organizationId? (uuid ou null)}` | `UserMe` |
| POST | `/api/me/password` | `{currentPassword, newPassword}` | 204 (encerra as outras sessões) |
| GET | `/api/organizations` | — | `Organization[]` |

## Categorias
| GET | `/api/categories` | — | `Category[]` (só ativas; admin recebe todas com `?all=true`) |

## Fotos + IA
| POST | `/api/photos` | multipart `file` (JPEG/PNG ≤ 5 MB) | 201 `PhotoUpload` |
| GET | `/api/photos/{id}` | — | `image/jpeg` (dono ou admin) |

**IA verificada no servidor.** No upload, o servidor classifica a foto (Claude, quando há `ANTHROPIC_API_KEY`) e grava o
resultado na própria foto. `PhotoUpload.ai.verified = true` só nesse caso. Os campos `aiSuggestedCode/aiConfidence/aiSource`
de `CreateDisposal` são apenas um **palpite** do navegador: ficam guardados, nunca dão bônus e nunca reduzem o risco antifraude.

## Descartes
| POST | `/api/disposals` | `CreateDisposal` + header `Idempotency-Key` | 201 `Disposal` |
| GET | `/api/disposals?status=PENDING\|APPROVED\|REJECTED&page&size` | — | `Page<Disposal>` (meus) |
| GET | `/api/disposals/{id}` | — | `Disposal` |

- `photoId` de outra pessoa → **404**; foto já usada em outro descarte → 400 (e `UNIQUE(photo_id)` no banco).
- Bônus de +10% só quando: a foto é do usuário, foi enviada há ≤ 24 h, a classificação **verificada do servidor** concorda com a
  categoria **final** (reavaliada na aprovação, inclusive após correção do admin) e a confiança é ≥ 0,6.
- `Disposal.ai.verified`: `true` = sugestão do servidor; `false` = palpite do navegador (só informativo).

## Pontos, níveis, medalhas, desafios
| GET | `/api/points/transactions?page&size` | — | `Page<PointTransaction>` |
| GET | `/api/gamification/summary` | — | `GamificationSummary` |
| GET | `/api/ranking?scope=USER\|HOUSEHOLD\|NEIGHBORHOOD\|ORGANIZATION&period=WEEK\|MONTH\|YEAR\|ALL` | — | `Ranking` |

## Recompensas
| GET | `/api/rewards` | — | `Reward[]` |
| POST | `/api/rewards/{id}/redeem` | — | 201 `Redemption` |
| GET | `/api/redemptions` | — | `Redemption[]` |

## Ecopontos e coletas
| GET | `/api/collection-points?lat&lon&radiusKm&category=CODE` | — | `CollectionPoint[]` (ordenado por distância se lat/lon) |
| POST | `/api/collection-requests` | `CreateCollectionRequest` | 201 `CollectionRequest` |
| GET | `/api/collection-requests` | — | `CollectionRequest[]` (minhas) |
| POST | `/api/collection-requests/{id}/cancel` | — | `CollectionRequest` |

## Residência (Smart Home) e lixeiras inteligentes
| GET | `/api/household` | — | 200 `Household` ou **204** se o usuário não tem residência |
| POST | `/api/household` | `{name, neighborhood, city}` | 201 `Household` |
| POST | `/api/household/join` | `{inviteCode}` | `Household` |
| POST | `/api/household/leave` | — | 204 |
| GET | `/api/household/bins` | — | `SmartBin[]` |
| POST | `/api/household/bins` | `{name, categoryId, capacityLiters, autoRequestThreshold}` | 201 `SmartBinCreated` |
| DELETE | `/api/household/bins/{id}` | — | 204 |
| POST | `/api/iot/readings` | headers `X-Device-Id`, `X-Device-Key`; `{fillLevel, batteryLevel}` | 202 (endpoint para dispositivo IoT real) |

## Impacto ambiental
| GET | `/api/public/stats` | — | `PublicStats` (sem login, para a landing page) |
| GET | `/api/impact/summary?scope=ME\|COMMUNITY&months=12` | — | `ImpactSummary` |
| POST | `/api/impact/simulate` | `SimulationInput` | `SimulationResult` |

## Coletor — `/api/collector`
| GET | `/routes` | — | `Route[]` (minhas rotas) |
| POST | `/routes/{id}/start` | — | `Route` |
| POST | `/routes/{routeId}/stops/{stopId}/complete` | `{collectedKg?}` | `Route` |

## Administração — `/api/admin`
| GET | `/overview` | — | `AdminOverview` |
| GET | `/users?q&role&page&size` | — | `Page<AdminUser>` |
| PATCH | `/users/{id}` | `{role?, enabled?}` | `AdminUser` |
| POST | `/users/{id}/unlock` | — | `AdminUser` (remove bloqueio por senha e por inspeção e zera os avisos; auditado `USER_UNLOCKED`) |
| GET | `/integrity` | — | `IntegrityReport` (verifica a cadeia HMAC do extrato e da auditoria e os saldos; 6 verificações/min) |
| GET | `/disposals?status&flagged=true&page&size` | — | `Page<Disposal>` (com `user` e `fraud`) |
| POST | `/disposals/{id}/approve` | `{categoryId?, quantityKg?}` | `Disposal` |
| POST | `/disposals/{id}/reject` | `{reason}` | `Disposal` |
| POST/PUT | `/categories`, `/categories/{id}` | `CategoryInput` | `Category` |
| POST/PUT/DELETE | `/collection-points`, `/collection-points/{id}` | `CollectionPointInput` | `CollectionPoint` |
| POST/PUT | `/rewards`, `/rewards/{id}` | `RewardInput` | `Reward` |
| GET/POST/PUT | `/challenges`, `/challenges/{id}` | `ChallengeInput` | `Challenge` |
| GET/POST | `/organizations` | `{name, type}` | `Organization` |
| GET/POST/PUT | `/goals`, `/goals/{id}` | `GoalInput` | `Goal` |
| GET | `/collection-requests?status` | — | `CollectionRequest[]` |
| GET | `/collectors` | — | `UserRef[]` |
| POST | `/routes/optimize` | `{requestIds, depot?, vehicleCapacityKg?}` | `RouteOptimization` |
| POST | `/routes` | `{name, collectorId?, plannedDate, requestIds, depot?, vehicleCapacityKg?}` | 201 `Route[]` |
| GET | `/routes` | — | `Route[]` |
| GET | `/bins` | — | `SmartBin[]` (com `household`) |
| GET | `/audit?page&size` | — | `Page<AuditEntry>` |
| GET | `/reports/disposals.csv?from&to` | — | `text/csv` |

`AdminUser` traz também `lockReason` (`PASSWORD`\|`INSPECTION`\|null), `lockedUntil` e `securityWarnings`.

`IntegrityReport`: `{ checkedAt, ledger: {ok, rowsChecked, brokenAt: {table, id, userId} | null}, audit: {…mesmo formato},
balances: {ok, mismatches} }`. `brokenAt` aponta a **primeira** linha cuja cadeia não confere (hash, `prev_hash`, sequência ou
saldo). `balances` confere, para cada usuário, pontos = último saldo do extrato = soma dos lançamentos (e total ganho = soma dos créditos).
As tabelas `point_transactions` e `audit_log` são **append-only** (o banco recusa UPDATE/DELETE/TRUNCATE).

Os tipos exatos estão em [`frontend/src/api/types.ts`](../frontend/src/api/types.ts), que é a fonte da verdade do contrato.

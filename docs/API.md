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

## Perfil — `/api/me`
| PATCH | `/api/me` | `{name?, organizationId? (uuid ou null)}` | `UserMe` |
| POST | `/api/me/password` | `{currentPassword, newPassword}` | 204 (encerra as outras sessões) |
| GET | `/api/organizations` | — | `Organization[]` |

## Categorias
| GET | `/api/categories` | — | `Category[]` (só ativas; admin recebe todas com `?all=true`) |

## Fotos + IA
| POST | `/api/photos` | multipart `file` (JPEG/PNG ≤ 5 MB) | 201 `PhotoUpload` |
| GET | `/api/photos/{id}` | — | `image/jpeg` (dono ou admin) |

## Descartes
| POST | `/api/disposals` | `CreateDisposal` + header `Idempotency-Key` | 201 `Disposal` |
| GET | `/api/disposals?status=PENDING\|APPROVED\|REJECTED&page&size` | — | `Page<Disposal>` (meus) |
| GET | `/api/disposals/{id}` | — | `Disposal` |

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

Os tipos exatos estão em [`frontend/src/api/types.ts`](../frontend/src/api/types.ts), que é a fonte da verdade do contrato.

# Fluxograma da Aplicação — Lixo Zero 2050

> ExpoTech 2026.2 · UniFECAF · 4º semestre de Ciência da Computação · categoria **INTELLIGENCE** · tema *Smart Home 2050*
>
> Entregável obrigatório **"Fluxograma"**: o fluxo completo da aplicação, do visitante às áreas de cada perfil, e os fluxos
> internos mais importantes. Cada passo corresponde a código real (os arquivos citados estão em
> `backend/src/main/java/br/com/ecotechzero/lixozero/` e `frontend/src/`).

**Sumário**

0. [Legenda (símbolos)](#0-legenda-símbolos)
1. [Fluxo geral da aplicação](#1-fluxo-geral-da-aplicação)
2. [Autenticação: login, CSRF, JWT, refresh e bloqueio](#2-autenticação)
3. [Registro de descarte com IA e antifraude](#3-registro-de-descarte)
4. [Moderação pelo administrador](#4-moderação-pelo-administrador)
5. [Resgate de recompensa](#5-resgate-de-recompensa)
6. [Smart Home: leitura IoT e pedido automático de coleta](#6-smart-home-leitura-iot-e-pedido-automático-de-coleta)
7. [Coleta e rota otimizada](#7-coleta-e-rota-otimizada)
8. [Bloqueio por inspeção](#8-bloqueio-por-inspeção)
9. [Verificação de integridade (cadeia HMAC)](#9-verificação-de-integridade-cadeia-hmac)
10. [Diagramas de sequência](#10-diagramas-de-sequência)
11. [Ciclos de vida (estados)](#11-ciclos-de-vida-estados)

---

## 0. Legenda (símbolos)

Todos os fluxogramas usam a simbologia padrão (ISO 5807 / ANSI) e as mesmas cores:

| Forma | Significado | Cor |
|---|---|---|
| Retângulo de cantos arredondados (*terminal*) | Início / Fim | verde-escuro |
| Retângulo | Processo executado pelo sistema | verde-claro |
| Losango | Decisão (sim / não) | amarelo |
| Paralelogramo | Entrada ou saída de dados (formulário, tela, requisição) | azul |
| Cilindro | Banco de dados | lilás |
| Retângulo com barras laterais | Subprocesso detalhado em outro diagrama | cinza |
| Retângulo vermelho | Erro / resposta negativa (código HTTP) | vermelho |

![Legenda](diagramas/legenda.png)

<!-- diagrama: legenda -->
```mermaid
flowchart LR
    A(["Início / Fim"]):::term
    B["Processo (ação do sistema)"]:::proc
    C{"Decisão"}:::dec
    D[/"Entrada / Saída de dados"/]:::io
    E[("Banco de dados")]:::db
    F[["Subprocesso (detalhado em outro diagrama)"]]:::sub
    G["Erro / resposta negativa"]:::err
    A --> B --> C --> D --> E --> F --> G

    classDef term fill:#0f5132,stroke:#0f5132,color:#ffffff
    classDef proc fill:#ecfdf5,stroke:#059669,color:#0a0e0c
    classDef dec fill:#fef9c3,stroke:#a16207,color:#0a0e0c
    classDef io fill:#e0f2fe,stroke:#0369a1,color:#0a0e0c
    classDef db fill:#ede9fe,stroke:#6d28d9,color:#0a0e0c
    classDef sub fill:#f1f5f9,stroke:#334155,color:#0a0e0c
    classDef err fill:#fee2e2,stroke:#b91c1c,color:#0a0e0c
```

Nomes usados de forma consistente: **Morador** (perfil `USER`), **Coletor** (`COLLECTOR`), **Administrador** (`ADMIN`);
**API** = back-end Spring Boot; **Front** = aplicação React no navegador; **BD** = PostgreSQL.

---

## 1. Fluxo geral da aplicação

![Fluxo geral](diagramas/fluxo-geral.png)

<!-- diagrama: fluxo-geral -->
```mermaid
flowchart TD
    INI(["Visitante abre o site"]):::term --> LAND["Landing page '/'<br/>indicadores públicos (GET /api/public/stats)"]:::proc
    LAND --> TEM{"Já tem conta?"}:::dec
    TEM -- "Não" --> CAD[/"Cadastro '/cadastro'<br/>nome, e-mail, senha"/]:::io
    TEM -- "Sim" --> LOG[/"Login '/entrar'<br/>e-mail e senha"/]:::io
    CAD --> VAL{"Dados válidos?<br/>(senha forte, e-mail único)"}:::dec
    VAL -- "Não" --> CADERR["Mostra erros no campo"]:::err --> CAD
    VAL -- "Sim" --> NOVO["Cria usuário com perfil Morador (USER)<br/>e já inicia a sessão"]:::proc
    LOG --> AUTH[["Autenticação (diagrama 2)"]]:::sub
    AUTH -- "falhou / bloqueado" --> LOG
    AUTH -- "ok" --> APP
    NOVO --> APP["Área logada '/app'<br/>Painel inicial"]:::proc
    APP --> PERFIL{"Perfil do usuário?"}:::dec

    PERFIL -- "Morador" --> M
    PERFIL -- "Coletor" --> C
    PERFIL -- "Administrador" --> A

    subgraph M ["Área do Morador (todos os perfis têm)"]
        M1["Registrar descarte '/app/descartar'"]:::proc
        M2["Meus descartes e status"]:::proc
        M3["Minha casa (Smart Home)<br/>residência e lixeiras inteligentes"]:::proc
        M4["Mapa de ecopontos<br/>e solicitação de coleta"]:::proc
        M5["Recompensas, conquistas e ranking"]:::proc
        M6["Impacto ambiental e simulador 2050"]:::proc
        M7["Perfil: dados, organização, senha"]:::proc
    end

    subgraph C ["Área do Coletor '/app/coletor'"]
        C1["Minhas rotas do dia"]:::proc
        C2["Iniciar rota e concluir paradas"]:::proc
    end

    subgraph A ["Área do Administrador '/app/admin'"]
        A1["Visão geral e indicadores"]:::proc
        A2["Moderação de descartes"]:::proc
        A3["Usuários: perfil, ativar, desbloquear"]:::proc
        A4["Coletas e rotas otimizadas"]:::proc
        A5["Ecopontos, catálogo, lixeiras"]:::proc
        A6["Auditoria (filtro por ação e texto),<br/>integridade e relatório CSV"]:::proc
    end

    C -.-> M
    A -.-> M
    M7 --> SAIR(["Sair (logout)"]):::term

    classDef term fill:#0f5132,stroke:#0f5132,color:#ffffff
    classDef proc fill:#ecfdf5,stroke:#059669,color:#0a0e0c
    classDef dec fill:#fef9c3,stroke:#a16207,color:#0a0e0c
    classDef io fill:#e0f2fe,stroke:#0369a1,color:#0a0e0c
    classDef sub fill:#f1f5f9,stroke:#334155,color:#0a0e0c
    classDef err fill:#fee2e2,stroke:#b91c1c,color:#0a0e0c
```

**Como explicar:**
- O cadastro público cria sempre um **Morador**. Só o Administrador muda o perfil de alguém para Coletor ou Administrador (`PATCH /api/admin/users/{id}`). Isso evita que alguém "se promova" mandando `"role":"ADMIN"` no cadastro.
- A navegação é filtrada por perfil no Front (`frontend/src/app/navigation.ts`, `RequireRole` em `frontend/src/app/router.tsx`), **mas quem garante a permissão é a API**: `/api/admin/**` só aceita `ADMIN` e `/api/collector/**` aceita `COLLECTOR` ou `ADMIN` (`security/SecurityConfig.java`).
- Coletor e Administrador também têm acesso às telas do Morador (linhas tracejadas).

---

## 2. Autenticação

### 2.1 Login (com CSRF, JWT em cookie e bloqueio por tentativas)

Código: `auth/AuthService.login`, `auth/LoginAttemptService.java`, `security/JwtService.java`, `security/AuthCookies.java`, `frontend/src/api/client.ts`.

![Login](diagramas/fluxo-login.png)

<!-- diagrama: fluxo-login -->
```mermaid
flowchart TD
    INI(["Usuário envia e-mail e senha"]):::term --> CSRF{"Front tem o cookie<br/>XSRF-TOKEN?"}:::dec
    CSRF -- "Não" --> GETCSRF["GET /api/auth/csrf<br/>servidor define o cookie XSRF-TOKEN"]:::proc --> POST
    CSRF -- "Sim" --> POST[/"POST /api/auth/login<br/>header X-XSRF-TOKEN = valor do cookie"/]:::io
    POST --> CHK{"Header CSRF confere<br/>com o cookie?"}:::dec
    CHK -- "Não" --> E403["403 — requisição forjada"]:::err
    CHK -- "Sim" --> RL{"Limite de tentativas<br/>por IP e por e-mail<br/>(Token Bucket) ok?"}:::dec
    RL -- "Não" --> E429["429 — muitas requisições"]:::err
    RL -- "Sim" --> LOCK{"Conta bloqueada por<br/>senha errada (15 min)?"}:::dec
    LOCK -- "Sim" --> E423A["423 — tente em N minutos"]:::err
    LOCK -- "Não" --> HASH["Compara a senha com o hash Argon2id<br/>(e-mail inexistente: compara com hash fictício,<br/>mesmo tempo de resposta)"]:::proc
    HASH --> OK{"Senha correta?"}:::dec
    OK -- "Não" --> FAIL["Conta a falha<br/>(memória + users.failed_login_attempts)<br/>auditoria LOGIN_FAILED"]:::proc
    FAIL --> CINCO{"5ª falha seguida?"}:::dec
    CINCO -- "Sim" --> BLOQ["users.locked_until = agora + 15 min<br/>auditoria ACCOUNT_LOCKED"]:::proc --> E423B["423 — conta bloqueada"]:::err
    CINCO -- "Não" --> E401["401 — 'E-mail ou senha incorretos'<br/>(mensagem genérica)"]:::err
    OK -- "Sim" --> ATIVA{"Conta ativa?"}:::dec
    ATIVA -- "Não" --> E403B["403 — conta desativada"]:::err
    ATIVA -- "Sim" --> INSP{"Bloqueada por inspeção<br/>(30 min)?"}:::dec
    INSP -- "Sim" --> E423C["423 — acesso bloqueado"]:::err
    INSP -- "Não" --> SUC["Zera falhas, grava last_login_at"]:::proc
    SUC --> RT["Gera refresh token aleatório (256 bits)<br/>nova família; grava só o SHA-256"]:::proc
    RT --> DB[("refresh_tokens")]:::db
    RT --> JWT["Gera JWT de acesso HS256 (15 min)<br/>com id do usuário e token_version"]:::proc
    JWT --> COOK[/"Cookies HttpOnly + SameSite:<br/>acesso (15 min) e refresh (7 dias, só /api/auth)"/]:::io
    COOK --> AUD["Auditoria LOGIN_SUCCESS"]:::proc --> FIM(["200 — dados do usuário;<br/>Front abre '/app'"]):::term

    classDef term fill:#0f5132,stroke:#0f5132,color:#ffffff
    classDef proc fill:#ecfdf5,stroke:#059669,color:#0a0e0c
    classDef dec fill:#fef9c3,stroke:#a16207,color:#0a0e0c
    classDef io fill:#e0f2fe,stroke:#0369a1,color:#0a0e0c
    classDef db fill:#ede9fe,stroke:#6d28d9,color:#0a0e0c
    classDef err fill:#fee2e2,stroke:#b91c1c,color:#0a0e0c
```

### 2.2 Cada requisição autenticada e a renovação da sessão (refresh com rotação e detecção de reuso)

Código: `security/JwtAuthenticationFilter.java`, `auth/RefreshTokenService.rotate`, `frontend/src/api/client.ts` (*single-flight*: uma única renovação compartilhada entre as chamadas).

![Refresh](diagramas/fluxo-refresh.png)

<!-- diagrama: fluxo-refresh -->
```mermaid
flowchart TD
    INI(["Front chama a API<br/>(cookie de acesso vai junto)"]):::term --> JWT{"JWT válido?<br/>assinatura HS256, emissor,<br/>expiração"}:::dec
    JWT -- "Sim" --> USR{"Usuário existe, está ativo<br/>e token_version confere?"}:::dec
    USR -- "Sim" --> INSP{"Bloqueado por inspeção?"}:::dec
    INSP -- "Sim" --> E423["423 — bloqueado"]:::err
    INSP -- "Não" --> ROLE{"Perfil permite a rota?"}:::dec
    ROLE -- "Não" --> E403["403"]:::err
    ROLE -- "Sim" --> OK(["Executa e responde"]):::term
    JWT -- "Não (ex.: venceu)" --> R401["401"]:::proc
    USR -- "Não" --> R401
    R401 --> REF[/"Front: POST /api/auth/refresh<br/>(uma única vez, promessa compartilhada)"/]:::io
    REF --> FIND{"Hash SHA-256 do token<br/>existe no banco?"}:::dec
    FIND -- "Não" --> SAIR["401 — limpa cookies;<br/>Front manda para '/entrar'"]:::err
    FIND -- "Sim" --> REV{"Token já revogado?"}:::dec
    REV -- "Sim, por rotação" --> GRACE{"Dentro da tolerância<br/>APP_REFRESH_GRACE_SECONDS?<br/>(padrão 0 = estrita)"}:::dec
    GRACE -- "Sim" --> NOVO
    GRACE -- "Não" --> REUSO["REUSO DETECTADO: alguém copiou o token.<br/>Revoga a FAMÍLIA inteira<br/>auditoria REFRESH_TOKEN_REUSE"]:::err --> SAIR
    REV -- "Sim, outro motivo" --> SAIR
    REV -- "Não" --> VAL{"Vencido, conta desativada<br/>ou bloqueada?"}:::dec
    VAL -- "Sim" --> SAIR
    VAL -- "Não" --> ROT["Revoga o token atual (ROTATED)"]:::proc
    ROT --> NOVO["Emite novo refresh da MESMA família<br/>+ novo JWT de 15 min (novos cookies)"]:::proc
    NOVO --> RETRY(["Front repete a requisição original"]):::term

    classDef term fill:#0f5132,stroke:#0f5132,color:#ffffff
    classDef proc fill:#ecfdf5,stroke:#059669,color:#0a0e0c
    classDef dec fill:#fef9c3,stroke:#a16207,color:#0a0e0c
    classDef io fill:#e0f2fe,stroke:#0369a1,color:#0a0e0c
    classDef err fill:#fee2e2,stroke:#b91c1c,color:#0a0e0c
```

**Por que assim:** o JWT fica em cookie **HttpOnly** (JavaScript não lê, então um XSS não rouba a sessão). O JWT dura só 15 min; o refresh dura 7 dias mas é **trocado a cada uso**. Se um token antigo reaparecer, só pode ser cópia: o sistema derruba todas as sessões daquela família. Trocar a senha, ser desativado ou bloqueado revoga todas as sessões.

---

## 3. Registro de descarte

Código: `frontend/src/pages/app/NewDisposalPage.tsx`, `photo/PhotoService.java`, `photo/ImageProcessor.java`, `ai/ClaudeVisionClassifier.java`, `frontend/src/features/resident/disposal/localClassifier.ts`, `disposal/DisposalService.create`, `fraud/FraudEngine.java`.

![Registro de descarte](diagramas/fluxo-descarte.png)

<!-- diagrama: fluxo-descarte -->
```mermaid
flowchart TD
    INI(["Morador abre 'Registrar descarte'"]):::term --> FOTO[/"Tira ou escolhe uma foto (opcional)"/]:::io
    FOTO --> TEMF{"Enviou foto?"}:::dec
    TEMF -- "Não" --> FORM
    TEMF -- "Sim" --> UP["POST /api/photos (multipart, até 5 MB)"]:::proc
    UP --> IMG{"Imagem válida?<br/>assinatura real JPEG/PNG,<br/>até 8000 px e 40 Mpx"}:::dec
    IMG -- "Não" --> EIMG["400 INVALID_IMAGE"]:::err --> FOTO
    IMG -- "Sim" --> SAN["Reencoda em JPEG (máx. 1600 px)<br/>remove EXIF/GPS; calcula SHA-256 e dHash"]:::proc
    SAN --> IA{"IA do servidor disponível?<br/>(ANTHROPIC_API_KEY)"}:::dec
    IA -- "Sim" --> CL["Claude Vision classifica<br/>(resposta validada contra as 7 categorias)"]:::proc --> GRAVA
    IA -- "Não ou falhou" --> GRAVA["Grava a foto (com a classificação,<br/>se houver = 'verificada')"]:::proc
    GRAVA --> DBF[("photos")]:::db
    GRAVA --> SUG{"Resposta trouxe<br/>sugestão do servidor?"}:::dec
    SUG -- "Sim" --> MOSTRA["Mostra sugestão 'Confirmado pela IA (+10%)'"]:::proc
    SUG -- "Não" --> LOCAL["IA LOCAL no navegador<br/>(TensorFlow.js + MobileNet, funciona offline)"]:::proc --> MOSTRA2["Mostra 'Sugestão do navegador'<br/>(apenas palpite, sem bônus)"]:::proc
    MOSTRA --> FORM
    MOSTRA2 --> FORM
    FORM[/"Morador confirma ou CORRIGE a categoria,<br/>informa kg, data, local e ecoponto"/]:::io
    FORM --> ENV["POST /api/disposals<br/>header Idempotency-Key"]:::proc
    ENV --> IDEM{"Mesma chave já usada<br/>por este usuário?"}:::dec
    IDEM -- "Sim" --> DEV(["Devolve o descarte original<br/>(clique duplo não duplica)"]):::term
    IDEM -- "Não" --> VALID{"Validações ok?<br/>categoria ativa, 0,01 kg até o máximo,<br/>data até 7 dias, lat/lon juntas,<br/>foto do próprio usuário e nunca usada,<br/>ecoponto aceita o material"}:::dec
    VALID -- "Não" --> E400["400 — erro no campo"]:::err --> FORM
    VALID -- "Sim" --> FRAUDE[["Motor antifraude: 8 regras somam o risco 0–100"]]:::sub
    FRAUDE --> SALVA["Grava o descarte como PENDENTE<br/>com pontos estimados e risco"]:::proc
    SALVA --> DBD[("disposals")]:::db
    SALVA --> RISCO{"Risco ≥ 50?"}:::dec
    RISCO -- "Sim" --> FLAG["Marca 'suspeito' (flagged)<br/>auditoria DISPOSAL_FLAGGED"]:::proc --> FILA(["Fica PENDENTE na fila de moderação<br/>(diagrama 4)"]):::term
    RISCO -- "Não" --> AUTO{"Aprovação automática ligada?<br/>(APP_AUTO_APPROVE) e<br/>risco < 20, até 5 kg, com foto"}:::dec
    AUTO -- "Não" --> FILA
    AUTO -- "Sim" --> APR[["Aprovação e crédito de pontos (diagrama 4)"]]:::sub --> FIM(["Descarte APROVADO"]):::term

    classDef term fill:#0f5132,stroke:#0f5132,color:#ffffff
    classDef proc fill:#ecfdf5,stroke:#059669,color:#0a0e0c
    classDef dec fill:#fef9c3,stroke:#a16207,color:#0a0e0c
    classDef io fill:#e0f2fe,stroke:#0369a1,color:#0a0e0c
    classDef db fill:#ede9fe,stroke:#6d28d9,color:#0a0e0c
    classDef sub fill:#f1f5f9,stroke:#334155,color:#0a0e0c
    classDef err fill:#fee2e2,stroke:#b91c1c,color:#0a0e0c
```

**Regras do motor antifraude** (`fraud/rules/`, cada uma é uma classe que implementa `FraudRule`):

| Regra (código) | Dispara quando | Risco |
|---|---|---|
| `FOTO_REPETIDA` (`PhotoReuseRule`) | Mesma foto (SHA-256) já enviada | +60 |
| `FOTO_SEMELHANTE` (`SimilarPhotoRule`) | Foto parecida (dHash) nos últimos 180 dias | +30 (própria) / +40 (de outra pessoa) |
| `LIMITE_DIARIO` (`DailyLimitRule`) | Mais de 50 kg no dia | +35 |
| `CATEGORIA_DIVERGENTE_IA` (`AiMismatchRule`) | IA (confiança ≥ 0,7) discorda da categoria escolhida | +30 (servidor) / +15 (navegador) |
| `DESLOCAMENTO_IMPOSSIVEL` (`LocationJumpRule`) | Saltos ≥ 10 km a mais de 120 km/h | +30 |
| `MUITOS_REGISTROS` (`VelocityRule`) | Mais de 4 registros em 10 min | +30 |
| `QUANTIDADE_ATIPICA` (`QuantityOutlierRule`) | Quantidade ≥ 80 % do máximo da categoria | +20 |
| `SEM_FOTO` (`MissingPhotoRule`) | Acima de 5 kg sem foto | +15 |

A soma é limitada a 100. O palpite da IA do navegador **só pode aumentar** o risco, nunca reduzir nem dar bônus.

---

## 4. Moderação pelo administrador

Código: `disposal/DisposalReviewService.java`, `points/PointsService.credit`, `integrity/LedgerChain.java`, `gamification/GamificationService.java`.

![Moderação](diagramas/fluxo-moderacao.png)

<!-- diagrama: fluxo-moderacao -->
```mermaid
flowchart TD
    INI(["Admin abre 'Moderação'"]):::term --> FILA[/"Fila de PENDENTES<br/>(filtro 'só suspeitos'), foto, risco e motivos"/]:::io
    FILA --> DEC{"Decisão do admin"}:::dec
    DEC -- "Recusar" --> MOT{"Motivo com<br/>3+ caracteres?"}:::dec
    MOT -- "Não" --> EMOT["400 — informe o motivo"]:::err --> DEC
    MOT -- "Sim" --> LOCKR["Trava a linha do descarte<br/>(SELECT ... FOR UPDATE)"]:::proc
    LOCKR --> STR{"Status atual?"}:::dec
    STR -- "RECUSADO" --> IDR(["Devolve como está (idempotente)"]):::term
    STR -- "APROVADO" --> E409R["409 — já aprovado"]:::err
    STR -- "PENDENTE" --> REJ["Status RECUSADO + motivo + revisor<br/>auditoria DISPOSAL_REJECTED"]:::proc --> FIMR(["Morador vê o motivo"]):::term

    DEC -- "Aprovar<br/>(pode corrigir categoria/kg)" --> LOCKA["Trava a linha do descarte"]:::proc
    LOCKA --> STA{"Status atual?"}:::dec
    STA -- "APROVADO" --> IDA(["Devolve sem pontuar de novo<br/>(idempotente)"]):::term
    STA -- "RECUSADO" --> E409A["409 — já recusado"]:::err
    STA -- "PENDENTE" --> PROP{"Descarte é do<br/>próprio admin?"}:::dec
    PROP -- "Sim" --> E422["422 — não pode aprovar o próprio"]:::err
    PROP -- "Não" --> COR{"Admin corrigiu<br/>categoria ou kg?"}:::dec
    COR -- "Sim" --> APLI["Aplica a correção<br/>(respeita o máximo da categoria)"]:::proc --> CALC
    COR -- "Não" --> CALC["Calcula pontos = kg × pontos/kg (mín. 1)<br/>+10% se a IA do SERVIDOR confirma a categoria FINAL"]:::proc
    CALC --> APROV["Status APROVADO, points_awarded, revisor"]:::proc
    APROV --> CRED["Trava a linha do usuário;<br/>saldo += pontos"]:::proc
    CRED --> LED["Lançamento EARN no extrato<br/>seq + 1, hash = HMAC(chave, anterior + campos)"]:::proc
    LED --> DB[("point_transactions<br/>índice único: 1 EARN por descarte")]:::db
    LED --> GAM["Gamificação: desafios concluídos geram BONUS;<br/>medalhas novas"]:::proc
    GAM --> AUD["Auditoria DISPOSAL_APPROVED"]:::proc --> FIMA(["Morador vê os pontos no extrato"]):::term

    classDef term fill:#0f5132,stroke:#0f5132,color:#ffffff
    classDef proc fill:#ecfdf5,stroke:#059669,color:#0a0e0c
    classDef dec fill:#fef9c3,stroke:#a16207,color:#0a0e0c
    classDef io fill:#e0f2fe,stroke:#0369a1,color:#0a0e0c
    classDef db fill:#ede9fe,stroke:#6d28d9,color:#0a0e0c
    classDef err fill:#fee2e2,stroke:#b91c1c,color:#0a0e0c
```

**As duas regras de negócio do edital aparecem aqui:** "apenas descartes aprovados geram pontos" (crédito só neste fluxo + `CHECK ck_disposals_points` no banco) e "cada descarte gera pontos uma única vez" (lock + idempotência + índice único `ux_point_tx_disposal`).

---

## 5. Resgate de recompensa

Código: `reward/RewardService.redeem`, `points/PointsService.debit`.

![Resgate](diagramas/fluxo-resgate.png)

<!-- diagrama: fluxo-resgate -->
```mermaid
flowchart TD
    INI(["Morador abre 'Recompensas'"]):::term --> CAT[/"Catálogo: custo, estoque e saldo atual"/]:::io
    CAT --> CLI["Clica em 'Resgatar'<br/>POST /api/rewards/{id}/redeem"]:::proc
    CLI --> RL{"Dentro do limite de<br/>resgates por usuário?"}:::dec
    RL -- "Não" --> E429["429"]:::err
    RL -- "Sim" --> L1["1º lock: linha do USUÁRIO"]:::proc --> L2["2º lock: linha da RECOMPENSA<br/>(ordem fixa evita deadlock)"]:::proc
    L2 --> ATV{"Recompensa existe<br/>e está ativa?"}:::dec
    ATV -- "Não" --> E404["404"]:::err
    ATV -- "Sim" --> EST{"Estoque > 0?"}:::dec
    EST -- "Não" --> EOUT["409 OUT_OF_STOCK — esgotada"]:::err
    EST -- "Sim" --> SAL{"Saldo ≥ custo?"}:::dec
    SAL -- "Não" --> EPTS["422 INSUFFICIENT_POINTS"]:::err
    SAL -- "Sim" --> DEC["Estoque − 1"]:::proc
    DEC --> VOU["Gera voucher LZ50-XXXX-XXXX (SecureRandom)<br/>grava o resgate (ISSUED)"]:::proc
    VOU --> DEB["Saldo − custo; lançamento REDEEM (valor negativo)<br/>no extrato encadeado"]:::proc
    DEB --> DB[("rewards · redemptions · point_transactions<br/>CHECK stock ≥ 0 e saldo ≥ 0")]:::db
    DEB --> AUD["Auditoria REWARD_REDEEMED"]:::proc --> FIM(["Mostra o voucher ao morador"]):::term

    classDef term fill:#0f5132,stroke:#0f5132,color:#ffffff
    classDef proc fill:#ecfdf5,stroke:#059669,color:#0a0e0c
    classDef dec fill:#fef9c3,stroke:#a16207,color:#0a0e0c
    classDef io fill:#e0f2fe,stroke:#0369a1,color:#0a0e0c
    classDef db fill:#ede9fe,stroke:#6d28d9,color:#0a0e0c
    classDef err fill:#fee2e2,stroke:#b91c1c,color:#0a0e0c
```

Tudo acontece numa **única transação**: se qualquer passo falhar, nada é gravado (nem estoque, nem voucher, nem débito). Os códigos HTTP exatos dos erros de negócio estão em `common/ErrorCode.java`.

---

## 6. Smart Home: leitura IoT e pedido automático de coleta

Código: `household/HouseholdService.java`, `household/SmartBinService.java`, `iot/IotController.java`, `iot/IotSimulator.java`.

![Smart Home](diagramas/fluxo-smarthome.png)

<!-- diagrama: fluxo-smarthome -->
```mermaid
flowchart TD
    subgraph CONF ["Configuração (uma vez, pelo morador)"]
        direction TB
        H1(["Morador abre 'Minha casa'"]):::term --> H2{"Já tem residência?"}:::dec
        H2 -- "Não" --> H3["Cria residência (gera código de convite)<br/>ou entra com o código de outra"]:::proc
        H2 -- "Sim" --> H4
        H3 --> H4["Cadastra lixeira: nome, material,<br/>capacidade (L), limite de pedido (50–100%)"]:::proc
        H4 --> H5[/"Recebe device_id e chave do dispositivo<br/>(mostrada UMA vez; banco guarda só o SHA-256)"/]:::io
    end

    subgraph LEIT ["Cada leitura do sensor"]
        direction TB
        S0(["Sensor real ou simulador<br/>(a cada 90 s)"]):::term --> S1[/"POST /api/iot/readings<br/>X-Device-Id, X-Device-Key, nível e bateria"/]:::io
        S1 --> S2{"Limite por IP e<br/>por dispositivo ok?"}:::dec
        S2 -- "Não" --> SE1["429"]:::err
        S2 -- "Sim" --> S3{"Chave confere?<br/>(hash comparado em tempo constante)"}:::dec
        S3 -- "Não" --> SE2["401 + auditoria IOT_AUTH_FAILED"]:::err
        S3 -- "Sim" --> S4["Trava a lixeira; ajusta valores a 0–100;<br/>atualiza nível/bateria e grava a leitura"]:::proc
        S4 --> S5[("smart_bins · bin_readings")]:::db
        S4 --> S6{"Nível ≥ limite configurado?"}:::dec
        S6 -- "Não" --> SF(["202 — painel mostra o novo nível"]):::term
        S6 -- "Sim" --> S7{"Já existe pedido aberto<br/>para esta lixeira?"}:::dec
        S7 -- "Sim" --> SF
        S7 -- "Não" --> S8["Cria solicitação de coleta automática<br/>origem SMART_BIN, endereço da casa,<br/>kg estimado = litros × nível × densidade do material"]:::proc
        S8 --> S9[("collection_requests<br/>índice único: 1 pedido aberto por lixeira")]:::db
        S8 --> S10["Auditoria SMART_BIN_AUTO_REQUEST"]:::proc --> S11[["Entra na fila de coletas (diagrama 7)"]]:::sub
    end

    H5 -. "configura o dispositivo" .-> S0

    classDef term fill:#0f5132,stroke:#0f5132,color:#ffffff
    classDef proc fill:#ecfdf5,stroke:#059669,color:#0a0e0c
    classDef dec fill:#fef9c3,stroke:#a16207,color:#0a0e0c
    classDef io fill:#e0f2fe,stroke:#0369a1,color:#0a0e0c
    classDef db fill:#ede9fe,stroke:#6d28d9,color:#0a0e0c
    classDef sub fill:#f1f5f9,stroke:#334155,color:#0a0e0c
    classDef err fill:#fee2e2,stroke:#b91c1c,color:#0a0e0c
```

Sem leitura há mais de 6 h, a lixeira aparece como **offline** (`APP_IOT_OFFLINE_HOURS`). Depois que o coletor conclui a parada, a lixeira volta a **0 %** (`SmartBinService.emptyAfterCollection`).

---

## 7. Coleta e rota otimizada

Código: `collection/CollectionRequestService.java`, `collection/PriorityCalculator.java`, `route/RouteService.java`, `route/RouteOptimizer.java`, `route/CollectorController.java`.

![Coleta e rota](diagramas/fluxo-rota.png)

<!-- diagrama: fluxo-rota -->
```mermaid
flowchart TD
    O1(["Solicitações REQUESTED<br/>(do morador pelo mapa ou automáticas da lixeira)"]):::term --> P1["Admin abre 'Coletas e rotas':<br/>lista ordenada por PRIORIDADE 0–100<br/>(volume, espera, eletrônico, nível da lixeira, data)"]:::proc
    P1 --> P2[/"Seleciona solicitações, garagem<br/>e capacidade do caminhão (padrão 1000 kg)"/]:::io
    P2 --> P3{"Todas existem e estão<br/>REQUESTED?"}:::dec
    P3 -- "Não" --> PE["400 — solicitação inválida"]:::err
    P3 -- "Sim" --> A1["Matriz de distâncias double[][]<br/>(fórmula de Haversine)"]:::proc
    A1 --> A2["Vizinho mais próximo com capacidade:<br/>PriorityQueue (min-heap) escolhe a parada<br/>mais próxima que CABE no caminhão"]:::proc
    A2 --> A3{"Ainda cabe alguma parada?"}:::dec
    A3 -- "Sim" --> A2
    A3 -- "Não" --> A4{"Sobrou parada<br/>não visitada?"}:::dec
    A4 -- "Sim" --> A5["Volta à garagem e inicia nova viagem"]:::proc --> A2
    A4 -- "Não" --> A6["2-opt em cada viagem:<br/>inverte trechos enquanto encurtar a rota"]:::proc
    A6 --> A7["Compara com a rota 'ingênua' (ordem de criação)<br/>e fica com a melhor; calcula economia %"]:::proc
    A7 --> A8[/"Pré-visualização no mapa: km, tempo, carga, economia"/]:::io
    A8 --> A9{"Admin confirma?<br/>(nome, data até +90 dias, coletor)"}:::dec
    A9 -- "Não" --> P2
    A9 -- "Sim" --> A10["Cria 1 rota por viagem (PLANNED) com paradas em ordem;<br/>solicitações viram SCHEDULED"]:::proc
    A10 --> DB[("routes · route_stops · collection_requests")]:::db
    A10 --> C1(["Coletor abre 'Minhas rotas'"]):::term
    C1 --> C2["Inicia a rota: IN_PROGRESS;<br/>solicitações IN_ROUTE"]:::proc
    C2 --> C3[/"Na parada: informa kg coletado (opcional)"/]:::io
    C3 --> C4["Parada DONE; solicitação COLLECTED;<br/>se veio de lixeira, ela volta a 0%"]:::proc
    C4 --> C5{"Todas as paradas<br/>concluídas?"}:::dec
    C5 -- "Não" --> C3
    C5 -- "Sim" --> C6(["Rota DONE"]):::term

    classDef term fill:#0f5132,stroke:#0f5132,color:#ffffff
    classDef proc fill:#ecfdf5,stroke:#059669,color:#0a0e0c
    classDef dec fill:#fef9c3,stroke:#a16207,color:#0a0e0c
    classDef io fill:#e0f2fe,stroke:#0369a1,color:#0a0e0c
    classDef db fill:#ede9fe,stroke:#6d28d9,color:#0a0e0c
    classDef err fill:#fee2e2,stroke:#b91c1c,color:#0a0e0c
```

**Cancelamento:** o morador (ou admin) pode cancelar uma solicitação enquanto ela está `REQUESTED` ou `SCHEDULED` em rota ainda `PLANNED`; a parada sai da rota, as demais são renumeradas e distância, tempo e carga são recalculados (`CollectionRoute.removeStop`).
**Por que heurística:** o roteamento com capacidade (CVRP) é NP-difícil; vizinho mais próximo (O(n² log n)) + 2-opt dão uma boa rota em milissegundos.

---

## 8. Bloqueio por inspeção

Código: `frontend/src/security/InspectionGuard.tsx`, `frontend/src/security/shortcuts.ts`, `frontend/src/security/devtoolsDetector.ts`, `security/InspectionService.java`, `admin/AdminService.unlockUser`.

![Bloqueio por inspeção](diagramas/fluxo-inspecao.png)

<!-- diagrama: fluxo-inspecao -->
```mermaid
flowchart TD
    I0(["Usuário logado aperta F12, Ctrl+Shift+I/J/C, Ctrl+U<br/>ou o DevTools é detectado aberto"]):::term --> I1["Front bloqueia o atalho e avisa a API<br/>POST /api/security/inspection-events"]:::proc
    I1 --> I2["Servidor trava a linha do usuário;<br/>zera avisos de bloqueio já vencido"]:::proc
    I2 --> I3{"Já está bloqueado?"}:::dec
    I3 -- "Sim" --> I9
    I3 -- "Não" --> I4{"Último aviso há<br/>menos de 5 s?"}:::dec
    I4 -- "Sim" --> I5(["Mesmo gesto: não conta de novo"]):::term
    I4 -- "Não" --> I6["Avisos + 1; auditoria SECURITY_INSPECTION_WARNING"]:::proc
    I6 --> I7{"Chegou a 3 avisos?"}:::dec
    I7 -- "Não" --> I8(["Front mostra 'Não tente novamente' (aviso N de 3)"]):::term
    I7 -- "Sim" --> I10["security_locked_until = agora + 30 min;<br/>revoga TODAS as sessões;<br/>auditoria SECURITY_INSPECTION_LOCK"]:::proc
    I10 --> I9["Tela de bloqueio; login, refresh e<br/>qualquer requisição recebem 423"]:::err
    I9 --> I11{"Admin desbloqueou?<br/>POST /api/admin/users/{id}/unlock"}:::dec
    I11 -- "Sim" --> I12["Zera avisos, bloqueio por inspeção<br/>e por senha; auditoria USER_UNLOCKED"]:::proc --> IF(["Usuário pode entrar de novo"]):::term
    I11 -- "Não" --> I13{"Passaram 30 min?"}:::dec
    I13 -- "Sim" --> IF
    I13 -- "Não" --> I9

    classDef term fill:#0f5132,stroke:#0f5132,color:#ffffff
    classDef proc fill:#ecfdf5,stroke:#059669,color:#0a0e0c
    classDef dec fill:#fef9c3,stroke:#a16207,color:#0a0e0c
    classDef err fill:#fee2e2,stroke:#b91c1c,color:#0a0e0c
```

O menu de contexto (botão direito) é desativado na área logada, mas **não conta aviso**. **Limite honesto:** bloquear o inspetor é só dissuasão; a proteção real está no servidor (autorização, validação, antifraude, integridade). O navegador apenas avisa; quem conta e bloqueia é a API.

---

## 9. Verificação de integridade (cadeia HMAC)

Código: `integrity/LedgerChain.java`, `integrity/AuditChain.java`, `integrity/ChainHashes.java`, `integrity/IntegrityService.java`, `integrity/IntegrityController.java`.

![Integridade](diagramas/fluxo-integridade.png)

<!-- diagrama: fluxo-integridade -->
```mermaid
flowchart TD
    subgraph GRAVAR ["Ao gravar um lançamento (extrato ou auditoria)"]
        direction TB
        W1(["Novo lançamento"]):::term --> W2["Serializa a escrita:<br/>extrato = lock do usuário · auditoria = advisory lock"]:::proc
        W2 --> W3["Lê o último elo (seq, hash);<br/>primeiro elo usa 64 zeros"]:::proc
        W3 --> W4["seq = último + 1<br/>hash = HMAC-SHA256(chave, seq + prev_hash + campos)"]:::proc
        W4 --> W5[("INSERT (UPDATE/DELETE proibidos por trigger)")]:::db
    end

    subgraph VERIF ["Admin verifica: GET /api/admin/integrity"]
        direction TB
        V1(["Admin clica 'Verificar integridade'"]):::term --> V2["Lê o extrato em fluxo,<br/>ordenado por usuário e seq"]:::proc
        V2 --> V3{"Para cada linha:<br/>seq esperado? prev_hash = hash anterior?<br/>HMAC recalculado confere?<br/>saldo = anterior + valor?"}:::dec
        V3 -- "Não" --> V4["Marca a PRIMEIRA linha quebrada"]:::err
        V3 -- "Sim" --> V5["Lê a auditoria em fluxo (cadeia global)<br/>e confere o último elo conhecido"]:::proc
        V4 --> V5
        V5 --> V6["Confere saldos:<br/>users.points = soma = último saldo;<br/>total_earned = soma dos ganhos"]:::proc
        V6 --> V7{"Tudo íntegro?"}:::dec
        V7 -- "Sim" --> V8(["Relatório OK"]):::term
        V7 -- "Não" --> V9(["Relatório aponta tabela, linha e usuário<br/>+ alerta no log"]):::err
    end

    classDef term fill:#0f5132,stroke:#0f5132,color:#ffffff
    classDef proc fill:#ecfdf5,stroke:#059669,color:#0a0e0c
    classDef dec fill:#fef9c3,stroke:#a16207,color:#0a0e0c
    classDef db fill:#ede9fe,stroke:#6d28d9,color:#0a0e0c
    classDef err fill:#fee2e2,stroke:#b91c1c,color:#0a0e0c
```

A chave HMAC fica **fora do banco** (`APP_INTEGRITY_KEY` ou `data/integrity.key`): quem só tem acesso ao banco não consegue recalcular os hashes depois de alterar um valor.

---

## 10. Diagramas de sequência

### 10.1 Login e renovação da sessão

![Sequência login e refresh](diagramas/seq-login-refresh.png)

<!-- diagrama: seq-login-refresh -->
```mermaid
sequenceDiagram
    autonumber
    actor U as Usuário
    participant F as Front (React)
    participant A as API (Spring Boot)
    participant D as PostgreSQL

    U->>F: abre o site
    F->>A: GET /api/auth/session
    A-->>F: 204 (visitante: sem sessão)
    F->>A: GET /api/auth/csrf
    A-->>F: 204 + cookie XSRF-TOKEN
    U->>F: e-mail e senha
    F->>A: POST /api/auth/login (X-XSRF-TOKEN)
    A->>A: rate limit (IP, e-mail) e bloqueio
    A->>D: SELECT usuário por e-mail
    D-->>A: usuário + password_hash
    A->>A: Argon2id.matches(senha, hash)
    A->>D: INSERT refresh_tokens (SHA-256, nova família)
    A->>D: INSERT audit_log LOGIN_SUCCESS (encadeado)
    A-->>F: 200 UserMe + cookies HttpOnly (JWT 15 min, refresh 7 dias)
    F-->>U: abre /app conforme o perfil

    Note over F,A: 15 minutos depois o JWT vence
    F->>A: GET /api/... (JWT vencido)
    A-->>F: 401
    F->>A: POST /api/auth/refresh (cookie refresh)
    A->>D: SELECT ... FOR UPDATE pelo hash do token
    alt token válido e não usado
        A->>D: revoga (ROTATED) e INSERT novo token da mesma família
        A-->>F: 200 + novos cookies
        F->>A: repete GET /api/...
        A-->>F: 200 dados
    else token já rotacionado reaparece (cópia)
        A->>D: revoga a família inteira (REUSE_DETECTED)
        A->>D: INSERT audit_log REFRESH_TOKEN_REUSE
        A-->>F: 401 + limpa cookies
        F-->>U: volta para /entrar
    end
```

### 10.2 Envio de um descarte

![Sequência descarte](diagramas/seq-descarte.png)

<!-- diagrama: seq-descarte -->
```mermaid
sequenceDiagram
    autonumber
    actor M as Morador
    participant F as Front (React)
    participant A as API (Spring Boot)
    participant IA as IA (Claude Vision)
    participant D as PostgreSQL

    M->>F: escolhe a foto
    F->>A: POST /api/photos (multipart)
    A->>A: valida assinatura e tamanho, reencoda, SHA-256 e dHash
    opt ANTHROPIC_API_KEY configurada
        A->>IA: classifica a imagem (fora da transação)
        IA-->>A: categoria + confiança
    end
    A->>D: INSERT photos (com classificação verificada)
    A-->>F: 201 PhotoUpload (sugestão, verified, suspeita de duplicata)
    alt servidor não sugeriu
        F->>F: MobileNet local (TensorFlow.js) sugere a categoria
    end
    M->>F: confirma ou corrige categoria, kg, local
    F->>A: POST /api/disposals (Idempotency-Key, X-XSRF-TOKEN)
    A->>D: já existe descarte com essa chave?
    A->>A: valida categoria, kg, data, coordenadas, foto e ecoponto
    A->>D: consultas das regras antifraude (histórico, hashes)
    A->>A: FraudEngine soma o risco (0–100)
    A->>D: INSERT disposals (PENDING, risco, pontos estimados)
    alt risco ≥ 50
        A->>D: INSERT audit_log DISPOSAL_FLAGGED
    else aprovação automática ligada e baixo risco
        A->>D: aprova, credita EARN no extrato encadeado
    end
    A-->>F: 201 Disposal (status, pontos estimados)
    F-->>M: "Descarte enviado para análise"
```

---

## 11. Ciclos de vida (estados)

![Estados](diagramas/estados.png)

<!-- diagrama: estados -->
```mermaid
stateDiagram-v2
    direction LR
    state "Descarte" as D {
        [*] --> PENDING : registrado
        PENDING --> APPROVED : admin aprova / aprovação automática
        PENDING --> REJECTED : admin recusa (com motivo)
        APPROVED --> [*]
        REJECTED --> [*]
    }
    state "Solicitação de coleta" as C {
        [*] --> REQUESTED : morador ou lixeira
        REQUESTED --> SCHEDULED : entra em rota
        REQUESTED --> CANCELLED : cancelada
        SCHEDULED --> CANCELLED : cancelada (rota PLANNED)
        SCHEDULED --> IN_ROUTE : coletor inicia a rota
        IN_ROUTE --> COLLECTED : parada concluída
        COLLECTED --> [*]
        CANCELLED --> [*]
    }
    state "Rota" as R {
        [*] --> PLANNED : criada pelo admin
        PLANNED --> IN_PROGRESS : coletor inicia
        IN_PROGRESS --> DONE : todas as paradas concluídas
        DONE --> [*]
    }
```

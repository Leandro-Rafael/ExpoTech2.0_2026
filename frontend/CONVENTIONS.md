# Convenções do front-end — Lixo Zero 2050

Guia curto para quem vai construir as páginas. Leia antes de começar.

## Pastas

```
src/
  api/          client.ts (fetch, CSRF, refresh, ApiError) · módulos por domínio · queries.ts (hooks) · forms.ts
                types.ts = contrato (somente leitura; importe tipos daqui, nunca redefina)
  app/          App.tsx (providers) · router.tsx (rotas lazy) · navigation.ts (menu por perfil)
  auth/         AuthProvider (useAuth/useUser) · guards (RequireAuth, RequireRole, RedirectIfAuthenticated)
  components/   ui/ (kit) · layout/ (AppShell, Sidebar, MobileNav, Logo...) · CategoryIcon · icons.ts
  features/     código específico de uma área (landing/, auth/). Crie features/<area>/ para a sua.
  hooks/        useMediaQuery, useReducedMotion, useGeolocation, useCountUp(Text), useInView, useDocumentTitle
  lib/          format.ts (pt-BR) · labels.ts (enums → rótulo + tom) · category.ts · validation.ts (zod) · cn.ts
  pages/        public/ · app/ · collector/ · admin/  (um arquivo por rota, `export default`)
  styles/       index.css (tokens @theme) · utilities.css
```

Alias `@/` = `src/`.

## Adicionar / substituir uma página

1. As rotas ficam em `app/router.tsx`; cada arquivo em `pages/` exporta a página com `export default`.
2. Página nova: crie o arquivo, registre com `page(() => import(...))` no router e, se tiver menu, em `app/navigation.ts` (`roles` define quais perfis veem a seção).
   Conteúdo do mesmo assunto vira aba de uma tela existente: acrescente-o em `app/hubs.tsx` (`TabbedPage`, aba na URL `?aba=`) e, se a rota antiga existia, mantenha-a com `moved()` no router.
3. Comece sempre com `<PageHeader eyebrow="Seção" title="..." description="..." actions={...} />` (ele também define o título da aba).
4. Estados obrigatórios: carregando (`Skeleton`/`PageSkeleton`), vazio (`EmptyState`), erro (`ErrorState error={q.error} onRetry={q.refetch}`).

## Dados: hooks prontos (`@/api/queries`)

```tsx
const { data, isPending, error, refetch } = useDisposals({ status: 'PENDING', page });
const create = useCreateDisposal();
create.mutate({ body, idempotencyKey }, { onSuccess: () => toast.success('Descarte enviado!') });
```

- Todas as rotas do `docs/API.md` têm função em `api/*.ts` e hook em `queries.ts`. Mutações já invalidam o cache relacionado (e o usuário quando pontos mudam).
- `POST /disposals`: gere `newIdempotencyKey()` UMA vez por intenção (ex.: ao abrir o formulário) e reutilize em re-tentativas.
- Upload: `useUploadPhoto().mutateAsync(file)` · CSV: `const { blob, filename } = await adminApi.disposalsCsv({from,to}); saveBlob(blob, filename ?? 'descartes.csv')`.
- Erros são `ApiError` (`status`, `code`, `detail`, `fieldErrors`, `retryAfter`). Decida pelo **`code`**, nunca pelo status. `errorMessage(err)` dá a mensagem PT pronta para toast.
- O cliente já cuida de: cookies, CSRF, refresh único (single-flight — nunca chame `/auth/refresh` você mesmo), 429/423 com tempo de espera, logout global em sessão expirada.
- Usuário: `const { user, hasRole } = useAuth()`; dentro de `/app`, `useUser()` (nunca nulo). Pontos mudaram? `refreshMe(queryClient)`.

## Formulários (react-hook-form + zod + Field)

```tsx
const schema = z.object({ quantityKg: z.number({ invalid_type_error: 'Informe a quantidade' }).min(0.01).max(50) });
const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { quantityKg: undefined } });

<form onSubmit={form.handleSubmit(async (v) => {
  try { await mutation.mutateAsync(v); toast.success('Salvo'); }
  catch (e) { applyServerErrors(e, form.setError); }   // erros de campo → campos; resto → root.server + toast
})} noValidate>
  <FormError error={form.formState.errors.root?.server} />
  <Field label="Quantidade" error={form.formState.errors.quantityKg} required>
    <Controller control={form.control} name="quantityKg"
      render={({ field }) => <NumberInput {...field} unit="kg" decimals={2} min={0.01} max={50} />} />
  </Field>
  <Button type="submit" loading={form.formState.isSubmitting}>Enviar</Button>
</form>
```

- Campos numéricos: **sempre `NumberInput`** (bloqueia teclado/colar/arrastar não numéricos; requisito avaliado).
- Textos: `Input`/`Textarea` com `{...register('x')}`. Senha: `PasswordInput` + `passwordSchema` de `lib/validation`.
- `Field` liga rótulo, dica e erro ao controle: `Input`, `NumberInput`, `Select` e `Textarea` recebem `id`, `aria-invalid` e `aria-describedby` via contexto — inclusive dentro de `<Controller>`. Controles próprios: use a forma função `{(a11y) => <X {...a11y} />}`.

## Kit de UI (`@/components/ui`)

| Componente | Uso |
|---|---|
| `Button` / `ButtonLink` | `variant` primary · secondary · ghost · outline · danger · link; `size` sm · md(44px) · lg(48px) · xl; `loading`, `leftIcon`, `rightIcon` |
| `IconButton` | só ícone; `label` obrigatório (aria-label) |
| `Input`, `PasswordInput`, `NumberInput`, `Textarea`, `Select`, `Checkbox`, `Switch` | controles; `invalid` ou via `Field` |
| `Field`, `FormError` | rótulo + dica + erro; erro geral do form |
| `Badge`, `StatusPill` | `<StatusPill map={disposalStatus} value={d.status} />` (mapas em `lib/labels`) |
| `Modal`, `Drawer`, `ConfirmDialog` | foco preso, Esc, scroll travado; Drawer `side="bottom"` no celular |
| `Tabs` + `TabPanel` | setas/Home/End; `idBase` liga aba ↔ painel |
| `Tooltip` | hover + foco |
| `Skeleton`, `SkeletonText`, `SkeletonCard`, `PageSkeleton`, `Spinner` | carregamento |
| `EmptyState`, `ErrorState` | vazio / erro com "Tentar novamente" |
| `StatTile` | KPI com número em mono e contagem animada (`variant="plain"` para grupos com divisórias) |
| `ProgressBar` | valor 0..1 (mesma convenção da API) |
| `Avatar`, `Pagination` (base 0), `PageHeader` · tabelas do admin: `AdminTable` (`features/admin/ui`) | — |
| `toast` | re-export do sonner: `toast.success/error` |
| `CategoryIcon` | `<CategoryIcon icon={c.icon} color={c.color} code={c.code} />` (ícones em `components/icons.ts`) |

Formatação sempre por `lib/format` (`formatKg`, `formatNumber`, `formatPercent`, `formatDate`, `formatRelative`...). Rótulos de enum por `lib/labels`.

## Sistema visual

**Tipografia**
- `font-display` (Fraunces): **apenas** h1/h2 (o CSS base já aplica). Nunca em botões, rótulos, cards ou números de UI.
- `font-sans` (Geist): toda a interface. Corpo 15–17px, `leading-relaxed`, até ~60ch. h3+ em Geist semibold.
- `font-mono` (Geist Mono): números, dados, códigos, datas curtas e rótulos `label-mono` ("01 / Seção", eyebrows). Use `tabular`.
- Escala: `text-display` (h1 de landing), `text-headline` (h2), `text-title`; títulos de página usam o `PageHeader`.
- Ênfase: peso ou itálico da Fraunces — **no máximo uma vez por tela**. Sem texto em gradiente.

**Cor**
- Base neutra: `bg`, `surface`, `surface-2/3`, `line`, `line-strong`. Texto: `fg` > `fg-soft` > `muted` > `subtle` (todos AA).
- **Acento lima (`accent`)**: só no CTA primário, no foco e em um destaque-chave. Um botão primário por área.
- **Esmeralda (`brand-*`)**: dados e estados positivos (gráficos, progresso, "aprovado"), e a cena 3D.
- Semânticas: `success`, `warning`, `danger`, `info` apenas para estado. Categorias usam a cor da API (`CategoryIcon`, `categoryChipStyle`).
- Sem sombras coloridas/brilho. Profundidade = hairline + realce interno de 1px + sombra neutra.

**Superfícies e forma**
- Um estilo de cartão: `surface` (ou `Card`). Popovers/modais: `surface-raised`. Prefira divisórias (`border-line`, `divide-line`) a caixas dentro de caixas.
- Raios curtos: `rounded-lg` (10) controles, `rounded-xl` (12), `rounded-2xl` (16) cartões. Evite maiores.
- Nada de `backdrop-filter` sobre conteúdo animado; `glass-blur` só em elementos pequenos sobre conteúdo estático.

**Movimento**
- Uma linguagem: opacidade + 8–14px de deslocamento, 0,5–0,6s, curva `cubic-bezier(0.22,1,0.36,1)` (GSAP `power3.out`), escalonamento ≤ 0,06s.
- Anime só `transform`/`opacity`. Nada de zoom/bounce. Transições de página já vêm do `AppShell`.
- `prefers-reduced-motion` é respeitado globalmente (CSS + `MotionConfig`); em efeitos JS use `prefersReducedMotion()`.
- Contagens numéricas: `useCountUpText` (escreve no DOM, sem re-render por quadro).

**Desempenho**
- Bibliotecas pesadas só em páginas lazy: `recharts` (chunk charts), `leaflet`, `@tensorflow/*` (tfjs), `three`. Não importe-as em `components/`, `lib/` ou `api/` (vão para o chunk inicial `core`).
- Nada de `setState` em `scroll`/`pointermove`; use refs. Listas longas: paginação da API.

## Segurança

- Nunca `dangerouslySetInnerHTML`; texto do usuário sempre como texto.
- Nunca guarde token/sessão em `localStorage` (a sessão é cookie HttpOnly). `localStorage` só para preferências de UI.
- Redirecionamentos: use `safeRedirect()` (só caminhos internos).
- CSP: sem scripts inline; imagens de mapa só de `https://*.basemaps.cartocdn.com`.

## Contas de demonstração

admin@ecotechzero.com.br / EcoTech@2050 · coletor@ecotechzero.com.br / Coleta@2050 · morador@ecotechzero.com.br / Recicla@2050

> Atualização (CSP): o mapa usa tiles do OpenStreetMap em `https://tile.openstreetmap.org/{z}/{x}/{y}.png`; a CSP do back-end (`img-src`) libera `https://tile.openstreetmap.org` e `https://*.tile.openstreetmap.org`, além de `https://*.basemaps.cartocdn.com`.

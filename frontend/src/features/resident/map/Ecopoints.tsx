import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Crosshair, ExternalLink, LocateFixed, MapPin, Navigation } from 'lucide-react';
import { useCategorias, useEcopontos } from '@/api/queries';
import type { CategoryCode, CollectionPoint } from '@/api/types';
import { IconeCategoria } from '@/components/CategoryIcon';
import { CategoryMarker, FitBounds, MapView, PositionMarker, type LatLngTuple } from '@/components/map';
import { Botao, EstadoVazio, EstadoErro, Selecao, EsqueletoTexto } from '@/components/ui';
import { useGeolocalizacao } from '@/hooks/useGeolocation';
import { cn } from '@/lib/cn';
import { corDaCategoria, hexComAlfa } from '@/lib/category';
import { formatarDistanciaKm } from '@/lib/format';
import { categoriaPadrao, CODIGOS_CATEGORIA } from '@/lib/labels';

const RAIOS = [1, 3, 5, 10, 25];

// Mapa e lista de ecopontos, filtrando por material e ordenando pela distância de quem está usando.
export function Ecopontos() {
  const geo = useGeolocalizacao();
  const categorias = useCategorias();
  const [categoria, setCategoria] = useState<CategoryCode | null>(null);
  const [raio, setRaio] = useState<number | null>(null);
  const [idSelecionado, setIdSelecionado] = useState<string | null>(null);
  const localizado = geo.status === 'success' && geo.latitude != null;
  const q = useEcopontos({
    lat: localizado ? Number(geo.latitude!.toFixed(5)) : undefined,
    lon: localizado ? Number(geo.longitude!.toFixed(5)) : undefined,
    radiusKm: localizado && raio ? raio : undefined,
    category: categoria ?? undefined,
  });
  const pontos = useMemo(() => (q.data ?? []).filter((p) => p.active), [q.data]);
  const selecionado = pontos.find((p) => p.id === idSelecionado) ?? null;
  const categoriaPorCodigo = useMemo(() => new Map((categorias.data ?? []).map((c) => [c.code, c])), [categorias.data]);
  const refLista = useRef<HTMLUListElement>(null);

  // Mantém o item selecionado visível na lista.
  useEffect(() => {
    if (!idSelecionado) return;
    refLista.current?.querySelector(`[data-id="${CSS.escape(idSelecionado)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [idSelecionado]);

  const minhaPosicao: LatLngTuple | null = localizado ? [geo.latitude!, geo.longitude!] : null;
  const pontosEnquadrar: LatLngTuple[] = selecionado
    ? [[selecionado.latitude, selecionado.longitude]]
    : [...pontos.map((p) => [p.latitude, p.longitude] as LatLngTuple), ...(minhaPosicao ? [minhaPosicao] : [])];

  return (
    <div>
      {/* Filtros: uma linha, acima do mapa */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="group" aria-label="Filtrar por material">
          <FiltroMaterial ativo={categoria === null} onClick={() => setCategoria(null)}>Todos</FiltroMaterial>
          {CODIGOS_CATEGORIA.map((code) => {
            const c = categoriaPorCodigo.get(code);
            const cor = corDaCategoria(code, c?.color);
            return (
              <FiltroMaterial key={code} ativo={categoria === code} cor={cor} onClick={() => setCategoria(categoria === code ? null : code)}>
                <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: cor }} />{c?.name ?? categoriaPadrao[code].name}
              </FiltroMaterial>
            );
          })}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {localizado ? (
            <Selecao tamanhoCampo="sm" aria-label="Distância máxima" value={raio ?? ''} onChange={(e) => setRaio(e.target.value ? Number(e.target.value) : null)} className="w-40">
              <option value="">Qualquer distância</option>
              {RAIOS.map((r) => <option key={r} value={r}>Até {r} km</option>)}
            </Selecao>
          ) : (
            <Botao size="sm" variant="secondary" iconeEsquerda={geo.status === 'loading' ? Crosshair : LocateFixed} carregando={geo.status === 'loading'} onClick={geo.request}>
              Perto de mim
            </Botao>
          )}
        </div>
      </div>
      {geo.status === 'error' && <p className="mb-4 text-sm text-warning">{geo.erro} Os ecopontos aparecem sem ordenação por distância.</p>}

      <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-line lg:h-[640px] lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="order-2 flex min-h-0 flex-col border-line lg:order-1 lg:border-r">
          <div className="flex items-center justify-between border-b border-line px-4 py-3 text-xs text-subtle">
            <span aria-live="polite"><span className="font-mono text-fg-soft tabular">{pontos.length}</span> {pontos.length === 1 ? 'ecoponto' : 'ecopontos'}{localizado ? ' · do mais perto ao mais longe' : ''}</span>
          </div>
          {q.isPending ? <div className="p-4"><EsqueletoTexto linhas={8} /></div> : q.error ? <EstadoErro compacto erro={q.error} aoTentarDeNovo={q.refetch} /> :
            pontos.length === 0 ? (
              <EstadoVazio compacto icon={MapPin} title="Nenhum ecoponto com esses filtros"
                description={raio ? 'Aumente a distância ou escolha outro material.' : 'Escolha outro material.'}
                acao={<Botao size="sm" variant="secondary" onClick={() => { setCategoria(null); setRaio(null); }}>Limpar filtros</Botao>} />
            ) : (
              <ul ref={refLista} className="max-h-[420px] min-h-0 flex-1 divide-y divide-line overflow-y-auto lg:max-h-none" data-lenis-prevent>
                {pontos.map((p) => (
                  <ItemPonto key={p.id} p={p} selecionado={p.id === idSelecionado} aoSelecionar={() => setIdSelecionado(p.id === idSelecionado ? null : p.id)} categoriaPorCodigo={categoriaPorCodigo} />
                ))}
              </ul>
            )}
        </div>
        <div className="relative order-1 h-[340px] lg:order-2 lg:h-auto">
          <MapView className="absolute inset-0" ariaLabel="Mapa de ecopontos" aoClicarMapa={() => setIdSelecionado(null)}>
            {pontosEnquadrar.length > 0 && <FitBounds pontos={pontosEnquadrar} maxZoom={selecionado ? 16 : 15} />}
            {minhaPosicao && <PositionMarker position={minhaPosicao} label="Você está aqui" />}
            {pontos.map((p) => {
              const principal = categoria ?? p.categories[0];
              const c = categoriaPorCodigo.get(principal);
              return (
                <CategoryMarker key={p.id} position={[p.latitude, p.longitude]} codigo={principal} cor={c?.color} icon={c?.icon}
                  selecionado={p.id === idSelecionado} esmaecido={!!idSelecionado && p.id !== idSelecionado}
                  label={p.name} tooltip={p.name} onClick={() => setIdSelecionado(p.id)} zIndexOffset={p.id === idSelecionado ? 1000 : 0} />
              );
            })}
          </MapView>
        </div>
      </div>
    </div>
  );
}

function FiltroMaterial({ ativo, onClick, children, cor }: { ativo: boolean; onClick: () => void; children: React.ReactNode; cor?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={ativo}
      className={cn('inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs whitespace-nowrap transition-colors',
        ativo ? 'border-transparent text-fg' : 'border-line text-muted hover:border-line-strong hover:text-fg')}
      style={ativo ? { backgroundColor: cor ? hexComAlfa(cor, 0.12) : 'rgb(255 255 255 / 0.06)', boxShadow: `inset 0 0 0 1px ${cor ? hexComAlfa(cor, 0.5) : 'rgb(236 239 234 / 0.24)'}` } : undefined}>
      {children}
    </button>
  );
}

function ItemPonto({ p, selecionado, aoSelecionar, categoriaPorCodigo }: {
  p: CollectionPoint; selecionado: boolean; aoSelecionar: () => void; categoriaPorCodigo: Map<CategoryCode, { color: string; icon: string; name: string }>;
}) {
  const linkRota = `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}`;
  return (
    <li data-id={p.id} className={cn('transition-colors', selecionado && 'bg-white/[0.035]')}>
      <button type="button" onClick={aoSelecionar} aria-expanded={selecionado} className="flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-white/[0.02]">
        <MapPin className={cn('mt-0.5 size-4 shrink-0', selecionado ? 'text-fg' : 'text-subtle')} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-fg">{p.name}</span>
          <span className="block truncate text-xs text-subtle">{p.neighborhood}</span>
          <span className="mt-2 flex flex-wrap gap-1">
            {p.categories.map((code) => {
              const c = categoriaPorCodigo.get(code);
              return <IconeCategoria key={code} codigo={code} icon={c?.icon} cor={c?.color} variant="plain" size="sm" label={c?.name ?? categoriaPadrao[code].name} />;
            })}
          </span>
        </span>
        {p.distanceKm != null && <span className="shrink-0 font-mono text-xs text-fg-soft tabular">{formatarDistanciaKm(p.distanceKm)}</span>}
      </button>
      {selecionado && (
        <div className="space-y-3 px-4 pb-4 pl-11 text-sm">
          <p className="text-fg-soft">{p.address}</p>
          <p className="flex items-start gap-2 text-muted"><Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden />{p.openingHours}</p>
          <p className="text-xs text-subtle">Recebe: {p.categories.map((c) => categoriaPorCodigo.get(c)?.name ?? categoriaPadrao[c].name).join(', ')}</p>
          <a href={linkRota} target="_blank" rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-xs font-medium text-fg transition-colors hover:bg-white/[0.04]">
            <Navigation className="size-3.5" aria-hidden />Como chegar<ExternalLink className="size-3 text-subtle" aria-hidden />
            <span className="sr-only">(abre o Google Maps em nova aba)</span>
          </a>
        </div>
      )}
    </li>
  );
}

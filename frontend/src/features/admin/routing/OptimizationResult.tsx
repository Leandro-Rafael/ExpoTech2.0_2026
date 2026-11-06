import { useState } from 'react';
import { ChevronDown, Route as RouteIcon } from 'lucide-react';
import type { RouteOptimization } from '@/api/types';
import { CaixaSelecao } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatarDistanciaKm, formatarKg, formatarMinutos, formatarNumero } from '@/lib/format';
import { Medidor } from '../ui';
import { corDaRota } from './shared';

interface Props {
  resultado: RouteOptimization;
  capacidadeKg: number;
  mostrarIngenua: boolean;
  aoMostrarIngenua: (v: boolean) => void;
  emFoco: number | null;
  aoFocar: (i: number | null) => void;
  desatualizado: boolean;
}

/** Resumo da otimização: economia, comparação com a ordem ingênua, viagens e "como funciona". */
export function ResultadoOtimizacao({ resultado, capacidadeKg, mostrarIngenua, aoMostrarIngenua, emFoco, aoFocar, desatualizado }: Props) {
  const [explicar, setExplicar] = useState(false);
  const economizado = Math.max(0, resultado.naiveTotalDistanceKm - resultado.totalDistanceKm);
  const minutos = resultado.routes.reduce((s, r) => s + r.estimatedMinutes, 0);
  const proporcao = resultado.naiveTotalDistanceKm > 0 ? resultado.totalDistanceKm / resultado.naiveTotalDistanceKm : 1;

  return (
    <section aria-labelledby="opt-title" className={cn('surface rounded-2xl', desatualizado && 'opacity-60')}>
      <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div>
          <p id="opt-title" className="label-mono">Resultado da otimização</p>
          <p className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-[44px] leading-none font-medium tracking-[-0.04em] text-fg tabular">{formatarNumero(resultado.savingsPercent, 1)}%</span>
            <span className="text-sm text-muted">menos distância</span>
          </p>
          <p className="mt-2 text-[13.5px] text-muted">
            <span className="font-mono text-fg-soft tabular">{formatarDistanciaKm(economizado)}</span> a menos que atender na ordem de chegada ·{' '}
            <span className="font-mono text-fg-soft tabular">{resultado.routes.length}</span> {resultado.routes.length === 1 ? 'viagem' : 'viagens'} ·{' '}
            <span className="font-mono text-fg-soft tabular">{formatarMinutos(minutos)}</span> estimados
          </p>
          {desatualizado && <p className="mt-2 text-[13px] text-warning">A seleção mudou — otimize novamente para atualizar.</p>}
        </div>

        {/* Comparação lado a lado */}
        <div className="space-y-3.5" aria-label="Comparação de distância">
          <div>
            <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
              <span className="text-fg-soft">Rota otimizada</span>
              <span className="font-mono text-fg tabular">{formatarDistanciaKm(resultado.totalDistanceKm)}</span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-brand-300" style={{ width: `${Math.max(4, proporcao * 100)}%` }} /></div>
          </div>
          <div>
            <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
              <span className="text-muted">Ordem de chegada (ingênua)</span>
              <span className="font-mono text-muted tabular">{formatarDistanciaKm(resultado.naiveTotalDistanceKm)}</span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.06]"><div className="h-full w-full rounded-full bg-[repeating-linear-gradient(90deg,rgb(200_206_201/0.5)_0_6px,transparent_6px_10px)]" /></div>
          </div>
          <CaixaSelecao checked={mostrarIngenua} onChange={(e) => aoMostrarIngenua(e.target.checked)} label={<span className="text-[13px] font-normal text-fg-soft">Mostrar a rota ingênua no mapa (tracejado)</span>} />
        </div>
      </div>

      {/* Viagens */}
      <div className="border-t border-line">
        <table className="w-full text-[13px]">
          <caption className="sr-only">Viagens otimizadas</caption>
          <thead>
            <tr className="text-[11px] tracking-[0.06em] text-subtle uppercase">
              <th scope="col" className="px-5 py-2.5 text-left font-medium sm:px-6">Viagem</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Distância</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium max-sm:hidden">Tempo</th>
              <th scope="col" className="w-[30%] px-5 py-2.5 text-left font-medium sm:px-6">Carga</th>
            </tr>
          </thead>
          <tbody>
            {resultado.routes.map((r, i) => {
              const economia = r.naiveDistanceKm > 0 ? 1 - r.distanceKm / r.naiveDistanceKm : 0;
              return (
                <tr key={i} tabIndex={0}
                  onMouseEnter={() => aoFocar(i)} onMouseLeave={() => aoFocar(null)} onFocus={() => aoFocar(i)} onBlur={() => aoFocar(null)}
                  className={cn('border-t border-line/70 transition-colors focus-visible:outline-offset-[-2px]', emFoco === i && 'bg-white/[0.035]')}>
                  <td className="px-5 py-3 sm:px-6">
                    <span className="flex items-center gap-2.5">
                      <span aria-hidden className="h-0.5 w-5 rounded-full" style={{ backgroundColor: corDaRota(i) }} />
                      <span className="font-medium text-fg">Viagem {i + 1}</span>
                      <span className="text-muted">{r.stops.length} {r.stops.length === 1 ? 'parada' : 'paradas'}</span>
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular">
                    <span className="text-fg">{formatarDistanciaKm(r.distanceKm)}</span>
                    {economia > 0.001 && <span className="ml-1.5 text-[11.5px] text-success">−{formatarNumero(economia * 100, 0)}%</span>}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-fg-soft tabular max-sm:hidden">{formatarMinutos(r.estimatedMinutes)}</td>
                  <td className="px-5 py-3 sm:px-6">
                    <span className="flex items-center gap-3">
                      <Medidor value={r.loadKg / capacidadeKg} tone={r.loadKg / capacidadeKg > 0.9 ? 'warning' : 'brand'} label={`Carga da viagem ${i + 1}`} />
                      <span className="shrink-0 font-mono text-[12px] text-muted tabular">{formatarKg(r.loadKg)}</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Algoritmo */}
      <div className="border-t border-line px-5 py-3.5 sm:px-6">
        <button type="button" onClick={() => setExplicar((e) => !e)} aria-expanded={explicar}
          className="flex w-full items-center justify-between gap-3 text-left">
          <span className="flex min-w-0 items-center gap-2.5 text-[13px]">
            <RouteIcon className="size-4 shrink-0 text-subtle" aria-hidden />
            <span className="truncate text-fg-soft">{resultado.algorithm}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-[13px] text-muted">Como funciona <ChevronDown className={cn('size-4 transition-transform', explicar && 'rotate-180')} aria-hidden /></span>
        </button>
        {explicar && (
          <ol className="mt-4 grid gap-4 text-[13px] leading-relaxed text-muted sm:grid-cols-3">
            {[
              ['Distâncias', 'Calcula a distância real (Haversine) entre a central e cada endereço — uma matriz de todos contra todos.'],
              ['Vizinho mais próximo', 'Sai da central e vai sempre ao ponto mais perto que ainda cabe no caminhão. Lotou? Volta e começa outra viagem.'],
              ['2-opt', 'Inverte trechos da rota sempre que isso encurta o caminho, até não haver mais ganho. Elimina os “cruzamentos”.'],
            ].map(([t, d], i) => (
              <li key={t} className="border-t border-line pt-3">
                <span className="font-mono text-[11px] text-subtle">0{i + 1}</span>
                <p className="mt-1 font-medium text-fg-soft">{t}</p>
                <p className="mt-1">{d}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

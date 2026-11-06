import { cn } from '@/lib/cn';

/** Bloco de carregamento com shimmer. Dê dimensões via className: `<Skeleton className="h-6 w-40" />` */
export function Esqueleto({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton', className)} />;
}

export function EsqueletoTexto({ linhas = 3, className }: { linhas?: number; className?: string }) {
  return (
    <div aria-hidden className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="skeleton h-3.5" style={{ width: i === linhas - 1 ? '60%' : `${92 - i * 6}%` }} />
      ))}
    </div>
  );
}

export function EsqueletoCartao({ className, linhas = 3 }: { className?: string; linhas?: number }) {
  return (
    <div aria-hidden className={cn('glass rounded-2xl p-5', className)}>
      <div className="mb-5 flex items-center gap-3">
        <Esqueleto className="size-10 rounded-xl" />
        <div className="flex-1 space-y-2"><Esqueleto className="h-4 w-1/3" /><Esqueleto className="h-3 w-1/2" /></div>
      </div>
      <EsqueletoTexto linhas={linhas} />
    </div>
  );
}

/** Esqueleto de página (usado no Suspense das rotas). */
export function EsqueletoPagina() {
  return (
    <div className="animate-fade-up space-y-6" role="status" aria-label="Carregando página">
      <div className="space-y-3">
        <Esqueleto className="h-3 w-24" />
        <Esqueleto className="h-8 w-72 max-w-full" />
        <Esqueleto className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <Esqueleto key={i} className="h-28 rounded-2xl" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <EsqueletoCartao className="lg:col-span-2" linhas={5} />
        <EsqueletoCartao linhas={5} />
      </div>
    </div>
  );
}

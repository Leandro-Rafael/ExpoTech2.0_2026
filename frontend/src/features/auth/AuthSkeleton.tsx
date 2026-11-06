import { Esqueleto } from '@/components/ui/Skeleton';
import { Logo } from '@/components/layout/Logo';

/** Esqueleto com o mesmo layout de /entrar e /cadastro (enquanto o chunk da página carrega). */
export function EsqueletoAuth() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1fr]" role="status" aria-label="Carregando">
      <aside aria-hidden className="relative hidden overflow-hidden border-r border-line bg-bg lg:flex lg:flex-col">
        <img src="/scene/ring-desktop.webp" alt="" className="absolute inset-0 size-full object-cover object-[78%_45%] opacity-90" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(10_14_12/0.2)_0%,rgb(10_14_12/0)_35%,rgb(10_14_12/0.85)_72%,#0a0e0c_100%)]" />
        <div className="relative z-10 p-10 xl:p-12"><Logo size={30} /></div>
      </aside>
      <div className="flex flex-col">
        <div className="container-app flex h-16 items-center lg:hidden"><Logo size={28} /></div>
        <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-[400px] space-y-4">
            <Esqueleto className="h-10 w-3/4" />
            <Esqueleto className="h-4 w-full" />
            <div className="h-6" />
            <Esqueleto className="h-3 w-16" />
            <Esqueleto className="h-12 w-full" />
            <Esqueleto className="h-3 w-16" />
            <Esqueleto className="h-12 w-full" />
            <Esqueleto className="h-12 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

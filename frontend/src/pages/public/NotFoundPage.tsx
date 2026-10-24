import { useLocation } from 'react-router';
import { ArrowLeft, Compass } from 'lucide-react';
import { ButtonLink, EmptyState } from '@/components/ui';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Logo } from '@/components/layout/Logo';

export default function NotFoundPage() {
  const { pathname } = useLocation();
  const inApp = pathname.startsWith('/app');
  useDocumentTitle('Página não encontrada');
  const content = (
    <div className="relative">
      <p aria-hidden className="pointer-events-none absolute inset-x-0 -top-10 text-center font-mono text-[160px] leading-none font-medium text-white/[0.03] select-none sm:text-[220px]">404</p>
      <EmptyState
        icon={Compass}
        title="Esta página foi para a reciclagem"
        description="O endereço que você acessou não existe ou foi movido. Que tal voltar e continuar reduzindo o desperdício?"
        action={<ButtonLink to={inApp ? '/app' : '/'} leftIcon={ArrowLeft}>{inApp ? 'Voltar ao painel' : 'Voltar ao início'}</ButtonLink>}
      />
    </div>
  );
  if (inApp) return content;
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="container-app flex h-16 items-center"><a href="/" aria-label="Início"><Logo size={32} /></a></header>
      <main className="container-app flex flex-1 items-center justify-center pb-16">{content}</main>
    </div>
  );
}

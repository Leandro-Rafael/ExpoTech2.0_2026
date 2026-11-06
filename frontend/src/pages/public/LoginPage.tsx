// Tela de login, com atalhos para as contas de demonstração usadas na feira.
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Check, Copy, KeyRound, Lock, Mail, ShieldAlert, Timer, UserRound, Truck, ShieldCheck } from 'lucide-react';
import { ErroApi, aplicarErrosDoServidor, mensagemDeErro } from '@/api';
import { useAutenticacao } from '@/auth/AuthProvider';
import { redirecionamentoSeguro } from '@/auth/guards';
import { Botao, Campo, ErroFormulario, BotaoIcone, CampoTexto, CampoSenha, toast } from '@/components/ui';
import { LayoutAuth } from '@/features/auth/AuthLayout';
import { useEspera } from '@/features/auth/useCooldown';
import { useTituloDocumento } from '@/hooks/useDocumentTitle';
import { esquemaEmail } from '@/lib/validation';
import { cn } from '@/lib/cn';
import { limparAvisoBloqueio, lerAvisoBloqueio } from '@/security/lockNotice';

const esquema = z.object({
  email: esquemaEmail,
  password: z.string().min(1, 'Informe sua senha').max(128, 'Senha muito longa'),
});
type ValoresFormulario = z.infer<typeof esquema>;

const CONTAS_DEMO = [
  { role: 'Administrador', icon: ShieldCheck, email: 'admin@ecotechzero.com.br', password: 'EcoTech@2050' },
  { role: 'Coletor', icon: Truck, email: 'coletor@ecotechzero.com.br', password: 'Coleta@2050' },
  { role: 'Morador', icon: UserRound, email: 'morador@ecotechzero.com.br', password: 'Recicla@2050' },
];

export default function PaginaLogin() {
  useTituloDocumento('Entrar');
  const { login: entrar } = useAutenticacao();
  const navegar = useNavigate();
  const localizacao = useLocation();
  const espera = useEspera();
  const [bloqueio, setBloqueio] = useState<string | null>(lerAvisoBloqueio); // bloqueio por inspeção vindo do app
  const [preenchida, setPreenchida] = useState<string | null>(null);
  const [copiada, setCopiada] = useState<string | null>(null);

  const formulario = useForm<ValoresFormulario>({ resolver: zodResolver(esquema), defaultValues: { email: '', password: '' }, mode: 'onTouched' });
  const { register, handleSubmit, setValue, setError, formState: { errors, isSubmitting } } = formulario;

  const aoEnviar = handleSubmit(async (valores) => {
    // 1. Envia e-mail e senha; se der certo, o AuthProvider guarda a sessão.
    setBloqueio(null);
    try {
      const usuario = await entrar(valores);
      limparAvisoBloqueio();
      toast.success(`Bem-vindo(a) de volta, ${usuario.name.split(' ')[0]}!`);
      // 2. Volta para a página que a pessoa tentava abrir (safeRedirect só aceita endereços do próprio site).
      navegar(redirecionamentoSeguro(localizacao.search), { replace: true });
    } catch (e) {
      // 3. Erros tratados um a um: conta bloqueada após muitas tentativas, excesso de pedidos (espera
      //    alguns segundos), conta desativada e senha errada (sem dizer qual dos dois campos errou).
      if (e instanceof ErroApi && e.code === 'ACCOUNT_LOCKED') {
        setBloqueio(mensagemDeErro(e));
        if (e.retryAfter) espera.start(e.retryAfter);
        return;
      }
      if (e instanceof ErroApi && e.ehLimiteExcedido) {
        espera.start(e.retryAfter ?? 30);
        setError('root.server', { message: mensagemDeErro(e) });
        return;
      }
      if (e instanceof ErroApi && e.code === 'FORBIDDEN') {
        setError('root.server', { message: 'Esta conta está desativada. Fale com a administração.' });
        return;
      }
      if (e instanceof ErroApi && e.code === 'BAD_CREDENTIALS') {
        setError('root.server', { message: 'E-mail ou senha incorretos. Confira e tente novamente.' });
        setValue('password', '');
        return;
      }
      aplicarErrosDoServidor(e, setError, { knownFields: ['email', 'password'], toast: false });
    }
  });

  const copiarDemo = async (d: (typeof CONTAS_DEMO)[number]) => {
    try {
      await navigator.clipboard.writeText(`${d.email}\n${d.password}`);
      setCopiada(d.email);
      window.setTimeout(() => setCopiada(null), 1600);
    } catch {
      toast.error('Não foi possível copiar. Use o botão "Usar".');
    }
  };

  const preencherDemo = (d: (typeof CONTAS_DEMO)[number]) => {
    setValue('email', d.email, { shouldValidate: true, shouldDirty: true });
    setValue('password', d.password, { shouldValidate: true, shouldDirty: true });
    setPreenchida(d.email);
    formulario.clearErrors('root');
  };

  return (
    <LayoutAuth
      title="Entrar na sua conta"
      subtitulo="Acompanhe seus descartes, pontos e o impacto da sua casa."
      rodape={<>Ainda não tem conta? <Link to={`/cadastro${localizacao.search}`} className="font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg">Criar conta grátis</Link></>}
    >
      <form onSubmit={aoEnviar} noValidate className="space-y-5">
        {bloqueio && (
          <div role="alert" className="flex gap-3 rounded-xl border border-warning/30 bg-warning/[0.08] p-3.5 text-sm text-warning">
            <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div>
              <p className="font-medium">Conta temporariamente bloqueada</p>
              <p className="mt-0.5 text-warning/85">{bloqueio}</p>
            </div>
          </div>
        )}
        <ErroFormulario erro={errors.root?.server} />

        <Campo label="E-mail" erro={errors.email} required>
          <CampoTexto type="email" autoComplete="email" inputMode="email" iconeEsquerda={Mail} placeholder="voce@exemplo.com" tamanhoCampo="lg" {...register('email')} />
        </Campo>
        <Campo label="Senha" erro={errors.password} required>
          <CampoSenha autoComplete="current-password" iconeEsquerda={Lock} placeholder="Sua senha" tamanhoCampo="lg" {...register('password')} />
        </Campo>

        <Botao type="submit" size="lg" larguraTotal carregando={isSubmitting} disabled={espera.active} iconeDireita={espera.active ? undefined : ArrowRight}>
          {espera.active ? <span className="inline-flex items-center gap-2"><Timer className="size-4" aria-hidden /> Aguarde {espera.remaining}s</span> : 'Entrar'}
        </Botao>
      </form>

      {/* Credenciais de demonstração: e-mail e senha completos, preencher ou copiar */}
      <section aria-labelledby="demo-title" className="mt-10">
        <div className="mb-3 flex items-center gap-2">
          <KeyRound className="size-4 text-subtle" aria-hidden />
          <h2 id="demo-title" className="font-sans text-sm font-medium tracking-normal text-fg">Contas de demonstração</h2>
        </div>
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {CONTAS_DEMO.map((d) => (
            <li key={d.email} className={cn('flex items-center gap-3 px-4 py-3 transition-colors', preenchida === d.email && 'bg-white/[0.04]')}>
              <d.icon className="size-4 shrink-0 text-subtle" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-fg">{d.role}</p>
                <p className="font-mono text-[12px] break-all text-muted">{d.email}</p>
                <p className="font-mono text-[12px] text-fg-soft">{d.password}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <BotaoIcone icon={copiada === d.email ? Check : Copy} label={`Copiar credenciais de ${d.role}`} size="sm" onClick={() => copiarDemo(d)} />
                <Botao size="sm" variant="secondary" onClick={() => preencherDemo(d)} aria-label={`Preencher com a conta ${d.role}`}>Usar</Botao>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </LayoutAuth>
  );
}

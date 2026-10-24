import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Check, Copy, KeyRound, Lock, Mail, ShieldAlert, Timer, UserRound, Truck, ShieldCheck } from 'lucide-react';
import { ApiError, applyServerErrors, errorMessage } from '@/api';
import { useAuth } from '@/auth/AuthProvider';
import { safeRedirect } from '@/auth/guards';
import { Button, Field, FormError, IconButton, Input, PasswordInput, toast } from '@/components/ui';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { useCooldown } from '@/features/auth/useCooldown';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { emailSchema } from '@/lib/validation';
import { cn } from '@/lib/cn';
import { clearLockNotice, readLockNotice } from '@/security/lockNotice';

const schema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe sua senha').max(128, 'Senha muito longa'),
});
type FormValues = z.infer<typeof schema>;

const DEMO = [
  { role: 'Administrador', icon: ShieldCheck, email: 'admin@ecotechzero.com.br', password: 'EcoTech@2050' },
  { role: 'Coletor', icon: Truck, email: 'coletor@ecotechzero.com.br', password: 'Coleta@2050' },
  { role: 'Morador', icon: UserRound, email: 'morador@ecotechzero.com.br', password: 'Recicla@2050' },
];

export default function LoginPage() {
  useDocumentTitle('Entrar');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const cooldown = useCooldown();
  const [locked, setLocked] = useState<string | null>(readLockNotice); // bloqueio por inspeção vindo do app
  const [filled, setFilled] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' }, mode: 'onTouched' });
  const { register, handleSubmit, setValue, setError, formState: { errors, isSubmitting } } = form;

  const onSubmit = handleSubmit(async (values) => {
    setLocked(null);
    try {
      const user = await login(values);
      clearLockNotice();
      toast.success(`Bem-vindo(a) de volta, ${user.name.split(' ')[0]}!`);
      navigate(safeRedirect(location.search), { replace: true });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'ACCOUNT_LOCKED') {
        setLocked(errorMessage(e));
        if (e.retryAfter) cooldown.start(e.retryAfter);
        return;
      }
      if (e instanceof ApiError && e.isRateLimited) {
        cooldown.start(e.retryAfter ?? 30);
        setError('root.server', { message: errorMessage(e) });
        return;
      }
      if (e instanceof ApiError && e.code === 'FORBIDDEN') {
        setError('root.server', { message: 'Esta conta está desativada. Fale com a administração.' });
        return;
      }
      if (e instanceof ApiError && e.code === 'BAD_CREDENTIALS') {
        setError('root.server', { message: 'E-mail ou senha incorretos. Confira e tente novamente.' });
        setValue('password', '');
        return;
      }
      applyServerErrors(e, setError, { knownFields: ['email', 'password'], toast: false });
    }
  });

  const copyDemo = async (d: (typeof DEMO)[number]) => {
    try {
      await navigator.clipboard.writeText(`${d.email}\n${d.password}`);
      setCopied(d.email);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      toast.error('Não foi possível copiar. Use o botão "Usar".');
    }
  };

  const fillDemo = (d: (typeof DEMO)[number]) => {
    setValue('email', d.email, { shouldValidate: true, shouldDirty: true });
    setValue('password', d.password, { shouldValidate: true, shouldDirty: true });
    setFilled(d.email);
    form.clearErrors('root');
  };

  return (
    <AuthLayout
      title="Entrar na sua conta"
      subtitle="Acompanhe seus descartes, pontos e o impacto da sua casa."
      footer={<>Ainda não tem conta? <Link to={`/cadastro${location.search}`} className="font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg">Criar conta grátis</Link></>}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {locked && (
          <div role="alert" className="flex gap-3 rounded-xl border border-warning/30 bg-warning/[0.08] p-3.5 text-sm text-warning">
            <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div>
              <p className="font-medium">Conta temporariamente bloqueada</p>
              <p className="mt-0.5 text-warning/85">{locked}</p>
            </div>
          </div>
        )}
        <FormError error={errors.root?.server} />

        <Field label="E-mail" error={errors.email} required>
          <Input type="email" autoComplete="email" inputMode="email" leftIcon={Mail} placeholder="voce@exemplo.com" inputSize="lg" {...register('email')} />
        </Field>
        <Field label="Senha" error={errors.password} required>
          <PasswordInput autoComplete="current-password" leftIcon={Lock} placeholder="Sua senha" inputSize="lg" {...register('password')} />
        </Field>

        <Button type="submit" size="lg" fullWidth loading={isSubmitting} disabled={cooldown.active} rightIcon={cooldown.active ? undefined : ArrowRight}>
          {cooldown.active ? <span className="inline-flex items-center gap-2"><Timer className="size-4" aria-hidden /> Aguarde {cooldown.remaining}s</span> : 'Entrar'}
        </Button>
      </form>

      {/* Credenciais de demonstração: e-mail e senha completos, preencher ou copiar */}
      <section aria-labelledby="demo-title" className="mt-10">
        <div className="mb-3 flex items-center gap-2">
          <KeyRound className="size-4 text-subtle" aria-hidden />
          <h2 id="demo-title" className="font-sans text-sm font-medium tracking-normal text-fg">Contas de demonstração</h2>
        </div>
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {DEMO.map((d) => (
            <li key={d.email} className={cn('flex items-center gap-3 px-4 py-3 transition-colors', filled === d.email && 'bg-white/[0.04]')}>
              <d.icon className="size-4 shrink-0 text-subtle" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-fg">{d.role}</p>
                <p className="font-mono text-[12px] break-all text-muted">{d.email}</p>
                <p className="font-mono text-[12px] text-fg-soft">{d.password}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <IconButton icon={copied === d.email ? Check : Copy} label={`Copiar credenciais de ${d.role}`} size="sm" onClick={() => copyDemo(d)} />
                <Button size="sm" variant="secondary" onClick={() => fillDemo(d)} aria-label={`Preencher com a conta ${d.role}`}>Usar</Button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </AuthLayout>
  );
}

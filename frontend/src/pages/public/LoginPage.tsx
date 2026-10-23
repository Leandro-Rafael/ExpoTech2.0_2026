import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, KeyRound, Lock, Mail, ShieldAlert, Timer, UserRound, Truck, ShieldCheck } from 'lucide-react';
import { ApiError, applyServerErrors, errorMessage } from '@/api';
import { useAuth } from '@/auth/AuthProvider';
import { safeRedirect } from '@/auth/guards';
import { Button, Field, FormError, Input, PasswordInput, toast } from '@/components/ui';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { useCooldown } from '@/features/auth/useCooldown';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { emailSchema } from '@/lib/validation';
import { cn } from '@/lib/cn';

const schema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe sua senha').max(128, 'Senha muito longa'),
});
type FormValues = z.infer<typeof schema>;

const DEMO = [
  { role: 'Administrador', icon: ShieldCheck, email: 'admin@ecotechzero.com.br', password: 'EcoTech@2050' },
  { role: 'Coletor', icon: Truck, email: 'coletor@ecotechzero.com.br', password: 'Coletor@2050' },
  { role: 'Morador', icon: UserRound, email: 'morador@ecotechzero.com.br', password: 'Morador@2050' },
];

export default function LoginPage() {
  useDocumentTitle('Entrar');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const cooldown = useCooldown();
  const [locked, setLocked] = useState<string | null>(null);
  const [filled, setFilled] = useState<string | null>(null);

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' }, mode: 'onTouched' });
  const { register, handleSubmit, setValue, setError, formState: { errors, isSubmitting } } = form;

  const onSubmit = handleSubmit(async (values) => {
    setLocked(null);
    try {
      const user = await login(values);
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
      if (e instanceof ApiError && e.code === 'BAD_CREDENTIALS') {
        setError('root.server', { message: 'E-mail ou senha incorretos. Confira e tente novamente.' });
        setValue('password', '');
        return;
      }
      applyServerErrors(e, setError, { knownFields: ['email', 'password'], toast: false });
    }
  });

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
      footer={<>Ainda não tem conta? <Link to={`/cadastro${location.search}`} className="font-medium text-brand-300 hover:text-lime-300">Criar conta grátis</Link></>}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {locked && (
          <div role="alert" className="flex gap-3 rounded-xl border border-warning/30 bg-warning/10 p-3.5 text-sm text-warning">
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

      {/* Credenciais de demonstração */}
      <section aria-labelledby="demo-title" className="mt-8 rounded-2xl border border-dashed border-lime-300/25 bg-lime-300/[0.04] p-4">
        <div className="mb-3 flex items-center gap-2">
          <KeyRound className="size-4 text-lime-300" aria-hidden />
          <h2 id="demo-title" className="text-sm font-semibold text-lime-200">Contas de demonstração</h2>
          <span className="ml-auto text-[11px] text-muted">Clique para preencher</span>
        </div>
        <ul className="grid gap-2">
          {DEMO.map((d) => (
            <li key={d.email}>
              <button
                type="button"
                onClick={() => fillDemo(d)}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                  filled === d.email ? 'border-brand-300/50 bg-brand-500/10' : 'border-line bg-bg-deep/40 hover:border-line-strong hover:bg-white/[0.03]',
                )}
              >
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-brand-300"><d.icon className="size-4" aria-hidden /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-fg">{d.role}</span>
                  <span className="block truncate font-mono text-[11.5px] text-muted">{d.email} · {d.password}</span>
                </span>
                <ArrowRight className="size-4 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-brand-300" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </AuthLayout>
  );
}

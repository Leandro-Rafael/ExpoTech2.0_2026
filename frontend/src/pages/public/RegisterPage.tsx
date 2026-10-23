import { Link, useLocation, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Lock, Mail, Timer, UserRound } from 'lucide-react';
import { ApiError, applyServerErrors, errorMessage } from '@/api';
import { useAuth } from '@/auth/AuthProvider';
import { safeRedirect } from '@/auth/guards';
import { Button, Checkbox, Field, FormError, Input, PasswordInput, toast } from '@/components/ui';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { PasswordStrength } from '@/features/auth/PasswordStrength';
import { useCooldown } from '@/features/auth/useCooldown';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { emailSchema, nameSchema, passwordNotContainingEmail, passwordSchema } from '@/lib/validation';

const schema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirm: z.string().min(1, 'Confirme sua senha'),
    terms: z.boolean().refine((v) => v, 'Aceite os termos para continuar'),
  })
  .superRefine((data, ctx) => {
    passwordNotContainingEmail(data, ctx);
    if (data.confirm && data.password !== data.confirm) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['confirm'], message: 'As senhas não coincidem' });
    }
  });
type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  useDocumentTitle('Criar conta');
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const cooldown = useCooldown();

  const { register, handleSubmit, watch, setError, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', confirm: '', terms: false },
    mode: 'onTouched',
  });
  const password = watch('password');
  const email = watch('email');

  const onSubmit = handleSubmit(async ({ name, email, password }) => {
    try {
      const user = await registerUser({ name: name.trim(), email: email.trim(), password });
      toast.success(`Conta criada! Bem-vindo(a), ${user.name.split(' ')[0]}.`);
      navigate(safeRedirect(location.search), { replace: true });
    } catch (e) {
      if (e instanceof ApiError && e.isRateLimited) {
        cooldown.start(e.retryAfter ?? 30);
        setError('root.server', { message: errorMessage(e) });
        return;
      }
      if (e instanceof ApiError && e.code === 'CONFLICT') {
        setError('email', { message: 'Já existe uma conta com este e-mail.' }, { shouldFocus: true });
        return;
      }
      applyServerErrors(e, setError, { knownFields: ['name', 'email', 'password'], toast: false });
    }
  });

  return (
    <AuthLayout
      title="Criar sua conta"
      subtitle="Em menos de um minuto você começa a ganhar pontos reciclando."
      footer={<>Já tem conta? <Link to={`/entrar${location.search}`} className="font-medium text-brand-300 hover:text-lime-300">Entrar</Link></>}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <FormError error={errors.root?.server} />
        <Field label="Nome completo" error={errors.name} required>
          <Input autoComplete="name" leftIcon={UserRound} placeholder="Como devemos te chamar?" inputSize="lg" {...register('name')} />
        </Field>
        <Field label="E-mail" error={errors.email} required>
          <Input type="email" autoComplete="email" inputMode="email" leftIcon={Mail} placeholder="voce@exemplo.com" inputSize="lg" {...register('email')} />
        </Field>
        <Field label="Senha" error={errors.password} required>
          <PasswordInput autoComplete="new-password" leftIcon={Lock} placeholder="Mínimo de 10 caracteres" inputSize="lg" maxLength={128} {...register('password')} />
        </Field>
        <PasswordStrength password={password ?? ''} email={email} className="-mt-2" />
        <Field label="Confirmar senha" error={errors.confirm} required>
          <PasswordInput autoComplete="new-password" leftIcon={Lock} placeholder="Repita a senha" inputSize="lg" maxLength={128} {...register('confirm')} />
        </Field>
        <div>
          <Checkbox
            {...register('terms')}
            aria-invalid={errors.terms ? true : undefined}
            label="Concordo com os termos de uso e a política de privacidade"
            description="Seus dados são usados apenas para o funcionamento da plataforma (LGPD)."
          />
          {errors.terms && <p role="alert" className="mt-1.5 text-[13px] text-danger">{errors.terms.message}</p>}
        </div>
        <Button type="submit" size="lg" fullWidth loading={isSubmitting} disabled={cooldown.active} rightIcon={cooldown.active ? undefined : ArrowRight}>
          {cooldown.active ? <span className="inline-flex items-center gap-2"><Timer className="size-4" aria-hidden /> Aguarde {cooldown.remaining}s</span> : 'Criar conta'}
        </Button>
      </form>
    </AuthLayout>
  );
}

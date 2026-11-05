import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { KeyRound, Save } from 'lucide-react';
import { applyServerErrors } from '@/api';
import { useChangePassword, useOrganizations, useUpdateProfile } from '@/api/queries';
import { useUser } from '@/auth/AuthProvider';
import { Avatar, Button, Field, FormError, Input, PageHeader, PasswordInput, Select, toast } from '@/components/ui';
import { PasswordStrength } from '@/features/auth/PasswordStrength';
import { SectionHeading } from '@/features/resident/shared';
import { formatDate, formatNumber } from '@/lib/format';
import { organizationType, role as roleLabels } from '@/lib/labels';
import { nameSchema, passwordChecks, passwordSchema } from '@/lib/validation';

const profileSchema = z.object({ name: nameSchema, organizationId: z.string() });
type ProfileValues = z.infer<typeof profileSchema>;

// Perfil: dados pessoais, organização com que o morador pontua no ranking e troca de senha.
export default function ProfilePage() {
  const user = useUser();
  return (
    <>
      <PageHeader eyebrow="Conta" title="Meu perfil" description="Seus dados, a organização com que você pontua no ranking e a segurança da conta." />
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-16">
        <aside className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar name={user.name} size="xl" />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-fg">{user.name}</p>
              <p className="truncate text-sm text-muted">{user.email}</p>
            </div>
          </div>
          <dl className="divide-y divide-line border-y border-line text-sm">
            <Info label="Perfil" value={roleLabels[user.role].label} />
            <Info label="Nível" value={`${user.level.index + 1} · ${user.level.name}`} />
            <Info label="Pontos acumulados" value={<span className="font-mono tabular">{formatNumber(user.totalEarned)}</span>} />
            <Info label="Saldo" value={<span className="font-mono tabular">{formatNumber(user.points)} pts</span>} />
            <Info label="Residência" value={user.household?.name ?? '—'} />
            <Info label="Membro desde" value={formatDate(user.createdAt)} />
          </dl>
        </aside>
        <div className="space-y-14">
          <ProfileForm />
          <PasswordForm email={user.email} />
        </div>
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex justify-between gap-4 py-2.5"><dt className="text-muted">{label}</dt><dd className="truncate text-right text-fg-soft">{value}</dd></div>;
}

function ProfileForm() {
  const user = useUser();
  const orgs = useOrganizations();
  const update = useUpdateProfile();
  const form = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: { name: user.name, organizationId: user.organization?.id ?? '' } });
  const { register, handleSubmit, setError, reset, formState: { errors, isSubmitting, isDirty } } = form;

  useEffect(() => { reset({ name: user.name, organizationId: user.organization?.id ?? '' }); }, [user.name, user.organization?.id, reset]);

  const onSubmit = handleSubmit(async (v) => {
    try {
      await update.mutateAsync({ name: v.name.trim(), organizationId: v.organizationId || null });
      toast.success('Perfil atualizado');
    } catch (e) { applyServerErrors(e, setError, { knownFields: ['name', 'organizationId'] }); }
  });

  return (
    <section aria-labelledby="pf-h">
      <SectionHeading id="pf-h" title="Dados pessoais" description="O nome aparece no ranking e na sua residência." />
      <form onSubmit={onSubmit} noValidate className="max-w-xl space-y-5 border-t border-line pt-6">
        <FormError error={errors.root?.server} />
        <Field label="Nome completo" required error={errors.name}>
          <Input autoComplete="name" {...register('name')} />
        </Field>
        <Field label="E-mail" hint="O e-mail é o seu login e não pode ser alterado aqui.">
          <Input value={user.email} readOnly disabled />
        </Field>
        <Field label="Turma, escola, empresa ou condomínio" optional error={errors.organizationId}
          hint="Seus pontos também contam no ranking de organizações.">
          <Select {...register('organizationId')} disabled={orgs.isPending}>
            <option value="">Nenhuma</option>
            {orgs.data?.map((o) => <option key={o.id} value={o.id}>{o.name} · {organizationType[o.type].label}</option>)}
          </Select>
        </Field>
        <div className="flex justify-end">
          <Button type="submit" leftIcon={Save} loading={isSubmitting} disabled={!isDirty}>Salvar alterações</Button>
        </div>
      </form>
    </section>
  );
}

const pwSchema = (email: string) => z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual'),
  newPassword: passwordSchema,
  confirm: z.string().min(1, 'Repita a nova senha'),
}).superRefine((v, ctx) => {
  if (!passwordChecks(v.newPassword, email).every((c) => c.ok)) ctx.addIssue({ code: 'custom', path: ['newPassword'], message: 'A senha não pode conter seu e-mail' });
  if (v.newPassword === v.currentPassword) ctx.addIssue({ code: 'custom', path: ['newPassword'], message: 'A nova senha deve ser diferente da atual' });
  if (v.confirm !== v.newPassword) ctx.addIssue({ code: 'custom', path: ['confirm'], message: 'As senhas não conferem' });
});
type V = z.infer<ReturnType<typeof pwSchema>>;

function PasswordForm({ email }: { email: string }) {
  const change = useChangePassword();
  const schema = useMemo(() => pwSchema(email), [email]);
  const form = useForm<V>({ resolver: zodResolver(schema), defaultValues: { currentPassword: '', newPassword: '', confirm: '' }, mode: 'onTouched' });
  const { register, handleSubmit, setError, reset, watch, formState: { errors, isSubmitting } } = form;

  const onSubmit = handleSubmit(async (v) => {
    try {
      await change.mutateAsync({ currentPassword: v.currentPassword, newPassword: v.newPassword });
      reset();
      toast.success('Senha alterada. As outras sessões foram encerradas.');
    } catch (e) { applyServerErrors(e, setError, { knownFields: ['currentPassword', 'newPassword'] }); }
  });

  return (
    <section aria-labelledby="pw-h">
      <SectionHeading id="pw-h" title="Alterar senha" description="Ao trocar a senha, todas as outras sessões abertas são encerradas." />
      <form onSubmit={onSubmit} noValidate className="max-w-xl space-y-5 border-t border-line pt-6">
        <FormError error={errors.root?.server} />
        <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
        <Field label="Senha atual" required error={errors.currentPassword}>
          <PasswordInput autoComplete="current-password" {...register('currentPassword')} />
        </Field>
        <Field label="Nova senha" required error={errors.newPassword}>
          <PasswordInput autoComplete="new-password" {...register('newPassword')} />
        </Field>
        <PasswordStrength password={watch('newPassword')} email={email} />
        <Field label="Confirme a nova senha" required error={errors.confirm}>
          <PasswordInput autoComplete="new-password" {...register('confirm')} />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" variant="secondary" leftIcon={KeyRound} loading={isSubmitting}>Alterar senha</Button>
        </div>
      </form>
    </section>
  );
}

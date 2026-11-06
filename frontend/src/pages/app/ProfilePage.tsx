import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { KeyRound, Save } from 'lucide-react';
import { aplicarErrosDoServidor } from '@/api';
import { useTrocarSenha, useOrganizacoes, useAtualizarPerfil } from '@/api/queries';
import { useUsuario } from '@/auth/AuthProvider';
import { Avatar, Botao, Campo, ErroFormulario, CampoTexto, CabecalhoPagina, CampoSenha, Selecao, toast } from '@/components/ui';
import { MedidorSenha } from '@/features/auth/PasswordStrength';
import { TituloSecao } from '@/features/resident/shared';
import { formatarData, formatarNumero } from '@/lib/format';
import { tipoOrganizacao, perfil as roleLabels } from '@/lib/labels';
import { esquemaNome, verificacoesSenha, esquemaSenha } from '@/lib/validation';

const esquemaPerfil = z.object({ name: esquemaNome, organizationId: z.string() });
type ValoresPerfil = z.infer<typeof esquemaPerfil>;

// Perfil: dados pessoais, organização com que o morador pontua no ranking e troca de senha.
export default function PaginaPerfil() {
  const usuario = useUsuario();
  return (
    <>
      <CabecalhoPagina sobretitulo="Conta" title="Meu perfil" description="Seus dados, a organização com que você pontua no ranking e a segurança da conta." />
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-16">
        <aside className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar nome={usuario.name} size="xl" />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-fg">{usuario.name}</p>
              <p className="truncate text-sm text-muted">{usuario.email}</p>
            </div>
          </div>
          <dl className="divide-y divide-line border-y border-line text-sm">
            <Informacao label="Perfil" value={roleLabels[usuario.role].label} />
            <Informacao label="Nível" value={`${usuario.level.index + 1} · ${usuario.level.name}`} />
            <Informacao label="Pontos acumulados" value={<span className="font-mono tabular">{formatarNumero(usuario.totalEarned)}</span>} />
            <Informacao label="Saldo" value={<span className="font-mono tabular">{formatarNumero(usuario.points)} pts</span>} />
            <Informacao label="Residência" value={usuario.household?.name ?? '—'} />
            <Informacao label="Membro desde" value={formatarData(usuario.createdAt)} />
          </dl>
        </aside>
        <div className="space-y-14">
          <FormularioPerfil />
          <FormularioSenha email={usuario.email} />
        </div>
      </div>
    </>
  );
}

function Informacao({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex justify-between gap-4 py-2.5"><dt className="text-muted">{label}</dt><dd className="truncate text-right text-fg-soft">{value}</dd></div>;
}

function FormularioPerfil() {
  const usuario = useUsuario();
  const organizacoes = useOrganizacoes();
  const atualizar = useAtualizarPerfil();
  const formulario = useForm<ValoresPerfil>({ resolver: zodResolver(esquemaPerfil), defaultValues: { name: usuario.name, organizationId: usuario.organization?.id ?? '' } });
  const { register, handleSubmit, setError, reset, formState: { errors, isSubmitting, isDirty } } = formulario;

  useEffect(() => { reset({ name: usuario.name, organizationId: usuario.organization?.id ?? '' }); }, [usuario.name, usuario.organization?.id, reset]);

  const aoEnviar = handleSubmit(async (v) => {
    try {
      await atualizar.mutateAsync({ name: v.name.trim(), organizationId: v.organizationId || null });
      toast.success('Perfil atualizado');
    } catch (e) { aplicarErrosDoServidor(e, setError, { knownFields: ['name', 'organizationId'] }); }
  });

  return (
    <section aria-labelledby="pf-h">
      <TituloSecao id="pf-h" title="Dados pessoais" description="O nome aparece no ranking e na sua residência." />
      <form onSubmit={aoEnviar} noValidate className="max-w-xl space-y-5 border-t border-line pt-6">
        <ErroFormulario erro={errors.root?.server} />
        <Campo label="Nome completo" required erro={errors.name}>
          <CampoTexto autoComplete="name" {...register('name')} />
        </Campo>
        <Campo label="E-mail" dica="O e-mail é o seu login e não pode ser alterado aqui.">
          <CampoTexto value={usuario.email} readOnly disabled />
        </Campo>
        <Campo label="Turma, escola, empresa ou condomínio" opcional erro={errors.organizationId}
          dica="Seus pontos também contam no ranking de organizações.">
          <Selecao {...register('organizationId')} disabled={organizacoes.isPending}>
            <option value="">Nenhuma</option>
            {organizacoes.data?.map((o) => <option key={o.id} value={o.id}>{o.name} · {tipoOrganizacao[o.type].label}</option>)}
          </Selecao>
        </Campo>
        <div className="flex justify-end">
          <Botao type="submit" iconeEsquerda={Save} carregando={isSubmitting} disabled={!isDirty}>Salvar alterações</Botao>
        </div>
      </form>
    </section>
  );
}

const pwSchema = (email: string) => z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual'),
  newPassword: esquemaSenha,
  confirm: z.string().min(1, 'Repita a nova senha'),
}).superRefine((v, ctx) => {
  if (!verificacoesSenha(v.newPassword, email).every((c) => c.ok)) ctx.addIssue({ code: 'custom', path: ['newPassword'], message: 'A senha não pode conter seu e-mail' });
  if (v.newPassword === v.currentPassword) ctx.addIssue({ code: 'custom', path: ['newPassword'], message: 'A nova senha deve ser diferente da atual' });
  if (v.confirm !== v.newPassword) ctx.addIssue({ code: 'custom', path: ['confirm'], message: 'As senhas não conferem' });
});
type ValoresSenha = z.infer<ReturnType<typeof pwSchema>>;

function FormularioSenha({ email }: { email: string }) {
  const alterarSenha = useTrocarSenha();
  const esquema = useMemo(() => pwSchema(email), [email]);
  const formulario = useForm<ValoresSenha>({ resolver: zodResolver(esquema), defaultValues: { currentPassword: '', newPassword: '', confirm: '' }, mode: 'onTouched' });
  const { register, handleSubmit, setError, reset, watch, formState: { errors, isSubmitting } } = formulario;

  const aoEnviar = handleSubmit(async (v) => {
    try {
      await alterarSenha.mutateAsync({ currentPassword: v.currentPassword, newPassword: v.newPassword });
      reset();
      toast.success('Senha alterada. As outras sessões foram encerradas.');
    } catch (e) { aplicarErrosDoServidor(e, setError, { knownFields: ['currentPassword', 'newPassword'] }); }
  });

  return (
    <section aria-labelledby="pw-h">
      <TituloSecao id="pw-h" title="Alterar senha" description="Ao trocar a senha, todas as outras sessões abertas são encerradas." />
      <form onSubmit={aoEnviar} noValidate className="max-w-xl space-y-5 border-t border-line pt-6">
        <ErroFormulario erro={errors.root?.server} />
        <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
        <Campo label="Senha atual" required erro={errors.currentPassword}>
          <CampoSenha autoComplete="current-password" {...register('currentPassword')} />
        </Campo>
        <Campo label="Nova senha" required erro={errors.newPassword}>
          <CampoSenha autoComplete="new-password" {...register('newPassword')} />
        </Campo>
        <MedidorSenha senha={watch('newPassword')} email={email} />
        <Campo label="Confirme a nova senha" required erro={errors.confirm}>
          <CampoSenha autoComplete="new-password" {...register('confirm')} />
        </Campo>
        <div className="flex justify-end">
          <Botao type="submit" variant="secondary" iconeEsquerda={KeyRound} carregando={isSubmitting}>Alterar senha</Botao>
        </div>
      </form>
    </section>
  );
}

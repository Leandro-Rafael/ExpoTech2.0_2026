// Tela de cadastro de morador.
import { Link, useLocation, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Lock, Mail, Timer, UserRound } from 'lucide-react';
import { ErroApi, aplicarErrosDoServidor, mensagemDeErro } from '@/api';
import { useAutenticacao } from '@/auth/AuthProvider';
import { redirecionamentoSeguro } from '@/auth/guards';
import { Botao, CaixaSelecao, Campo, ErroFormulario, CampoTexto, CampoSenha, toast } from '@/components/ui';
import { LayoutAuth } from '@/features/auth/AuthLayout';
import { MedidorSenha } from '@/features/auth/PasswordStrength';
import { useEspera } from '@/features/auth/useCooldown';
import { useTituloDocumento } from '@/hooks/useDocumentTitle';
import { esquemaEmail, esquemaNome, senhaSemEmail, esquemaSenha } from '@/lib/validation';

// 1. Validação no navegador: senha forte, sem conter o e-mail, confirmação igual e termos aceitos.
//    O servidor valida tudo de novo; isto aqui é só para avisar o usuário mais rápido.
const esquema = z
  .object({
    name: esquemaNome,
    email: esquemaEmail,
    password: esquemaSenha,
    confirm: z.string().min(1, 'Confirme sua senha'),
    terms: z.boolean().refine((v) => v, 'Aceite os termos para continuar'),
  })
  .superRefine((dados, ctx) => {
    senhaSemEmail(dados, ctx);
    if (dados.confirm && dados.password !== dados.confirm) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['confirm'], message: 'As senhas não coincidem' });
    }
  });
type ValoresFormulario = z.infer<typeof esquema>;

export default function PaginaCadastro() {
  useTituloDocumento('Criar conta');
  const { register: cadastrarUsuario } = useAutenticacao();
  const navegar = useNavigate();
  const localizacao = useLocation();
  const espera = useEspera();

  const { register, handleSubmit, watch, setError, formState: { errors, isSubmitting } } = useForm<ValoresFormulario>({
    resolver: zodResolver(esquema),
    defaultValues: { name: '', email: '', password: '', confirm: '', terms: false },
    mode: 'onTouched',
  });
  const senha = watch('password');
  const email = watch('email');

  const aoEnviar = handleSubmit(async ({ name, email, password }) => {
    try {
      // 2. Cria a conta no servidor; ele já devolve o usuário logado.
      const usuario = await cadastrarUsuario({ name: name.trim(), email: email.trim(), password });
      toast.success(`Conta criada! Bem-vindo(a), ${usuario.name.split(' ')[0]}.`);
      navegar(redirecionamentoSeguro(localizacao.search), { replace: true });
    } catch (e) {
      // 3. Erros: muitas tentativas seguidas (espera) ou e-mail já cadastrado.
      if (e instanceof ErroApi && e.ehLimiteExcedido) {
        espera.start(e.retryAfter ?? 30);
        setError('root.server', { message: mensagemDeErro(e) });
        return;
      }
      if (e instanceof ErroApi && e.code === 'CONFLICT') {
        setError('email', { message: 'Já existe uma conta com este e-mail.' }, { shouldFocus: true });
        return;
      }
      aplicarErrosDoServidor(e, setError, { knownFields: ['name', 'email', 'password'], toast: false });
    }
  });

  return (
    <LayoutAuth
      title="Criar sua conta"
      subtitulo="Em menos de um minuto você começa a ganhar pontos reciclando."
      rodape={<>Já tem conta? <Link to={`/entrar${localizacao.search}`} className="font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg">Entrar</Link></>}
    >
      <form onSubmit={aoEnviar} noValidate className="space-y-5">
        <ErroFormulario erro={errors.root?.server} />
        <Campo label="Nome completo" erro={errors.name} required>
          <CampoTexto autoComplete="name" iconeEsquerda={UserRound} placeholder="Como devemos te chamar?" tamanhoCampo="lg" {...register('name')} />
        </Campo>
        <Campo label="E-mail" erro={errors.email} required>
          <CampoTexto type="email" autoComplete="email" inputMode="email" iconeEsquerda={Mail} placeholder="voce@exemplo.com" tamanhoCampo="lg" {...register('email')} />
        </Campo>
        <Campo label="Senha" erro={errors.password} required>
          <CampoSenha autoComplete="new-password" iconeEsquerda={Lock} placeholder="Mínimo de 10 caracteres" tamanhoCampo="lg" maxLength={128} {...register('password')} />
        </Campo>
        <MedidorSenha senha={senha ?? ''} email={email} className="-mt-2" />
        <Campo label="Confirmar senha" erro={errors.confirm} required>
          <CampoSenha autoComplete="new-password" iconeEsquerda={Lock} placeholder="Repita a senha" tamanhoCampo="lg" maxLength={128} {...register('confirm')} />
        </Campo>
        <div>
          <CaixaSelecao
            {...register('terms')}
            aria-invalid={errors.terms ? true : undefined}
            label="Concordo com os termos de uso e a política de privacidade"
            description="Seus dados são usados apenas para o funcionamento da plataforma (LGPD)."
          />
          {errors.terms && <p role="alert" className="mt-1.5 text-[13px] text-danger">{errors.terms.message}</p>}
        </div>
        <Botao type="submit" size="lg" larguraTotal carregando={isSubmitting} disabled={espera.active} iconeDireita={espera.active ? undefined : ArrowRight}>
          {espera.active ? <span className="inline-flex items-center gap-2"><Timer className="size-4" aria-hidden /> Aguarde {espera.remaining}s</span> : 'Criar conta'}
        </Botao>
      </form>
    </LayoutAuth>
  );
}

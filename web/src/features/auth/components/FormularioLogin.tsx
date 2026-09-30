import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { autenticacaoApi } from '@/api/autenticacao.api';
import { chavesConsulta } from '@/api/chaves-consulta';
import { Alerta } from '@/components/ui/Alerta';
import { Botao } from '@/components/ui/Botao';
import { CampoTexto } from '@/components/ui/CampoTexto';
import { textos } from '@/i18n/pt-BR';
import { codigoDoErro, mensagemDeErro } from '@/lib/errors';
import { lerCampos, validar, type ErrosDoFormulario } from '@/lib/formulario';

import { esquemaDeLogin } from '../esquemas-auth';

function ErroDoLogin({ erro }: { erro: unknown }) {
  return (
    <>
      <Alerta tom="critico">{mensagemDeErro(erro)}</Alerta>
      {codigoDoErro(erro) === 'email_nao_confirmado' && (
        <Link to="/confirmar-email" className="texto-link">
          {textos.auth.emailNaoConfirmado.reenviar}
        </Link>
      )}
    </>
  );
}

export function FormularioLogin() {
  const navegar = useNavigate();
  const cliente = useQueryClient();
  const [erros, setErros] = useState<ErrosDoFormulario>({});
  const mutacao = useMutation({
    mutationFn: (dados: { email: string; senha: string }) =>
      autenticacaoApi.entrar(dados.email, dados.senha),
    onSuccess: (usuario) => {
      cliente.setQueryData(chavesConsulta.eu, usuario);
      void navegar('/projetos');
    },
  });

  function enviar(evento: SubmitEvent<HTMLFormElement>): void {
    evento.preventDefault();
    const resultado = validar(esquemaDeLogin, lerCampos(evento));
    setErros(resultado.erros ?? {});
    if (resultado.dados !== undefined) {
      mutacao.mutate(resultado.dados);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      {mutacao.isError && <ErroDoLogin erro={mutacao.error} />}
      <CampoTexto
        rotulo={textos.campos.email}
        name="email"
        type="email"
        autoComplete="email"
        erro={erros.email}
      />
      <CampoTexto
        rotulo={textos.campos.senha}
        name="senha"
        type="password"
        autoComplete="current-password"
        erro={erros.senha}
      />
      <Link to="/esqueci-senha" className="texto-auxiliar texto-link">
        {textos.auth.login.esqueciSenha}
      </Link>
      <Botao type="submit" carregando={mutacao.isPending}>
        {textos.auth.login.enviar}
      </Botao>
    </form>
  );
}

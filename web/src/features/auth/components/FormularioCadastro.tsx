import { useMutation } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';

import { autenticacaoApi, type DadosDeCadastro } from '@/api/autenticacao.api';
import { Alerta } from '@/components/ui/Alerta';
import { Botao } from '@/components/ui/Botao';
import { CampoTexto } from '@/components/ui/CampoTexto';
import { textos } from '@/i18n/pt-BR';
import { mensagemDeErro } from '@/lib/errors';
import { lerCampos, validar, type ErrosDoFormulario } from '@/lib/formulario';

import { esquemaDeCadastro } from '../esquemas-auth';
import { AceiteDosTermos } from './AceiteDosTermos';

interface FormularioCadastroProps {
  aoConcluir: () => void;
}

export function FormularioCadastro({ aoConcluir }: FormularioCadastroProps) {
  const [erros, setErros] = useState<ErrosDoFormulario>({});
  const mutacao = useMutation({
    mutationFn: (dados: DadosDeCadastro) => autenticacaoApi.cadastrar(dados),
    onSuccess: aoConcluir,
  });

  function enviar(evento: SubmitEvent<HTMLFormElement>): void {
    evento.preventDefault();
    const resultado = validar(esquemaDeCadastro, lerCampos(evento));
    setErros(resultado.erros ?? {});
    if (resultado.dados !== undefined) {
      mutacao.mutate(resultado.dados);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      {mutacao.isError && <Alerta tom="critico">{mensagemDeErro(mutacao.error)}</Alerta>}
      <CampoTexto rotulo={textos.campos.nomeEmpresa} name="nomeEmpresa" erro={erros.nomeEmpresa} />
      <CampoTexto
        rotulo={textos.campos.nomeUsuario}
        name="nomeUsuario"
        autoComplete="name"
        erro={erros.nomeUsuario}
      />
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
        autoComplete="new-password"
        erro={erros.senha}
      />
      <AceiteDosTermos erro={erros.aceiteTermos} />
      <Botao type="submit" carregando={mutacao.isPending}>
        {textos.auth.cadastro.enviar}
      </Botao>
    </form>
  );
}

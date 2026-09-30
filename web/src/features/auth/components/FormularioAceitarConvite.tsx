import { useMutation } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';

import { autenticacaoApi } from '@/api/autenticacao.api';
import { Alerta } from '@/components/ui/Alerta';
import { Botao } from '@/components/ui/Botao';
import { CampoTexto } from '@/components/ui/CampoTexto';
import { textos } from '@/i18n/pt-BR';
import { mensagemDeErro } from '@/lib/errors';
import { lerCampos, validar, type ErrosDoFormulario } from '@/lib/formulario';

import { esquemaDeAceiteDeConvite } from '../esquemas-auth';
import { AceiteDosTermos } from './AceiteDosTermos';

interface FormularioAceitarConviteProps {
  token: string;
  aoConcluir: () => void;
}

export function FormularioAceitarConvite({ token, aoConcluir }: FormularioAceitarConviteProps) {
  const [erros, setErros] = useState<ErrosDoFormulario>({});
  const mutacao = useMutation({
    mutationFn: (dados: { nome: string; senha: string; aceiteTermos: true }) =>
      autenticacaoApi.aceitarConvite({ token, ...dados }),
    onSuccess: aoConcluir,
  });

  function enviar(evento: SubmitEvent<HTMLFormElement>): void {
    evento.preventDefault();
    const resultado = validar(esquemaDeAceiteDeConvite, lerCampos(evento));
    setErros(resultado.erros ?? {});
    if (resultado.dados !== undefined) {
      mutacao.mutate(resultado.dados);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      {mutacao.isError && <Alerta tom="critico">{mensagemDeErro(mutacao.error)}</Alerta>}
      <CampoTexto
        rotulo={textos.campos.nomeUsuario}
        name="nome"
        autoComplete="name"
        erro={erros.nome}
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
        {textos.auth.aceitarConvite.enviar}
      </Botao>
    </form>
  );
}

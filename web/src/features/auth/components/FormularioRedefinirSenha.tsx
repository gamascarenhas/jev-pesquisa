import { useMutation } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';

import { autenticacaoApi } from '@/api/autenticacao.api';
import { Alerta } from '@/components/ui/Alerta';
import { Botao } from '@/components/ui/Botao';
import { CampoTexto } from '@/components/ui/CampoTexto';
import { textos } from '@/i18n/pt-BR';
import { mensagemDeErro } from '@/lib/errors';
import { lerCampos, validar, type ErrosDoFormulario } from '@/lib/formulario';

import { esquemaDeRedefinicao } from '../esquemas-auth';

interface FormularioRedefinirSenhaProps {
  token: string;
  aoConcluir: () => void;
}

export function FormularioRedefinirSenha({ token, aoConcluir }: FormularioRedefinirSenhaProps) {
  const [erros, setErros] = useState<ErrosDoFormulario>({});
  const mutacao = useMutation({
    mutationFn: (novaSenha: string) => autenticacaoApi.redefinirSenha(token, novaSenha),
    onSuccess: aoConcluir,
  });

  function enviar(evento: SubmitEvent<HTMLFormElement>): void {
    evento.preventDefault();
    const resultado = validar(esquemaDeRedefinicao, lerCampos(evento));
    setErros(resultado.erros ?? {});
    if (resultado.dados !== undefined) {
      mutacao.mutate(resultado.dados.novaSenha);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      {mutacao.isError && <Alerta tom="critico">{mensagemDeErro(mutacao.error)}</Alerta>}
      <CampoTexto
        rotulo={textos.campos.novaSenha}
        name="novaSenha"
        type="password"
        autoComplete="new-password"
        erro={erros.novaSenha}
      />
      <Botao type="submit" carregando={mutacao.isPending}>
        {textos.auth.redefinirSenha.enviar}
      </Botao>
    </form>
  );
}

import { useMutation } from '@tanstack/react-query';
import { useRef, useState, type SubmitEvent } from 'react';
import { z } from 'zod';

import { autenticacaoApi } from '@/api/autenticacao.api';
import { Alerta } from '@/components/ui/Alerta';
import { useAvisos } from '@/components/ui/AvisoTemporario';
import { Botao } from '@/components/ui/Botao';
import { CampoTexto } from '@/components/ui/CampoTexto';
import { textos } from '@/i18n/pt-BR';
import { mensagemDeErro } from '@/lib/errors';
import { esquemaNovaSenha, esquemaSenhaInformada } from '@/lib/esquemas';
import { lerCampos, validar, type ErrosDoFormulario } from '@/lib/formulario';

const esquemaDeTrocaDeSenha = z.object({
  senhaAtual: esquemaSenhaInformada,
  novaSenha: esquemaNovaSenha,
});

export function FormularioTrocarSenha() {
  const avisar = useAvisos();
  const formulario = useRef<HTMLFormElement>(null);
  const [erros, setErros] = useState<ErrosDoFormulario>({});
  const mutacao = useMutation({
    mutationFn: (dados: { senhaAtual: string; novaSenha: string }) =>
      autenticacaoApi.trocarSenha(dados.senhaAtual, dados.novaSenha),
    onSuccess: () => {
      formulario.current?.reset();
      avisar(textos.configuracoes.perfil.senhaTrocada);
    },
  });

  function enviar(evento: SubmitEvent<HTMLFormElement>): void {
    evento.preventDefault();
    const resultado = validar(esquemaDeTrocaDeSenha, lerCampos(evento));
    setErros(resultado.erros ?? {});
    if (resultado.dados !== undefined) {
      mutacao.mutate(resultado.dados);
    }
  }

  return (
    <form ref={formulario} onSubmit={enviar} noValidate className="flex flex-col gap-4">
      {mutacao.isError && <Alerta tom="critico">{mensagemDeErro(mutacao.error)}</Alerta>}
      <CampoTexto
        rotulo={textos.campos.senhaAtual}
        name="senhaAtual"
        type="password"
        autoComplete="current-password"
        erro={erros.senhaAtual}
      />
      <CampoTexto
        rotulo={textos.campos.novaSenha}
        name="novaSenha"
        type="password"
        autoComplete="new-password"
        erro={erros.novaSenha}
      />
      <div>
        <Botao type="submit" carregando={mutacao.isPending}>
          {textos.configuracoes.perfil.senhaEnviar}
        </Botao>
      </div>
    </form>
  );
}

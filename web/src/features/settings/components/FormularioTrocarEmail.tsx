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
import { esquemaEmail, esquemaSenhaInformada } from '@/lib/esquemas';
import { lerCampos, validar, type ErrosDoFormulario } from '@/lib/formulario';

const esquemaDeTrocaDeEmail = z.object({ novoEmail: esquemaEmail, senha: esquemaSenhaInformada });

export function FormularioTrocarEmail() {
  const avisar = useAvisos();
  const formulario = useRef<HTMLFormElement>(null);
  const [erros, setErros] = useState<ErrosDoFormulario>({});
  const mutacao = useMutation({
    mutationFn: (dados: { novoEmail: string; senha: string }) =>
      autenticacaoApi.trocarEmail(dados.novoEmail, dados.senha),
    onSuccess: () => {
      formulario.current?.reset();
      avisar(textos.configuracoes.perfil.emailEnviado);
    },
  });

  function enviar(evento: SubmitEvent<HTMLFormElement>): void {
    evento.preventDefault();
    const resultado = validar(esquemaDeTrocaDeEmail, lerCampos(evento));
    setErros(resultado.erros ?? {});
    if (resultado.dados !== undefined) {
      mutacao.mutate(resultado.dados);
    }
  }

  return (
    <form ref={formulario} onSubmit={enviar} noValidate className="flex flex-col gap-4">
      {mutacao.isError && <Alerta tom="critico">{mensagemDeErro(mutacao.error)}</Alerta>}
      <CampoTexto
        rotulo={textos.campos.novoEmail}
        name="novoEmail"
        type="email"
        autoComplete="email"
        erro={erros.novoEmail}
      />
      <CampoTexto
        rotulo={textos.campos.senha}
        name="senha"
        type="password"
        autoComplete="current-password"
        erro={erros.senha}
      />
      <div>
        <Botao type="submit" carregando={mutacao.isPending}>
          {textos.configuracoes.perfil.emailEnviar}
        </Botao>
      </div>
    </form>
  );
}

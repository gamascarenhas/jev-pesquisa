import { useState, type SubmitEvent } from 'react';
import { z } from 'zod';

import { Alerta } from '@/components/ui/Alerta';
import { Botao } from '@/components/ui/Botao';
import { CampoTexto } from '@/components/ui/CampoTexto';
import { useCriarProjeto } from '@/features/projects/hooks/use-projetos';
import { textos } from '@/i18n/pt-BR';
import { mensagemDeErro } from '@/lib/errors';
import { esquemaNome } from '@/lib/esquemas';
import { lerCampos, validar, type ErrosDoFormulario } from '@/lib/formulario';

const esquemaDoProjeto = z.object({ nome: esquemaNome });

export function FormularioDoPrimeiroProjeto() {
  const [erros, setErros] = useState<ErrosDoFormulario>({});
  const criar = useCriarProjeto(() => undefined);

  function enviar(evento: SubmitEvent<HTMLFormElement>): void {
    evento.preventDefault();
    const resultado = validar(esquemaDoProjeto, lerCampos(evento));
    setErros(resultado.erros ?? {});
    if (resultado.dados !== undefined) {
      criar.mutate(resultado.dados.nome);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-3">
      <CampoTexto
        rotulo={textos.onboarding.nomeDoProjeto}
        name="nome"
        autoComplete="off"
        erro={erros.nome}
      />
      {criar.isError && <Alerta tom="critico">{mensagemDeErro(criar.error)}</Alerta>}
      <div>
        <Botao type="submit" carregando={criar.isPending}>
          {textos.onboarding.criarProjeto}
        </Botao>
      </div>
    </form>
  );
}

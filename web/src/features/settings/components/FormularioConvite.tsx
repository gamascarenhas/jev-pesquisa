import { useRef, useState, type SubmitEvent } from 'react';
import { z } from 'zod';

import { Alerta } from '@/components/ui/Alerta';
import { useAvisos } from '@/components/ui/AvisoTemporario';
import { Botao } from '@/components/ui/Botao';
import { CampoTexto } from '@/components/ui/CampoTexto';
import { Seletor } from '@/components/ui/Seletor';
import { textos } from '@/i18n/pt-BR';
import { mensagemDeErro } from '@/lib/errors';
import { esquemaEmail } from '@/lib/esquemas';
import { lerCampos, validar, type ErrosDoFormulario } from '@/lib/formulario';

import { useConvidar } from '../hooks/use-configuracoes';

const esquemaDeConvite = z.object({ email: esquemaEmail, papel: z.enum(['owner', 'member']) });

const OPCOES_DE_PAPEL = [
  { valor: 'member', rotulo: textos.comum.papelMember },
  { valor: 'owner', rotulo: textos.comum.papelOwner },
];

export function FormularioConvite() {
  const avisar = useAvisos();
  const formulario = useRef<HTMLFormElement>(null);
  const [erros, setErros] = useState<ErrosDoFormulario>({});
  const mutacao = useConvidar(() => {
    formulario.current?.reset();
    avisar(textos.configuracoes.convites.enviado);
  });

  function enviar(evento: SubmitEvent<HTMLFormElement>): void {
    evento.preventDefault();
    const resultado = validar(esquemaDeConvite, lerCampos(evento));
    setErros(resultado.erros ?? {});
    if (resultado.dados !== undefined) {
      mutacao.mutate({ email: resultado.dados.email, papel: resultado.dados.papel });
    }
  }

  return (
    <form ref={formulario} onSubmit={enviar} noValidate className="flex flex-col gap-4">
      {mutacao.isError && <Alerta tom="critico">{mensagemDeErro(mutacao.error)}</Alerta>}
      <CampoTexto
        rotulo={textos.campos.email}
        name="email"
        type="email"
        autoComplete="off"
        erro={erros.email}
      />
      <Seletor
        rotulo={textos.campos.papel}
        name="papel"
        opcoes={OPCOES_DE_PAPEL}
        defaultValue="member"
      />
      <div>
        <Botao type="submit" carregando={mutacao.isPending}>
          {textos.configuracoes.convites.enviar}
        </Botao>
      </div>
    </form>
  );
}

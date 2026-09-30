import { useMutation } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';

import type { Mensagem } from '@/api/types';
import { Alerta } from '@/components/ui/Alerta';
import { Botao } from '@/components/ui/Botao';
import { CampoTexto } from '@/components/ui/CampoTexto';
import { textos } from '@/i18n/pt-BR';
import { mensagemDeErro } from '@/lib/errors';
import { lerCampos, validar, type ErrosDoFormulario } from '@/lib/formulario';

import { esquemaSomenteEmail } from '../esquemas-auth';

interface FormularioSomenteEmailProps {
  enviarEmail: (email: string) => Promise<Mensagem>;
  rotuloDaAcao: string;
  mensagemDeSucesso: string;
}

export function FormularioSomenteEmail({
  enviarEmail,
  rotuloDaAcao,
  mensagemDeSucesso,
}: FormularioSomenteEmailProps) {
  const [erros, setErros] = useState<ErrosDoFormulario>({});
  const mutacao = useMutation({ mutationFn: enviarEmail });

  function enviar(evento: SubmitEvent<HTMLFormElement>): void {
    evento.preventDefault();
    const resultado = validar(esquemaSomenteEmail, lerCampos(evento));
    setErros(resultado.erros ?? {});
    if (resultado.dados !== undefined) {
      mutacao.mutate(resultado.dados.email);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      {mutacao.isSuccess && <Alerta tom="sucesso">{mensagemDeSucesso}</Alerta>}
      {mutacao.isError && <Alerta tom="critico">{mensagemDeErro(mutacao.error)}</Alerta>}
      <CampoTexto
        rotulo={textos.campos.email}
        name="email"
        type="email"
        autoComplete="email"
        erro={erros.email}
      />
      <Botao type="submit" carregando={mutacao.isPending}>
        {rotuloDaAcao}
      </Botao>
    </form>
  );
}

import { useState, type SubmitEvent } from 'react';
import { z } from 'zod';

import type { Projeto } from '@/api/types';
import { Alerta } from '@/components/ui/Alerta';
import { Botao } from '@/components/ui/Botao';
import { CampoTexto } from '@/components/ui/CampoTexto';
import { Modal } from '@/components/ui/Modal';
import { useAvisos } from '@/components/ui/AvisoTemporario';
import { textos } from '@/i18n/pt-BR';
import { mensagemDeErro } from '@/lib/errors';
import { lerCampos, validar, type ErrosDoFormulario } from '@/lib/formulario';
import { esquemaNome } from '@/lib/esquemas';

import { useCriarProjeto, useRenomearProjeto } from '../hooks/use-projetos';

const esquemaDeProjeto = z.object({ nome: esquemaNome });

interface ModalDeProjetoProps {
  projeto: Projeto | null;
  aoFechar: () => void;
}

export function ModalDeProjeto({ projeto, aoFechar }: ModalDeProjetoProps) {
  const avisar = useAvisos();
  const [erros, setErros] = useState<ErrosDoFormulario>({});
  const { projetos } = textos;
  const aoConcluir = () => {
    avisar(projeto === null ? projetos.criado : projetos.renomeado);
    aoFechar();
  };
  const criar = useCriarProjeto(aoConcluir);
  const renomear = useRenomearProjeto(projeto?.id ?? '', aoConcluir);
  const mutacao = projeto === null ? criar : renomear;

  function enviar(evento: SubmitEvent<HTMLFormElement>): void {
    evento.preventDefault();
    const resultado = validar(esquemaDeProjeto, lerCampos(evento));
    setErros(resultado.erros ?? {});
    if (resultado.dados !== undefined) {
      mutacao.mutate(resultado.dados.nome);
    }
  }

  return (
    <Modal titulo={projeto === null ? projetos.novo : projetos.renomearTitulo} aoFechar={aoFechar}>
      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <CampoTexto
          rotulo={textos.campos.nomeProjeto}
          name="nome"
          defaultValue={projeto?.nome ?? ''}
          autoComplete="off"
          erro={erros.nome}
        />
        {mutacao.isError && <Alerta tom="critico">{mensagemDeErro(mutacao.error)}</Alerta>}
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={aoFechar}>
            {textos.comum.cancelar}
          </Botao>
          <Botao type="submit" carregando={mutacao.isPending}>
            {projeto === null ? projetos.criar : textos.comum.salvar}
          </Botao>
        </div>
      </form>
    </Modal>
  );
}

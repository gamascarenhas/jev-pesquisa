import type { Projeto } from '@/api/types';
import { useAvisos } from '@/components/ui/AvisoTemporario';
import { DialogoConfirmacao } from '@/components/ui/DialogoConfirmacao';
import { textos } from '@/i18n/pt-BR';
import { mensagemDeErro } from '@/lib/errors';
import { interpolar } from '@/lib/format';

import { useApagarProjeto } from '../hooks/use-projetos';

interface DialogoApagarProjetoProps {
  projeto: Projeto;
  aoFechar: () => void;
}

export function DialogoApagarProjeto({ projeto, aoFechar }: DialogoApagarProjetoProps) {
  const avisar = useAvisos();
  const { projetos } = textos;
  const mutacao = useApagarProjeto(projeto.id, () => {
    avisar(projetos.apagado);
    aoFechar();
  });
  const valores = { nome: projeto.nome };

  return (
    <DialogoConfirmacao
      titulo={interpolar(projetos.apagarTitulo, valores)}
      descricao={projetos.apagarTexto}
      nomeEsperado={projeto.nome}
      rotuloDoCampo={interpolar(projetos.apagarConfirmacao, valores)}
      rotuloDaAcao={projetos.apagar}
      carregando={mutacao.isPending}
      erro={mutacao.isError ? mensagemDeErro(mutacao.error) : undefined}
      aoConfirmar={() => {
        mutacao.mutate(projeto.nome);
      }}
      aoCancelar={aoFechar}
    />
  );
}

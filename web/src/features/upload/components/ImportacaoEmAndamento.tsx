import type { ConfirmacaoDoEnvio } from '@/api/types';
import { Alerta } from '@/components/ui/Alerta';
import { Botao } from '@/components/ui/Botao';
import { textos } from '@/i18n/pt-BR';
import { mensagemDeErro } from '@/lib/errors';

import { useAcompanharTrabalho, useResumoDaFonte } from '../hooks/use-envio';

import { ProgressoDaImportacao } from './ProgressoDaImportacao';
import { ResumoDaImportacao } from './ResumoDaImportacao';

interface ImportacaoEmAndamentoProps {
  projetoId: string;
  confirmacao: ConfirmacaoDoEnvio;
  aoRecomecar: () => void;
}

export function ImportacaoEmAndamento({
  projetoId,
  confirmacao,
  aoRecomecar,
}: ImportacaoEmAndamentoProps) {
  const trabalho = useAcompanharTrabalho(confirmacao.trabalhoId);
  const concluido = trabalho.data?.status === 'done';
  const fonte = useResumoDaFonte(projetoId, confirmacao.fonteId, concluido);
  const resumo = fonte.data?.importacao;

  if (trabalho.isError) {
    return <Alerta tom="critico">{mensagemDeErro(trabalho.error)}</Alerta>;
  }
  if (trabalho.data?.status === 'failed') {
    return (
      <div className="flex flex-col gap-3">
        <Alerta tom="critico">{textos.upload.falhou}</Alerta>
        <div>
          <Botao onClick={aoRecomecar}>{textos.upload.trocarArquivo}</Botao>
        </div>
      </div>
    );
  }
  if (concluido && resumo) {
    return <ResumoDaImportacao resumo={resumo} aoImportarOutro={aoRecomecar} />;
  }
  return <ProgressoDaImportacao trabalho={trabalho.data} />;
}

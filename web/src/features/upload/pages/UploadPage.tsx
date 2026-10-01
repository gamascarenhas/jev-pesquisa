import { useState } from 'react';
import { useParams } from 'react-router';

import type { ConfirmacaoDoEnvio, MapeamentoDeColunas, PreviaDoEnvio } from '@/api/types';
import { Seletor } from '@/components/ui/Seletor';
import { textos } from '@/i18n/pt-BR';
import { mensagemDeErro } from '@/lib/errors';

import { EtapasDaImportacao, type EtapaDaImportacao } from '../components/EtapasDaImportacao';
import { ImportacaoEmAndamento } from '../components/ImportacaoEmAndamento';
import { MapeamentoDeColunas as FormularioDeMapeamento } from '../components/MapeamentoDeColunas';
import { PreviaDoArquivo } from '../components/PreviaDoArquivo';
import { SelecionarArquivo } from '../components/SelecionarArquivo';
import { useConfirmarEnvio, useEnviarArquivo, useTrocarAba } from '../hooks/use-envio';

interface EtapaDeColunasProps {
  projetoId: string;
  previa: PreviaDoEnvio;
  aoTrocarPrevia: (previa: PreviaDoEnvio) => void;
  aoConfirmar: (confirmacao: ConfirmacaoDoEnvio) => void;
  aoTrocarArquivo: () => void;
}

function EtapaDeColunas({
  projetoId,
  previa,
  aoTrocarPrevia,
  aoConfirmar,
  aoTrocarArquivo,
}: EtapaDeColunasProps) {
  const trocarAba = useTrocarAba(projetoId, previa.envioId);
  const confirmar = useConfirmarEnvio(projetoId);
  const erro = trocarAba.isError ? trocarAba.error : confirmar.error;

  function confirmarMapeamento(mapeamento: MapeamentoDeColunas): void {
    confirmar.mutate({ previa, mapeamento }, { onSuccess: aoConfirmar });
  }

  return (
    <div className="pilha-secoes">
      {previa.abas.length > 1 && (
        <Seletor
          rotulo={textos.upload.aba}
          value={previa.aba ?? ''}
          opcoes={previa.abas.map((aba) => ({ valor: aba, rotulo: aba }))}
          onChange={(evento) => {
            trocarAba.mutate(evento.target.value, {
              onSuccess: (nova) => {
                aoTrocarPrevia({ ...nova, nomeArquivo: previa.nomeArquivo });
              },
            });
          }}
        />
      )}
      <PreviaDoArquivo previa={previa} />
      <FormularioDeMapeamento
        key={`${previa.envioId}-${previa.aba ?? ''}`}
        previa={previa}
        carregando={confirmar.isPending}
        erroDoServidor={erro === null ? undefined : mensagemDeErro(erro)}
        aoConfirmar={confirmarMapeamento}
        aoTrocarArquivo={aoTrocarArquivo}
      />
    </div>
  );
}

export function UploadPage() {
  const { projetoId = '' } = useParams<{ projetoId: string }>();
  const [previa, setPrevia] = useState<PreviaDoEnvio | null>(null);
  const [confirmacao, setConfirmacao] = useState<ConfirmacaoDoEnvio | null>(null);
  const enviar = useEnviarArquivo(projetoId);
  const etapa: EtapaDaImportacao = confirmacao ? 'importacao' : previa ? 'colunas' : 'arquivo';

  function recomecar(): void {
    setPrevia(null);
    setConfirmacao(null);
    enviar.reset();
  }

  return (
    <div className="pilha-secoes">
      <header className="flex flex-col gap-1">
        <h1 className="texto-titulo-pagina">{textos.upload.titulo}</h1>
        <p className="texto-corpo texto-secundario">{textos.upload.descricao}</p>
      </header>
      <EtapasDaImportacao atual={etapa} />
      {etapa === 'arquivo' && (
        <SelecionarArquivo
          enviando={enviar.isPending}
          erro={enviar.isError ? mensagemDeErro(enviar.error) : undefined}
          aoEscolher={(arquivo) => {
            enviar.mutate(arquivo, { onSuccess: setPrevia });
          }}
        />
      )}
      {etapa === 'colunas' && previa && (
        <EtapaDeColunas
          projetoId={projetoId}
          previa={previa}
          aoTrocarPrevia={setPrevia}
          aoConfirmar={setConfirmacao}
          aoTrocarArquivo={recomecar}
        />
      )}
      {etapa === 'importacao' && confirmacao && (
        <ImportacaoEmAndamento
          projetoId={projetoId}
          confirmacao={confirmacao}
          aoRecomecar={recomecar}
        />
      )}
    </div>
  );
}

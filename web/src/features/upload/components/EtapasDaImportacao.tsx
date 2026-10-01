import { textos } from '@/i18n/pt-BR';
import { cn } from '@/lib/cn';

export type EtapaDaImportacao = 'arquivo' | 'colunas' | 'importacao';

const ETAPAS: { chave: EtapaDaImportacao; rotulo: string }[] = [
  { chave: 'arquivo', rotulo: textos.upload.passoArquivo },
  { chave: 'colunas', rotulo: textos.upload.passoColunas },
  { chave: 'importacao', rotulo: textos.upload.passoImportacao },
];

interface EtapasDaImportacaoProps {
  atual: EtapaDaImportacao;
}

export function EtapasDaImportacao({ atual }: EtapasDaImportacaoProps) {
  const indiceAtual = ETAPAS.findIndex((etapa) => etapa.chave === atual);
  return (
    <ol className="pilha-horizontal" aria-label={textos.upload.passosRotulo}>
      {ETAPAS.map(({ chave, rotulo }, indice) => (
        <li
          key={chave}
          aria-current={chave === atual ? 'step' : undefined}
          className={cn('texto-rotulo', indice > indiceAtual && 'texto-secundario')}
        >
          {String(indice + 1)}. {rotulo}
        </li>
      ))}
    </ol>
  );
}

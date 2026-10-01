import type { PreviaDoEnvio } from '@/api/types';
import { TabelaDados, type ColunaDaTabela } from '@/components/ui/TabelaDados';
import { textos } from '@/i18n/pt-BR';
import { formatarNumero, interpolar } from '@/lib/format';

import { LINHAS_DA_PREVIA } from '../limites';

interface LinhaDaPrevia {
  numero: number;
  celulas: string[];
}

interface PreviaDoArquivoProps {
  previa: PreviaDoEnvio;
}

export function PreviaDoArquivo({ previa }: PreviaDoArquivoProps) {
  const linhas: LinhaDaPrevia[] = previa.linhas
    .slice(0, LINHAS_DA_PREVIA)
    .map((celulas, indice) => ({ numero: indice + 1, celulas }));
  const colunas: ColunaDaTabela<LinhaDaPrevia>[] = previa.cabecalho.map((nome, indice) => ({
    chave: String(indice),
    titulo: nome,
    renderizar: (linha) => linha.celulas[indice] ?? '',
  }));

  return (
    <div className="flex flex-col gap-3">
      <p className="texto-auxiliar">
        {interpolar(textos.upload.previaDescricao, {
          arquivo: previa.nomeArquivo,
          total: formatarNumero(previa.totalLinhas),
          mostradas: String(linhas.length),
        })}
      </p>
      <TabelaDados
        legenda={textos.upload.previaTitulo}
        colunas={colunas}
        linhas={linhas}
        chaveDaLinha={(linha) => String(linha.numero)}
      />
    </div>
  );
}

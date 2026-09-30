import type { Projeto } from '@/api/types';
import { TabelaDados, type ColunaDaTabela } from '@/components/ui/TabelaDados';
import { textos } from '@/i18n/pt-BR';
import { formatarData } from '@/lib/format';

import { AcoesDoProjeto } from './AcoesDoProjeto';

interface TabelaDeProjetosProps {
  projetos: Projeto[];
  ehDono: boolean;
  aoRenomear: (projeto: Projeto) => void;
  aoApagar: (projeto: Projeto) => void;
}

export function TabelaDeProjetos({
  projetos,
  ehDono,
  aoRenomear,
  aoApagar,
}: TabelaDeProjetosProps) {
  const colunas: ColunaDaTabela<Projeto>[] = [
    { chave: 'nome', titulo: textos.projetos.colunaNome, renderizar: (projeto) => projeto.nome },
    {
      chave: 'criadoEm',
      titulo: textos.projetos.colunaCriado,
      renderizar: (projeto) => formatarData(projeto.criadoEm),
    },
    {
      chave: 'acoes',
      titulo: textos.projetos.colunaAcoes,
      renderizar: (projeto) => (
        <AcoesDoProjeto
          projeto={projeto}
          ehDono={ehDono}
          aoRenomear={aoRenomear}
          aoApagar={aoApagar}
        />
      ),
    },
  ];

  return (
    <TabelaDados
      legenda={textos.projetos.titulo}
      colunas={colunas}
      linhas={projetos}
      chaveDaLinha={(projeto) => projeto.id}
    />
  );
}

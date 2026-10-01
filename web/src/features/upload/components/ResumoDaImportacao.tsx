import { Link } from 'react-router';

import type { ResumoDaImportacao as Resumo } from '@/api/types';
import { Botao } from '@/components/ui/Botao';
import { Cartao } from '@/components/ui/Cartao';
import { botaoVariantes } from '@/components/ui/variants';
import { textos } from '@/i18n/pt-BR';
import { formatarNumero } from '@/lib/format';

interface ResumoDaImportacaoProps {
  resumo: Resumo;
  aoImportarOutro: () => void;
}

interface Indicador {
  rotulo: string;
  ajuda: string;
  valor: number;
}

export function ResumoDaImportacao({ resumo, aoImportarOutro }: ResumoDaImportacaoProps) {
  const indicadores: Indicador[] = [
    {
      rotulo: textos.upload.importados,
      ajuda: textos.upload.importadosAjuda,
      valor: resumo.importados,
    },
    {
      rotulo: textos.upload.ignorados,
      ajuda: textos.upload.ignoradosAjuda,
      valor: resumo.ignorados,
    },
    {
      rotulo: textos.upload.duplicados,
      ajuda: textos.upload.duplicadosAjuda,
      valor: resumo.duplicados,
    },
  ];
  return (
    <Cartao titulo={textos.upload.resumoTitulo}>
      <dl className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {indicadores.map(({ rotulo, ajuda, valor }) => (
          <div key={rotulo} className="superficie-sutil flex flex-col gap-1 p-4">
            <dt className="texto-rotulo">{rotulo}</dt>
            <dd className="texto-destaque">{formatarNumero(valor)}</dd>
            <dd className="texto-auxiliar">{ajuda}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap justify-end gap-2">
        <Link to="/projetos" className={botaoVariantes({ variante: 'secundario' })}>
          {textos.upload.voltarProjetos}
        </Link>
        <Botao onClick={aoImportarOutro}>{textos.upload.importarOutro}</Botao>
      </div>
    </Cartao>
  );
}

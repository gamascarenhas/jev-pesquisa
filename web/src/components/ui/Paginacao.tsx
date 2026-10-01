import { textos } from '@/i18n/pt-BR';
import { interpolar } from '@/lib/format';

import { Botao } from './Botao';

interface PaginacaoProps {
  rotulo: string;
  pagina: number;
  totalDePaginas: number;
  aoMudar: (pagina: number) => void;
}

export function Paginacao({ rotulo, pagina, totalDePaginas, aoMudar }: PaginacaoProps) {
  const valores = { pagina: String(pagina), total: String(totalDePaginas) };
  return (
    <nav className="pilha-horizontal" aria-label={rotulo}>
      <Botao
        variante="secundario"
        tamanho="sm"
        disabled={pagina <= 1}
        onClick={() => {
          aoMudar(pagina - 1);
        }}
      >
        {textos.comum.anterior}
      </Botao>
      <span className="texto-auxiliar">{interpolar(textos.comum.paginaDe, valores)}</span>
      <Botao
        variante="secundario"
        tamanho="sm"
        disabled={pagina >= totalDePaginas}
        onClick={() => {
          aoMudar(pagina + 1);
        }}
      >
        {textos.comum.proxima}
      </Botao>
    </nav>
  );
}

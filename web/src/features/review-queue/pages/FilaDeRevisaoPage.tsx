import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { Alerta } from '@/components/ui/Alerta';
import { EstadoVazio } from '@/components/ui/EstadoVazio';
import { Paginacao } from '@/components/ui/Paginacao';
import { botaoVariantes } from '@/components/ui/variants';
import { textos } from '@/i18n/pt-BR';

import { ItemDaFila } from '../components/ItemDaFila';
import { useFilaDeRevisao } from '../hooks/use-fila-de-revisao';

export function FilaDeRevisaoPage() {
  const { projetoId = '' } = useParams<{ projetoId: string }>();
  const [pagina, setPagina] = useState(1);
  const { data, isPending, isError } = useFilaDeRevisao(projetoId, pagina);

  return (
    <div className="pilha-secoes">
      <header className="flex flex-col gap-1">
        <h1 className="texto-titulo-pagina">{textos.revisao.titulo}</h1>
        <p className="texto-corpo texto-secundario">{textos.revisao.descricao}</p>
      </header>
      {isPending && <p className="texto-corpo">{textos.comum.carregando}</p>}
      {isError && <Alerta tom="critico">{textos.comum.erroCarregar}</Alerta>}
      {data?.itens.length === 0 && (
        <EstadoVazio
          titulo={textos.revisao.vazioTitulo}
          texto={textos.revisao.vazioTexto}
          acao={
            <Link to={`/projetos/${projetoId}/painel`} className={botaoVariantes()}>
              {textos.revisao.voltarAoPainel}
            </Link>
          }
        />
      )}
      {data !== undefined && data.itens.length > 0 && (
        <>
          <ul className="flex flex-col gap-4">
            {data.itens.map((comentario) => (
              <ItemDaFila key={comentario.id} projetoId={projetoId} comentario={comentario} />
            ))}
          </ul>
          <Paginacao
            rotulo={textos.revisao.titulo}
            pagina={pagina}
            totalDePaginas={Math.max(1, Math.ceil(data.total / data.tamanhoPagina))}
            aoMudar={setPagina}
          />
        </>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Link, useParams } from 'react-router';

import type { DadosDoPainel, FiltrosDoPainel } from '@/api/types';
import { GraficoGravidade } from '@/components/charts/GraficoGravidade';
import { GraficoTemaSentimento } from '@/components/charts/GraficoTemaSentimento';
import { Alerta } from '@/components/ui/Alerta';
import { Cartao } from '@/components/ui/Cartao';
import { EstadoVazio } from '@/components/ui/EstadoVazio';
import { Paginacao } from '@/components/ui/Paginacao';
import { botaoVariantes } from '@/components/ui/variants';
import { TabelaDeComentarios } from '@/features/comments/components/TabelaDeComentarios';
import { useComentarios } from '@/features/comments/hooks/use-comentarios';
import { textos } from '@/i18n/pt-BR';

import { AcoesDoPainel } from '../components/AcoesDoPainel';
import { CartoesDeResumo } from '../components/CartoesDeResumo';
import { FiltrosDoPainel as BarraDeFiltros } from '../components/FiltrosDoPainel';
import { useOpcoesDoPainel, usePainel } from '../hooks/use-painel';

function ListaDeComentarios({
  projetoId,
  filtros,
}: {
  projetoId: string;
  filtros: FiltrosDoPainel;
}) {
  const [pagina, setPagina] = useState(1);
  const { data } = useComentarios(projetoId, filtros, pagina);
  if (data === undefined) {
    return <p className="texto-corpo">{textos.comum.carregando}</p>;
  }
  if (data.itens.length === 0) {
    return <p className="texto-corpo texto-secundario">{textos.comentarios.vazio}</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <TabelaDeComentarios comentarios={data.itens} />
      <Paginacao
        rotulo={textos.painel.mudarPagina}
        pagina={pagina}
        totalDePaginas={Math.max(1, Math.ceil(data.total / data.tamanhoPagina))}
        aoMudar={setPagina}
      />
    </div>
  );
}

function Graficos({ dados }: { dados: DadosDoPainel }) {
  if (dados.resumo.classificados === 0) {
    return <p className="texto-corpo texto-secundario">{textos.painel.semDados}</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Cartao>
        <GraficoTemaSentimento dados={dados.temas} />
      </Cartao>
      <Cartao>
        <GraficoGravidade dados={dados.gravidade} />
      </Cartao>
    </div>
  );
}

function EstadoSemClassificacao({ projetoId }: { projetoId: string }) {
  return (
    <EstadoVazio
      titulo={textos.painel.vazioTitulo}
      texto={textos.painel.vazioTexto}
      acao={
        <div className="pilha-horizontal">
          <Link
            to={`/projetos/${projetoId}/importar`}
            className={botaoVariantes({ variante: 'secundario' })}
          >
            {textos.painel.irParaImportar}
          </Link>
          <Link to={`/projetos/${projetoId}/classificar`} className={botaoVariantes()}>
            {textos.painel.irParaClassificar}
          </Link>
        </div>
      }
    />
  );
}

export function PainelPage() {
  const { projetoId = '' } = useParams<{ projetoId: string }>();
  const [filtros, setFiltros] = useState<FiltrosDoPainel>({});
  const painel = usePainel(projetoId, filtros);
  const opcoes = useOpcoesDoPainel(projetoId);
  const semFiltros = Object.values(filtros).every((valor) => valor === undefined);
  const vazio = semFiltros && painel.data?.resumo.classificados === 0;

  return (
    <div className="pilha-secoes">
      <header className="cabecalho-pagina">
        <div className="flex flex-col gap-1">
          <h1 className="texto-titulo-pagina">{textos.painel.titulo}</h1>
          <p className="texto-corpo texto-secundario">{textos.painel.descricao}</p>
        </div>
        <AcoesDoPainel projetoId={projetoId} filtros={filtros} />
      </header>
      {painel.isError && <Alerta tom="critico">{textos.comum.erroCarregar}</Alerta>}
      {vazio ? (
        <EstadoSemClassificacao projetoId={projetoId} />
      ) : (
        <>
          <BarraDeFiltros opcoes={opcoes.data} filtros={filtros} aoMudar={setFiltros} />
          {painel.data && <CartoesDeResumo resumo={painel.data.resumo} />}
          {painel.data && <Graficos dados={painel.data} />}
          <ListaDeComentarios
            key={JSON.stringify(filtros)}
            projetoId={projetoId}
            filtros={filtros}
          />
        </>
      )}
    </div>
  );
}

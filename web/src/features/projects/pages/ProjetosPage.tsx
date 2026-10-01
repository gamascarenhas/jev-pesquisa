import { useState } from 'react';

import type { Pagina, Projeto } from '@/api/types';
import { Alerta } from '@/components/ui/Alerta';
import { Botao } from '@/components/ui/Botao';
import { EstadoVazio } from '@/components/ui/EstadoVazio';
import { Paginacao } from '@/components/ui/Paginacao';
import { useUsuarioAtual } from '@/hooks/use-usuario-atual';
import { textos } from '@/i18n/pt-BR';

import { ModaisDeProjeto, type EdicaoDeProjeto } from '../components/ModaisDeProjeto';
import { TabelaDeProjetos } from '../components/TabelaDeProjetos';
import { useProjetos } from '../hooks/use-projetos';

interface ListaDeProjetosProps {
  dados: Pagina<Projeto>;
  pagina: number;
  aoMudarPagina: (pagina: number) => void;
  aoEditar: (edicao: EdicaoDeProjeto) => void;
}

function ListaDeProjetos({ dados, pagina, aoMudarPagina, aoEditar }: ListaDeProjetosProps) {
  const { data: usuario } = useUsuarioAtual();
  return (
    <>
      <TabelaDeProjetos
        projetos={dados.itens}
        ehDono={usuario?.papel === 'owner'}
        aoRenomear={(projeto) => {
          aoEditar({ tipo: 'renomear', projeto });
        }}
        aoApagar={(projeto) => {
          aoEditar({ tipo: 'apagar', projeto });
        }}
      />
      <Paginacao
        rotulo={textos.projetos.titulo}
        pagina={pagina}
        totalDePaginas={Math.max(1, Math.ceil(dados.total / dados.tamanhoPagina))}
        aoMudar={aoMudarPagina}
      />
    </>
  );
}

export function ProjetosPage() {
  const [pagina, setPagina] = useState(1);
  const [edicao, setEdicao] = useState<EdicaoDeProjeto | null>(null);
  const { data, isPending, isError } = useProjetos(pagina);
  const novoProjeto = (
    <Botao
      onClick={() => {
        setEdicao({ tipo: 'criar' });
      }}
    >
      {textos.projetos.novo}
    </Botao>
  );

  return (
    <div className="pilha-vertical">
      <header className="cabecalho-pagina">
        <div className="flex flex-col gap-1">
          <h1 className="texto-titulo-pagina">{textos.projetos.titulo}</h1>
          <p className="texto-corpo texto-secundario">{textos.projetos.descricao}</p>
        </div>
        {novoProjeto}
      </header>
      {isPending && <p className="texto-corpo">{textos.comum.carregando}</p>}
      {isError && <Alerta tom="critico">{textos.comum.erroCarregar}</Alerta>}
      {data?.itens.length === 0 && (
        <EstadoVazio
          titulo={textos.projetos.vazioTitulo}
          texto={textos.projetos.vazioTexto}
          acao={novoProjeto}
        />
      )}
      {data !== undefined && data.itens.length > 0 && (
        <ListaDeProjetos
          dados={data}
          pagina={pagina}
          aoMudarPagina={setPagina}
          aoEditar={setEdicao}
        />
      )}
      <ModaisDeProjeto
        edicao={edicao}
        aoFechar={() => {
          setEdicao(null);
        }}
      />
    </div>
  );
}

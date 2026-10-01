import type { FiltrosDoPainel as Filtros, OpcoesDoPainel } from '@/api/types';
import { Botao } from '@/components/ui/Botao';
import { CampoTexto } from '@/components/ui/CampoTexto';
import { CaixaDeSelecao } from '@/components/ui/CaixaDeSelecao';
import { Seletor } from '@/components/ui/Seletor';
import { textos } from '@/i18n/pt-BR';

interface FiltrosDoPainelProps {
  opcoes: OpcoesDoPainel | undefined;
  filtros: Filtros;
  aoMudar: (filtros: Filtros) => void;
}

interface GrupoDeFiltros {
  filtros: Filtros;
  alterar: (mudanca: Partial<Filtros>) => void;
}

const TODOS = { valor: '', rotulo: textos.painel.todos };
const TODAS = { valor: '', rotulo: textos.painel.todas };

function opcoesDoMapa(mapa: Record<string, string>) {
  return Object.entries(mapa).map(([valor, rotulo]) => ({ valor, rotulo }));
}

function ouIndefinido(valor: string): string | undefined {
  return valor === '' ? undefined : valor;
}

function FiltrosDeOrigem({
  filtros,
  alterar,
  opcoes,
}: GrupoDeFiltros & { opcoes?: OpcoesDoPainel }) {
  const fontes = (opcoes?.fontes ?? []).map((f) => ({ valor: f.id, rotulo: f.nome }));
  const unidades = (opcoes?.unidades ?? []).map((u) => ({ valor: u, rotulo: u }));
  return (
    <>
      <Seletor
        rotulo={textos.painel.filtroFonte}
        value={filtros.fonteId ?? ''}
        opcoes={[TODAS, ...fontes]}
        onChange={(e) => {
          alterar({ fonteId: ouIndefinido(e.target.value) });
        }}
      />
      <Seletor
        rotulo={textos.painel.filtroUnidade}
        value={filtros.unidade ?? ''}
        opcoes={[TODAS, ...unidades]}
        onChange={(e) => {
          alterar({ unidade: ouIndefinido(e.target.value) });
        }}
      />
    </>
  );
}

function FiltrosDeClassificacao({ filtros, alterar }: GrupoDeFiltros) {
  return (
    <>
      <Seletor
        rotulo={textos.painel.filtroTema}
        value={filtros.tema ?? ''}
        opcoes={[TODOS, ...opcoesDoMapa(textos.rotulos.temas)]}
        onChange={(e) => {
          alterar({ tema: ouIndefinido(e.target.value) });
        }}
      />
      <Seletor
        rotulo={textos.painel.filtroSentimento}
        value={filtros.sentimento ?? ''}
        opcoes={[TODOS, ...opcoesDoMapa(textos.rotulos.sentimentos)]}
        onChange={(e) => {
          alterar({ sentimento: ouIndefinido(e.target.value) });
        }}
      />
    </>
  );
}

function FiltrosDePeriodo({ filtros, alterar }: GrupoDeFiltros) {
  return (
    <>
      <CampoTexto
        rotulo={textos.painel.filtroDe}
        type="date"
        value={filtros.de ?? ''}
        onChange={(e) => {
          alterar({ de: ouIndefinido(e.target.value) });
        }}
      />
      <CampoTexto
        rotulo={textos.painel.filtroAte}
        type="date"
        value={filtros.ate ?? ''}
        onChange={(e) => {
          alterar({ ate: ouIndefinido(e.target.value) });
        }}
      />
    </>
  );
}

export function FiltrosDoPainel({ opcoes, filtros, aoMudar }: FiltrosDoPainelProps) {
  const alterar = (mudanca: Partial<Filtros>): void => {
    aoMudar({ ...filtros, ...mudanca });
  };
  const grupo = { filtros, alterar };

  return (
    <form
      className="superficie-plana flex flex-col gap-4 p-4"
      aria-label={textos.painel.filtros}
      onSubmit={(evento) => {
        evento.preventDefault();
      }}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <FiltrosDeOrigem {...grupo} {...(opcoes && { opcoes })} />
        <FiltrosDeClassificacao {...grupo} />
        <FiltrosDePeriodo {...grupo} />
      </div>
      <div className="pilha-horizontal justify-between">
        <CaixaDeSelecao
          rotulo={textos.painel.filtroPrecisaAcao}
          checked={filtros.precisaAcao === true}
          onChange={(e) => {
            alterar({ precisaAcao: e.target.checked ? true : undefined });
          }}
        />
        <Botao
          variante="fantasma"
          tamanho="sm"
          onClick={() => {
            aoMudar({});
          }}
        >
          {textos.painel.limparFiltros}
        </Botao>
      </div>
    </form>
  );
}

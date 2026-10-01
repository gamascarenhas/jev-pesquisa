import { Link } from 'react-router';

import { Alerta } from '@/components/ui/Alerta';
import { BarraProgresso } from '@/components/ui/BarraProgresso';
import { botaoVariantes } from '@/components/ui/variants';
import { textos } from '@/i18n/pt-BR';
import { interpolar } from '@/lib/format';

import { CartaoDoPasso, type SituacaoDoPasso } from '../components/CartaoDoPasso';
import { FormularioDoPrimeiroProjeto } from '../components/FormularioDoPrimeiroProjeto';
import {
  PASSOS,
  TOTAL_DE_PASSOS,
  useEstadoDoOnboarding,
  type PassoDoOnboarding,
} from '../hooks/use-estado-do-onboarding';

const ENDERECO_DO_EXEMPLO = '/exemplo-comentarios.csv';

function situacaoDoPasso(indice: number, passoAtual: number): SituacaoDoPasso {
  if (indice + 1 < passoAtual) {
    return 'feito';
  }
  return indice + 1 === passoAtual ? 'atual' : 'pendente';
}

function Acao({ passo, projetoId }: { passo: PassoDoOnboarding; projetoId: string }) {
  const primaria = botaoVariantes();
  const secundaria = botaoVariantes({ variante: 'secundario' });
  const { passos } = textos.onboarding;
  switch (passo) {
    case 'projeto':
      return <FormularioDoPrimeiroProjeto />;
    case 'fonte':
      return (
        <div className="flex flex-col gap-3">
          <div className="pilha-horizontal">
            <Link to={`/projetos/${projetoId}/importar`} className={primaria}>
              {passos.fonte.acao}
            </Link>
            <a href={ENDERECO_DO_EXEMPLO} download className={secundaria}>
              {passos.fonte.exemplo}
            </a>
          </div>
          <Link to={`/projetos/${projetoId}/google`} className="texto-link">
            {passos.fonte.google}
          </Link>
        </div>
      );
    case 'colunas':
      return (
        <Link to={`/projetos/${projetoId}/importar`} className={primaria}>
          {passos.colunas.acao}
        </Link>
      );
    case 'classificar':
      return (
        <Link to={`/projetos/${projetoId}/classificar`} className={primaria}>
          {passos.classificar.acao}
        </Link>
      );
    case 'painel':
      return (
        <Link to={`/projetos/${projetoId}/painel`} className={primaria}>
          {passos.painel.acao}
        </Link>
      );
  }
}

export function PrimeirosPassosPage() {
  const { carregando, erro, projeto, passoAtual } = useEstadoDoOnboarding();
  const restantes = TOTAL_DE_PASSOS - passoAtual;

  return (
    <div className="pilha-secoes">
      <header className="flex flex-col gap-1">
        <h1 className="texto-titulo-pagina">{textos.onboarding.titulo}</h1>
        <p className="texto-corpo texto-secundario">{textos.onboarding.descricao}</p>
      </header>
      {carregando && <p className="texto-corpo">{textos.comum.carregando}</p>}
      {erro && <Alerta tom="critico">{textos.comum.erroCarregar}</Alerta>}
      {!carregando && !erro && (
        <>
          <div className="flex flex-col gap-2">
            <BarraProgresso
              rotulo={interpolar(textos.onboarding.progresso, {
                atual: String(passoAtual),
                total: String(TOTAL_DE_PASSOS),
              })}
              valor={passoAtual - 1}
              maximo={TOTAL_DE_PASSOS}
            />
            <p className="texto-auxiliar">
              {interpolar(textos.onboarding.progresso, {
                atual: String(passoAtual),
                total: String(TOTAL_DE_PASSOS),
              })}
              {' · '}
              {interpolar(textos.onboarding.restantes, { restantes: String(restantes) })}
            </p>
          </div>
          <ol className="flex flex-col gap-4">
            {PASSOS.map((passo, indice) => (
              <CartaoDoPasso
                key={passo}
                numero={indice + 1}
                titulo={textos.onboarding.passos[passo].titulo}
                texto={textos.onboarding.passos[passo].texto}
                situacao={situacaoDoPasso(indice, passoAtual)}
              >
                <Acao passo={passo} projetoId={projeto?.id ?? ''} />
              </CartaoDoPasso>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

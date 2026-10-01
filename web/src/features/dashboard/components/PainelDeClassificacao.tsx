import { Link } from 'react-router';

import type { EstimativaDaClassificacao, ProgressoDaClassificacao } from '@/api/types';
import { Alerta } from '@/components/ui/Alerta';
import { Botao } from '@/components/ui/Botao';
import { Cartao } from '@/components/ui/Cartao';
import { botaoVariantes } from '@/components/ui/variants';
import { textos } from '@/i18n/pt-BR';
import { formatarNumero, interpolar } from '@/lib/format';

import { estaEmAndamento } from '../hooks/use-classificacao';

interface PainelDeClassificacaoProps {
  projetoId: string;
  emailConfirmado: boolean;
  estimativa: EstimativaDaClassificacao | undefined;
  progresso: ProgressoDaClassificacao | undefined;
  iniciando: boolean;
  erro?: string | undefined;
  aoIniciar: () => void;
  aoReprocessar: () => void;
}

function formatarPorcentagem(valor: number): string {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

function Estimativa({ estimativa }: { estimativa: EstimativaDaClassificacao }) {
  const itens = [
    { rotulo: textos.classificacao.pendentes, valor: formatarNumero(estimativa.pendentes) },
    {
      rotulo: textos.classificacao.consumo,
      valor: interpolar(textos.classificacao.consumoValor, {
        valor: formatarPorcentagem(estimativa.porcentagemEstimada),
      }),
    },
    {
      rotulo: textos.classificacao.tempo,
      valor: interpolar(textos.classificacao.tempoValor, {
        minutos: formatarNumero(estimativa.minutosEstimados),
      }),
    },
  ];
  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {itens.map(({ rotulo, valor }) => (
          <div key={rotulo} className="superficie-sutil flex flex-col gap-1 p-4">
            <dt className="texto-rotulo">{rotulo}</dt>
            <dd className="texto-titulo-secao">{valor}</dd>
          </div>
        ))}
      </dl>
      <p className="texto-auxiliar">
        {interpolar(textos.classificacao.jaConsumido, {
          valor: formatarPorcentagem(estimativa.porcentagemJaConsumida),
        })}
      </p>
      {!estimativa.cabe && <Alerta tom="atencao">{textos.classificacao.naoCabe}</Alerta>}
    </div>
  );
}

function Andamento({ progresso }: { progresso: ProgressoDaClassificacao }) {
  const pausada = progresso.trabalho?.status === 'paused_limit';
  return (
    <div className="flex flex-col gap-2" role="status">
      <h2 className="texto-titulo-secao">{textos.classificacao.emAndamento}</h2>
      <p className="texto-corpo">
        {interpolar(textos.classificacao.emAndamentoTexto, {
          classificados: formatarNumero(progresso.classificados),
          pendentes: formatarNumero(progresso.pendentes),
        })}
      </p>
      {pausada && <Alerta tom="atencao">{textos.classificacao.pausada}</Alerta>}
    </div>
  );
}

function Conclusao({ progresso }: { progresso: ProgressoDaClassificacao | undefined }) {
  const classificou = (progresso?.classificados ?? 0) > 0;
  return (
    <p className="texto-corpo">
      {classificou ? textos.classificacao.concluida : textos.classificacao.nadaPendente}
    </p>
  );
}

function contagens(progresso: ProgressoDaClassificacao | undefined) {
  return { pendentes: progresso?.pendentes ?? 0, falhos: progresso?.falhos ?? 0 };
}

function Falhas({ total }: { total: number }) {
  return (
    <Alerta tom="critico">
      {interpolar(textos.classificacao.falhas, { total: formatarNumero(total) })}
    </Alerta>
  );
}

function Situacao({
  progresso,
  estimativa,
}: Pick<PainelDeClassificacaoProps, 'progresso' | 'estimativa'>) {
  const { pendentes, falhos } = contagens(progresso);
  if (progresso && estaEmAndamento(progresso)) {
    return <Andamento progresso={progresso} />;
  }
  return (
    <>
      {estimativa && pendentes > 0 && <Estimativa estimativa={estimativa} />}
      {pendentes === 0 && falhos === 0 && <Conclusao progresso={progresso} />}
      {falhos > 0 && <Falhas total={falhos} />}
    </>
  );
}

function Acoes({
  projetoId,
  emailConfirmado,
  progresso,
  iniciando,
  aoIniciar,
  aoReprocessar,
}: Omit<PainelDeClassificacaoProps, 'estimativa' | 'erro'>) {
  const livre = !estaEmAndamento(progresso);
  const { pendentes, falhos } = contagens(progresso);
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Link
        to={`/projetos/${projetoId}/painel`}
        className={botaoVariantes({ variante: 'secundario' })}
      >
        {textos.classificacao.verPainel}
      </Link>
      {livre && falhos > 0 && (
        <Botao
          variante="secundario"
          disabled={!emailConfirmado}
          carregando={iniciando}
          onClick={aoReprocessar}
        >
          {textos.classificacao.reprocessar}
        </Botao>
      )}
      {livre && pendentes > 0 && (
        <Botao disabled={!emailConfirmado} carregando={iniciando} onClick={aoIniciar}>
          {textos.classificacao.iniciar}
        </Botao>
      )}
    </div>
  );
}

export function PainelDeClassificacao(props: PainelDeClassificacaoProps) {
  return (
    <Cartao>
      {!props.emailConfirmado && (
        <Alerta tom="atencao">{textos.classificacao.confirmeEmail}</Alerta>
      )}
      <Situacao progresso={props.progresso} estimativa={props.estimativa} />
      {props.erro !== undefined && <Alerta tom="critico">{props.erro}</Alerta>}
      <Acoes {...props} />
    </Cartao>
  );
}

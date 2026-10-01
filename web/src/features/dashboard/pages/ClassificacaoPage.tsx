import { useParams } from 'react-router';

import { useUsuarioAtual } from '@/hooks/use-usuario-atual';
import { textos } from '@/i18n/pt-BR';
import { mensagemDeErro } from '@/lib/errors';

import { PainelDeClassificacao } from '../components/PainelDeClassificacao';
import {
  useEstimativa,
  useIniciarClassificacao,
  useProgressoDaClassificacao,
} from '../hooks/use-classificacao';

export function ClassificacaoPage() {
  const { projetoId = '' } = useParams<{ projetoId: string }>();
  const { data: usuario } = useUsuarioAtual();
  const emailConfirmado = usuario?.emailConfirmado === true;
  const progresso = useProgressoDaClassificacao(projetoId);
  const estimativa = useEstimativa(projetoId, emailConfirmado);
  const iniciar = useIniciarClassificacao(projetoId, false);
  const reprocessar = useIniciarClassificacao(projetoId, true);
  const erro = iniciar.error ?? reprocessar.error;

  return (
    <div className="pilha-secoes">
      <header className="flex flex-col gap-1">
        <h1 className="texto-titulo-pagina">{textos.classificacao.titulo}</h1>
        <p className="texto-corpo texto-secundario">{textos.classificacao.descricao}</p>
      </header>
      <PainelDeClassificacao
        projetoId={projetoId}
        emailConfirmado={emailConfirmado}
        estimativa={estimativa.data}
        progresso={progresso.data}
        iniciando={iniciar.isPending || reprocessar.isPending}
        erro={erro === null ? undefined : mensagemDeErro(erro)}
        aoIniciar={() => {
          iniciar.mutate();
        }}
        aoReprocessar={() => {
          reprocessar.mutate();
        }}
      />
    </div>
  );
}

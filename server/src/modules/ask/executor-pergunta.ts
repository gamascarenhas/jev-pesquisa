import { noul } from '@typesafe-ai/sdk';

import type {
  ClassificadorDeComentarios,
  EstadoDoComentario,
} from '../../integrations/jev/classificador-comentarios.js';
import { ErroTemporarioDeTrabalho } from '../../jobs/trabalhos.tipos.js';
import { ErroLimiteDeCustoAtingido, ErroNaoEncontrado } from '../../shared/errors.js';
import type { ContaId, ProjetoId } from '../../shared/ids.js';
import type { Registrador } from '../../shared/logger.js';
import {
  converterFiltros,
  type ComentariosServico,
  type TextoParaPergunta,
} from '../comments/comentarios.servico.js';
import type { ControleDeCusto } from '../usage/controle-custo.servico.js';
import type { PerguntasPersonalizadasRepositorio } from './perguntas-personalizadas.repositorio.js';
import {
  MAX_CARACTERES_POR_COMENTARIO,
  NOME_DA_PERGUNTA_NO_JEV,
  TAMANHO_LOTE_DA_PERGUNTA,
  type PerguntaGravada,
} from './perguntar.tipos.js';

const MENOR_LOTE_QUE_INDICA_QUEDA = 3;

export interface ProgressoDaPergunta {
  sinal: AbortSignal;
  atualizarProgresso: (total: number, feito: number) => Promise<void>;
}

export interface DependenciasDoExecutorDePergunta {
  repositorio: PerguntasPersonalizadasRepositorio;
  comentarios: Pick<ComentariosServico, 'alvosDaPergunta' | 'textosParaPergunta'>;
  controleDeCusto: ControleDeCusto;
  classificador: Pick<ClassificadorDeComentarios, 'avaliar'>;
  registrador: Registrador;
  concorrencia: number;
  maximoDeComentarios: number;
}

function montarPergunta(pergunta: PerguntaGravada) {
  return {
    [NOME_DA_PERGUNTA_NO_JEV]: noul(pergunta.instrucoes ?? '', {
      true: pergunta.criterios?.true ?? '',
      false: pergunta.criterios?.false ?? '',
    }),
  };
}

function montarEstado(comentario: TextoParaPergunta): EstadoDoComentario {
  return {
    comment: comentario.textoMascarado.slice(0, MAX_CARACTERES_POR_COMENTARIO),
    rating: comentario.nota,
    location: comentario.unidade,
  };
}

function emLotes<T>(lista: T[], tamanho: number): T[][] {
  return Array.from({ length: Math.ceil(lista.length / tamanho) }, (_v, i) =>
    lista.slice(i * tamanho, (i + 1) * tamanho),
  );
}

// O job de uma pergunta: um comentário por vez no Jev, com reserva de custo e retomada exata pelas respostas gravadas.
export class ExecutorDePergunta {
  constructor(private readonly dep: DependenciasDoExecutorDePergunta) {}

  async executar(
    contaId: ContaId,
    projetoId: ProjetoId,
    perguntaId: string,
    progresso: ProgressoDaPergunta,
  ): Promise<void> {
    const pergunta = await this.dep.repositorio.buscarPorId(contaId, projetoId, perguntaId);
    if (pergunta?.respondivel !== true || pergunta.instrucoes === null) {
      throw new ErroNaoEncontrado('Pergunta não encontrada.', 'pergunta_nao_encontrada');
    }
    const { alvos } = await this.dep.comentarios.alvosDaPergunta(
      contaId,
      projetoId,
      converterFiltros(pergunta.filtros),
      this.dep.maximoDeComentarios,
      MAX_CARACTERES_POR_COMENTARIO,
    );
    const ids = alvos.map((a) => a.id);
    await this.dep.repositorio.copiarReaproveitaveis(contaId, projetoId, pergunta, ids);
    await this.dep.repositorio.atualizarStatus(contaId, perguntaId, 'running', ids.length);
    const respondidos = await this.dep.repositorio.idsRespondidos(contaId, perguntaId);
    const pendentes = ids.filter((id) => !respondidos.has(id));
    let feitos = ids.length - pendentes.length;
    await progresso.atualizarProgresso(ids.length, feitos);
    for (const lote of emLotes(pendentes, TAMANHO_LOTE_DA_PERGUNTA)) {
      if (progresso.sinal.aborted) {
        throw new Error('pergunta_interrompida');
      }
      feitos += await this.processarLote(contaId, projetoId, pergunta, lote, progresso.sinal);
      await progresso.atualizarProgresso(ids.length, feitos);
    }
    await this.concluir(contaId, perguntaId, ids);
  }

  private async concluir(contaId: ContaId, perguntaId: string, ids: string[]): Promise<void> {
    const respondidos = await this.dep.repositorio.idsRespondidos(contaId, perguntaId);
    if (ids.some((id) => !respondidos.has(id))) {
      throw new ErroTemporarioDeTrabalho('pergunta_incompleta');
    }
    await this.dep.repositorio.atualizarStatus(contaId, perguntaId, 'done');
  }

  private async processarLote(
    contaId: ContaId,
    projetoId: ProjetoId,
    pergunta: PerguntaGravada,
    ids: string[],
    sinal: AbortSignal,
  ): Promise<number> {
    const textos = await this.dep.comentarios.textosParaPergunta(contaId, projetoId, ids);
    const perguntas = montarPergunta(pergunta);
    const tamanhoDaPergunta = JSON.stringify(perguntas).length;
    const estados = textos.map(montarEstado);
    const { resultados, naoReservados } = await this.dep.controleDeCusto.executarEmLoteComReserva(
      contaId,
      textos.map((texto, i) => ({
        provedor: 'jev' as const,
        operacao: 'ask' as const,
        caracteresEntrada: JSON.stringify(estados[i]).length + tamanhoDaPergunta,
        perguntaPersonalizadaRef: pergunta.id,
        comentarioRef: texto.id,
      })),
      async (reserva, indice) => {
        const resultado = await this.dep.classificador.avaliar({ ...estados[indice] }, perguntas, {
          sinal,
        });
        return {
          valor: { probabilidade: resultado.respostas.answer.noul, modelo: resultado.modelo },
          uso: {
            tokensEntrada:
              resultado.uso.tokensEntrada +
              resultado.tentativasAmbiguas * reserva.tokensEntradaEstimados,
            tokensSaida: resultado.uso.tokensSaida,
          },
        };
      },
      { concorrencia: this.dep.concorrencia },
    );
    const gravaveis = resultados.flatMap((r, i) =>
      r?.ok === true && textos[i] !== undefined ? [{ comentarioId: textos[i].id, ...r.valor }] : [],
    );
    await this.dep.repositorio.gravarRespostas(contaId, pergunta.id, gravaveis);
    await this.tratarSobras(
      contaId,
      pergunta.id,
      gravaveis.length,
      resultados.length,
      naoReservados,
    );
    return gravaveis.length;
  }

  // Sem saldo, o job pausa e retoma sozinho; uma queda geral do Jev volta à fila com atraso.
  private async tratarSobras(
    contaId: ContaId,
    perguntaId: string,
    sucessos: number,
    total: number,
    naoReservados: number[],
  ): Promise<void> {
    if (naoReservados.length > 0) {
      await this.dep.repositorio.atualizarStatus(contaId, perguntaId, 'paused_limit');
      throw new ErroLimiteDeCustoAtingido();
    }
    if (sucessos === 0 && total >= MENOR_LOTE_QUE_INDICA_QUEDA) {
      throw new ErroTemporarioDeTrabalho('jev_indisponivel');
    }
  }
}

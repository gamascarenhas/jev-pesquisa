import type { Relogio } from '../../shared/clock.js';
import { executarEmPiscina } from '../../shared/concorrencia.js';
import { ErroLimiteDeCustoAtingido } from '../../shared/errors.js';
import type { ContaId, TrabalhoId } from '../../shared/ids.js';
import type { Registrador } from '../../shared/logger.js';
import type { ItemParaReservar } from './consumo.repositorio.js';
import type { ConsumoRepositorio } from './consumo.repositorio.js';
import type { ConsumoSistemaRepositorio } from './consumo.sistema.repositorio.js';
import {
  ErroDeIaAmbiguo,
  ErroDeIaNaoCobrado,
  type EstimativaDoPlano,
  type RequisicaoDeIa,
  type ReservaAtiva,
  type ResultadoDoItem,
  type ResultadoDoLote,
  type RespostaDeIa,
} from './consumo.tipos.js';
import type { EstimadorDeCusto } from './estimador-custo.js';
import type { AlertasDeConsumo } from './alertas-consumo.servico.js';
import { criarCiclosServico, type CiclosServico } from './ciclos.servico.js';
import { LiquidadorDeConsumo } from './liquidador-consumo.js';
import { porcentagem } from './valores-usd.js';

export {
  ErroDeIaAmbiguo,
  ErroDeIaNaoCobrado,
  type EstimativaDoPlano,
  type RequisicaoDeIa,
  type ReservaAtiva,
  type ResultadoDoItem,
  type ResultadoDoLote,
  type RespostaDeIa,
};

export const TAMANHO_LOTE_RESERVA = 50;
export const IDADE_MAXIMA_RESERVA_MS = 15 * 60 * 1000;

/** `indice` é a posição da requisição em `requisicoes` (0 em `executarComReserva`). */
export type ChamadaDeIa<T> = (reserva: ReservaAtiva, indice: number) => Promise<RespostaDeIa<T>>;

export interface ConsumoDoPlano {
  /** Porcentagem do limite do plano; pode passar de 100 por pouco, pela diferença entre estimado e real. */
  porcentagem: number;
  cicloTerminaEm: Date;
}

export interface OpcoesDoLote {
  concorrencia?: number;
}

export interface ControleDeCusto {
  executarComReserva<T>(
    contaId: ContaId,
    requisicao: RequisicaoDeIa,
    chamar: ChamadaDeIa<T>,
  ): Promise<T>;
  executarEmLoteComReserva<T>(
    contaId: ContaId,
    requisicoes: RequisicaoDeIa[],
    chamar: ChamadaDeIa<T>,
    opcoes?: OpcoesDoLote,
  ): Promise<ResultadoDoLote<T>>;
  estimarConsumoDoPlano(
    contaId: ContaId,
    requisicoes: Pick<RequisicaoDeIa, 'provedor' | 'caracteresEntrada'>[],
  ): Promise<EstimativaDoPlano>;
  liberarReservasAntigas(): Promise<number>;
  reavaliarJobsPausados(): Promise<number>;
  consumoDoPlano(contaId: ContaId): Promise<ConsumoDoPlano>;
  virarCiclosVencidos(): Promise<number>;
  forcarViradaDeCiclo(contaId: ContaId): Promise<boolean>;
}

export interface DependenciasDoControleDeCusto {
  consumo: ConsumoRepositorio;
  sistema: ConsumoSistemaRepositorio;
  estimador: EstimadorDeCusto;
  relogio: Relogio;
  registrador: Registrador;
  retomarJob: (trabalhoId: TrabalhoId, agora: Date) => Promise<boolean>;
  modeloDoJev: string | undefined;
  modeloDoLlm: string | undefined;
  alertas?: AlertasDeConsumo;
}

class ControleDeCustoImpl implements ControleDeCusto {
  private readonly liquidador: LiquidadorDeConsumo;
  private readonly ciclos: CiclosServico;

  constructor(private readonly dep: DependenciasDoControleDeCusto) {
    this.liquidador = new LiquidadorDeConsumo({
      ...dep,
      ...(dep.alertas && { alertas: dep.alertas }),
    });
    this.ciclos = criarCiclosServico({
      ...dep,
      reavaliarJobsPausados: () => this.reavaliarJobsPausados(),
    });
  }

  async executarComReserva<T>(
    contaId: ContaId,
    requisicao: RequisicaoDeIa,
    chamar: ChamadaDeIa<T>,
  ): Promise<T> {
    const [reserva] = await this.reservar(contaId, [requisicao]);
    if (reserva === undefined) {
      await this.dep.alertas?.verificar(contaId, { forcar: true });
      throw new ErroLimiteDeCustoAtingido();
    }
    return this.executarReservada(contaId, reserva, 0, chamar);
  }

  async executarEmLoteComReserva<T>(
    contaId: ContaId,
    requisicoes: RequisicaoDeIa[],
    chamar: ChamadaDeIa<T>,
    opcoes?: OpcoesDoLote,
  ): Promise<ResultadoDoLote<T>> {
    const resultados = new Array<ResultadoDoItem<T> | undefined>(requisicoes.length).fill(
      undefined,
    );
    for (let inicio = 0; inicio < requisicoes.length; inicio += TAMANHO_LOTE_RESERVA) {
      const lote = requisicoes.slice(inicio, inicio + TAMANHO_LOTE_RESERVA);
      const reservas = await this.reservar(contaId, lote);
      await executarEmPiscina(
        reservas,
        opcoes?.concorrencia ?? TAMANHO_LOTE_RESERVA,
        async (reserva, indice) => {
          resultados[inicio + indice] = await this.executarReservada(
            contaId,
            reserva,
            inicio + indice,
            chamar,
          ).then(
            (valor): ResultadoDoItem<T> => ({ ok: true, valor }),
            (erro: unknown): ResultadoDoItem<T> => ({ ok: false, erro }),
          );
        },
      );
      if (reservas.length < lote.length) {
        await this.dep.alertas?.verificar(contaId, { forcar: true });
        break;
      }
    }
    const naoReservados = resultados.flatMap((r, indice) => (r === undefined ? [indice] : []));
    return { resultados, naoReservados };
  }

  async estimarConsumoDoPlano(
    contaId: ContaId,
    requisicoes: Pick<RequisicaoDeIa, 'provedor' | 'caracteresEntrada'>[],
  ): Promise<EstimativaDoPlano> {
    const { consumidoUsd8, limiteUsd8 } = await this.dep.consumo.consumoDoCiclo(contaId);
    const estimadoUsd8 = requisicoes.reduce(
      (soma, r) => soma + this.dep.estimador.estimar(r.provedor, r.caracteresEntrada).custoUsd8,
      0n,
    );
    return {
      porcentagemEstimada: porcentagem(estimadoUsd8, limiteUsd8),
      porcentagemJaConsumida: porcentagem(consumidoUsd8, limiteUsd8),
      cabe: consumidoUsd8 + estimadoUsd8 <= limiteUsd8,
    };
  }

  async consumoDoPlano(contaId: ContaId): Promise<ConsumoDoPlano> {
    const situacao = await this.dep.consumo.situacaoDoConsumo(contaId);
    return {
      porcentagem: porcentagem(situacao.consumidoUsd8, situacao.limiteUsd8),
      cicloTerminaEm: situacao.cicloTerminaEm,
    };
  }

  virarCiclosVencidos(): Promise<number> {
    return this.ciclos.virarCiclosVencidos();
  }

  forcarViradaDeCiclo(contaId: ContaId): Promise<boolean> {
    return this.ciclos.forcarVirada(contaId);
  }

  async liberarReservasAntigas(): Promise<number> {
    const agora = this.dep.relogio.agora();
    const liberadas = await this.dep.sistema.liberarReservasAntigas(
      new Date(agora.getTime() - IDADE_MAXIMA_RESERVA_MS),
      agora,
    );
    if (liberadas > 0) {
      this.dep.registrador.warn({ categoria: 'custo', liberadas }, 'reservas antigas liberadas');
    }
    return liberadas;
  }

  // Cabe quando ainda sobra limite no ciclo; se o job pausar de novo, a pausa não gasta tentativa.
  async reavaliarJobsPausados(): Promise<number> {
    const agora = this.dep.relogio.agora();
    let retomados = 0;
    for (const job of await this.dep.sistema.listarJobsPausadosPorLimite()) {
      if (
        job.consumidoUsd8 < job.limiteUsd8 &&
        (await this.dep.retomarJob(job.trabalhoId, agora))
      ) {
        retomados += 1;
      }
    }
    if (retomados > 0) {
      this.dep.registrador.info({ categoria: 'custo', retomados }, 'jobs pausados retomados');
    }
    return retomados;
  }

  private async reservar(contaId: ContaId, requisicoes: RequisicaoDeIa[]): Promise<ReservaAtiva[]> {
    const itens = requisicoes.map((requisicao) => this.montarItem(requisicao));
    const gravadas = await this.dep.consumo.reservarLote(contaId, itens);
    return gravadas.map(({ id, item }) => ({
      id,
      provedor: item.provedor,
      operacao: item.operacao,
      tokensEntradaEstimados: item.tokensEntradaEstimados,
      tokensSaidaEstimados: item.tokensSaidaEstimados,
      estimadoUsd8: item.reservadoUsd8,
    }));
  }

  private montarItem(requisicao: RequisicaoDeIa): ItemParaReservar {
    const estimativa = this.dep.estimador.estimar(
      requisicao.provedor,
      requisicao.caracteresEntrada,
    );
    return {
      provedor: requisicao.provedor,
      operacao: requisicao.operacao,
      modelo:
        requisicao.modelo ??
        (requisicao.provedor === 'jev' ? this.dep.modeloDoJev : this.dep.modeloDoLlm),
      comentarioRef: requisicao.comentarioRef,
      perguntaPersonalizadaRef: requisicao.perguntaPersonalizadaRef,
      resumoRef: requisicao.resumoRef,
      tokensEntradaEstimados: estimativa.tokensEntrada,
      tokensSaidaEstimados: estimativa.tokensSaida,
      reservadoUsd8: estimativa.custoUsd8,
    };
  }

  // Sem reserva a chamada não existe: `chamar` só é invocada aqui, depois de reservar.
  private async executarReservada<T>(
    contaId: ContaId,
    reserva: ReservaAtiva,
    indice: number,
    chamar: ChamadaDeIa<T>,
  ): Promise<T> {
    let resposta: RespostaDeIa<T>;
    try {
      resposta = await chamar(reserva, indice);
    } catch (erro) {
      await this.liquidador.tratarFalha(contaId, reserva, erro);
      throw erro;
    }
    const liquidacao = resposta.uso
      ? this.liquidador.porUso(reserva, resposta.uso)
      : this.liquidador.pelaEstimativa(reserva, resposta.tentativas ?? 1);
    await this.liquidador.liquidar(contaId, reserva, liquidacao);
    return resposta.valor;
  }
}

export function criarControleDeCusto(dep: DependenciasDoControleDeCusto): ControleDeCusto {
  return new ControleDeCustoImpl(dep);
}

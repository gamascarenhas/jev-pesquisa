import type { Relogio } from '../../shared/clock.js';
import type { ContaId } from '../../shared/ids.js';
import { nomeSeguroDoErro } from '../../shared/errors.js';
import type { Registrador } from '../../shared/logger.js';
import type { ConsumoRepositorio } from './consumo.repositorio.js';
import {
  ErroDeIaAmbiguo,
  ErroDeIaNaoCobrado,
  type ReservaAtiva,
  type UsoReal,
} from './consumo.tipos.js';
import type { EstimadorDeCusto, EstimativaDaRequisicao } from './estimador-custo.js';
import type { UnidadesUsd } from './valores-usd.js';

const TENTATIVAS_DE_LIQUIDACAO = 3;

export interface Liquidacao {
  tokensEntrada: number;
  tokensSaida: number;
  realUsd8: UnidadesUsd;
}

export interface DependenciasDoLiquidador {
  consumo: ConsumoRepositorio;
  estimador: EstimadorDeCusto;
  relogio: Relogio;
  registrador: Registrador;
  alertas?: { verificar: (contaId: ContaId) => Promise<void> };
}

export class LiquidadorDeConsumo {
  constructor(private readonly dep: DependenciasDoLiquidador) {}

  porUso(reserva: ReservaAtiva, uso: UsoReal): Liquidacao {
    return {
      tokensEntrada: uso.tokensEntrada,
      tokensSaida: uso.tokensSaida,
      realUsd8: this.dep.estimador.custoReal(reserva.provedor, uso.tokensEntrada, uso.tokensSaida),
    };
  }

  // A reserva cobre uma tentativa; sem o uso real, cada tentativa feita vale a estimativa inteira.
  pelaEstimativa(reserva: ReservaAtiva, tentativas: number): Liquidacao {
    const vezes = Math.max(1, tentativas);
    return {
      tokensEntrada: reserva.tokensEntradaEstimados * vezes,
      tokensSaida: reserva.tokensSaidaEstimados * vezes,
      realUsd8: reserva.estimadoUsd8 * BigInt(vezes),
    };
  }

  async tratarFalha(contaId: ContaId, reserva: ReservaAtiva, erro: unknown): Promise<void> {
    if (erro instanceof ErroDeIaNaoCobrado) {
      await this.dep.consumo.liberar(contaId, reserva.id, this.dep.relogio.agora());
      return;
    }
    // Qualquer outra falha é tratada como ambígua: o consumo nunca fica subestimado.
    const tentativas = erro instanceof ErroDeIaAmbiguo ? erro.tentativas : 1;
    await this.liquidar(contaId, reserva, this.pelaEstimativa(reserva, tentativas));
  }

  async liquidar(contaId: ContaId, reserva: ReservaAtiva, liquidacao: Liquidacao): Promise<void> {
    const estimada: EstimativaDaRequisicao = {
      tokensEntrada: reserva.tokensEntradaEstimados,
      tokensSaida: reserva.tokensSaidaEstimados,
      custoUsd8: reserva.estimadoUsd8,
    };
    const diferenca = this.dep.estimador.registrarDiferenca(
      estimada,
      liquidacao.tokensEntrada,
      liquidacao.tokensSaida,
      liquidacao.realUsd8,
    );
    this.dep.registrador.info(
      {
        categoria: 'custo',
        provedor: reserva.provedor,
        operacao: reserva.operacao,
        idReserva: reserva.id,
        tokensEstimados: diferenca.tokensEstimados,
        tokensReais: diferenca.tokensReais,
        diferencaDeTokens: diferenca.diferencaDeTokens,
        diferencaUsd8: diferenca.diferencaUsd8.toString(),
      },
      'consumo liquidado',
    );
    await this.gravar(contaId, reserva, liquidacao);
    await this.dep.alertas?.verificar(contaId);
  }

  // O custo já foi incorrido: tenta de novo antes de desistir, e a reserva antiga ainda conta no limite.
  private async gravar(
    contaId: ContaId,
    reserva: ReservaAtiva,
    liquidacao: Liquidacao,
  ): Promise<void> {
    for (let tentativa = 1; tentativa <= TENTATIVAS_DE_LIQUIDACAO; tentativa += 1) {
      try {
        await this.dep.consumo.liquidar(contaId, reserva.id, liquidacao, this.dep.relogio.agora());
        return;
      } catch (erro) {
        this.dep.registrador.error(
          { categoria: 'custo', idReserva: reserva.id, tentativa, erro: nomeSeguroDoErro(erro) },
          'falha ao liquidar o consumo',
        );
      }
    }
  }
}

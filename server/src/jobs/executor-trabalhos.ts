import { randomUUID } from 'node:crypto';

import type { Relogio } from '../shared/clock.js';
import { ErroDeDominio, ErroLimiteDeCustoAtingido, nomeSeguroDoErro } from '../shared/errors.js';
import type { Registrador } from '../shared/logger.js';
import type { FilaTrabalhos } from './fila-trabalhos.js';
import type { RecuperacaoTrabalhos } from './recuperacao-trabalhos.js';
import {
  ErroTemporarioDeTrabalho,
  type ContextoDoTrabalho,
  type MapaDeManipuladores,
  type ManipuladorDeTrabalho,
  type TipoDeTrabalho,
  type Trabalho,
} from './trabalhos.tipos.js';

export const CONCORRENCIA_PADRAO = 4;
export const INTERVALO_CONSULTA_MS = 1_000;
export const INTERVALO_SINAL_DE_VIDA_MS = 10_000;
export const INTERVALO_RECUPERACAO_MS = 30_000;
export const TEMPO_LIMITE_DESLIGAMENTO_EXECUTOR_MS = 30_000;
const ATRASO_BASE_RETENTATIVA_MS = 5_000;
const ATRASO_MAXIMO_RETENTATIVA_MS = 900_000;

export interface OpcoesDoExecutor {
  fila: FilaTrabalhos;
  manipuladores: MapaDeManipuladores;
  recuperacao: RecuperacaoTrabalhos;
  relogio: Relogio;
  registrador: Registrador;
  instanciaId?: string;
  concorrencia?: number;
  intervaloConsultaMs?: number;
  intervaloSinalDeVidaMs?: number;
  intervaloRecuperacaoMs?: number;
  tempoLimiteDesligamentoMs?: number;
  aleatorio?: () => number;
}

export interface ExecutorTrabalhos {
  iniciar(): Promise<void>;
  parar(): Promise<void>;
}

type Resultado = 'concluido' | 'reagendado' | 'falhou' | 'pausado_limite' | 'devolvido';

interface ExecucaoAtiva {
  trabalho: Trabalho;
  controle: AbortController;
  iniciouEm: Date;
  devolvida: boolean;
  promessa: Promise<void>;
}

/** Atraso exponencial com jitter de 50% a 100%, limitado a 15 minutos. */
export function calcularAtrasoDeRetentativa(
  tentativa: number,
  aleatorio: () => number = Math.random,
): number {
  const exponencial = Math.min(
    ATRASO_BASE_RETENTATIVA_MS * 2 ** Math.max(tentativa - 1, 0),
    ATRASO_MAXIMO_RETENTATIVA_MS,
  );
  return Math.round(exponencial / 2 + (aleatorio() * exponencial) / 2);
}

function descreverErro(causa: unknown): string {
  if (causa instanceof ErroTemporarioDeTrabalho || causa instanceof ErroDeDominio) {
    return `${causa.name}: ${causa.codigo}`;
  }
  return nomeSeguroDoErro(causa);
}

async function aguardarAte(promessa: Promise<unknown>, limiteMs: number): Promise<boolean> {
  let temporizador: NodeJS.Timeout | undefined;
  const estouro = new Promise<false>((resolver) => {
    temporizador = setTimeout(() => {
      resolver(false);
    }, limiteMs);
  });
  const terminou = await Promise.race([promessa.then(() => true as const), estouro]);
  clearTimeout(temporizador);
  return terminou;
}

class ExecutorDeTrabalhos implements ExecutorTrabalhos {
  private readonly instanciaId: string;
  private readonly tipos: TipoDeTrabalho[];
  private readonly ativas = new Set<ExecucaoAtiva>();
  private parando = false;
  private temporizadorDeConsulta: NodeJS.Timeout | undefined;
  private temporizadorDeRecuperacao: NodeJS.Timeout | undefined;
  private rodadaEmAndamento: Promise<void> = Promise.resolve();
  private parada: Promise<void> | undefined;

  constructor(private readonly opcoes: OpcoesDoExecutor) {
    this.instanciaId = opcoes.instanciaId ?? randomUUID();
    this.tipos = Object.keys(opcoes.manipuladores) as TipoDeTrabalho[];
  }

  async iniciar(): Promise<void> {
    await this.opcoes.recuperacao.executarNaInicializacao();
    this.temporizadorDeRecuperacao = setInterval(() => {
      this.opcoes.recuperacao.recuperarOrfaos().catch((erro: unknown) => {
        this.registrarFalha(erro, 'recuperação periódica falhou');
      });
    }, this.opcoes.intervaloRecuperacaoMs ?? INTERVALO_RECUPERACAO_MS);
    this.temporizadorDeRecuperacao.unref();
    this.agendarConsulta();
  }

  parar(): Promise<void> {
    this.parada ??= this.encerrar();
    return this.parada;
  }

  private agendarConsulta(): void {
    if (this.parando) {
      return;
    }
    this.temporizadorDeConsulta = setTimeout(() => {
      this.rodadaEmAndamento = this.preencherVagas()
        .catch((erro: unknown) => {
          this.registrarFalha(erro, 'consulta da fila falhou');
        })
        .finally(() => {
          this.agendarConsulta();
        });
    }, this.opcoes.intervaloConsultaMs ?? INTERVALO_CONSULTA_MS);
    this.temporizadorDeConsulta.unref();
  }

  private async preencherVagas(): Promise<void> {
    const { fila, manipuladores, relogio } = this.opcoes;
    const concorrencia = this.opcoes.concorrencia ?? CONCORRENCIA_PADRAO;
    while (!this.parando && this.ativas.size < concorrencia) {
      const trabalho = await fila.reivindicarProximo(this.instanciaId, this.tipos, relogio.agora());
      const manipulador = trabalho && manipuladores[trabalho.tipo];
      if (trabalho === undefined || manipulador === undefined) {
        return;
      }
      this.iniciarExecucao(trabalho, manipulador);
    }
  }

  private iniciarExecucao(trabalho: Trabalho, manipulador: ManipuladorDeTrabalho): void {
    const ativa: ExecucaoAtiva = {
      trabalho,
      controle: new AbortController(),
      iniciouEm: this.opcoes.relogio.agora(),
      devolvida: false,
      promessa: Promise.resolve(),
    };
    this.ativas.add(ativa);
    ativa.promessa = this.executar(ativa, manipulador)
      .catch((erro: unknown) => {
        this.registrarFalha(erro, 'falha ao registrar o desfecho do job', trabalho);
      })
      .finally(() => {
        this.ativas.delete(ativa);
      });
  }

  private async executar(ativa: ExecucaoAtiva, manipulador: ManipuladorDeTrabalho): Promise<void> {
    const batimento = setInterval(() => {
      void this.baterSinalDeVida(ativa);
    }, this.opcoes.intervaloSinalDeVidaMs ?? INTERVALO_SINAL_DE_VIDA_MS);
    try {
      const falha = await this.rodar(manipulador, ativa);
      if (ativa.devolvida) {
        return;
      }
      if (falha === undefined) {
        await this.opcoes.fila.concluir(ativa.trabalho.id, this.instanciaId, this.agora());
        this.registrarResultado(ativa, 'concluido');
      } else {
        await this.tratarErro(ativa, falha.causa);
      }
    } finally {
      clearInterval(batimento);
    }
  }

  private async rodar(
    manipulador: ManipuladorDeTrabalho,
    ativa: ExecucaoAtiva,
  ): Promise<{ causa: unknown } | undefined> {
    const contexto: ContextoDoTrabalho = {
      trabalho: ativa.trabalho,
      sinal: ativa.controle.signal,
      atualizarProgresso: async (total, feito) => {
        await this.opcoes.fila.atualizarProgresso(
          ativa.trabalho.id,
          this.instanciaId,
          total,
          feito,
        );
      },
    };
    try {
      await manipulador(contexto);
      return undefined;
    } catch (causa) {
      return { causa };
    }
  }

  private async tratarErro(ativa: ExecucaoAtiva, causa: unknown): Promise<void> {
    const { fila } = this.opcoes;
    const { trabalho } = ativa;
    if (causa instanceof ErroLimiteDeCustoAtingido) {
      await fila.pausarPorLimite(trabalho.id, this.instanciaId);
      this.registrarResultado(ativa, 'pausado_limite');
      return;
    }
    const descricao = descreverErro(causa);
    if (causa instanceof ErroTemporarioDeTrabalho && trabalho.tentativas < trabalho.maxTentativas) {
      const atraso = calcularAtrasoDeRetentativa(trabalho.tentativas, this.opcoes.aleatorio);
      const executarApos = new Date(this.agora().getTime() + atraso);
      await fila.reagendar(trabalho.id, this.instanciaId, executarApos, descricao);
      this.registrarResultado(ativa, 'reagendado');
      return;
    }
    await fila.falhar(trabalho.id, this.instanciaId, this.agora(), descricao);
    this.registrarResultado(ativa, 'falhou');
  }

  private async baterSinalDeVida(ativa: ExecucaoAtiva): Promise<void> {
    try {
      const mantido = await this.opcoes.fila.registrarSinalDeVida(
        ativa.trabalho.id,
        this.instanciaId,
        this.agora(),
      );
      if (!mantido && !ativa.devolvida) {
        ativa.devolvida = true;
        ativa.controle.abort();
        this.opcoes.registrador.warn(
          { categoria: 'trabalho', idTrabalho: ativa.trabalho.id },
          'bloqueio do job perdido',
        );
      }
    } catch (erro) {
      this.registrarFalha(erro, 'sinal de vida falhou', ativa.trabalho);
    }
  }

  private async encerrar(): Promise<void> {
    this.parando = true;
    clearTimeout(this.temporizadorDeConsulta);
    clearInterval(this.temporizadorDeRecuperacao);
    await this.rodadaEmAndamento;
    const terminaram = await aguardarAte(
      Promise.all([...this.ativas].map((ativa) => ativa.promessa)),
      this.opcoes.tempoLimiteDesligamentoMs ?? TEMPO_LIMITE_DESLIGAMENTO_EXECUTOR_MS,
    );
    if (!terminaram) {
      await Promise.all([...this.ativas].map((ativa) => this.devolver(ativa)));
    }
  }

  private async devolver(ativa: ExecucaoAtiva): Promise<void> {
    ativa.devolvida = true;
    ativa.controle.abort();
    await this.opcoes.fila.devolverParaPendente(ativa.trabalho.id, this.instanciaId);
    this.registrarResultado(ativa, 'devolvido');
  }

  private agora(): Date {
    return this.opcoes.relogio.agora();
  }

  private registrarFalha(erro: unknown, mensagem: string, trabalho?: Trabalho): void {
    this.opcoes.registrador.error(
      {
        categoria: 'trabalho',
        ...(trabalho && { idTrabalho: trabalho.id }),
        erro: nomeSeguroDoErro(erro),
      },
      mensagem,
    );
  }

  private registrarResultado(ativa: ExecucaoAtiva, resultado: Resultado): void {
    const { trabalho } = ativa;
    this.opcoes.registrador.info(
      {
        categoria: 'trabalho',
        idTrabalho: trabalho.id,
        contaId: trabalho.contaId,
        tipo: trabalho.tipo,
        resultado,
        tentativas: trabalho.tentativas,
        duracaoMs: this.agora().getTime() - ativa.iniciouEm.getTime(),
      },
      'job finalizado',
    );
  }
}

export function criarExecutorTrabalhos(opcoes: OpcoesDoExecutor): ExecutorTrabalhos {
  return new ExecutorDeTrabalhos(opcoes);
}

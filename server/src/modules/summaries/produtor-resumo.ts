import type { ClassificadorDeComentarios } from '../../integrations/jev/classificador-comentarios.js';
import type { ProvedorLlm, RespostaLlm } from '../../integrations/llm/provedor-llm.js';
import type { ContaId } from '../../shared/ids.js';
import type { Registrador } from '../../shared/logger.js';
import type { ControleDeCusto } from '../usage/controle-custo.servico.js';
import { perguntasVerificacaoAchado } from './perguntas-verificacao.js';
import {
  PROMPT_DE_SISTEMA,
  MINIMO_DE_ACHADOS,
  montarPromptDoResumo,
  validarResumo,
  type ResumoGerado,
} from './prompt-resumo.js';
import type { ResumosRepositorio, ResumoGravado } from './resumos.repositorio.js';
import type { Achado, Agregados, AmostraDoResumo } from './resumos.tipos.js';

export const TENTATIVAS_DE_GERACAO = 2;
export const TEMPERATURA_DO_RESUMO = 0.2;

export interface ConfiguracaoDoProdutor {
  maximoDeTokens: number;
  limiarDeSustentacao: number;
}

export interface DependenciasDoProdutor {
  repositorio: ResumosRepositorio;
  controleDeCusto: ControleDeCusto;
  llm: ProvedorLlm;
  classificador: Pick<ClassificadorDeComentarios, 'avaliar'>;
  registrador: Registrador;
  configuracao: ConfiguracaoDoProdutor;
}

interface MotivoDaRecusa {
  tipo: 'invalido' | 'sem_sustentacao';
  texto: string;
}

// As etapas 3 e 4 da spec: o LLM escreve, o código confere os números e o Jev confere a sustentação.
export class ProdutorDeResumo {
  constructor(private readonly dep: DependenciasDoProdutor) {}

  async produzir(
    contaId: ContaId,
    resumo: ResumoGravado,
    amostra: AmostraDoResumo[],
    agregados: Agregados,
    sinal: AbortSignal,
  ): Promise<void> {
    let recusa: MotivoDaRecusa | undefined;
    let modelo: string | null = null;
    for (let tentativa = 1; tentativa <= TENTATIVAS_DE_GERACAO; tentativa += 1) {
      const resposta = await this.chamarLlm(contaId, resumo, amostra, agregados, sinal, recusa);
      modelo = resposta.modelo;
      const validacao = validarResumo(resposta.texto, amostra, agregados);
      if (!validacao.valido) {
        recusa = { tipo: 'invalido', texto: validacao.motivo };
        continue;
      }
      const achados = await this.verificar(contaId, resumo, amostra, validacao.resumo, sinal);
      if (achados.length >= MINIMO_DE_ACHADOS) {
        await this.dep.repositorio.marcarPronto(
          contaId,
          resumo.id,
          validacao.resumo.titulo,
          achados,
          modelo,
        );
        return;
      }
      recusa = {
        tipo: 'sem_sustentacao',
        texto: 'poucos achados foram sustentados pelos comentários',
      };
    }
    this.dep.registrador.warn(
      { categoria: 'resumos', contaId, resumoId: resumo.id, motivo: recusa?.tipo },
      'resumo recusado nas duas tentativas',
    );
    if (recusa?.tipo === 'sem_sustentacao') {
      await this.dep.repositorio.marcarSoNumeros(contaId, resumo.id, modelo);
    } else {
      await this.dep.repositorio.marcarFalha(contaId, resumo.id, 'resumo_invalido');
    }
  }

  private chamarLlm(
    contaId: ContaId,
    resumo: ResumoGravado,
    amostra: AmostraDoResumo[],
    agregados: Agregados,
    sinal: AbortSignal,
    recusa: MotivoDaRecusa | undefined,
  ): Promise<RespostaLlm> {
    const usuario = montarPromptDoResumo(resumo.tema, agregados, amostra, recusa?.texto);
    return this.dep.controleDeCusto.executarComReserva(
      contaId,
      {
        provedor: 'llm',
        operacao: 'summarize',
        caracteresEntrada: PROMPT_DE_SISTEMA.length + usuario.length,
        resumoRef: resumo.id,
      },
      async () => {
        const resposta = await this.dep.llm.gerar(
          {
            sistema: PROMPT_DE_SISTEMA,
            usuario,
            maximoDeTokens: this.dep.configuracao.maximoDeTokens,
            temperatura: TEMPERATURA_DO_RESUMO,
          },
          { sinal },
        );
        return { valor: resposta, uso: resposta.uso };
      },
    );
  }

  // Um achado só aparece na tela se o Jev disser que os comentários citados o sustentam.
  private async verificar(
    contaId: ContaId,
    resumo: ResumoGravado,
    amostra: AmostraDoResumo[],
    gerado: ResumoGerado,
    sinal: AbortSignal,
  ): Promise<Achado[]> {
    const porId = new Map(amostra.map((c) => [c.id, c]));
    const sustentados: Achado[] = [];
    for (const achado of gerado.achados) {
      const evidencias = [...new Set(achado.evidencias)].flatMap((id) => porId.get(id) ?? []);
      const suporte = await this.verificarUm(contaId, resumo, achado.texto, evidencias, sinal);
      if (suporte >= this.dep.configuracao.limiarDeSustentacao) {
        sustentados.push({
          texto: achado.texto,
          evidencias: evidencias.map((e) => ({ id: e.id, comentarioId: e.comentarioId })),
          suporte,
        });
      }
    }
    return sustentados;
  }

  private verificarUm(
    contaId: ContaId,
    resumo: ResumoGravado,
    texto: string,
    evidencias: AmostraDoResumo[],
    sinal: AbortSignal,
  ): Promise<number> {
    const estado = { claim: texto, evidence: evidencias.map((e) => ({ id: e.id, text: e.texto })) };
    return this.dep.controleDeCusto.executarComReserva(
      contaId,
      {
        provedor: 'jev',
        operacao: 'verify_summary',
        caracteresEntrada:
          JSON.stringify(estado).length + JSON.stringify(perguntasVerificacaoAchado).length,
        resumoRef: resumo.id,
      },
      async (reserva) => {
        const resultado = await this.dep.classificador.avaliar(estado, perguntasVerificacaoAchado, {
          sinal,
        });
        return {
          valor: resultado.respostas.supported.noul,
          uso: {
            tokensEntrada:
              resultado.uso.tokensEntrada +
              resultado.tentativasAmbiguas * reserva.tokensEntradaEstimados,
            tokensSaida: resultado.uso.tokensSaida,
          },
        };
      },
    );
  }
}

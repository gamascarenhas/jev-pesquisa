import type { ProvedorLlm } from '../../integrations/llm/provedor-llm.js';
import type { ContaId } from '../../shared/ids.js';
import type { ControleDeCusto } from '../usage/controle-custo.servico.js';
import {
  lerInterpretacao,
  montarPromptDaPergunta,
  PROMPT_DO_INTERPRETADOR,
  type InterpretacaoDoLlm,
} from './prompt-interpretador.js';
import { MAX_TOKENS_INTERPRETACAO } from './perguntar.tipos.js';

export interface DependenciasDoInterpretador {
  llm: ProvedorLlm;
  controleDeCusto: ControleDeCusto;
}

// Uma única chamada ao LLM, cobrada como interpret_question mesmo quando a pergunta não é respondível.
export class InterpretadorDePergunta {
  constructor(private readonly dep: DependenciasDoInterpretador) {}

  async interpretar(
    contaId: ContaId,
    perguntaId: string,
    perguntaMascarada: string,
    sinal?: AbortSignal,
  ): Promise<InterpretacaoDoLlm | undefined> {
    const usuario = montarPromptDaPergunta(perguntaMascarada);
    const resposta = await this.dep.controleDeCusto.executarComReserva(
      contaId,
      {
        provedor: 'llm',
        operacao: 'interpret_question',
        caracteresEntrada: PROMPT_DO_INTERPRETADOR.length + usuario.length,
        perguntaPersonalizadaRef: perguntaId,
      },
      async () => {
        const gerada = await this.dep.llm.gerar(
          {
            sistema: PROMPT_DO_INTERPRETADOR,
            usuario,
            maximoDeTokens: MAX_TOKENS_INTERPRETACAO,
            temperatura: 0,
          },
          { sinal },
        );
        return { valor: gerada, uso: gerada.uso };
      },
    );
    return lerInterpretacao(resposta.texto);
  }
}

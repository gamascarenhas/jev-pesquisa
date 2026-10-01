import type { Configuracao } from '../../config/config.js';
import type { Banco } from '../../db/conexoes.js';
import type { EnviadorDeEmail } from '../../integrations/mail/enviador-email.js';
import type { Relogio } from '../../shared/clock.js';
import type { ContaId, TrabalhoId } from '../../shared/ids.js';
import type { Registrador } from '../../shared/logger.js';
import { criarAlertasDeConsumo, type DonoDaConta } from './alertas-consumo.servico.js';
import { criarConsumoRepositorio } from './consumo.repositorio.js';
import { criarConsumoSistemaRepositorio } from './consumo.sistema.repositorio.js';
import { criarControleDeCusto, type ControleDeCusto } from './controle-custo.servico.js';
import { criarEstimadorDeCusto } from './estimador-custo.js';
import { precoPorMtokParaUnidades } from './valores-usd.js';

// Preços do LLM simulado: só existem para o limite funcionar em desenvolvimento, nunca são cobrados.
const PRECO_LLM_SIMULADO_ENTRADA_POR_MTOK = 1;
const PRECO_LLM_SIMULADO_SAIDA_POR_MTOK = 5;

export interface EntradaDoControleDoSistema {
  enviador: EnviadorDeEmail;
  listarDonos: (contaId: ContaId) => Promise<DonoDaConta[]>;
  banco: Banco;
  configuracao: Readonly<Configuracao>;
  registrador: Registrador;
  relogio: Relogio;
  retomarJob: (trabalhoId: TrabalhoId, agora: Date) => Promise<boolean>;
}

// Monta o controle com os preços e modelos da configuração; é a única porta de entrada para fora do módulo.
export function criarControleDeCustoDoSistema(
  entrada: EntradaDoControleDoSistema,
): ControleDeCusto {
  const { jev, llm } = entrada.configuracao;
  const estimador = criarEstimadorDeCusto({
    precos: {
      jev: precoPorMtokParaUnidades(jev.precoPorMtok),
      llmEntrada: precoPorMtokParaUnidades(
        llm.precoEntradaPorMtok ?? PRECO_LLM_SIMULADO_ENTRADA_POR_MTOK,
      ),
      llmSaida: precoPorMtokParaUnidades(
        llm.precoSaidaPorMtok ?? PRECO_LLM_SIMULADO_SAIDA_POR_MTOK,
      ),
    },
    tokensSaidaDoLlm: llm.resumoMaxTokens,
  });
  const consumo = criarConsumoRepositorio(entrada.banco);
  return criarControleDeCusto({
    consumo,
    alertas: criarAlertasDeConsumo({
      consumo,
      listarDonos: entrada.listarDonos,
      enviador: entrada.enviador,
      nomeDoNegocio: entrada.configuracao.nomeNegocio,
      relogio: entrada.relogio,
      registrador: entrada.registrador,
    }),
    sistema: criarConsumoSistemaRepositorio(entrada.banco),
    estimador,
    relogio: entrada.relogio,
    registrador: entrada.registrador,
    retomarJob: entrada.retomarJob,
    modeloDoJev: jev.modelo,
    modeloDoLlm: llm.modelo,
  });
}

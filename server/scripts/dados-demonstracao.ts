import type { ComentarioParaImportar } from '../src/modules/comments/comentarios.servico.js';

export const SEMENTE_DA_DEMONSTRACAO = 20_260_101;
const INICIO_DO_PERIODO = Date.UTC(2025, 9, 1, 15);
const DIAS_DO_PERIODO = 365;
const MS_POR_DIA = 86_400_000;
const CHANCE_PADRAO_DE_DADO_PESSOAL = 0.04;

const ABERTURAS = [
  'Fui atendido ontem e',
  'Estive na loja no sábado e',
  'Comprei pelo aplicativo e',
  'Liguei para a central e',
  'Passei na unidade do centro e',
  'Meu pedido chegou e',
  'Resolvi voltar depois de meses e',
  'Levei minha família e',
  'Precisei de ajuda com a troca e',
  'Fiz a reserva por telefone e',
];
const AVALIACOES = [
  'o atendimento foi excelente, equipe muito atenciosa',
  'a espera passou de quarenta minutos sem nenhum aviso',
  'o preço está acima do que vi em outros lugares',
  'o produto veio com defeito e ninguém quis trocar',
  'a limpeza do ambiente estava impecável',
  'o entregador chegou no horário e foi educado',
  'a fila no caixa estava enorme e só havia um atendente',
  'resolveram meu problema rápido, sem burocracia',
  'o site travou na hora de pagar e perdi a promoção',
  'a comida chegou fria e faltou um item',
  'o estacionamento é pequeno e difícil de manobrar',
  'o gerente me recebeu bem e ouviu minha reclamação',
  'cobraram um valor diferente do anunciado',
  'a variedade de opções é ótima e os preços são justos',
  'ninguém soube explicar a política de devolução',
  'o ambiente estava barulhento e desconfortável',
  'o aplicativo é simples e funciona bem',
  'a troca foi feita na hora, sem perguntas',
  'a embalagem veio amassada, mas o produto estava intacto',
  'demoraram para responder minha mensagem no chat',
  'a atendente foi grosseira quando pedi uma segunda via',
  'o sistema estava fora do ar e não puderam finalizar a compra',
  'adorei a novidade do cardápio, volto com certeza',
  'a loja estava desorganizada e não achei o que procurava',
  'a entrega atrasou três dias e ninguém avisou',
];
const FECHAMENTOS = [
  'Recomendo.',
  'Não volto mais.',
  'Espero que melhorem.',
  'Nota máxima.',
  'Fiquei decepcionado.',
  'Vale a visita.',
  'Já indiquei para amigos.',
  'Podem melhorar nisso.',
];
const DADOS_PESSOAIS = [
  'Podem me ligar no (11) 98765-4321.',
  'Meu e-mail é cliente.demo@exemplo.com.br para retorno.',
  'Moro no CEP 01310-100, perto da avenida.',
  'Meu CPF é 529.982.247-25 se precisarem confirmar.',
];
const UNIDADES = ['Centro', 'Zona Norte', 'Zona Sul', 'Shopping Leste', 'Aeroporto'];
const AUTORES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabi', 'Heitor', 'Irene'];

function criarGeradorDeNumeros(semente: number): () => number {
  let estado = semente;
  return () => {
    estado = (estado + 0x6d2b79f5) | 0;
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export interface OpcoesDoGerador {
  semente?: number;
  chanceDeDadoPessoal?: number;
  /** Acrescenta " (#n)" ao texto para que nenhum comentário se repita. */
  numerar?: boolean;
}

export function gerarComentariosDeDemonstracao(
  quantidade: number,
  opcoes: OpcoesDoGerador = {},
): ComentarioParaImportar[] {
  const sorteio = criarGeradorDeNumeros(opcoes.semente ?? SEMENTE_DA_DEMONSTRACAO);
  const chanceDeDadoPessoal = opcoes.chanceDeDadoPessoal ?? CHANCE_PADRAO_DE_DADO_PESSOAL;
  const escolher = <T>(lista: readonly T[]): T => lista[Math.floor(sorteio() * lista.length)] as T;
  return Array.from({ length: quantidade }, (_v, indice) => {
    const dadoPessoal = sorteio() < chanceDeDadoPessoal ? ` ${escolher(DADOS_PESSOAIS)}` : '';
    const dia = Math.floor(sorteio() * DIAS_DO_PERIODO);
    return {
      texto: `${escolher(ABERTURAS)} ${escolher(AVALIACOES)}. ${escolher(FECHAMENTOS)}${dadoPessoal}${opcoes.numerar === false ? '' : ` (#${String(indice + 1)})`}`,
      nota: 1 + Math.floor(sorteio() * 5),
      unidade: escolher(UNIDADES),
      autor: escolher(AUTORES),
      comentadoEm: new Date(INICIO_DO_PERIODO + dia * MS_POR_DIA),
    };
  });
}

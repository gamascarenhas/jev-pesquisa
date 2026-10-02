import type { ContaId, ProjetoId } from '../../shared/ids.js';
import { ROTULOS_DE_TEMA } from '../../shared/rotulos.js';
import { iniciarCsv, montarLinhaDeCsv } from '../../shared/safe-csv.js';
import type {
  ComentariosServico,
  FaixaDaPergunta,
  FiltrosDeComentarios,
} from '../comments/comentarios.servico.js';
import { LIMIARES } from './faixas-pergunta.js';

const TAMANHO_DO_LOTE_DE_EXPORTACAO = 1_000;
const CASAS_DECIMAIS = 10_000;

function arredondar(valor: number): number {
  return Math.round(valor * CASAS_DECIMAIS) / CASAS_DECIMAIS;
}

// Toda célula passa pelo shared/safe-csv.ts, que neutraliza fórmulas do Excel.
export async function* gerarCsvDaPergunta(
  comentarios: Pick<ComentariosServico, 'listarRespostasDaPergunta'>,
  contaId: ContaId,
  projetoId: ProjetoId,
  perguntaId: string,
  filtros: FiltrosDeComentarios,
  faixa: FaixaDaPergunta,
): AsyncGenerator<string> {
  yield iniciarCsv(['Comentário', 'Unidade', 'Data', 'Nota', 'Tema', 'Probabilidade (0 a 1)']);
  for (let pagina = 1; ; pagina += 1) {
    const lote = await comentarios.listarRespostasDaPergunta(
      contaId,
      projetoId,
      perguntaId,
      filtros,
      faixa,
      LIMIARES,
      { pagina, tamanhoPagina: TAMANHO_DO_LOTE_DE_EXPORTACAO },
    );
    yield lote.itens
      .map((c) =>
        montarLinhaDeCsv([
          c.textoOriginal,
          c.unidade,
          c.comentadoEm?.toISOString() ?? null,
          c.nota,
          c.tema === null ? null : (ROTULOS_DE_TEMA[c.tema] ?? c.tema),
          arredondar(c.probabilidade),
        ]),
      )
      .join('');
    if (pagina * TAMANHO_DO_LOTE_DE_EXPORTACAO >= lote.total) {
      return;
    }
  }
}

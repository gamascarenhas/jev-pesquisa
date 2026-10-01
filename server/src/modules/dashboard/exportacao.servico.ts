import { registrarAuditoria } from '../../shared/auditoria.js';
import type { ContaId, ProjetoId, UsuarioId } from '../../shared/ids.js';
import type { Registrador } from '../../shared/logger.js';
import { iniciarCsv, montarLinhaDeCsv, type CelulaDeCsv } from '../../shared/safe-csv.js';
import { precisaDeAcao } from '../../shared/thresholds.js';
import type {
  ComentarioListado,
  ComentariosServico,
  FiltrosDeComentarios,
} from '../comments/comentarios.servico.js';
import type { ProjetosServico } from '../projects/projetos.servico.js';
import { ROTULOS_DE_SENTIMENTO, ROTULOS_DE_TEMA } from '../../shared/rotulos.js';

export const TAMANHO_DO_LOTE_DE_EXPORTACAO = 1_000;
const CASAS_DECIMAIS = 100;

export const CABECALHO_DA_EXPORTACAO = [
  'Comentário',
  'Fonte',
  'Unidade',
  'Autor',
  'Data',
  'Nota',
  'Tema',
  'Sentimento',
  'Gravidade (0 a 1)',
  'Precisa de ação',
  'Confiança do tema (0 a 1)',
  'Confiança do sentimento (0 a 1)',
  'Revisado por pessoa',
];

const formatadorDeData = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  dateStyle: 'short',
  timeStyle: 'short',
});

export interface ArquivoExportado {
  nomeDoArquivo: string;
  conteudo: AsyncGenerator<string>;
}

export interface ExportacaoServico {
  exportar(
    contaId: ContaId,
    usuarioId: UsuarioId,
    projetoId: ProjetoId,
    filtros: FiltrosDeComentarios,
  ): Promise<ArquivoExportado>;
}

function duasCasas(valor: number | null): number | null {
  return valor === null ? null : Math.round(valor * CASAS_DECIMAIS) / CASAS_DECIMAIS;
}

// Tema e sentimento já vêm com a correção humana quando ela existe.
export function linhaDaExportacao(comentario: ComentarioListado): CelulaDeCsv[] {
  return [
    comentario.textoOriginal,
    comentario.fonte,
    comentario.unidade,
    comentario.autor,
    comentario.comentadoEm === null ? null : formatadorDeData.format(comentario.comentadoEm),
    comentario.nota,
    comentario.tema === null ? null : (ROTULOS_DE_TEMA[comentario.tema] ?? comentario.tema),
    comentario.sentimento === null
      ? null
      : (ROTULOS_DE_SENTIMENTO[comentario.sentimento] ?? comentario.sentimento),
    duasCasas(comentario.gravidade),
    comentario.precisaAcao === null ? null : precisaDeAcao(comentario.precisaAcao),
    duasCasas(comentario.temaConfianca),
    duasCasas(comentario.sentimentoConfianca),
    comentario.statusClassificacao === 'done' ? comentario.foiRevisado : null,
  ];
}

function nomeSeguro(nome: string): string {
  return (
    nome
      .normalize('NFD')
      .replace(/[^\w.-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'comentarios'
  );
}

export function criarExportacaoServico(dep: {
  comentarios: ComentariosServico;
  projetos: ProjetosServico;
  registrador: Registrador;
}): ExportacaoServico {
  async function* gerar(
    contaId: ContaId,
    projetoId: ProjetoId,
    filtros: FiltrosDeComentarios,
  ): AsyncGenerator<string> {
    yield iniciarCsv(CABECALHO_DA_EXPORTACAO);
    let ultimo: string | undefined;
    for (;;) {
      const lote = await dep.comentarios.lerLoteParaExportar(
        contaId,
        projetoId,
        filtros,
        ultimo,
        TAMANHO_DO_LOTE_DE_EXPORTACAO,
      );
      yield lote.map((comentario) => montarLinhaDeCsv(linhaDaExportacao(comentario))).join('');
      ultimo = lote.at(-1)?.id;
      if (lote.length < TAMANHO_DO_LOTE_DE_EXPORTACAO) {
        return;
      }
    }
  }

  return {
    async exportar(contaId, usuarioId, projetoId, filtros) {
      const projeto = await dep.projetos.obter(contaId, projetoId);
      registrarAuditoria(dep.registrador, 'exportacao', { contaId, usuarioId, alvoId: projetoId });
      return {
        nomeDoArquivo: `comentarios-${nomeSeguro(projeto.nome)}.csv`,
        conteudo: gerar(contaId, projetoId, filtros),
      };
    },
  };
}

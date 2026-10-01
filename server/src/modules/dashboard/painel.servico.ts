import type { ContaId, ProjetoId } from '../../shared/ids.js';
import { NIVEL_MAXIMO_DE_GRAVIDADE } from '../classification/classificacao.servico.js';
import type {
  ComentariosServico,
  ContagemDeGravidade,
  ContagemTemaSentimento,
  FiltrosDeComentarios,
  OpcoesDeFiltro,
  ResumoDoPainel,
} from '../comments/comentarios.servico.js';

export interface Painel {
  resumo: ResumoDoPainel;
  temas: ContagemTemaSentimento[];
  gravidade: ContagemDeGravidade[];
}

export interface PainelServico {
  consultar(contaId: ContaId, projetoId: ProjetoId, filtros: FiltrosDeComentarios): Promise<Painel>;
  opcoes(contaId: ContaId, projetoId: ProjetoId): Promise<OpcoesDeFiltro>;
}

// Todos os níveis aparecem, inclusive os sem comentários, para o gráfico manter a escala.
function completarNiveis(contagens: ContagemDeGravidade[]): ContagemDeGravidade[] {
  return Array.from({ length: NIVEL_MAXIMO_DE_GRAVIDADE + 1 }, (_v, nivel) => ({
    nivel,
    total: contagens.find((contagem) => contagem.nivel === nivel)?.total ?? 0,
  }));
}

export function criarPainelServico(comentarios: ComentariosServico): PainelServico {
  return {
    async consultar(contaId, projetoId, filtros) {
      const [resumo, temas, gravidade] = await Promise.all([
        comentarios.resumo(contaId, projetoId, filtros),
        comentarios.porTemaESentimento(contaId, projetoId, filtros),
        comentarios.porGravidade(contaId, projetoId, filtros),
      ]);
      return { resumo, temas, gravidade: completarNiveis(gravidade) };
    },
    opcoes: (contaId, projetoId) => comentarios.opcoesDeFiltro(contaId, projetoId),
  };
}

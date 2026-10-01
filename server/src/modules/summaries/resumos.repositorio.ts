import type { Banco } from '../../db/conexoes.js';
import { comoContaId, type ContaId, type ProjetoId, type UsuarioId } from '../../shared/ids.js';
import type {
  Achado,
  Agregados,
  AmostraDoResumo,
  NivelDeAlerta,
  StatusDoResumo,
} from './resumos.tipos.js';

export interface ChaveDoResumo {
  tema: string;
  inicio: string;
  fim: string;
  unidade: string | null;
  hashDados: string;
}

export interface NovoResumo extends ChaveDoResumo {
  agregados: Agregados;
  amostra: AmostraDoResumo[] | null;
  nivelDeAlerta: NivelDeAlerta;
  status: Extract<StatusDoResumo, 'generating' | 'too_few_comments'>;
}

export interface ResumoGravado {
  id: string;
  contaId: ContaId;
  tema: string;
  inicio: string;
  fim: string;
  unidade: string | null;
  agregados: Agregados;
  amostra: AmostraDoResumo[] | null;
  titulo: string | null;
  achados: Achado[] | null;
  nivelDeAlerta: NivelDeAlerta;
  status: StatusDoResumo;
  criadoEm: Date;
}

interface LinhaDeResumo {
  id: string;
  conta_id: string;
  tema: string;
  inicio: string;
  fim: string;
  nome_unidade: string | null;
  agregados: Agregados;
  amostra: AmostraDoResumo[] | null;
  titulo: string | null;
  achados: Achado[] | null;
  nivel_alerta: NivelDeAlerta;
  status: StatusDoResumo;
  criado_em: Date;
}

const COLUNAS = `id, conta_id, tema, periodo_inicio::text AS inicio, periodo_fim::text AS fim,
  nome_unidade, agregados, amostra, titulo, achados, nivel_alerta, status, criado_em`;

const COLUNAS_COM_ALIAS = `r.id, r.conta_id, r.tema, r.periodo_inicio::text AS inicio,
  r.periodo_fim::text AS fim, r.nome_unidade, r.agregados, r.amostra, r.titulo, r.achados,
  r.nivel_alerta, r.status, r.criado_em`;

function mapear(linha: LinhaDeResumo): ResumoGravado {
  return {
    id: linha.id,
    contaId: comoContaId(linha.conta_id),
    tema: linha.tema,
    inicio: linha.inicio,
    fim: linha.fim,
    unidade: linha.nome_unidade,
    agregados: linha.agregados,
    amostra: linha.amostra,
    titulo: linha.titulo,
    achados: linha.achados,
    nivelDeAlerta: linha.nivel_alerta,
    status: linha.status,
    criadoEm: linha.criado_em,
  };
}

const IGUAL_A_CHAVE = `tema = $3 AND periodo_inicio = $4 AND periodo_fim = $5
  AND coalesce(nome_unidade, '') = coalesce($6, '') AND hash_dados = $7 AND status <> 'failed'`;

export class ResumosRepositorio {
  constructor(private readonly banco: Banco) {}

  // Uma queda do servidor no meio da geração não pode prender o cache para sempre.
  async encerrarGeracoesAntigas(
    contaId: ContaId,
    projetoId: ProjetoId,
    criadasAntesDe: Date,
  ): Promise<void> {
    await this.banco.query(
      `UPDATE resumos_tema SET status = 'failed', erro = 'interrompido'
        WHERE conta_id = $1 AND projeto_id = $2 AND status = 'generating' AND criado_em < $3`,
      [contaId, projetoId, criadasAntesDe],
    );
  }

  async buscarEquivalente(
    contaId: ContaId,
    projetoId: ProjetoId,
    chave: ChaveDoResumo,
  ): Promise<ResumoGravado | undefined> {
    const resultado = await this.banco.query<LinhaDeResumo>(
      `SELECT ${COLUNAS} FROM resumos_tema WHERE conta_id = $1 AND projeto_id = $2 AND ${IGUAL_A_CHAVE}`,
      [contaId, projetoId, chave.tema, chave.inicio, chave.fim, chave.unidade, chave.hashDados],
    );
    const linha = resultado.rows[0];
    return linha && mapear(linha);
  }

  // O índice único do cache decide a disputa: quem perde recebe `undefined`.
  async inserir(
    contaId: ContaId,
    projetoId: ProjetoId,
    usuarioId: UsuarioId | null,
    novo: NovoResumo,
  ): Promise<ResumoGravado | undefined> {
    const resultado = await this.banco.query<LinhaDeResumo>(
      `INSERT INTO resumos_tema (conta_id, projeto_id, tema, periodo_inicio, periodo_fim,
                                 nome_unidade, hash_dados, agregados, amostra, nivel_alerta,
                                 criado_por, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT DO NOTHING RETURNING ${COLUNAS}`,
      [
        contaId,
        projetoId,
        novo.tema,
        novo.inicio,
        novo.fim,
        novo.unidade,
        novo.hashDados,
        JSON.stringify(novo.agregados),
        novo.amostra === null ? null : JSON.stringify(novo.amostra),
        novo.nivelDeAlerta,
        usuarioId,
        novo.status,
      ],
    );
    const linha = resultado.rows[0];
    return linha && mapear(linha);
  }

  async marcarPronto(
    contaId: ContaId,
    id: string,
    titulo: string,
    achados: Achado[],
    modelo: string,
  ): Promise<void> {
    await this.banco.query(
      `UPDATE resumos_tema SET status = 'ready', titulo = $3, achados = $4, modelo_llm = $5
        WHERE conta_id = $1 AND id = $2`,
      [contaId, id, titulo, JSON.stringify(achados), modelo],
    );
  }

  async marcarSoNumeros(contaId: ContaId, id: string, modelo: string | null): Promise<void> {
    await this.banco.query(
      `UPDATE resumos_tema SET status = 'numbers_only', modelo_llm = $3
        WHERE conta_id = $1 AND id = $2`,
      [contaId, id, modelo],
    );
  }

  // O erro é só um nome curto, nunca texto de comentário nem resposta do modelo.
  async marcarFalha(contaId: ContaId, id: string, erro: string): Promise<void> {
    await this.banco.query(
      `UPDATE resumos_tema SET status = 'failed', erro = $3 WHERE conta_id = $1 AND id = $2`,
      [contaId, id, erro],
    );
  }

  // O conjunto atual é o último período e unidade gerados; dentro dele, o resumo mais novo de cada tema.
  async listarUltimoConjunto(contaId: ContaId, projetoId: ProjetoId): Promise<ResumoGravado[]> {
    const resultado = await this.banco.query<LinhaDeResumo>(
      `WITH ultimo AS (
         SELECT periodo_inicio, periodo_fim, nome_unidade FROM resumos_tema
          WHERE conta_id = $1 AND projeto_id = $2 AND status NOT IN ('failed', 'generating')
          ORDER BY criado_em DESC LIMIT 1)
       SELECT DISTINCT ON (r.tema) ${COLUNAS_COM_ALIAS}
         FROM resumos_tema r JOIN ultimo u
           ON u.periodo_inicio = r.periodo_inicio AND u.periodo_fim = r.periodo_fim
          AND coalesce(u.nome_unidade, '') = coalesce(r.nome_unidade, '')
        WHERE r.conta_id = $1 AND r.projeto_id = $2 AND r.status NOT IN ('failed', 'generating')
        ORDER BY r.tema, r.criado_em DESC`,
      [contaId, projetoId],
    );
    return resultado.rows.map(mapear);
  }

  async buscarPorId(
    contaId: ContaId,
    projetoId: ProjetoId,
    id: string,
  ): Promise<ResumoGravado | undefined> {
    const resultado = await this.banco.query<LinhaDeResumo>(
      `SELECT ${COLUNAS} FROM resumos_tema WHERE conta_id = $1 AND projeto_id = $2 AND id = $3`,
      [contaId, projetoId, id],
    );
    const linha = resultado.rows[0];
    return linha && mapear(linha);
  }
}

export function criarResumosRepositorio(banco: Banco): ResumosRepositorio {
  return new ResumosRepositorio(banco);
}

import type { Banco, Executor } from '../../db/conexoes.js';
import { exigirPrimeiraLinha } from '../../db/linhas.js';
import {
  comoContaId,
  comoFonteId,
  comoProjetoId,
  type ContaId,
  type FonteId,
  type ProjetoId,
} from '../../shared/ids.js';
import type { ResumoDaImportacao } from './envios.tipos.js';

export interface Fonte {
  id: FonteId;
  contaId: ContaId;
  projetoId: ProjetoId;
  tipo: 'upload' | 'google_business';
  nome: string;
  importacao: ResumoDaImportacao | undefined;
  criadoEm: Date;
}

interface LinhaDeFonte {
  id: string;
  conta_id: string;
  projeto_id: string;
  tipo: 'upload' | 'google_business';
  nome: string;
  metadados: { importacao?: ResumoDaImportacao };
  criado_em: Date;
}

const COLUNAS = 'id, conta_id, projeto_id, tipo, nome, metadados, criado_em';

function mapear(linha: LinhaDeFonte): Fonte {
  return {
    id: comoFonteId(linha.id),
    contaId: comoContaId(linha.conta_id),
    projetoId: comoProjetoId(linha.projeto_id),
    tipo: linha.tipo,
    nome: linha.nome,
    importacao: linha.metadados.importacao,
    criadoEm: linha.criado_em,
  };
}

export class FontesRepositorio {
  constructor(private readonly banco: Banco) {}

  async criarUpload(contaId: ContaId, projetoId: ProjetoId, nome: string): Promise<Fonte> {
    const resultado = await this.banco.query<LinhaDeFonte>(
      `INSERT INTO fontes (conta_id, projeto_id, tipo, nome) VALUES ($1, $2, 'upload', $3)
       RETURNING ${COLUNAS}`,
      [contaId, projetoId, nome],
    );
    return mapear(exigirPrimeiraLinha(resultado.rows));
  }

  async buscarPorId(
    contaId: ContaId,
    projetoId: ProjetoId,
    fonteId: FonteId,
  ): Promise<Fonte | undefined> {
    const resultado = await this.banco.query<LinhaDeFonte>(
      `SELECT ${COLUNAS} FROM fontes WHERE conta_id = $1 AND projeto_id = $2 AND id = $3`,
      [contaId, projetoId, fonteId],
    );
    const linha = resultado.rows[0];
    return linha && mapear(linha);
  }

  async gravarImportacao(
    contaId: ContaId,
    fonteId: FonteId,
    importacao: ResumoDaImportacao,
    executor: Executor = this.banco,
  ): Promise<void> {
    await executor.query(
      `UPDATE fontes
          SET metadados = jsonb_set(metadados, '{importacao}', $3::jsonb),
              ultima_sincronizacao_em = CASE WHEN $4 THEN now() ELSE ultima_sincronizacao_em END
        WHERE conta_id = $1 AND id = $2`,
      [contaId, fonteId, JSON.stringify(importacao), importacao.concluida],
    );
  }

  async apagar(contaId: ContaId, fonteId: FonteId): Promise<void> {
    await this.banco.query('DELETE FROM fontes WHERE conta_id = $1 AND id = $2', [
      contaId,
      fonteId,
    ]);
  }
}

export function criarFontesRepositorio(banco: Banco): FontesRepositorio {
  return new FontesRepositorio(banco);
}

import type { Banco } from '../../db/conexoes.js';
import { exigirPrimeiraLinha } from '../../db/linhas.js';
import type { ContaId, ProjetoId } from '../../shared/ids.js';
import type { FonteGoogle } from './conexoes-google.tipos.js';

interface LinhaDeFonteGoogle {
  id: string;
  nome_unidade_google: string;
  nome: string;
  ultima_sincronizacao_em: Date | null;
  metadados: { falha?: { codigo: string; mensagem: string } };
}

const COLUNAS = 'id, nome_unidade_google, nome, ultima_sincronizacao_em, metadados';

function mapear(linha: LinhaDeFonteGoogle): FonteGoogle {
  return {
    id: linha.id,
    nomeUnidade: linha.nome_unidade_google,
    titulo: linha.nome,
    ultimaSincronizacaoEm: linha.ultima_sincronizacao_em,
    falha: linha.metadados.falha ?? null,
  };
}

export class FontesGoogleRepositorio {
  constructor(private readonly banco: Banco) {}

  async listar(contaId: ContaId, projetoId: ProjetoId): Promise<FonteGoogle[]> {
    const resultado = await this.banco.query<LinhaDeFonteGoogle>(
      `SELECT ${COLUNAS} FROM fontes
        WHERE conta_id = $1 AND projeto_id = $2 AND tipo = 'google_business'
        ORDER BY nome`,
      [contaId, projetoId],
    );
    return resultado.rows.map(mapear);
  }

  // Uma unidade vira uma fonte só; escolher de novo religa a fonte à conexão atual.
  async garantir(
    contaId: ContaId,
    projetoId: ProjetoId,
    conexaoId: string,
    nomeUnidade: string,
    titulo: string,
  ): Promise<FonteGoogle> {
    const resultado = await this.banco.query<LinhaDeFonteGoogle>(
      `INSERT INTO fontes (conta_id, projeto_id, tipo, nome, conexao_google_id, nome_unidade_google)
       VALUES ($1, $2, 'google_business', $3, $4, $5)
       ON CONFLICT (projeto_id, nome_unidade_google) WHERE tipo = 'google_business'
       DO UPDATE SET conexao_google_id = EXCLUDED.conexao_google_id
       RETURNING ${COLUNAS}`,
      [contaId, projetoId, titulo, conexaoId, nomeUnidade],
    );
    return mapear(exigirPrimeiraLinha(resultado.rows));
  }

  async religar(contaId: ContaId, projetoId: ProjetoId, conexaoId: string): Promise<void> {
    await this.banco.query(
      `UPDATE fontes SET conexao_google_id = $3
        WHERE conta_id = $1 AND projeto_id = $2 AND tipo = 'google_business'`,
      [contaId, projetoId, conexaoId],
    );
  }

  async registrarSucesso(
    contaId: ContaId,
    fonteId: string,
    iniciadaEm: Date,
    resumo: object,
  ): Promise<void> {
    await this.banco.query(
      `UPDATE fontes
          SET ultima_sincronizacao_em = $3,
              metadados = (metadados - 'falha') || jsonb_build_object('sincronizacao', $4::jsonb)
        WHERE conta_id = $1 AND id = $2`,
      [contaId, fonteId, iniciadaEm, JSON.stringify(resumo)],
    );
  }

  async registrarFalha(
    contaId: ContaId,
    projetoId: ProjetoId,
    codigo: string,
    mensagem: string,
  ): Promise<void> {
    await this.banco.query(
      `UPDATE fontes SET metadados = metadados || jsonb_build_object('falha', $3::jsonb)
        WHERE conta_id = $1 AND projeto_id = $2 AND tipo = 'google_business'`,
      [contaId, projetoId, JSON.stringify({ codigo, mensagem })],
    );
  }
}

export function criarFontesGoogleRepositorio(banco: Banco): FontesGoogleRepositorio {
  return new FontesGoogleRepositorio(banco);
}

import type { Banco } from '../db/conexoes.js';

// A tabela é do sistema, sem conta_id: guarda quem executou cada tarefa agendada em cada horário.
export class ExecucoesAgendadasSistemaRepositorio {
  constructor(private readonly banco: Banco) {}

  // Atravessa contas por natureza: a chave primária (nome, horário) deixa só uma instância executar a tarefa.
  async reservar(nome: string, agendadoPara: Date, agora: Date): Promise<boolean> {
    const resultado = await this.banco.query(
      `INSERT INTO execucoes_agendadas (nome, agendado_para, iniciado_em)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [nome, agendadoPara, agora],
    );
    return resultado.rowCount === 1;
  }

  // Atravessa contas por natureza: registra o fim da execução reservada acima.
  async finalizar(
    nome: string,
    agendadoPara: Date,
    agora: Date,
    erro: string | null,
  ): Promise<void> {
    await this.banco.query(
      `UPDATE execucoes_agendadas SET finalizado_em = $3, erro = $4
        WHERE nome = $1 AND agendado_para = $2`,
      [nome, agendadoPara, agora, erro],
    );
  }
}

export function criarExecucoesAgendadasSistemaRepositorio(
  banco: Banco,
): ExecucoesAgendadasSistemaRepositorio {
  return new ExecucoesAgendadasSistemaRepositorio(banco);
}

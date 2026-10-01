-- 0012_execucoes_agendadas.sql
CREATE TABLE execucoes_agendadas (
  nome           text NOT NULL,
  agendado_para  timestamptz NOT NULL,
  iniciado_em    timestamptz NOT NULL DEFAULT now(),
  finalizado_em  timestamptz,
  erro           text,
  PRIMARY KEY (nome, agendado_para)
);

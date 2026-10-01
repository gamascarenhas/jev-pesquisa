-- 0009_livro_razao_consumo.sql
CREATE TABLE livro_razao_consumo (
  id                          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conta_id                    uuid REFERENCES contas(id) ON DELETE SET NULL,
  conta_ref                   uuid NOT NULL,
  ciclo_iniciado_em           timestamptz NOT NULL,
  provedor                    text NOT NULL CHECK (provedor IN ('jev', 'llm')),
  operacao                    text NOT NULL
                              CHECK (operacao IN ('classify', 'ask', 'interpret_question',
                                                  'summarize', 'verify_summary')),
  comentario_ref              uuid,
  pergunta_personalizada_ref  uuid,
  resumo_ref                  uuid,
  modelo                      text,
  tokens_entrada_estimados    integer NOT NULL CHECK (tokens_entrada_estimados >= 0),
  tokens_saida_estimados      integer NOT NULL DEFAULT 0 CHECK (tokens_saida_estimados >= 0),
  reservado_usd               numeric(14,8) NOT NULL CHECK (reservado_usd >= 0),
  tokens_entrada              integer CHECK (tokens_entrada >= 0),
  tokens_saida                integer CHECK (tokens_saida >= 0),
  real_usd                    numeric(14,8) CHECK (real_usd >= 0),
  status                      text NOT NULL DEFAULT 'reserved'
                              CHECK (status IN ('reserved', 'settled', 'released')),
  criado_em                   timestamptz NOT NULL DEFAULT now(),
  finalizado_em               timestamptz,
  CHECK (status <> 'settled' OR real_usd IS NOT NULL)
);
CREATE INDEX livro_razao_consumo_conta_ciclo_idx
  ON livro_razao_consumo (conta_ref, ciclo_iniciado_em, status);
CREATE INDEX livro_razao_consumo_reservas_antigas_idx
  ON livro_razao_consumo (criado_em) WHERE status = 'reserved';

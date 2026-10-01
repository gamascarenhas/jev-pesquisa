-- 0011_alertas_consumo.sql
CREATE TABLE alertas_consumo (
  conta_id           uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  ciclo_iniciado_em  timestamptz NOT NULL,
  limiar             smallint NOT NULL CHECK (limiar IN (80, 100)),
  enviado_em         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conta_id, ciclo_iniciado_em, limiar)
);

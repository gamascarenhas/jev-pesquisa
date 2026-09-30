CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE migracoes_aplicadas (
  versao      text PRIMARY KEY,
  checksum    text NOT NULL,
  aplicada_em timestamptz NOT NULL DEFAULT now()
);

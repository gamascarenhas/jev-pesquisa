CREATE TABLE projetos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id       uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  nome           text NOT NULL,
  criado_por     uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, conta_id)
);
CREATE INDEX projetos_conta_id_idx ON projetos (conta_id);

-- 0007_fontes.sql
CREATE TABLE fontes (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id                 uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  projeto_id               uuid NOT NULL,
  tipo                     text NOT NULL CHECK (tipo IN ('upload', 'google_business')),
  nome                     text NOT NULL,
  conexao_google_id        uuid,
  nome_unidade_google      text,
  metadados                jsonb NOT NULL DEFAULT '{}'::jsonb,
  ultima_sincronizacao_em  timestamptz,
  criado_em                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, conta_id),
  FOREIGN KEY (projeto_id, conta_id) REFERENCES projetos(id, conta_id) ON DELETE CASCADE,
  CHECK (tipo <> 'google_business' OR nome_unidade_google IS NOT NULL)
);
CREATE INDEX fontes_projeto_id_idx ON fontes (projeto_id);
CREATE INDEX fontes_conta_id_idx ON fontes (conta_id);
CREATE UNIQUE INDEX fontes_unidade_google_unica
  ON fontes (projeto_id, nome_unidade_google) WHERE tipo = 'google_business';

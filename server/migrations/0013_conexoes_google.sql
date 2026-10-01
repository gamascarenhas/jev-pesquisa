-- 0013_conexoes_google.sql
CREATE TABLE conexoes_google (
  id                               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id                         uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  projeto_id                       uuid NOT NULL,
  email_conta_google               text NOT NULL,
  token_atualizacao_criptografado  text,
  token_acesso_criptografado       text,
  token_acesso_expira_em           timestamptz,
  escopos                          text[] NOT NULL,
  conectado_por                    uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  revogado_em                      timestamptz,
  criado_em                        timestamptz NOT NULL DEFAULT now(),
  atualizado_em                    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, conta_id),
  FOREIGN KEY (projeto_id, conta_id) REFERENCES projetos(id, conta_id) ON DELETE CASCADE,
  CHECK (revogado_em IS NOT NULL OR token_atualizacao_criptografado IS NOT NULL)
);
CREATE UNIQUE INDEX conexoes_google_ativa_unica
  ON conexoes_google (projeto_id) WHERE revogado_em IS NULL;
CREATE INDEX conexoes_google_conta_id_idx ON conexoes_google (conta_id);

ALTER TABLE fontes
  ADD CONSTRAINT fontes_conexao_google_fk
  FOREIGN KEY (conexao_google_id, conta_id) REFERENCES conexoes_google(id, conta_id)
  ON DELETE SET NULL (conexao_google_id);

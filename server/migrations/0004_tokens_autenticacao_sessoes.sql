CREATE TABLE tokens_autenticacao (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id         uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  usuario_id       uuid,
  tipo             text NOT NULL
                   CHECK (tipo IN ('email_verification', 'password_reset', 'invitation', 'email_change')),
  email            text NOT NULL,
  hash_token       text NOT NULL UNIQUE,
  papel_convidado  text CHECK (papel_convidado IN ('owner', 'member')),
  criado_por       uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  expira_em        timestamptz NOT NULL,
  usado_em         timestamptz,
  criado_em        timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (usuario_id, conta_id) REFERENCES usuarios(id, conta_id) ON DELETE CASCADE,
  CHECK (tipo <> 'invitation' OR papel_convidado IS NOT NULL),
  CHECK (tipo = 'invitation' OR usuario_id IS NOT NULL)
);
CREATE INDEX tokens_autenticacao_conta_id_idx ON tokens_autenticacao (conta_id);
CREATE INDEX tokens_autenticacao_expira_em_idx ON tokens_autenticacao (expira_em);

CREATE TABLE sessoes (
  id_sessao   text PRIMARY KEY,
  usuario_id  uuid REFERENCES usuarios(id) ON DELETE CASCADE,
  dados       jsonb NOT NULL,
  expira_em   timestamptz NOT NULL
);
CREATE INDEX sessoes_expira_em_idx ON sessoes (expira_em);
CREATE INDEX sessoes_usuario_id_idx ON sessoes (usuario_id);

CREATE TABLE contas (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                  text NOT NULL,
  plano_id              text NOT NULL REFERENCES planos(id),
  ciclo_iniciado_em     timestamptz NOT NULL DEFAULT now(),
  ciclo_termina_em      timestamptz NOT NULL DEFAULT now() + interval '1 month',
  criado_em             timestamptz NOT NULL DEFAULT now(),
  atualizado_em         timestamptz NOT NULL DEFAULT now(),
  CHECK (ciclo_termina_em > ciclo_iniciado_em)
);
CREATE INDEX contas_ciclo_termina_em_idx ON contas (ciclo_termina_em);

CREATE TABLE usuarios (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id                 uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  nome                     text NOT NULL,
  email                    text NOT NULL,
  email_confirmado_em      timestamptz,
  hash_senha               text NOT NULL,
  papel                    text NOT NULL CHECK (papel IN ('owner', 'member')),
  tentativas_login_falhas  integer NOT NULL DEFAULT 0,
  bloqueado_ate            timestamptz,
  ultimo_login_em          timestamptz,
  termos_aceitos_em        timestamptz,
  versao_termos            text,
  criado_em                timestamptz NOT NULL DEFAULT now(),
  atualizado_em            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, conta_id)
);
CREATE UNIQUE INDEX usuarios_email_unico ON usuarios (lower(email));
CREATE INDEX usuarios_conta_id_idx ON usuarios (conta_id);

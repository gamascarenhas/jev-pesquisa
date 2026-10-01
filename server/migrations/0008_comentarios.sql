-- 0008_comentarios.sql
CREATE TABLE comentarios (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id                  uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  projeto_id                uuid NOT NULL,
  fonte_id                  uuid NOT NULL,
  id_externo                text,
  texto_original            text,
  texto_mascarado           text,
  foi_truncado              boolean NOT NULL DEFAULT false,
  nota                      smallint CHECK (nota BETWEEN 1 AND 5),
  nome_unidade              text,
  nome_autor                text,
  comentado_em              timestamptz,
  fonte_atualizada_em       timestamptz,
  hash_conteudo             text NOT NULL,
  status_classificacao      text NOT NULL DEFAULT 'pending'
                            CHECK (status_classificacao IN ('pending', 'done', 'no_text', 'failed')),
  tentativas_classificacao  integer NOT NULL DEFAULT 0,
  erro_classificacao        text,
  criado_em                 timestamptz NOT NULL DEFAULT now(),
  atualizado_em             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, conta_id),
  FOREIGN KEY (projeto_id, conta_id) REFERENCES projetos(id, conta_id) ON DELETE CASCADE,
  FOREIGN KEY (fonte_id, conta_id) REFERENCES fontes(id, conta_id) ON DELETE CASCADE,
  CHECK ((texto_original IS NULL) = (texto_mascarado IS NULL)),
  CHECK (texto_original IS NOT NULL OR status_classificacao = 'no_text')
);
CREATE UNIQUE INDEX comentarios_projeto_hash_unico ON comentarios (projeto_id, hash_conteudo);
CREATE UNIQUE INDEX comentarios_fonte_externo_unico
  ON comentarios (fonte_id, id_externo) WHERE id_externo IS NOT NULL;
CREATE INDEX comentarios_conta_id_idx ON comentarios (conta_id);
CREATE INDEX comentarios_projeto_comentado_em_idx ON comentarios (projeto_id, comentado_em DESC);
CREATE INDEX comentarios_projeto_status_idx ON comentarios (projeto_id, status_classificacao);
CREATE INDEX comentarios_projeto_unidade_idx ON comentarios (projeto_id, nome_unidade);

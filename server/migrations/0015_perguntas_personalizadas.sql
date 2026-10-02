-- 0015_perguntas_personalizadas.sql
CREATE TABLE perguntas_personalizadas (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id                uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  projeto_id              uuid NOT NULL,
  criado_por              uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  texto_original          text NOT NULL,
  hash_pergunta           text NOT NULL,
  respondivel             boolean,
  instrucoes_jev          text,
  criterios_jev           jsonb,
  interpretacao_pt        text,
  motivo_nao_respondivel  text,
  filtros                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_alvo              integer,
  status                  text NOT NULL DEFAULT 'interpreting'
                          CHECK (status IN ('interpreting', 'awaiting_confirmation', 'not_answerable',
                                            'running', 'paused_limit', 'done', 'failed')),
  criado_em               timestamptz NOT NULL DEFAULT now(),
  atualizado_em           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, conta_id),
  FOREIGN KEY (projeto_id, conta_id) REFERENCES projetos(id, conta_id) ON DELETE CASCADE,
  CHECK (respondivel IS NOT TRUE OR (instrucoes_jev IS NOT NULL AND criterios_jev IS NOT NULL))
);
CREATE INDEX perguntas_personalizadas_projeto_criado_idx ON perguntas_personalizadas (projeto_id, criado_em DESC);
CREATE INDEX perguntas_personalizadas_projeto_hash_idx ON perguntas_personalizadas (projeto_id, hash_pergunta);
CREATE INDEX perguntas_personalizadas_conta_id_idx ON perguntas_personalizadas (conta_id);

CREATE TABLE respostas_perguntas_personalizadas (
  pergunta_personalizada_id  uuid NOT NULL,
  comentario_id              uuid NOT NULL,
  conta_id                   uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  probabilidade              numeric(5,4) NOT NULL CHECK (probabilidade BETWEEN 0 AND 1),
  modelo                     text NOT NULL,
  criado_em                  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pergunta_personalizada_id, comentario_id),
  FOREIGN KEY (pergunta_personalizada_id, conta_id) REFERENCES perguntas_personalizadas(id, conta_id) ON DELETE CASCADE,
  FOREIGN KEY (comentario_id, conta_id) REFERENCES comentarios(id, conta_id) ON DELETE CASCADE
);
CREATE INDEX respostas_perguntas_personalizadas_comentario_idx ON respostas_perguntas_personalizadas (comentario_id);
CREATE INDEX respostas_perguntas_personalizadas_ranking_idx
  ON respostas_perguntas_personalizadas (pergunta_personalizada_id, probabilidade DESC);

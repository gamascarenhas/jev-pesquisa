-- 0010_classificacoes_revisoes.sql
CREATE TABLE classificacoes (
  comentario_id              uuid PRIMARY KEY,
  conta_id                   uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  modelo                     text NOT NULL,
  tema                       text NOT NULL,
  tema_confianca             numeric(5,4) NOT NULL CHECK (tema_confianca BETWEEN 0 AND 1),
  tema_probabilidades        jsonb NOT NULL,
  sentimento                 text NOT NULL
                             CHECK (sentimento IN ('positive', 'neutral', 'negative', 'mixed')),
  sentimento_confianca       numeric(5,4) NOT NULL CHECK (sentimento_confianca BETWEEN 0 AND 1),
  sentimento_probabilidades  jsonb NOT NULL,
  gravidade_pontuacao        numeric(6,4) NOT NULL CHECK (gravidade_pontuacao >= 0),
  gravidade_normalizada      numeric(5,4) NOT NULL CHECK (gravidade_normalizada BETWEEN 0 AND 1),
  gravidade_confianca        numeric(5,4) NOT NULL CHECK (gravidade_confianca BETWEEN 0 AND 1),
  gravidade_probabilidades   jsonb NOT NULL,
  precisa_acao               numeric(5,4) NOT NULL CHECK (precisa_acao BETWEEN 0 AND 1),
  precisa_revisao            boolean NOT NULL,
  criado_em                  timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (comentario_id, conta_id) REFERENCES comentarios(id, conta_id) ON DELETE CASCADE
);
CREATE INDEX classificacoes_conta_id_idx ON classificacoes (conta_id);
CREATE INDEX classificacoes_tema_idx ON classificacoes (tema);
CREATE INDEX classificacoes_precisa_revisao_idx ON classificacoes (conta_id) WHERE precisa_revisao;

CREATE TABLE revisoes_classificacao (
  comentario_id  uuid PRIMARY KEY,
  conta_id       uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  tema           text NOT NULL,
  sentimento     text NOT NULL
                 CHECK (sentimento IN ('positive', 'neutral', 'negative', 'mixed')),
  revisado_por   uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  revisado_em    timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (comentario_id, conta_id) REFERENCES comentarios(id, conta_id) ON DELETE CASCADE
);
CREATE INDEX revisoes_classificacao_conta_id_idx ON revisoes_classificacao (conta_id);

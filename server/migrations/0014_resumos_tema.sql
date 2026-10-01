-- 0014_resumos_tema.sql
CREATE TABLE resumos_tema (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id        uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  projeto_id      uuid NOT NULL,
  tema            text NOT NULL,
  periodo_inicio  date NOT NULL,
  periodo_fim     date NOT NULL,
  nome_unidade    text,
  hash_dados      text NOT NULL,
  agregados       jsonb NOT NULL,
  amostra         jsonb,
  titulo          text,
  achados         jsonb,
  nivel_alerta    text NOT NULL CHECK (nivel_alerta IN ('critical', 'attention', 'stable')),
  modelo_llm      text,
  criado_por      uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'generating'
                  CHECK (status IN ('generating', 'ready', 'numbers_only', 'too_few_comments', 'failed')),
  erro            text,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (projeto_id, conta_id) REFERENCES projetos(id, conta_id) ON DELETE CASCADE,
  CHECK (periodo_fim >= periodo_inicio),
  CHECK (status <> 'ready' OR (titulo IS NOT NULL AND achados IS NOT NULL))
);
CREATE UNIQUE INDEX resumos_tema_cache_unico
  ON resumos_tema (projeto_id, tema, periodo_inicio, periodo_fim, coalesce(nome_unidade, ''), hash_dados)
  WHERE status <> 'failed';
CREATE INDEX resumos_tema_projeto_periodo_idx
  ON resumos_tema (projeto_id, periodo_fim DESC, tema);
CREATE INDEX resumos_tema_conta_id_idx ON resumos_tema (conta_id);

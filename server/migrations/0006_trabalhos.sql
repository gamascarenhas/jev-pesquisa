-- 0006_trabalhos.sql
CREATE TABLE trabalhos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id         uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  projeto_id       uuid,
  tipo             text NOT NULL
                   CHECK (tipo IN ('import_upload', 'classify', 'ask', 'summarize', 'google_sync')),
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'running', 'paused_limit', 'done', 'failed', 'cancelled')),
  carga            jsonb NOT NULL DEFAULT '{}'::jsonb,
  progresso_total  integer NOT NULL DEFAULT 0 CHECK (progresso_total >= 0),
  progresso_feito  integer NOT NULL DEFAULT 0 CHECK (progresso_feito >= 0),
  tentativas       integer NOT NULL DEFAULT 0,
  max_tentativas   integer NOT NULL DEFAULT 5,
  executar_apos    timestamptz NOT NULL DEFAULT now(),
  bloqueado_por    text,
  bloqueado_em     timestamptz,
  sinal_vida_em    timestamptz,
  ultimo_erro      text,
  criado_por       uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em        timestamptz NOT NULL DEFAULT now(),
  iniciado_em      timestamptz,
  finalizado_em    timestamptz,
  FOREIGN KEY (projeto_id, conta_id) REFERENCES projetos(id, conta_id) ON DELETE CASCADE
);
CREATE INDEX trabalhos_prontos_idx ON trabalhos (executar_apos) WHERE status = 'pending';
CREATE INDEX trabalhos_executando_sinal_vida_idx ON trabalhos (sinal_vida_em) WHERE status = 'running';
CREATE INDEX trabalhos_pausados_idx ON trabalhos (conta_id) WHERE status = 'paused_limit';
CREATE INDEX trabalhos_projeto_criado_idx ON trabalhos (projeto_id, criado_em DESC);
CREATE UNIQUE INDEX trabalhos_classificacao_ativa_unica
  ON trabalhos (projeto_id)
  WHERE tipo = 'classify' AND status IN ('pending', 'running', 'paused_limit');
CREATE UNIQUE INDEX trabalhos_sincronizacao_ativa_unica
  ON trabalhos (projeto_id)
  WHERE tipo = 'google_sync' AND status IN ('pending', 'running', 'paused_limit');
CREATE UNIQUE INDEX trabalhos_pergunta_ativa_unica
  ON trabalhos ((carga->>'perguntaId'))
  WHERE tipo = 'ask' AND status IN ('pending', 'running', 'paused_limit');

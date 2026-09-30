# Fase 4: Fila de jobs

**Entrega 1.** Depende de: fases 1 e 2.

## Leia antes

- `AGENTS.md`
- `docs/spec/referencia/tecnologias.md`
- `docs/spec/referencia/padroes-de-engenharia.md`, seções de arquitetura e segurança
- `docs/spec/referencia/estrutura-server.md`, pasta `jobs`
- `docs/spec/referencia/banco-de-dados.md`, tabela `trabalhos`

## Nesta fase

- **Migrations desta fase:** crie em `server/migrations` o arquivo da seção "Migrations desta fase", com o SQL exato dela, e aplique-o.
- **Infraestrutura de jobs**, que todas as fases seguintes usam: `jobs/fila-trabalhos.ts` com `FOR UPDATE SKIP LOCKED`, `executor-trabalhos.ts` com concorrência configurável e heartbeat, e `recuperacao-trabalhos.ts`. `fila-trabalhos.ts` e a recuperação atravessam contas de propósito, e cada função que faz isso tem o comentário de justificativa exigido.
- **Registro de handlers:** o executor recebe um mapa de tipo de job para handler, montado em `app.ts`. Cada fase seguinte registra o seu handler (`importar-envio`, `classificar`, `perguntar`, `resumir`, `google-sincronizacao`). Nesta fase os testes usam handlers de teste.
- **Ganchos de recuperação:** `recuperacao-trabalhos.ts` também chama funções registradas por fases seguintes na inicialização (limpeza de envios órfãos, liberação de reservas antigas, reavaliação de jobs `paused_limit`). Nesta fase o mecanismo existe e a lista de ganchos está vazia.
- Rota de status de job com progresso, filtrada pela conta e protegida por `exigir-autenticacao`, em `jobs/trabalhos.rotas.ts`, `trabalhos.servico.ts` e `trabalhos.repositorio.ts`.
- Estatísticas de job em log estruturado (`idTrabalho`, tipo, duração, tentativas), sem nenhum dado de comentário.

## Especificação

### Comportamento da fila

1. **Pegar jobs sem colisão:** o executor reivindica o próximo job pronto (`status = 'pending'` e `executar_apos` vencido) com `FOR UPDATE SKIP LOCKED`, gravando `bloqueado_por` e `bloqueado_em`. Duas instâncias nunca executam o mesmo job.
2. **Heartbeat:** enquanto um handler roda, o executor atualiza `sinal_vida_em` em intervalos fixos.
3. **Recuperação na inicialização:** jobs `running` sem heartbeat recente voltam para `pending`, com o bloqueio limpo, e continuam de onde pararam porque o progresso é derivado dos dados.
4. **Erros:** erro temporário repete o job com atraso crescente e jitter até `max_tentativas`; erro definitivo marca `failed` com `ultimo_erro` sem texto de comentário; o handler pode lançar `ErroLimiteDeCustoAtingido` (fase 6), que o executor converte em `paused_limit`; esse é o único mecanismo de pausa, e o handler nunca devolve o status.
5. **Encerramento gracioso:** ao receber `SIGTERM` ou `SIGINT`, o executor para de pegar jobs novos, espera o handler atual por até 30 segundos e devolve para `pending`, com o bloqueio limpo, o job que não terminou.
6. **Um job ativo por vez:** os índices únicos parciais de `trabalhos` impedem dois jobs ativos de classificação por projeto, de sincronização do Google por projeto e de execução da mesma pergunta. Quem cria o job trata a violação como "já existe um em andamento" e devolve o job existente.
7. **Isolamento:** a rota de status devolve só jobs da própria conta.

## Migrations desta fase

Crie o arquivo abaixo em `server/migrations`, com este SQL exato.

```sql
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
```

## Testes desta fase

- Dois executores concorrentes nunca pegam o mesmo job.
- Um job `running` órfão volta para `pending` na recuperação e termina.
- Erro temporário repete com atraso crescente até `max_tentativas`, e depois o job fica `failed`.
- O desligamento do executor durante um job devolve o job a `pending` sem perder progresso (o teste chama a função de desligamento, porque no Windows `SIGTERM` não dispara handler).
- Os ganchos de recuperação registrados rodam na inicialização, e a falha de um não impede os outros.
- O banco recusa um segundo job de classificação ativo no mesmo projeto, e criar o job trata isso devolvendo o existente.
- O banco recusa um job de uma conta que aponte para um projeto de outra conta.
- A rota de status de job só devolve jobs da própria conta e exige autenticação.
- O log de job não contém texto de comentário nem segredos.
- Isolamento e exclusão: apagar projeto e encerrar conta removem os jobs dependentes.
- A migration desta fase aplicada duas vezes sem erro.

## Pronto quando

1. Criar um job de teste, parar o servidor no meio e ver o job terminar sozinho depois de subir de novo.
2. Consultar o progresso pela rota de status e ver só jobs da própria conta.
3. A migration desta fase aplicada num PostgreSQL 16 real, duas vezes, sem erro.

## Fora desta fase

- Qualquer handler de negócio: upload, classificação, perguntas, resumos e Google.
- O agendador de tarefas recorrentes: fase 9.

## Antes de parar

Passe pela lista de `AGENTS.md`. Confira também:

- [ ] Toda função de `fila-trabalhos.ts` e da recuperação que atravessa contas tem o comentário de justificativa.
- [ ] Nenhum log de job traz texto de comentário, token ou segredo.

Entregue o relatório e espere minha confirmação. Não comece a próxima fase.

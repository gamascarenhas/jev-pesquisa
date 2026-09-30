# Fase 6: Controle de custo

**Entrega 1.** Depende de: fases 4 e 5.

## Leia antes

- `AGENTS.md`
- `docs/spec/referencia/tecnologias.md`
- `docs/spec/referencia/padroes-de-engenharia.md`, seções de arquitetura e segurança
- `docs/spec/referencia/estrutura-server.md`, módulo `usage` e pasta `jobs`
- `docs/spec/referencia/banco-de-dados.md`, tabelas `livro_razao_consumo`, `planos`, `contas` e `trabalhos`
- `docs/spec/referencia/configuracao.md`, variáveis `JEV_*` e `LLM_*`

## Nesta fase

- **Migrations desta fase:** crie em `server/migrations` o arquivo da seção "Migrations desta fase", com o SQL exato dela, e aplique-o.
- Módulo `usage`, somente a parte de custo: `controle-custo.servico.ts` com reservar, liquidar e liberar, `estimador-custo.ts`, `consumo.repositorio.ts` e `consumo.sistema.repositorio.ts`. Alertas, ciclos, a rota de consumo e a barra de consumo são da fase 9.
- **Função única de acesso a IA:** `executarComReserva`, que reserva o custo, chama o serviço externo (Jev ou LLM) recebido como função, e liquida ou libera conforme o resultado. Nenhum código chama o Jev ou o LLM sem passar por ela. As fases 7, 11 e 12 usam só essa função.
- **Fronteira do módulo:** de fora de `usage`, só se importa `controle-custo.servico.ts`. Ele exporta, além de `executarComReserva`, a função `estimarConsumoDoPlano`, que recebe a `contaId` e uma lista de requisições previstas e devolve a estimativa em **porcentagem do limite do plano** e se o trabalho cabe. As fases 8 e 12 usam essa função, nunca o `estimador-custo.ts` direto.
- Erro de domínio `ErroLimiteDeCustoAtingido`. O executor de jobs da fase 4 trata esse erro marcando o job como `paused_limit`, guardando exatamente onde parou.
- Funções em `consumo.sistema.repositorio.ts` que atravessam contas de propósito, cada uma com o comentário de justificativa: liberar reservas `reserved` com mais de 15 minutos e listar jobs `paused_limit` de todas as contas.
- Ganchos de recuperação da fase 4, registrados nesta fase: liberar reservas antigas e **reavaliar os jobs `paused_limit`**, devolvendo a `pending` os que agora cabem no limite. A fase 9 agenda a liberação de reservas periodicamente e reavalia os jobs a cada virada de ciclo.
- Não há rota nem tela nesta fase. Valide por testes de integração e unitários.

## Especificação

### Limite de custo de IA por plano

Não existe limite de quantidade de comentários. O limite é **o custo de IA consumido no ciclo**, somando Jev e LLM, definido em `planos.limite_custo_ia_usd`.

Cálculo do custo:

- custo real de uma requisição ao Jev = `usage.input_tokens` × `JEV_PRECO_POR_MTOK` ÷ 1.000.000; tokens de saída do Jev não são cobrados;
- custo real de uma chamada ao LLM = tokens de entrada × `LLM_PRECO_ENTRADA_POR_MTOK` ÷ 1.000.000 mais tokens de saída × `LLM_PRECO_SAIDA_POR_MTOK` ÷ 1.000.000; na estimativa, use o `max_tokens` configurado como saída;
- estimativa antes de enviar = número de caracteres do `state` somado ao texto das perguntas, dividido por 4, como aproximação de tokens, multiplicado pelo mesmo preço. Deixe o divisor numa constante configurável e registre a diferença entre estimado e real para calibrar depois;
- todos os valores em USD são inteiros em unidades de 1e-8 USD, nunca ponto flutuante.

Regras de controle, em transação no banco:

1. **Reserva antes de enviar**: antes de cada requisição ao Jev ou ao LLM, reserve o custo estimado no `livro_razao_consumo`. Se consumo liquidado mais reservas mais esta estimativa passar do limite, **não envie**.
2. **Liquidação depois**: com a resposta, grave o custo real e marque `settled`. Se a requisição falhar de forma **inequívoca** (401, 422, erro antes de o corpo sair), marque `released` e libere a reserva. Se o resultado for **ambíguo** (timeout ou queda de conexão depois do envio), o Jev pode ter cobrado: liquide pela estimativa, para o consumo nunca ficar subestimado. Se o SDK repetir a chamada por conta própria (até 2 vezes, fase 7), a liquidação soma o custo de todas as tentativas conhecidas, ou a estimativa multiplicada pelo número de tentativas feitas quando o uso não vier na resposta; a reserva cobre uma tentativa e a diferença é liquidada, nunca ignorada.
3. **Concorrência segura e sem gargalo**: use bloqueio de linha na conta, com `SELECT ... FOR UPDATE`, para que requisições paralelas nunca ultrapassem o limite juntas. Reserve **em lote**, de até `TAMANHO_LOTE_RESERVA` requisições por transação (constante nomeada no código, valor 50, sem variável de ambiente): uma transação, um bloqueio e várias linhas `reserved`. Liquidar e liberar atualizam só a própria linha, sem bloquear a conta. Se o lote inteiro não cabe no limite, reserve só as requisições que cabem, e o job pausa com as demais pendentes.
4. **Ao atingir o limite**: o job muda para `paused_limit`, guardando exatamente onde parou. Os itens restantes ficam pendentes, nada é perdido.
5. **Ao aumentar o limite do plano ou virar o ciclo**: jobs em `paused_limit` da conta retomam automaticamente de onde pararam. Sem cobrança real, o limite aumenta quando eu edito o seed e reinicio; por isso a inicialização também reavalia os jobs `paused_limit`, e a fase 9 faz o mesmo a cada virada de ciclo.
6. **Importar e sincronizar continuam liberados** com o limite atingido, porque não consomem IA. Classificação e geração de resumos param. Resumos já gerados continuam visíveis.
7. **Estimativa antes de começar**: as telas de iniciar classificação (fase 8) e de confirmar pergunta (fase 12) mostram quanto do plano o job deve consumir e avisam se não vai caber, usando `estimarConsumoDoPlano`, de `controle-custo.servico.ts`, que por dentro usa o `estimador-custo.ts` desta fase. Ofereça aumentar o plano ali mesmo somente quando `COBRANCA_ATIVADA=true`, o que não ocorre no MVP.

Interface para o cliente, entregue na fase 9:

- Consumo como **porcentagem do plano**, com barra de progresso no topo do sistema. Nunca mostrar valores em dólar, tokens ou nomes de modelos ao cliente.
- Avisos na interface e por e-mail em 80% e 100% do limite.
- Quando pausar: "Seu plano atingiu o limite de análises deste mês. A análise continua automaticamente na renovação em dd/mm."

## Migrations desta fase

Crie o arquivo abaixo em `server/migrations`, com este SQL exato.

```sql
-- 0009_livro_razao_consumo.sql
CREATE TABLE livro_razao_consumo (
  id                          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conta_id                    uuid REFERENCES contas(id) ON DELETE SET NULL,
  conta_ref                   uuid NOT NULL,
  ciclo_iniciado_em           timestamptz NOT NULL,
  provedor                    text NOT NULL CHECK (provedor IN ('jev', 'llm')),
  operacao                    text NOT NULL
                              CHECK (operacao IN ('classify', 'ask', 'interpret_question',
                                                  'summarize', 'verify_summary')),
  comentario_ref              uuid,
  pergunta_personalizada_ref  uuid,
  resumo_ref                  uuid,
  modelo                      text,
  tokens_entrada_estimados    integer NOT NULL CHECK (tokens_entrada_estimados >= 0),
  tokens_saida_estimados      integer NOT NULL DEFAULT 0 CHECK (tokens_saida_estimados >= 0),
  reservado_usd               numeric(14,8) NOT NULL CHECK (reservado_usd >= 0),
  tokens_entrada              integer CHECK (tokens_entrada >= 0),
  tokens_saida                integer CHECK (tokens_saida >= 0),
  real_usd                    numeric(14,8) CHECK (real_usd >= 0),
  status                      text NOT NULL DEFAULT 'reserved'
                              CHECK (status IN ('reserved', 'settled', 'released')),
  criado_em                   timestamptz NOT NULL DEFAULT now(),
  finalizado_em               timestamptz,
  CHECK (status <> 'settled' OR real_usd IS NOT NULL)
);
CREATE INDEX livro_razao_consumo_conta_ciclo_idx
  ON livro_razao_consumo (conta_ref, ciclo_iniciado_em, status);
CREATE INDEX livro_razao_consumo_reservas_antigas_idx
  ON livro_razao_consumo (criado_em) WHERE status = 'reserved';
```

## Testes desta fase

- O limite nunca é ultrapassado com 50 requisições concorrentes.
- Reservar em lote nunca ultrapassa o limite, mesmo com lotes concorrentes.
- A reserva é liberada quando a requisição falha de forma inequívoca, e liquidada pela estimativa quando o resultado é ambíguo (timeout).
- Nenhuma chamada a um serviço externo de IA acontece sem passar por `executarComReserva`, e sem reserva a chamada não sai.
- Os valores em USD usam inteiros em toda a cadeia, sem ponto flutuante.
- O job de teste pausa exatamente no limite, guarda onde parou e retoma do ponto certo quando a retomada é chamada.
- Aumentar o limite do plano e reiniciar devolve a `pending` os jobs `paused_limit` que agora cabem.
- Reservas `reserved` com mais de 15 minutos são liberadas pelo gancho da inicialização.
- Importar continua funcionando com o limite atingido.
- O estimador registra a diferença entre estimado e real.
- `estimarConsumoDoPlano` devolve a porcentagem do limite do plano e se o trabalho cabe, e nenhum outro módulo importa o `estimador-custo.ts`.
- Encerrar a conta mantém o `livro_razao_consumo` sem vínculo com a conta e sem nenhum texto, e o isolamento entre contas cobre a tabela nova.
- A migration desta fase aplicada duas vezes sem erro.

## Pronto quando

1. Com uma operação de teste que consome custo, ver o limite respeitado com 50 requisições concorrentes.
2. Com um plano de limite baixo, ver o job de teste pausar exatamente no limite, sem ultrapassá-lo, e retomar depois de o limite subir.
3. Parar o servidor com reservas em aberto, subir de novo e ver as reservas antigas liberadas.
4. A migration desta fase aplicada num PostgreSQL 16 real, duas vezes, sem erro.

## Fora desta fase

- Chamadas reais ao Jev e ao LLM: fases 7, 11 e 12.
- Ciclos, alertas de consumo, barra de consumo e cobrança: fase 9.
- Telas: fase 8 em diante.

## Antes de parar

Passe pela lista de `AGENTS.md`. Confira também:

- [ ] Nenhum valor em USD passa por ponto flutuante.
- [ ] Toda função de `consumo.sistema.repositorio.ts` tem o comentário de justificativa.

Entregue o relatório e espere minha confirmação. Não comece a próxima fase.

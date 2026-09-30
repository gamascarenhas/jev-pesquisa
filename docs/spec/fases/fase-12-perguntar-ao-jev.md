# Fase 12: Perguntar ao Jev

**Entrega 3.** Depende de: fases 8, 9 e 11.

## Leia antes

- `AGENTS.md`
- `docs/spec/referencia/configuracao.md`, variável `PERGUNTAR_MAX_COMENTARIOS`
- `docs/spec/referencia/fora-de-escopo.md`
- `docs/spec/referencia/estrutura-server.md`, módulos `ask`, `classification` e `integrations/jev` (interface `ClassificadorDeComentarios`), e `shared`
- `docs/spec/referencia/estrutura-web.md`, funcionalidade `ask`
- `docs/spec/referencia/auxiliar-de-design-mobbin.md`, para consultar referências de design antes de desenhar as telas
- `docs/spec/referencia/banco-de-dados.md`, tabelas `perguntas_personalizadas` e `respostas_perguntas_personalizadas`
- `docs/spec/referencia/padroes-de-engenharia.md`, seções de arquitetura e segurança
- `docs/spec/fases/fase-06-controle-de-custo.md`, controle de custo
- o `ProvedorLlm` criado na fase 11

## Nesta fase

- **Migrations desta fase:** crie em `server/migrations` o arquivo da seção "Migrations desta fase", com o SQL exato dela, e aplique-o.
- Módulo `ask` completo, nos arquivos previstos na árvore, e o handler `perguntar`. As rotas de interpretar e confirmar pergunta usam o guard `exigir-email-confirmado`, e confirmar a mesma pergunta duas vezes não cria dois jobs.
- Web: `features/ask` com o campo acima da tabela, a confirmação com a estimativa, o resultado em faixas e o histórico, além de `perguntar.api.ts`.
- Exportação em CSV do resultado de uma pergunta, com a probabilidade, passando pelo `shared/safe-csv.ts` da fase 8.

## Especificação

### Perguntar ao Jev

Um campo de texto no topo da tabela de comentários, com o rótulo "Pergunte sobre estes comentários". O usuário escreve uma pergunta livre em português e o sistema mostra quais comentários respondem sim.

**Como funciona por baixo**

O Jev não entende pergunta livre sobre um conjunto de comentários: ele avalia **um comentário por vez** contra perguntas tipadas. Então o sistema transforma a pergunta do usuário numa pergunta Noul aplicada a cada comentário, e o código agrega o resultado.

**Etapa 1: tradução da pergunta pelo LLM.** Uma única chamada ao `ProvedorLlm`, com saída validada por `zod`:

```json
{
  "respondivel": true,
  "instrucoes": "Pergunta em inglês, sobre um único comentário, com resposta sim ou não, referenciando `comment`",
  "criterios": { "true": "O que caracteriza sim", "false": "O que caracteriza não" },
  "interpretacao_pt": "Frase curta em português explicando como a pergunta foi entendida",
  "motivo_se_nao_respondivel_pt": null
}
```

Regras do prompt de sistema desta chamada:

- reescrever a intenção do usuário como pergunta sim ou não sobre **um** comentário, em inglês, com `true` significando a resposta que o usuário procura;
- perguntas de contagem, porcentagem ou ranking viram a pergunta por comentário correspondente, porque a contagem é feita depois pelo código;
- marcar `respondivel: false` quando a pergunta não puder ser respondida lendo comentários individuais, como pedidos de cálculo sobre números da planilha, previsões sem relação com o texto ou assuntos fora dos comentários, e explicar o motivo em `motivo_se_nao_respondivel_pt` com uma sugestão de como reformular;
- nunca inventar critérios que o usuário não pediu.

A pergunta do usuário passa antes pelo `anonimizador.ts` da fase 5, e só a versão mascarada vai ao LLM; o `texto_original` da pergunta fica no banco. Ela vai delimitada por tags no prompt e é tratada como dado. O limite de saída dessa chamada é a constante nomeada `MAX_TOKENS_INTERPRETACAO`, valor 500, sem variável de ambiente.

Antes de chamar o LLM, o código procura no projeto uma pergunta com o mesmo `hash_pergunta` (SHA-256 do texto do usuário normalizado, em minúsculas e sem espaços duplicados) já interpretada e não editada. Se existir, reabre a interpretação e as respostas dela, sem nova chamada. A interpretação é um custo próprio (`interpret_question`), cobrado mesmo quando a pergunta sai como não respondível.

**Etapa 2: confirmação pelo usuário.** Antes de gastar, mostre:

- a interpretação em português, com opção de editar o texto e reinterpretar;
- quantos comentários serão avaliados, que são os do filtro atual da tabela que têm texto (comentários `no_text` ficam de fora), ordenados do mais recente para o mais antigo e limitados por `PERGUNTAR_MAX_COMENTARIOS`, padrão 5.000; se o filtro tiver mais, a tela diz quantos ficaram de fora;
- quanto do plano isso deve consumir, em porcentagem, por `estimarConsumoDoPlano`, de `controle-custo.servico.ts` (fase 6).

O usuário confirma com um botão. Nada roda sem confirmação.

**Etapa 3: execução pelo Jev.** Uma chamada ao método genérico `avaliar` de `ClassificadorDeComentarios` por comentário, com uma única pergunta `noul` montada de `instrucoes_jev` e `criterios_jev`, e no modo simulado o resultado é determinístico (regra da fase 7). Um job em segundo plano com o mesmo mecanismo da classificação: fila com concorrência, reserva e liquidação de custo, pausa no limite, retomada após reinício. O `state` é o mesmo objeto usado na classificação, com `texto_mascarado`. Resultados aparecem na tela conforme chegam.

**Etapa 4: resultado na tela.**

- Contador no topo: quantos comentários provavelmente sim, sobre o total avaliado.
- Três faixas, com limiares em constantes nomeadas no código: provavelmente sim a partir de 0,7; incerto entre 0,3 e 0,7; provavelmente não abaixo de 0,3. Por padrão mostre só provavelmente sim, com abas para as outras faixas.
- Lista ordenada pela probabilidade, com o comentário, a indicação visual da faixa e as colunas habituais da tabela.
- Os filtros da tabela continuam funcionando sobre o resultado, e o contador se atualiza.
- Botão para exportar o resultado em CSV, incluindo a probabilidade.

**Cada pergunta é um job próprio**, com uma requisição ao Jev por comentário avaliado, contendo só a pergunta do usuário. Perguntas salvas como colunas, com classificação automática de comentários novos, ficam fora do MVP.

**Reaproveitamento.** Se a mesma pergunta normalizada já foi respondida para um comentário, use a resposta gravada sem chamar o Jev de novo.

**Histórico.** Uma lista das últimas perguntas do projeto, para reabrir o resultado sem custo.

**Limites de interpretação que a interface deve deixar claros**, em texto curto abaixo do campo: as respostas vêm do que os clientes escreveram; o sistema indica probabilidade, não certeza; perguntas sobre cálculos devem usar os filtros e gráficos do painel.

## Migrations desta fase

Crie o arquivo abaixo em `server/migrations`, com este SQL exato.

```sql
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
```

## Testes desta fase

- Interpretar e confirmar pergunta recusam usuário sem e-mail confirmado.
- Confirmar a mesma pergunta duas vezes não cria dois jobs.
- Testes de componentes: o resultado em faixas, a tela de confirmação com a estimativa e o histórico.
- O isolamento entre contas e a exclusão de projeto e de conta cobrem as tabelas de perguntas.
- Pergunta marcada como não respondível não dispara nenhuma chamada ao Jev; só a interpretação é cobrada.
- A pergunta do usuário passa pelo anonimizador antes de ir ao LLM.
- Repetir a mesma pergunta (mesmo `hash_pergunta`) não chama o LLM nem o Jev.
- Nada roda sem a confirmação do usuário.
- Respostas já gravadas são reaproveitadas.
- O limite do plano pausa e retoma o job de pergunta.
- A pergunta do usuário vai delimitada no prompt de interpretação e é tratada como dado.

## Pronto quando

1. Fazer uma pergunta livre no campo da tabela, ver a interpretação, confirmar, ver o resultado em faixas.
2. Repetir a mesma pergunta e ver que o resultado vem do histórico sem novo custo.
3. A migration desta fase aplicada num PostgreSQL 16 real, duas vezes, sem erro.

## Fora desta fase

- Os usos futuros do LLM listados em `fora-de-escopo.md`.

## Antes de parar

Passe pela lista de `AGENTS.md`. Confira também:

- [ ] Nenhuma pergunta livre é executada sem a confirmação do usuário com a estimativa de consumo.
- [ ] A classificação padrão continua gerando uma única requisição por comentário, sem nenhuma pergunta extra.

Entregue o relatório e espere minha confirmação. Não comece a próxima fase.

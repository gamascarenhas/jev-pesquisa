# Fase 7: Classificação com o Jev

**Entrega 1.** Depende de: fases 5 e 6.

## Leia antes

- `AGENTS.md`
- `docs/spec/referencia/tecnologias.md`
- `docs/spec/referencia/padroes-de-engenharia.md`, seções de arquitetura e segurança
- `docs/spec/referencia/estrutura-server.md`, módulos `classification` e `integrations/jev`, e `shared/thresholds.ts`
- `docs/spec/referencia/banco-de-dados.md`, tabelas `classificacoes`, `revisoes_classificacao` e `comentarios`
- `docs/spec/referencia/configuracao.md`, variáveis `JEV_*`
- `docs/spec/fases/fase-06-controle-de-custo.md`, seção "Limite de custo de IA por plano"

## Nesta fase

- **Migrations desta fase:** crie em `server/migrations` o arquivo da seção "Migrations desta fase", com o SQL exato dela, e aplique-o.
- `integrations/jev`: interface `ClassificadorDeComentarios`, com **um método genérico** `avaliar(state, perguntas)` que serve a classificação padrão (esta fase), a verificação de achados (fase 11) e as perguntas livres (fase 12), e um método `classificarComentario` de conveniência montado sobre ele com `perguntasDoComentario`. Implementação real com `@typesafe-ai/sdk` e implementação simulada determinística. Toda chamada ao Jev tem timeout e passa por `executarComReserva`, da fase 6.
- Módulo `classification`: `questions.ts`, `classificacao.servico.ts`, `pos-processamento.ts` e os repositórios. As rotas ficam em `classificacao.rotas.ts` e `classificacao.esquemas.ts`, com estimar, iniciar, consultar progresso e reprocessar falhas. Todas as rotas que iniciam consumo de IA usam o guard `exigir-email-confirmado`, e iniciar a classificação e reprocessar falhas não criam um segundo job se já houver um ativo no projeto (o banco garante, e a rota devolve o job existente).
- Handler `classificar`, registrado no executor da fase 4, retomando pelos comentários com `status_classificacao = 'pending'`.
- Estenda o `dev:semear-demo` para classificar os comentários de demonstração com o classificador simulado.
- Não há tela nesta fase. A tela de iniciar a classificação é da fase 8. Valide por testes de integração e por requisições HTTP descritas no relatório.

## Especificação

### Classificação com o Jev

Contrato da API, para referência:

- `POST https://api.typesafe.ai/v1/systemone` com `Authorization: Bearer $CHAVE_API_TYPESAFE`.
- Corpo: `state`, `model` e `questions`, um mapa de id para pergunta.
- Tipos: `choice` com `criteria` como mapa de opção para descrição, até 255 opções, e resposta com `choice`, `probabilities` e `confidence`; `score` com `criteria` como lista ordenada de 2 a 10 níveis, e resposta com `score`, `legend`, `probabilities` e `confidence`; `noul` para sim ou não, com resposta `noul` entre 0 e 1 e sem `confidence`.
- O **id da pergunta não é enviado ao modelo**; a pergunta completa precisa estar em `instructions`.
- Todas as perguntas de uma requisição são avaliadas em paralelo e isoladas, contra o mesmo `state`. Adicionar perguntas quase não aumenta custo nem latência.
- Erros: 401 chave inválida; 422 corpo inválido, não repetir; 429 limite de taxa e 529 sobrecarga, repetir com backoff exponencial.
- O SDK já faz até 2 novas tentativas com backoff; mantenha esse comportamento.
- Limite atual de 1.200 requisições por minuto: use uma fila com concorrência configurável, padrão 10, por `JEV_CONCORRENCIA`.

Regras de desenho obrigatórias:

1. **Uma requisição por comentário, com todas as perguntas padrão juntas.** Nunca uma requisição por pergunta padrão.
2. O `state` é um objeto com nomes descritivos: `{ "comment": texto_mascarado, "rating": nota ou null, "location": unidade ou null }`.
3. **Instruções, nomes de opções e descrições em inglês**, mesmo com o comentário em português, porque o Jev é mais preciso em inglês. Os rótulos em português para a interface ficam no `i18n/pt-BR.ts` do web, indexados pelos ids em inglês; a API devolve só os ids.
4. Referenciar partes do state entre crases nas instruções, como `` `comment` ``.
5. Fixar a versão do modelo por `JEV_MODELO`, padrão `jev-1.13.0`, e gravar o campo `model` devolvido em cada classificação.

Perguntas do MVP, a implementar exatamente assim e manter num único arquivo `server/src/modules/classification/questions.ts`:

```ts
import { choice, noul, score } from "@typesafe-ai/sdk";

export const perguntasDoComentario = {
  topic: choice("What is the main subject of `comment`?", {
    service: "How staff treated the customer: politeness, attention, helpfulness",
    wait_time: "Queues, delays, slow service, waiting to be attended",
    product_quality: "Quality, defects or condition of the product or service delivered",
    price: "Price, value for money, fees, discounts",
    billing_payment: "Charges, invoices, refunds, payment methods, wrong charges",
    delivery: "Shipping, delivery time, order tracking, missing items",
    environment: "Cleanliness, comfort, noise, parking, physical location",
    digital_channels: "Website, app, online ordering, digital account problems",
    communication: "Lack of information, unclear communication, no response from the company",
    other: "None of the subjects above",
  }),
  sentiment: choice("What is the overall sentiment of `comment` toward the company?", {
    positive: "Satisfied, praising, recommending",
    neutral: "Factual or indifferent, no clear feeling",
    negative: "Dissatisfied, complaining, criticizing",
    mixed: "Clear praise and clear complaint in the same comment",
  }),
  severity: score("How serious is the problem described in `comment`?", [
    "No problem reported, or only praise",
    "Minor annoyance that does not affect the outcome",
    "Real problem that hurt the customer experience but was resolved or has a workaround",
    "Serious problem: financial loss, safety risk, legal threat, or intention to leave the company",
  ]),
  needs_action: noul(
    "Does `comment` describe a specific problem that the company should act on?",
    {
      true: "Reports a concrete failure, request, or unresolved issue",
      false: "Only praise, a general opinion, or nothing actionable",
    },
  ),
};
```

Regras de pós-processamento no código:

- `precisa_revisao = true` quando `topic.confidence < 0.5` ou `sentiment.confidence < 0.5`. Deixe esses limiares em constantes nomeadas no código, sem variável de ambiente.
- **"Precisa de ação" como sim ou não:** `precisa_acao` é uma probabilidade, e todo filtro, contador e porcentagem do sistema (painel da fase 8 e resumos da fase 11) trata o comentário como "precisa de ação" quando `precisa_acao >= LIMIAR_PRECISA_ACAO`, constante nomeada em `shared/thresholds.ts` com valor 0,5. Ninguém compara a probabilidade com outro número.
- Normalizar `severity.score` dividindo pelo índice do nível mais alto, hoje 3, para exibir de 0 a 1.
- Se o comentário tiver mais de 4.000 caracteres, truncar e registrar.
- Falha em um comentário não pode parar o job: registrar o erro no comentário e seguir. Cada comentário é tentado até `MAX_TENTATIVAS_CLASSIFICACAO` vezes, constante nomeada no código, valor 3, contadas em `tentativas_classificacao`; esgotadas, o comentário fica `failed`. Uma rota de **reprocessar falhas** volta os comentários `failed` do projeto para `pending` com as tentativas zeradas e inicia a classificação, sem apagar o erro anterior até haver novo resultado.
- Toda requisição ao Jev passa obrigatoriamente pelo controle de custo da fase 6.

A implementação simulada de `ClassificadorDeComentarios` devolve respostas determinísticas, para permitir testar a interface sem chave da API. Ative com `JEV_SIMULADO=true`. Regras do simulado:

- perguntas padrão (`topic`, `sentiment`, `severity`, `needs_action`): por palavras-chave do `comment`, com probabilidades e confiança fixas por regra;
- qualquer outra pergunta `noul`: a probabilidade é a fração das palavras significativas (sem palavras curtas e sem termos muito comuns) do **texto de referência** que aparecem no texto avaliado, limitada a 0 e 1. Para a `supported` da fase 11, o texto de referência é `state.claim` e o texto avaliado é a concatenação de `state.evidence[].text`. Para as perguntas livres da fase 12, o texto de referência é `instructions` e o texto avaliado é `state.comment`; por isso o mock do `ProvedorLlm` da fase 12 inclui em `instrucoes` as palavras significativas da pergunta original do usuário, em português, entre aspas;
- a mesma entrada sempre gera a mesma saída, sem aleatoriedade.

## Migrations desta fase

Crie o arquivo abaixo em `server/migrations`, com este SQL exato.

```sql
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
```

## Testes desta fase

- Pós-processamento: `precisa_revisao`, normalização da gravidade e truncamento em 4.000 caracteres.
- `LIMIAR_PRECISA_ACAO` decide a fronteira em 0,5: 0,49 não precisa de ação e 0,5 precisa.
- O método genérico `avaliar` do simulado responde de forma determinística a uma pergunta `noul` desconhecida.
- Cada comentário gera uma única requisição ao Jev com todas as perguntas padrão.
- Toda chamada ao Jev tem timeout, passa por `executarComReserva`, e o SDK não repete uma chamada além das duas tentativas previstas.
- Nenhuma chamada ao Jev acontece sem reserva de custo.
- O job pausa exatamente no limite, guarda onde parou e retoma do ponto certo.
- Uma falha em um comentário não para o job; após `MAX_TENTATIVAS_CLASSIFICACAO` ele fica `failed`, e reprocessar falhas o devolve a `pending`.
- Usuário sem e-mail confirmado recebe 403 ao estimar, iniciar ou reprocessar.
- Iniciar a classificação duas vezes seguidas não cria dois jobs.
- Uma classificação interrompida no meio continua sozinha depois da recuperação de jobs.
- Apagar projeto e conta removem `classificacoes` e `revisoes_classificacao`, e o isolamento entre contas cobre as tabelas novas.
- A migration desta fase aplicada duas vezes sem erro.

## Pronto quando

1. Com `JEV_SIMULADO=true`, classificar todos os comentários de um projeto e ver as classificações gravadas.
2. Com um plano de limite baixo, ver a classificação pausar exatamente no limite, sem ultrapassá-lo.
3. Parar o servidor no meio de uma classificação, subir de novo e ver a classificação continuar sozinha.
4. Quando eu colocar a chave real no arquivo de desenvolvimento, o mesmo fluxo funciona com o Jev de verdade sem mudar código. Você não precisa da chave para concluir a fase.
5. A migration desta fase aplicada num PostgreSQL 16 real, duas vezes, sem erro.

## Fora desta fase

- Ciclos, alertas de consumo, barra de consumo e cobrança: fase 9.
- Telas: fase 8.
- Perguntas livres: fase 12.

## Antes de parar

Passe pela lista de `AGENTS.md`. Confira também:

- [ ] Cada comentário gera uma única requisição com todas as perguntas padrão.
- [ ] Nenhuma pergunta ao Jev pede cálculo, contagem ou comparação de datas.
- [ ] Toda rota que inicia consumo de IA usa o guard `exigir-email-confirmado`.

Entregue o relatório e espere minha confirmação. Não comece a próxima fase.

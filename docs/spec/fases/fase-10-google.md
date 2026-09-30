# Fase 10: Google Perfil da Empresa

**Entrega 3.** Depende de: fases 5, 8 e 9.

## Leia antes

- `AGENTS.md`
- `docs/spec/referencia/tecnologias.md`
- `docs/spec/referencia/padroes-de-engenharia.md`, seções de arquitetura e segurança
- `docs/spec/referencia/estrutura-server.md`, módulos `google-business` e `integrations/google`, e `shared/crypto.ts`
- `docs/spec/referencia/estrutura-web.md`, funcionalidade `google`
- `docs/spec/referencia/auxiliar-de-design-mobbin.md`, para consultar referências de design antes de desenhar as telas
- `docs/spec/referencia/banco-de-dados.md`, tabelas `conexoes_google`, `fontes` e `comentarios`, e as regras de preenchimento
- `docs/spec/referencia/configuracao.md`, variáveis `GOOGLE_*`

## Nesta fase

- **Migrations desta fase:** crie em `server/migrations` o arquivo da seção "Migrations desta fase", com o SQL exato dela, e aplique-o. As colunas de Google de `fontes` já existem desde a fase 5; esta fase cria `conexoes_google` e a chave estrangeira.
- `integrations/google`: interface `FonteDeAvaliacoes`, implementação simulada com fixtures em JSON, **feita primeiro**, e depois a implementação real.
- Módulo `google-business`, com `conexoes-google.sistema.repositorio.ts` para o agendador listar as conexões ativas de todas as contas, com o comentário de justificativa: só o `owner` conecta e desconecta; OAuth completo, listagem de contas e unidades, sincronização completa e incremental, renovação automática do token, conversão de `starRating` e criptografia dos tokens com AES-256-GCM.
- Handler `google-sincronizacao`, registrado no executor da fase 4, e agendamento da sincronização a cada `GOOGLE_INTERVALO_SINCRONIZACAO_HORAS` no agendador da fase 9. `shared/crypto.ts` nasce nesta fase.
- Desconectar o Google: revogar o token junto ao Google, gravar `revogado_em` e anular as colunas de token (a linha da conexão permanece como histórico, sem segredo), e parar a sincronização. Acrescente a revogação ao serviço de exclusão de dados, inclusive no encerramento de conta.
- Web: `features/google` com a conexão e a escolha de unidades, `google.api.ts` e o passo de conectar o Google no onboarding.
- Antes de escrever a parte real, confirme na documentação oficial em https://developers.google.com/my-business os nomes de campos e o formato dos identificadores. Diga explicitamente o que não conseguir confirmar.

## Especificação

### Fonte 2: Perfil da Empresa no Google

Contexto verificado na documentação oficial em setembro de 2026:

- Avaliações: `GET https://mybusiness.googleapis.com/v4/{parent=accounts/*/locations/*}/reviews`
  - `pageSize` máximo 50; paginação por `pageToken` e `nextPageToken`.
  - `orderBy` aceita `rating`, `rating desc` e `updateTime desc`; o padrão é `updateTime desc`.
  - A resposta traz `reviews`, `averageRating`, `totalReviewCount` e `nextPageToken`.
  - Só funciona para unidades verificadas.
- Escopo OAuth exigido: `https://www.googleapis.com/auth/business.manage`.
- Contas: API My Business Account Management v1, método `accounts.list`.
- Unidades: API My Business Business Information v1, método `accounts.locations.list`, que exige o parâmetro `readMask`, por exemplo `name,title,storefrontAddress`.
- Cada avaliação tem, entre outros campos, `name`, `reviewId`, `reviewer` com `displayName` e `isAnonymous`, `starRating` como enum `ONE` a `FIVE`, `comment`, `createTime`, `updateTime` e `reviewReply`.
- **Projetos novos no Google Cloud começam com cota zero.** O acesso precisa ser solicitado ao Google e aprovado manualmente.
- O escopo `business.manage` é sensível: o aplicativo OAuth também precisa passar pela **verificação do Google** (tela de consentimento, política de privacidade publicada e domínio verificado) antes de atender usuários fora da lista de testes. Confirme os requisitos atuais na documentação oficial e diga no relatório o que ainda depende de mim, uma vez só, sem virar tarefa recorrente. Já se sabe que a verificação pede uma página inicial e uma política de privacidade públicas: a página inicial é a landing da fase 13 (`URL_SITE`) e a política é a tela pública de `features/legal` da fase 3, em `URL_APP`, sem exigir login, ambas no mesmo domínio registrável. Portanto o pedido de verificação só pode ser feito depois da fase 13, e o relatório deve dizer isso e listar o que precisa estar publicado. Confirme na documentação oficial do Google se um domínio de página inicial diferente do subdomínio do app é aceito.

Antes de escrever o código desta parte, **confira os detalhes acima na documentação oficial** em https://developers.google.com/my-business, porque nomes de campos e formatos de identificador podem ter mudado. Em especial, confirme como converter o identificador de unidade devolvido pela API Business Information para o formato `accounts/{accountId}/locations/{locationId}` usado pela API v4 de avaliações.

Requisitos:

1. Fluxo OAuth 2.0 completo pelo servidor com `access_type=offline` para obter refresh token; renovar o token automaticamente quando expirar. O início do fluxo gera um parâmetro `state` aleatório, de uso único e com validade curta, guardado na sessão do usuário; o callback recusa qualquer `state` ausente, diferente ou já usado, e associa a conexão ao projeto e à conta da sessão, nunca a valores vindos da URL.
2. Depois de conectar, listar as contas e as unidades e deixar o usuário escolher quais unidades importar.
3. Importar todas as avaliações das unidades escolhidas, página por página.
4. **Sincronização incremental**: nas próximas sincronizações, buscar ordenado por `updateTime desc` e parar quando encontrar avaliação com `updateTime` anterior à última sincronização bem-sucedida.
5. Converter `starRating` para número de 1 a 5. Usar `reviewId` como `id_externo` para deduplicar.
6. Avaliações sem texto em `comment`, só com estrelas, devem ser gravadas e contadas nas estatísticas de nota, mas **não** enviadas ao Jev.
7. Se o comentário vier com trecho traduzido automaticamente pelo Google junto do original, guardar o texto como veio e registrar isso; não tente separar no MVP.
8. Tratar erros 401, 403 e 429 com mensagens claras. Em 403 por falta de cota, explicar ao usuário que o acesso à API ainda não foi aprovado pelo Google.
9. **Modo simulado obrigatório**: com `GOOGLE_EMPRESA_SIMULADO=true`, a implementação `FonteDeAvaliacoes` simulada devolve contas, unidades e cerca de 200 avaliações fictícias em português, geradas por `scripts/gerar-fixtures.ts` com semente fixa (não escritas à mão), cobrindo notas de 1 a 5, comentários vazios, comentários longos e paginação. Toda chamada real ao Google tem timeout. Isso permite desenvolver e demonstrar sem aprovação do Google.

## Migrations desta fase

Crie o arquivo abaixo em `server/migrations`, com este SQL exato.

```sql
-- 0013_conexoes_google.sql
CREATE TABLE conexoes_google (
  id                               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id                         uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  projeto_id                       uuid NOT NULL,
  email_conta_google               text NOT NULL,
  token_atualizacao_criptografado  text,
  token_acesso_criptografado       text,
  token_acesso_expira_em           timestamptz,
  escopos                          text[] NOT NULL,
  conectado_por                    uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  revogado_em                      timestamptz,
  criado_em                        timestamptz NOT NULL DEFAULT now(),
  atualizado_em                    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, conta_id),
  FOREIGN KEY (projeto_id, conta_id) REFERENCES projetos(id, conta_id) ON DELETE CASCADE,
  CHECK (revogado_em IS NOT NULL OR token_atualizacao_criptografado IS NOT NULL)
);
CREATE UNIQUE INDEX conexoes_google_ativa_unica
  ON conexoes_google (projeto_id) WHERE revogado_em IS NULL;
CREATE INDEX conexoes_google_conta_id_idx ON conexoes_google (conta_id);

ALTER TABLE fontes
  ADD CONSTRAINT fontes_conexao_google_fk
  FOREIGN KEY (conexao_google_id, conta_id) REFERENCES conexoes_google(id, conta_id)
  ON DELETE SET NULL (conexao_google_id);
```

## Testes desta fase

- Conversão de `starRating` de `ONE` a `FIVE` para 1 a 5.
- Paginação das avaliações.
- Sincronização incremental no modo simulado, parando na primeira avaliação anterior à última sincronização.
- Avaliação editada volta a `pending`, com a classificação e as respostas de perguntas apagadas.
- Avaliação só com estrelas é gravada como `no_text` e não é enviada ao Jev.
- Tokens gravados criptografados e nunca aparecem em log.
- Erro 403 por falta de cota gera a mensagem que explica que o acesso à API ainda não foi aprovado.
- Desconectar revoga e apaga os tokens.
- Callback com `state` ausente, errado ou reutilizado é recusado; `member` recebe 403 ao conectar ou desconectar.
- Testes de componentes da conexão e da escolha de unidades.
- O isolamento entre contas e a exclusão de projeto e de conta cobrem `conexoes_google` e as fontes do Google.

## Pronto quando

1. Conectar a conta simulada do Google, escolher duas unidades e importar as avaliações.
2. Sincronizar de novo e ver que nada duplica.
3. Desconectar e ver os tokens apagados.
4. A migration desta fase aplicada num PostgreSQL 16 real, duas vezes, sem erro.
5. Preenchendo `.env.production` com as chaves reais do Jev e do Google, a integração funciona sem mudar código. Depende de uma ação minha única, e não recorrente: a aprovação de cota e a verificação OAuth do Google, que só podem ser pedidas depois da fase 13. O relatório lista o que precisa estar publicado. O LLM real só entra na fase 11.

## Fora desta fase

- Responder avaliações do Google.

## Antes de parar

Passe pela lista de `AGENTS.md`. Confira também:

- [ ] Nenhum token ou segredo em log.
- [ ] Reimportar ou sincronizar de novo não duplica comentários.

Entregue o relatório e espere minha confirmação. Não comece a próxima fase.

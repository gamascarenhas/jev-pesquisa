# Fase 1: Infraestrutura

**Entrega 1.** Depende de: nenhuma.

## Leia antes

- `AGENTS.md`
- `docs/spec/referencia/tecnologias.md`
- `docs/spec/referencia/padroes-de-engenharia.md`
- `docs/spec/referencia/estrutura-server.md`, apenas a raiz e as pastas `config`, `db`, `http` e `shared`
- `docs/spec/referencia/banco-de-dados.md`
- `docs/spec/referencia/configuracao.md`

## Nesta fase

- Raiz do repositório: `package.json` com o workspace `server` e os scripts `dev`, `test`, `typecheck`, `lint`, `build`, `start`, `verificar` e `auditoria`, definindo `AMBIENTE_APP` e `NODE_ENV` de forma que funcione no Windows; `docker-compose.dev.yml`; `.gitignore`; `.editorconfig`; `.nvmrc`; `.prettierrc.json`; `eslint.config.js` com as regras de `padroes-de-engenharia.md`; `package-lock.json` versionado; `README.md` explicando como rodar em desenvolvimento e como preparar produção, com a nota de que em produção a aplicação usa um usuário de banco sem privilégio de superusuário e de que o backup do PostgreSQL é responsabilidade do operador. A fase 3 adiciona o workspace `web` e o script `stylelint`. Se a pasta ainda não for um repositório Git, inicialize-o, sem fazer nenhum commit.
- **Banco local:** o PostgreSQL não está rodando no início. Crie o `docker-compose.dev.yml`, suba o banco e só então aplique as migrations. Se o Docker Desktop estiver desligado e você não conseguir subi-lo, diga isso no relatório e não declare as migrations validadas. O `docker-compose.dev.yml` cria também o segundo banco, o de testes, por um script de inicialização montado no contêiner, sem passo manual.
- `.env.development.example` e `.env.production.example`, completos, com comentários curtos em português (uma linha por variável), conforme o arquivo de configuração. Até a fase 3 sugerir um nome, `NOME_NEGOCIO` no exemplo de desenvolvimento vale `Nome Provisório`, para o arquivo funcionar copiado sem alteração. Inclua `CONFIAR_PROXY` (padrão `false`; `true` no exemplo de produção), que liga `trustProxy` do Fastify, necessário para o limite de requisições por IP atrás de proxy reverso.
- `server/src/config`, `db`, `http`, `shared`, `main.ts` e `app.ts`. A inicialização carrega o ambiente, valida as travas, aplica as migrations de `server/migrations`, roda o seed e sobe o servidor. O executor de migrations aplica cada arquivo numa transação, sob `pg_advisory_lock`, registra o nome e o `checksum` SHA-256 em `migracoes_aplicadas` e recusa iniciar se o checksum de uma migration já aplicada mudou.
- `shared/ids.ts` com os tipos de marca (`ContaId`, `UsuarioId`, `ProjetoId`…), `shared/errors.ts` com `ErroDeDominio` e o formato de erro da API, `shared/logger.ts` com o `pino` e a redação de campos sensíveis, `shared/clock.ts` com o `Relogio` injetável, `shared/pagination.ts`, e `app.ts` como raiz de composição, conforme `padroes-de-engenharia.md`.
- **Migrations desta fase:** crie em `server/migrations` os dois arquivos da seção "Migrations desta fase", com o SQL exato dela.
- Seed de planos idempotente com `ON CONFLICT (id) DO UPDATE` para nome, preço e limite, com três planos iniciais: `trial`, `basic` e `pro`. Proponha os valores no relatório. Eu ajusto editando o seed e reiniciando. O plano `trial` não expira no MVP: o limite de custo é o único freio dele.
- Plugins de `http/plugins`: `cabecalhos-seguranca.plugin.ts` (`@fastify/helmet`), `limite-requisicoes.plugin.ts` (`@fastify/rate-limit` registrado, com o limite global; os limites por rota entram com as rotas), `protecao-csrf.plugin.ts` e `manipulador-erros.plugin.ts`.
- Rotas públicas `GET /api/configuracao-publica`, que devolve só `{ nomeNegocio }`, e `GET /api/saude`, registradas por `registrar-rotas.ts`.
- Banco de testes separado, `test/setup.ts`, `build-app.ts` e a base de `factories.ts`.

## Especificação

### Segurança e operação da infraestrutura

- **CSRF:** o plugin `protecao-csrf.plugin.ts` exige, em `POST`, `PUT`, `PATCH` e `DELETE`, o cabeçalho `Origin` (ou `Referer`, se não houver) igual à origem de `URL_APP`. Sem isso, responde 403, sem exceção. Em desenvolvimento, `URL_APP` é a origem do Vite.
- **Cabeçalhos:** `@fastify/helmet` com a CSP do projeto, HSTS em produção e os demais cabeçalhos de `padroes-de-engenharia.md`. A CSP libera `font-src` para `ORIGENS_FONTE_EXTERNA` e `style-src` para `ORIGENS_ESTILO_EXTERNO`.
- **Erros:** o manipulador central converte `ErroDeDominio` no formato de erro da API, com `idRequisicao`, e em produção responde mensagem genérica nos erros 5xx, sem vazar detalhe técnico.
- **Entrada e saída:** esquemas `zod` com `.strict()`, limite de tamanho de corpo por rota e parâmetros de rota validados como UUID. As rotas que criam dados aplicam isso a partir da fase 2.
- **Saúde:** `GET /api/saude` responde 200 com `{ "status": "ok" }` depois de um `SELECT 1` no banco, e 503 se o banco falhar. Não expõe versão nem detalhes.
- **Encerramento gracioso:** ao receber `SIGTERM` ou `SIGINT`, o servidor para de aceitar requisições, espera as em andamento por até 30 segundos e fecha o pool do banco. A fila de jobs faz a parte dela na fase 4.
- **Logs:** `pino` com `redact` para `authorization`, `cookie`, `senha`, `token`, `texto_original`, `texto_mascarado` e segredos, e `idRequisicao` em toda linha de requisição.

## Migrations desta fase

Crie os arquivos abaixo em `server/migrations`, com este SQL exato.

```sql
-- 0001_extensoes.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE migracoes_aplicadas (
  versao      text PRIMARY KEY,
  checksum    text NOT NULL,
  aplicada_em timestamptz NOT NULL DEFAULT now()
);

-- 0002_planos.sql
CREATE TABLE planos (
  id                    text PRIMARY KEY,
  nome                  text NOT NULL,
  preco_mensal_centavos integer NOT NULL CHECK (preco_mensal_centavos >= 0),
  limite_custo_ia_usd   numeric(12,6) NOT NULL CHECK (limite_custo_ia_usd > 0),
  ativo                 boolean NOT NULL DEFAULT true,
  ordem                 integer NOT NULL DEFAULT 0,
  criado_em             timestamptz NOT NULL DEFAULT now()
);
```

## Testes desta fase

- Configuração: variável obrigatória ausente, inclusive `NOME_NEGOCIO` e `VERSAO_TERMOS`, impede a inicialização com mensagem que lista cada problema. Em produção, modo simulado ligado, `PROVEDOR_EMAIL=log`, URL sem https, segredo igual ao inseguro do exemplo ou `URL_BANCO_TESTES` presente impedem a inicialização.
- Os testes usam sempre `URL_BANCO_TESTES` e nunca tocam o banco de desenvolvimento.
- Migrations: aplicar duas vezes não causa erro nem duplicação; alterar um arquivo já aplicado faz o sistema recusar iniciar; duas instâncias migrando ao mesmo tempo não aplicam nada em duplicidade.
- Seed: rodar duas vezes mantém três planos e atualiza nome, preço e limite se mudarem.
- CSRF: uma rota `POST` de teste sem `Origin` válido recebe 403, e com `Origin` de `URL_APP` passa.
- Cabeçalhos: os cabeçalhos do helmet estão presentes e a CSP bloqueia fonte de domínio fora de `ORIGENS_FONTE_EXTERNA`.
- Erros: um erro de domínio sai no formato `{ erro: { codigo, mensagem, idRequisicao } }`, e um erro inesperado em produção sai genérico, sem stack.
- Logs: campos sensíveis saem redigidos.
- Saúde: `GET /api/saude` responde 200 com o banco no ar e 503 sem ele, sem expor detalhes. `GET /api/configuracao-publica` devolve só `{ nomeNegocio }`.
- Encerramento: a função de desligamento fecha o servidor sem derrubar requisições em andamento. O teste chama essa função diretamente, porque no Windows `SIGTERM` não dispara handler; o registro dos handlers de `SIGTERM` e `SIGINT` é testado à parte.

## Pronto quando

1. Clonar o projeto, copiar `.env.development.example` sem alterar nada, subir o banco local com o Docker e rodar, sem nenhum passo manual de banco.
2. Remover uma variável obrigatória e ver o sistema recusar a inicialização com mensagem clara.
3. Iniciar em produção com um modo simulado ligado e ver o sistema recusar a inicialização.
4. Rodar os testes e confirmar que os dados do banco de desenvolvimento continuam intactos.
5. As migrations aplicadas num PostgreSQL 16 real, duas vezes, sem erro.
6. `GET /api/saude` respondendo 200 com o servidor no ar.

## Fora desta fase

- Contas, login, sessão, e-mail e projetos: fase 2.
- Telas de qualquer tipo: fase 3.
- Fila de jobs e agendador.
- Upload, classificação, cobrança e Google.

## Antes de parar

Passe pela lista de `AGENTS.md`. Confira também:

- [ ] As migrations desta fase existem em `server/migrations` com o SQL da spec e foram aplicadas duas vezes, ou o relatório diz por que não foi possível.
- [ ] Nenhuma variável de ambiente é lida fora de `config.ts`, e os dois arquivos `.env.*.example` estão completos.

Entregue o relatório e espere minha confirmação. Não comece a próxima fase.

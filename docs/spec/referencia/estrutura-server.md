# Arquitetura de pastas: raiz e servidor

Leia apenas as pastas dos módulos que a fase atual toca. A árvore de `web/` está em `estrutura-web.md` e a de `site/` (fase 13), em `estrutura-site.md`.

Siga **exatamente** esta estrutura. Não crie pastas fora dela sem me perguntar. Arquivos novos entram na pasta do módulo a que pertencem, seguindo o mesmo padrão de nomes. O número entre parênteses nos comentários diz em que fase o arquivo nasce.

**Raiz do repositório**

```text
/
├── package.json                    workspaces server e web (e site, na fase 13); scripts dev, test, typecheck, lint, stylelint, build, start, verificar, auditoria
├── docker-compose.dev.yml          PostgreSQL local, somente desenvolvimento
├── .env.development.example
├── .env.production.example
├── .gitignore
├── .editorconfig
├── .nvmrc
├── .prettierrc.json
├── eslint.config.js                regras de padroes-de-engenharia.md, compartilhadas por server, web e site
└── README.md
```

**API em `server/`**

Organização por módulo de negócio. Dentro de cada módulo, a responsabilidade de cada arquivo é fixa pelo sufixo:

- `*.rotas.ts`: rotas Fastify; só valida entrada, chama o serviço e formata a resposta;
- `*.esquemas.ts`: esquemas `zod` de entrada e saída das rotas;
- `*.servico.ts`: regras de negócio; nunca acessa `request` ou `reply`;
- `*.repositorio.ts`: única camada que executa SQL; toda função recebe `contaId` como primeiro parâmetro;
- `*.sistema.repositorio.ts`: única exceção à regra anterior, para funções que atravessam contas de propósito, cada uma com comentário justificando;
- `*.tipos.ts`: tipos do domínio do módulo.

Os padrões de nomes, tamanho de arquivo, imports e erros estão em `docs/spec/referencia/padroes-de-engenharia.md`.

```text
server/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── migrations/                             SQL puro, aplicado em ordem pelo nome
│   │                                       começa vazia; cada fase cria as suas, conforme banco-de-dados.md
│   ├── 0001_extensoes.sql                  (1)
│   ├── 0002_planos.sql                     (1)
│   ├── 0003_contas_usuarios.sql            (2)
│   ├── 0004_tokens_autenticacao_sessoes.sql  (2)
│   ├── 0005_projetos.sql                   (2)
│   ├── 0006_trabalhos.sql                  (4)
│   ├── 0007_fontes.sql                     (5)
│   ├── 0008_comentarios.sql                (5)
│   ├── 0009_livro_razao_consumo.sql        (6)
│   ├── 0010_classificacoes_revisoes.sql    (7)
│   ├── 0011_alertas_consumo.sql            (9)
│   ├── 0012_execucoes_agendadas.sql        (9)
│   ├── 0013_conexoes_google.sql            (10)
│   ├── 0014_resumos_tema.sql               (11)
│   └── 0015_perguntas_personalizadas.sql   (12)
├── scripts/
│   ├── dev-semear-demo.ts                  (5) só desenvolvimento; cria conta, projeto e comentários de demonstração; recusa rodar em produção
│   ├── gerar-fixtures.ts                   (8) gera por semente fixa o CSV de exemplo; (10) também as avaliações fictícias do Google
│   └── dev-avancar-ciclo.ts                (9) só desenvolvimento; recusa rodar em produção
├── src/
│   ├── main.ts                             (1) inicialização: config, migrações, seed, servidor, agendador, fila
│   ├── app.ts                             (1) raiz de composição; monta a instância Fastify; usado também pelos testes
│   ├── config/                             (1)
│   │   ├── config.ts                 carrega o arquivo de ambiente e exporta a configuração tipada
│   │   ├── ambiente.esquema.ts             esquema zod das variáveis
│   │   ├── travas-producao.ts              travas de produção
│   │   └── padroes-inseguros.ts            lista de valores inseguros do exemplo de desenvolvimento
│   ├── db/                                 (1)
│   │   ├── conexoes.ts                     pool do pg
│   │   ├── migrar.ts                       aplica migrações com advisory lock e checksum em migracoes_aplicadas
│   │   ├── dados-iniciais.ts               planos iniciais, idempotente
│   │   └── transacao.ts                    helper comTransacao
│   ├── http/
│   │   ├── plugins/
│   │   │   ├── cabecalhos-seguranca.plugin.ts  (1) @fastify/helmet com a CSP do projeto e os demais cabeçalhos
│   │   │   ├── limite-requisicoes.plugin.ts  (1)
│   │   │   ├── protecao-csrf.plugin.ts     (1) exige Origin igual a URL_APP em POST, PUT, PATCH e DELETE
│   │   │   ├── manipulador-erros.plugin.ts  (1) erros genéricos em produção com identificador
│   │   │   ├── sessao.plugin.ts            (2) sessão com armazenamento no PostgreSQL; o armazenamento atravessa contas de propósito e cada função tem o comentário de justificativa
│   │   │   └── estaticos.plugin.ts         (3) serve o build do web em produção; (13) escolhe o site ou o app pelo Host, serve web/dist ou site/dist, carrega as páginas públicas, substitui %NOME_NEGOCIO%, %URL_SITE% e %URL_APP% e envia X-Robots-Tag: noindex em tudo do domínio do app
│   │   ├── guards/                         (2)
│   │   │   ├── exigir-autenticacao.ts      injeta usuarioId e contaId da sessão
│   │   │   ├── exigir-dono.ts
│   │   │   └── exigir-email-confirmado.ts  bloqueia uso de IA sem e-mail confirmado
│   │   ├── configuracao-publica.rotas.ts   (1) GET /api/configuracao-publica, devolve só o nome do negócio
│   │   ├── publico.rotas.ts                (13) só no domínio de URL_SITE: GET e HEAD de /, /blog, /blog/:slug/, robots.txt, sitemap.xml e feed.xml, com 404 real, sem cookie de sessão e com 301 das rotas do app para URL_APP
│   │   ├── saude.rotas.ts                  (1) GET /api/saude, verifica o banco
│   │   └── registrar-rotas.ts              (1) registra as rotas de todos os módulos sob /api
│   ├── modules/
│   │   ├── auth/                           (2)
│   │   │   ├── autenticacao.rotas.ts
│   │   │   ├── autenticacao.esquemas.ts
│   │   │   ├── autenticacao.servico.ts     cadastro, login, confirmação, redefinição, convites
│   │   │   ├── usuarios.repositorio.ts
│   │   │   ├── tokens-autenticacao.repositorio.ts
│   │   │   ├── autenticacao.sistema.repositorio.ts  busca de usuário por e-mail e de token por hash, antes de haver sessão
│   │   │   └── senha.ts                    hash e verificação com argon2
│   │   ├── accounts/                       (2)
│   │   │   ├── contas.rotas.ts
│   │   │   ├── contas.servico.ts
│   │   │   └── contas.repositorio.ts
│   │   ├── plans/                          (2)
│   │   │   ├── planos.rotas.ts
│   │   │   ├── planos.servico.ts
│   │   │   └── planos.sistema.repositorio.ts  planos são globais, sem conta_id
│   │   ├── projects/                       (2)
│   │   │   ├── projetos.rotas.ts
│   │   │   ├── projetos.servico.ts
│   │   │   └── projetos.repositorio.ts
│   │   ├── data-deletion/                  (2)
│   │   │   ├── exclusao-dados.rotas.ts
│   │   │   └── exclusao-dados.servico.ts
│   │   ├── uploads/                        (5)
│   │   │   ├── envios.rotas.ts             envio, prévia e confirmação do mapeamento
│   │   │   ├── envios.esquemas.ts
│   │   │   ├── envios.servico.ts
│   │   │   ├── limpeza-envios.ts           apaga arquivos órfãos de server/tmp/uploads
│   │   │   └── parsing/
│   │   │       ├── detectar-codificacao.ts
│   │   │       ├── detectar-separador.ts
│   │   │       ├── leitor-csv.ts
│   │   │       ├── leitor-xlsx.ts
│   │   │       ├── sugestoes-colunas.ts
│   │   │       └── interpretar-data.ts
│   │   ├── comments/                       (5; os filtros e as rotas entram na 8)
│   │   │   ├── comentarios.rotas.ts        listagem com filtros e paginação, fila de revisão e gravação da correção
│   │   │   ├── comentarios.esquemas.ts
│   │   │   ├── comentarios.servico.ts
│   │   │   ├── comentarios.repositorio.ts
│   │   │   ├── filtros-comentarios.ts      tradução dos filtros da tela em SQL parametrizado
│   │   │   ├── anonimizador.ts
│   │   │   └── hash-conteudo.ts
│   │   ├── usage/                          (6; rotas, ciclos e alertas entram na 9)
│   │   │   ├── controle-custo.servico.ts   reserva em lote, liquidação e liberação com bloqueio da conta; único ponto de saída do módulo, também expõe a estimativa de custo às fases 8 e 12
│   │   │   ├── estimador-custo.ts          estimativa de tokens e custo; interno ao módulo, usado de fora só por controle-custo.servico.ts
│   │   │   ├── consumo.repositorio.ts
│   │   │   ├── consumo.sistema.repositorio.ts  reservas antigas, jobs pausados e contas com ciclo vencido, entre contas
│   │   │   ├── consumo.rotas.ts            (9) consumo em porcentagem para a interface
│   │   │   ├── ciclos.servico.ts           (9) virada de ciclo e retomada de jobs pausados
│   │   │   └── alertas-consumo.servico.ts  (9) avisos de 80% e 100%
│   │   ├── classification/                 (7)
│   │   │   ├── classificacao.rotas.ts      estimar, iniciar, progresso e reprocessar falhas
│   │   │   ├── classificacao.esquemas.ts
│   │   │   ├── questions.ts                perguntas padrão do Jev
│   │   │   ├── classificacao.servico.ts    monta a requisição por comentário e grava os resultados
│   │   │   ├── pos-processamento.ts        precisa_revisao, normalização, truncamento
│   │   │   ├── classificacoes.repositorio.ts
│   │   │   └── revisoes.repositorio.ts     correções da fila de revisão (usadas na 8)
│   │   ├── dashboard/                      (8)
│   │   │   ├── painel.rotas.ts             números e séries dos gráficos
│   │   │   ├── painel.servico.ts
│   │   │   └── exportacao.servico.ts       CSV com ; e UTF-8 com BOM, usando shared/safe-csv.ts
│   │   ├── billing/                        (9)
│   │   │   ├── provedor-cobranca.ts        interface ProvedorDeCobranca
│   │   │   └── provedor-cobranca-desativado.ts
│   │   ├── google-business/                (10)
│   │   │   ├── google.rotas.ts             início do OAuth, callback, contas, unidades, desconectar
│   │   │   ├── google-oauth.servico.ts
│   │   │   ├── google-sincronizacao.servico.ts  sincronização completa e incremental
│   │   │   ├── conexoes-google.repositorio.ts
│   │   │   ├── conexoes-google.sistema.repositorio.ts  lista as conexões ativas de todas as contas, só para o agendador da sincronização
│   │   │   └── nota-estrelas.ts            conversão ONE a FIVE para 1 a 5
│   │   ├── summaries/                      (11)
│   │   │   ├── resumos.rotas.ts
│   │   │   ├── resumos.servico.ts          orquestra as cinco etapas
│   │   │   ├── agregar.ts
│   │   │   ├── selecionar-amostra.ts
│   │   │   ├── prompt-resumo.ts
│   │   │   ├── conferir-numeros.ts
│   │   │   ├── perguntas-verificacao.ts    pergunta Noul de sustentação
│   │   │   ├── nivel-alerta.ts
│   │   │   ├── hash-dados.ts
│   │   │   └── resumos.repositorio.ts
│   │   └── ask/                            (12)
│   │       ├── perguntar.rotas.ts
│   │       ├── perguntar.esquemas.ts
│   │       ├── perguntar.servico.ts
│   │       ├── interpretador-pergunta.ts   chamada ao LLM que traduz a pergunta
│   │       ├── prompt-interpretador.ts
│   │       └── perguntas-personalizadas.repositorio.ts
│   ├── integrations/
│   │   ├── mail/                           (2)
│   │   │   ├── enviador-email.ts           interface EnviadorDeEmail
│   │   │   ├── enviador-smtp.ts
│   │   │   ├── enviador-log.ts
│   │   │   └── templates/                  um arquivo por e-mail, textos em português
│   │   ├── jev/                            (7)
│   │   │   ├── classificador-comentarios.ts  interface ClassificadorDeComentarios
│   │   │   ├── classificador-jev.ts        implementação com @typesafe-ai/sdk
│   │   │   └── classificador-simulado.ts
│   │   ├── google/                         (10)
│   │   │   ├── fonte-avaliacoes.ts         interface FonteDeAvaliacoes
│   │   │   ├── fonte-avaliacoes-google.ts
│   │   │   ├── fonte-avaliacoes-simulada.ts
│   │   │   └── fixtures/                   contas, unidades e avaliações fictícias em JSON, geradas por scripts/gerar-fixtures.ts
│   │   └── llm/                            (11)
│   │       ├── provedor-llm.ts             interface ProvedorLlm
│   │       ├── provedor-anthropic.ts
│   │       └── provedor-llm-simulado.ts
│   ├── jobs/                               (4)
│   │   ├── trabalhos.rotas.ts              status de job com progresso, filtrado pela conta
│   │   ├── trabalhos.servico.ts
│   │   ├── trabalhos.repositorio.ts
│   │   ├── fila-trabalhos.ts               fila no PostgreSQL com FOR UPDATE SKIP LOCKED
│   │   ├── executor-trabalhos.ts           laço de execução, heartbeat, retentativas, registro de handlers
│   │   ├── recuperacao-trabalhos.ts        retoma jobs órfãos e roda os ganchos de recuperação na inicialização
│   │   └── handlers/
│   │       ├── importar-envio.manipulador.ts   (5)
│   │       ├── classificar.manipulador.ts      (7)
│   │       ├── google-sincronizacao.manipulador.ts  (10)
│   │       ├── resumir.manipulador.ts          (11)
│   │       └── perguntar.manipulador.ts        (12)
│   ├── scheduler/                          (9)
│   │   ├── agendador.ts                    node-cron com trava em execucoes_agendadas
│   │   └── agendamentos.ts                 sincronização do Google, virada de ciclo, liberação de reservas, limpezas
│   └── shared/
│       ├── errors.ts                        (1) classes de erro de domínio
│       ├── ids.ts              (1) tipos de marca ContaId, UsuarioId, ProjetoId e demais
│       ├── logger.ts                  (1)
│       ├── clock.ts                        (1) Relogio injetável; datas no fuso America/Sao_Paulo
│       ├── pagination.ts                    (1)
│       ├── thresholds.ts                     (7) limiares de regra de negócio usados por mais de um módulo, como LIMIAR_PRECISA_ACAO
│       ├── safe-csv.ts                   (8) neutraliza células que o Excel leria como fórmula, usado pela exportação do painel e pela da pergunta
│       └── crypto.ts                 (10) AES-256-GCM para tokens
└── test/
    ├── setup.ts                           (1) recria o banco de testes
    ├── helpers/
    │   ├── build-app.ts                   (1)
    │   ├── factories.ts                     (1, estendida a cada fase) cria contas, usuários, projetos e comentários de teste
    │   └── login.ts                       (2)
    ├── fixtures/                           CSVs em UTF-8 e Windows-1252, XLSX, respostas do Jev e do LLM
    ├── unit/                               espelha a estrutura de src
    └── integration/                        rotas completas contra o banco de testes
```

Arquivos enviados pelo cliente ficam temporariamente em `server/tmp/uploads`, fora de `src`, listada no `.gitignore`, e são apagados logo após a importação.

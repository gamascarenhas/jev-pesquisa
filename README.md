# jev-pesquisa

SaaS self-service que classifica comentários de clientes com o Jev, modelo da TypeSafe AI que devolve decisões tipadas com probabilidades e não gera texto. A especificação está em `docs/SPEC.md`.

Monorepo simples: `server/` (API Fastify). O `web/` entra na fase 3 e o `site/`, na fase 13.

## Requisitos

- Node.js 20 ou mais novo (`.nvmrc` indica a versão usada no desenvolvimento)
- Docker, só para o PostgreSQL local de desenvolvimento

## Desenvolvimento

```bash
npm ci
cp .env.development.example .env.development   # sem alterar nada
npm run dev
```

`npm run dev` sobe o PostgreSQL 16 local pelo `docker-compose.dev.yml` (porta 5433), aplica as migrations pendentes, cria os planos iniciais e sobe o servidor em `http://localhost:3100`. Não há passo manual de banco. Confira em `GET /api/saude`.

O compose cria dois bancos: `jev_dev`, para rodar, e `jev_teste`, só para os testes. Os testes recriam o `jev_teste` a cada execução e recusam rodar se `URL_BANCO_TESTES` não existir ou for igual a `URL_BANCO`, então nunca tocam os dados de desenvolvimento.

Por padrão o exemplo de desenvolvimento liga todos os modos simulados (Jev, Google, LLM) e manda os e-mails para o log, então não precisa de nenhuma chave.

### Scripts (na raiz)

| Script | O que faz |
| --- | --- |
| `npm run dev` | sobe o banco local e o servidor com recarga automática |
| `npm test` | roda os testes contra `URL_BANCO_TESTES` |
| `npm run typecheck` | checagem de tipos |
| `npm run lint` | ESLint |
| `npm run verificar` | `typecheck`, `lint` e `test` em sequência |
| `npm run build` | compila para `server/dist`; não precisa de nenhum segredo |
| `npm start` | roda o build em produção |
| `npm run auditoria` | `npm audit --omit=dev --audit-level=high` |

`AMBIENTE_APP` e `NODE_ENV` são definidos pelos scripts (com `cross-env`, então funcionam no Windows) e nunca dentro dos arquivos de ambiente. O `stylelint` entra na fase 3.

## Preparar produção

1. `cp .env.production.example .env.production` e preencha cada valor vazio. Cada variável tem um comentário dizendo onde conseguir o valor.
2. `npm ci && npm run build && npm start`.

O sistema **recusa iniciar** e lista cada problema se: alguma variável obrigatória faltar; algum modo simulado estiver ligado; `PROVEDOR_EMAIL=log`; `URL_APP` ou `GOOGLE_URI_REDIRECIONAMENTO` não usarem `https`; `SEGREDO_SESSAO` ou `CHAVE_CRIPTOGRAFIA` forem curtos ou iguais aos valores inseguros do exemplo de desenvolvimento; ou `URL_BANCO_TESTES` existir.

Ao iniciar, o servidor aplica as migrations pendentes e cria os planos iniciais, de forma idempotente. Ele recusa subir se uma migration já aplicada foi alterada: migration aplicada nunca é editada, a correção é uma nova migration.

Atrás de proxy reverso, use `CONFIAR_PROXY=true` e faça o proxy repassar o `Host` original, para o limite de requisições por IP enxergar o IP real.

### Banco em produção

- A aplicação deve usar um **usuário de banco sem privilégio de superusuário**. A extensão `pgcrypto` é criada pela primeira migration; se o usuário da aplicação não puder criar extensões, crie-a antes com um usuário administrativo (`CREATE EXTENSION IF NOT EXISTS pgcrypto;`).
- **O backup do PostgreSQL é responsabilidade do operador.** A aplicação não faz backup.

### Encerramento

Ao receber `SIGTERM` ou `SIGINT`, o servidor para de aceitar requisições, espera as que estão em andamento por até 30 segundos e fecha o pool do banco.

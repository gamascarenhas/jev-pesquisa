# jev-pesquisa

SaaS self-service que classifica comentários de clientes com o Jev, modelo da TypeSafe AI que devolve decisões tipadas com probabilidades e não gera texto. A especificação está em `docs/SPEC.md`.

Monorepo simples: `server/` (API Fastify) e `web/` (React + Vite). O `site/` entra na fase 13.

## Requisitos

- Node.js 20 ou mais novo (`.nvmrc` indica a versão usada no desenvolvimento)
- Docker, só para o PostgreSQL local de desenvolvimento

## Desenvolvimento

```bash
npm ci
cp .env.development.example .env.development   # sem alterar nada
npm run dev
```

`npm run dev` sobe o PostgreSQL 16 local pelo `docker-compose.dev.yml` (porta 5432), aplica as migrations pendentes, cria os planos iniciais e sobe a API em `http://localhost:3000` e o front em `http://localhost:5173` (o Vite repassa `/api` para a API). Abra o front. Não há passo manual de banco. Confira em `GET /api/saude`.

O compose cria dois bancos: `jev_dev`, para rodar, e `jev_teste`, só para os testes. Os testes recriam o `jev_teste` a cada execução e recusam rodar se `URL_BANCO_TESTES` não existir ou for igual a `URL_BANCO`, então nunca tocam os dados de desenvolvimento.

Por padrão o exemplo de desenvolvimento liga todos os modos simulados (Jev, Google, LLM) e manda os e-mails para o log, então não precisa de nenhuma chave.

### Scripts (na raiz)

| Script | O que faz |
| --- | --- |
| `npm run dev` | sobe o banco local, a API e o front com recarga automática |
| `npm test` | roda os testes contra `URL_BANCO_TESTES` |
| `npm run dev:semear-demo` | cria a conta `demo@exemplo.com.br` (senha `demonstracao-123`) com um projeto e 1.000 comentários fictícios, classificados com o Jev simulado; só em desenvolvimento e repetível sem duplicar |
| `npm run dev:avancar-ciclo [-- email]` | vence e vira o ciclo da conta do usuário (padrão `demo@exemplo.com.br`), zerando o consumo e devolvendo à fila os jobs pausados por limite; recusa-se a rodar em produção |
| `npm run fixtures:gerar` | regenera `web/public/exemplo-comentarios.csv` (100 comentários fictícios, semente fixa, `;` e UTF-8 com BOM) |
| `npm run typecheck` | checagem de tipos |
| `npm run lint` | ESLint |
| `npm run stylelint` | stylelint dos CSS do `web` |
| `npm run verificar` | `typecheck`, `lint`, `stylelint` e `test` em sequência |
| `npm run build` | compila `server/dist` e `web/dist`; não precisa de nenhum segredo |
| `npm start` | roda o build em produção; a API serve o `web/dist` |
| `npm run auditoria` | `npm audit --omit=dev --audit-level=high` |

`AMBIENTE_APP` e `NODE_ENV` são definidos pelos scripts (com `cross-env`, então funcionam no Windows) e nunca dentro dos arquivos de ambiente.

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

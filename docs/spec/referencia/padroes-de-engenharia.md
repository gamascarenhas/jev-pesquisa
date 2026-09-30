# Padrões de engenharia

Valem para todo o código. "Padrão de empresa grande" aqui significa fronteiras claras, segurança por padrão, tipagem forte e testes confiáveis, tudo verificável por ferramenta. Não significa microsserviços, Redis, contêiner de injeção de dependência ou outra peça que o MVP não precise.

As fases 1 e 3 criam a configuração que faz cumprir estas regras (`tsconfig`, ESLint, Prettier, stylelint, Vitest). Depois disso, `lint`, `typecheck` e `test` falham quando uma regra é violada.

## 1. TypeScript

- `tsconfig` com `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax` e `isolatedModules`. Servidor em ES2022 com módulos `NodeNext`.
- ESLint com `typescript-eslint` nos conjuntos `strictTypeChecked` e `stylisticTypeChecked`, mais estas regras como erro: `no-explicit-any`, `no-non-null-assertion`, `no-floating-promises`, `no-misused-promises`, `switch-exhaustiveness-check`, `consistent-type-imports`, `eqeqeq`, `no-console` no servidor, `complexity` até 10, `max-lines-per-function` até 50 e `max-lines` até 300 (testes ficam de fora dos dois limites de tamanho, e os arquivos de textos `i18n/*.ts` ficam de fora do limite de linhas, porque só crescem com cada fase e não têm lógica).
- No web, também `eslint-plugin-react`, `eslint-plugin-react-hooks` e `eslint-plugin-jsx-a11y`, com `react/no-danger` como erro. Nada de `dangerouslySetInnerHTML`.
- Formatação por Prettier, sem discussão de estilo.
- **Identificadores com tipo de marca** (`ContaId`, `UsuarioId`, `ProjetoId`, `ComentarioId`…) em `shared/ids.ts`, para o compilador impedir trocar um id por outro. Todo repositório recebe `ContaId`, nunca `string`.
- **Dinheiro nunca em ponto flutuante.** Colunas `numeric` de USD são convertidas no repositório para inteiro em unidades de 1e-8 USD (`bigint`) e só viram texto na borda de saída.
- Entradas externas (corpo, query, params, variáveis de ambiente, resposta do Jev, do LLM e do Google) são `unknown` até passarem por `zod`. Esquemas de entrada usam `.strict()`, e chave desconhecida é erro.

## 2. Arquitetura

- **Direção das dependências:** rotas → serviços → repositórios e integrações. Um módulo só importa de outro módulo pelos arquivos `*.servico.ts` e `*.tipos.ts`, nunca por `*.repositorio.ts`, `*.rotas.ts` ou internos. Regra imposta por `no-restricted-imports`. Código usado por mais de um módulo que não seja serviço nem tipo, como `safe-csv.ts` e `thresholds.ts`, mora em `shared/`. No front-end, o `site/` importa só de `web/src/styles`, `web/src/components/ui` e `web/src/lib`, e nada em `web/` importa de `site/` (`estrutura-site.md`).
- **Constantes de regra e configuração:** só as variáveis listadas em `configuracao.md` são configuráveis por ambiente. Limiares, tamanhos de lote e número de tentativas citados nas fases são constantes nomeadas no topo do arquivo ou em `shared/thresholds.ts`, sem variável de ambiente.
- **Raiz de composição:** `app.ts` cria o pool, os repositórios, as integrações e os serviços, e os entrega por fábricas `criarNomeServico(dependencias)`. Sem singleton global (exceto a configuração imutável) e sem contêiner de injeção. O relógio é injetável (`Relogio` em `shared/clock.ts`), e os testes trocam integrações por falsos.
- **Repositórios de sistema:** funções que atravessam contas ficam em arquivos `*.sistema.repositorio.ts`, cada uma com um comentário justificando. Só `auth` (busca por e-mail e por hash de token), o armazenamento de sessão, a fila de jobs, o agendador (inclusive reservas antigas, jobs `paused_limit`, contas com ciclo vencido e conexões ativas do Google) e o `planos` os usam. Todo o resto exige `ContaId`.
- **Erros:** classes de `ErroDeDominio` em `shared/errors.ts`, cada uma com código estável e status HTTP. Serviços lançam, rotas não capturam, e um manipulador central converte. Nunca lançar texto solto.
- **Formato de erro da API:** `{ "erro": { "codigo": "...", "mensagem": "...", "idRequisicao": "..." } }`. Em erro 5xx em produção, a mensagem é genérica.
- **Paginação:** entrada `pagina` e `tamanhoPagina` (máximo 100), saída `{ itens, total, pagina, tamanhoPagina }`.
- **DTOs explícitos:** a rota devolve só os campos listados no esquema de saída. Nunca uma linha crua do banco, e nunca `hash_senha`, tokens ou segredos.
- **Transações:** `comTransacao` para toda operação com mais de uma escrita. Nada de chamada externa lenta dentro de transação com bloqueio.
- **Chamadas externas** (Jev, LLM, Google, SMTP): timeout obrigatório com `AbortSignal`; retentativa com backoff exponencial e jitter só para erro transitório; nunca repetir uma operação não idempotente sem chave de idempotência.
- **Migrations:** só para frente, sem editar arquivo aplicado. O executor aplica cada arquivo em uma transação, sob `pg_advisory_lock` para duas instâncias não migrarem juntas, grava o `checksum` SHA-256 e recusa iniciar se o de uma migration já aplicada mudou.
- **Estado no banco, processo sem estado:** sessão, fila e agendador vivem no PostgreSQL, então uma segunda instância funciona sem mudar código.

## 3. Convenções de código

- `camelCase` para variáveis e funções; `PascalCase` para tipos, classes e componentes; `MAIUSCULAS_COM_SUBLINHADO` para constantes; `snake_case` no SQL; arquivos `.ts` em `kebab-case`; componentes React em `PascalCase.tsx`.
- Booleanos com prefixo: `estaAtivo`, `possuiPermissao`, `podeEditar`.
- Só exportações nomeadas. Sem `export default` (exceto onde a ferramenta exige) e sem arquivos `index.ts` de reexportação.
- Nomes de arquivo e pasta que são convenção de ferramenta ficam em inglês (`main.ts`, `app.ts`, `routes.tsx`, `providers.tsx`, `variants.ts`, `format.ts`, `prerender.ts`, `config.ts`, `logger.ts`, `errors.ts`, `index.*`, `setup.ts`, `types.ts`, `factories.ts`, `cn.ts`, `crypto.ts`, `thresholds.ts`, `safe-csv.ts`, `questions.ts`, `test/`, `tmp/`, `*.test.ts`, `*.config.*`); o restante, em português (regra completa no `AGENTS.md`).
- Um arquivo, uma responsabilidade. Ordem dentro do arquivo: imports, constantes, tipos, funções exportadas, auxiliares privadas.
- Ordem dos imports: `node:`, pacotes, alias `@/`, relativos, com `import type` para tipos.
- **Comentários: o mínimo.** Sem comentário é o padrão; nomes claros dispensam explicação. Só comente o porquê de algo não óbvio (restrição, armadilha, decisão), em português, em **uma linha** e, no máximo, duas, curta e direta, mas completa o bastante para a dúvida não voltar. Nada de blocos JSDoc longos, nada que repita o nome da função ou o código, sem cabeçalho de arquivo e sem código comentado; `TODO` só com motivo. Regra de negócio vive na spec e nos testes, não em comentário. Exceção: os `.env.*.example`, com uma linha por variável que precise de explicação.
- Limiares e números mágicos viram constantes nomeadas no topo do arquivo ou em `config`.
- Commits em Conventional Commits, em português, e nenhum commit sem eu pedir.

## 4. Segurança básica

- SQL sempre parametrizado, nunca montado por concatenação. `statement_timeout` e tamanho do pool em constantes nomeadas em `config/`, sem variável de ambiente.
- Tokens de e-mail: 32 bytes de `crypto.randomBytes`, gravados como hash SHA-256, comparados em tempo constante, de uso único e com expiração.
- Senhas com `argon2id`. Login com e-mail inexistente executa um hash falso, para o tempo de resposta não revelar a existência da conta.
- Cabeçalhos por `@fastify/helmet`: CSP, HSTS em produção, `X-Content-Type-Options`, `Referrer-Policy` e `Permissions-Policy`. Cookie de sessão com prefixo `__Host-` em produção, `httpOnly`, `secure` e `sameSite=lax`.
- Limite de tamanho de corpo por rota, e parâmetros de rota validados como UUID.
- Saída do LLM e comentários de clientes são dados não confiáveis: validados por `zod`, exibidos sempre como texto, nunca como HTML.
- Logs com `pino` e `redact` para `authorization`, `cookie`, `senha`, `token`, `texto_original`, `texto_mascarado` e segredos. Nada de dado pessoal em log, só ids.
- **Auditoria:** eventos de log com `categoria: "auditoria"` para login (sucesso e falha), troca e redefinição de senha, convite, remoção de usuário, exportação, conexão e desconexão do Google, exclusão de projeto e encerramento de conta, com ids e sem texto de comentário.
- Em produção, a aplicação usa um usuário de banco sem privilégio de superusuário. O README diz isso e diz que backup do PostgreSQL é responsabilidade do operador.
- Segredos só em variáveis de ambiente, nunca em código, teste, fixture ou log. `.gitignore` cobre `.env.development` e `.env.production`.

## 5. Testes

- Pirâmide: muitos testes unitários de regra pura, testes de integração das rotas contra o PostgreSQL de testes real, e poucos testes de componentes no web. Sem mock de banco em teste de integração.
- Determinísticos: relógio falso, semente fixa, nenhuma chamada de rede real. Cada bug corrigido ganha um teste de regressão.
- Limiar de cobertura de 90% de linhas em `usage`, `comments/anonimizador.ts`, `auth` e nas funções de isolamento; o restante sem limiar rígido.
- Fábricas em `test/helpers/factories.ts` para dados de teste. Nenhum segredo real em fixture.

## 6. Dependências e build

- `package-lock.json` versionado e instalação com `npm ci`. `engines.node` em `>=20` e `.nvmrc`.
- Script `auditoria` com `npm audit --omit=dev --audit-level=high`, rodado antes de cada relatório de fase.
- Só dependências mantidas e com licença compatível com uso comercial.
- Scripts da raiz: `dev`, `test`, `typecheck`, `lint`, `build`, `start` e `auditoria`. Um script `verificar` roda `typecheck`, `lint`, `stylelint` (a partir da fase 3) e `test` em sequência.

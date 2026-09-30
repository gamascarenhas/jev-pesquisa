# Fase 2: Contas e acesso

**Entrega 1.** Depende de: fase 1.

## Leia antes

- `AGENTS.md`
- `docs/spec/referencia/tecnologias.md`, autenticação e e-mail
- `docs/spec/referencia/padroes-de-engenharia.md`
- `docs/spec/referencia/estrutura-server.md`, módulos `auth`, `accounts`, `plans`, `projects` e `data-deletion`, `integrations/mail`, `http/guards` e `http/plugins/sessao.plugin.ts`
- `docs/spec/referencia/banco-de-dados.md`
- `docs/spec/referencia/configuracao.md`, variáveis de e-mail, `NOME_NEGOCIO`, `VERSAO_TERMOS` e `PLANO_PADRAO_ID`

## Nesta fase

- **Migrations desta fase:** crie em `server/migrations` os três arquivos da seção "Migrations desta fase", com o SQL exato dela, e aplique-os.
- Sessões guardadas no PostgreSQL, com armazenamento próprio para o `@fastify/session` que grava `usuario_id` e permite encerrar todas as sessões de um usuário ou de uma conta (`sessao.plugin.ts`).
- Módulos `auth` (com `autenticacao.sistema.repositorio.ts`), `accounts`, `plans` somente com listagem (com `planos.sistema.repositorio.ts`), `projects` com criar, listar, renomear e apagar, e `data-deletion`.
- `integrations/mail` com a interface `EnviadorDeEmail`, a implementação SMTP, a que só escreve no log e os modelos de e-mail de confirmação, troca de e-mail, redefinição de senha, convite e aviso de conta já existente, que usam `NOME_NEGOCIO` da configuração no assunto, no corpo e no nome de exibição do remetente, sem nome fixo.
- Guards `exigir-autenticacao`, `exigir-dono` e `exigir-email-confirmado`.
- Limites de requisição por rota, respostas sem enumeração de e-mails, auditoria e DTOs explícitos, descritos abaixo.
- Helpers de teste `login.ts` e as fábricas de contas, usuários e projetos em `factories.ts`.

## Especificação

### Contas, login e isolamento

1. Cadastro público: nome da empresa, nome do usuário, e-mail, senha e aceite dos termos de uso e da política de privacidade. Cria a conta, o usuário `owner` e associa o plano inicial definido por `PLANO_PADRAO_ID`. O aceite grava `termos_aceitos_em` e `versao_termos` com o valor de `VERSAO_TERMOS`. Sem aceite, não há cadastro.
2. **Confirmação de e-mail obrigatória** antes de qualquer uso de IA. Sem confirmação, o usuário navega e sobe arquivos, mas não classifica. Isso evita contas falsas consumindo IA. O usuário pode pedir o **reenvio** do e-mail de confirmação, com limite de frequência.
3. Login, logout e redefinição de senha por link enviado por e-mail. Abstraia o envio de e-mail numa interface `EnviadorDeEmail` com implementação que só escreve no log em desenvolvimento.
4. O `owner` pode convidar outros usuários da mesma empresa por e-mail, ver os convites pendentes e **revogar** um convite. Todo link enviado por e-mail expira e só pode ser usado uma vez. Quem aceita um convite também aceita os termos, e o aceite é gravado.
5. Senha mínima de 10 caracteres; bloqueio temporário após 5 tentativas erradas.
6. **Perfil:** o usuário logado troca a própria senha, informando a atual, e troca o próprio e-mail, com confirmação da senha e um link enviado ao novo endereço, que só vale depois de clicado.
7. **Usuários:** o `owner` lista os usuários da conta e remove um deles. Ele não pode remover a si mesmo nem o último `owner`. Remover um usuário encerra as sessões dele; os dados que ele criou permanecem na conta.
8. **E-mail único no sistema:** um endereço de e-mail pertence a uma única conta no MVP. Consultor que atende duas empresas usa dois endereços.

**Papéis.** Só existem `owner` e `member`.

| Ação | `owner` | `member` |
| --- | --- | --- |
| Convidar, revogar convites e remover usuários | sim | não |
| Encerrar a conta | sim | não |
| Apagar projeto | sim | não |
| Conectar e desconectar o Google | sim | não |
| Trocar de plano | sim | não |
| Criar e renomear projetos, subir arquivos, classificar, perguntar, revisar, gerar resumos e exportar | sim | sim |
| Trocar a própria senha e o próprio e-mail | sim | sim |

### Segurança das contas e da sessão

- **Enumeração de e-mails:** o login errado responde sempre "e-mail ou senha incorretos", inclusive no bloqueio temporário. Redefinição de senha e reenvio de confirmação respondem sempre "se o e-mail existir, enviamos as instruções". Cadastro com e-mail já existente responde igual ao cadastro novo e envia ao endereço existente um aviso de que já há conta. Convite para um e-mail que já pertence a alguma conta responde ao `owner` igual ao convite normal e envia ao endereço existente o mesmo aviso, sem criar token.
- **Limite de requisições:** além do bloqueio de login, limites por IP e por e-mail em cadastro, reenvio de confirmação, redefinição de senha e troca de e-mail. Os valores ficam em constantes nomeadas.
- **Sessão:** o cookie expira após 7 dias sem uso, renovando a cada uso, e tem duração absoluta máxima de 30 dias. Redefinir ou trocar a senha encerra todas as sessões do usuário, exceto a atual no caso da troca. Em produção, o cookie usa o prefixo `__Host-`.
- **Entrada e saída:** todas as rotas desta fase usam esquemas `zod` com `.strict()`, parâmetros de rota validados como UUID e respostas montadas por DTOs explícitos, sem nunca devolver `hash_senha`, tokens ou segredos.
- **Auditoria:** login (sucesso e falha), troca e redefinição de senha, convite, revogação, remoção de usuário, apagar projeto e encerrar conta geram log estruturado com `categoria: "auditoria"`, só com ids.

---

### Exclusão de dados

O cliente controla os próprios dados, sem precisar de mim:

- **Apagar projeto**: remove comentários, classificações, perguntas, resumos e fontes do projeto, depois de confirmação digitando o nome do projeto.
- **Desconectar o Google**: revoga o token junto ao Google, apaga os tokens gravados e para a sincronização. Os comentários já importados continuam, a menos que o projeto seja apagado.
- **Encerrar a conta**: só o `owner`, com confirmação por senha. Apaga todos os dados da conta e revoga as conexões com o Google.
- Arquivos enviados são apagados do disco logo depois de importados; o sistema guarda só os comentários extraídos.
- O `livro_razao_consumo` de contas encerradas é mantido sem textos, apenas com valores, para meu controle de custos.

Nesta fase, implemente apagar projeto e encerrar conta sobre as tabelas que já existem. O passo de desconectar o Google e revogar o token entra na fase 10; deixe o ponto de extensão pronto no serviço de exclusão. Cada fase seguinte que criar tabela de dados de cliente estende os testes de exclusão e de isolamento.

## Migrations desta fase

Crie os arquivos abaixo em `server/migrations`, com este SQL exato.

```sql
-- 0003_contas_usuarios.sql
CREATE TABLE contas (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                  text NOT NULL,
  plano_id              text NOT NULL REFERENCES planos(id),
  ciclo_iniciado_em     timestamptz NOT NULL DEFAULT now(),
  ciclo_termina_em      timestamptz NOT NULL DEFAULT now() + interval '1 month',
  criado_em             timestamptz NOT NULL DEFAULT now(),
  atualizado_em         timestamptz NOT NULL DEFAULT now(),
  CHECK (ciclo_termina_em > ciclo_iniciado_em)
);
CREATE INDEX contas_ciclo_termina_em_idx ON contas (ciclo_termina_em);

CREATE TABLE usuarios (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id                 uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  nome                     text NOT NULL,
  email                    text NOT NULL,
  email_confirmado_em      timestamptz,
  hash_senha               text NOT NULL,
  papel                    text NOT NULL CHECK (papel IN ('owner', 'member')),
  tentativas_login_falhas  integer NOT NULL DEFAULT 0,
  bloqueado_ate            timestamptz,
  ultimo_login_em          timestamptz,
  termos_aceitos_em        timestamptz,
  versao_termos            text,
  criado_em                timestamptz NOT NULL DEFAULT now(),
  atualizado_em            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, conta_id)
);
CREATE UNIQUE INDEX usuarios_email_unico ON usuarios (lower(email));
CREATE INDEX usuarios_conta_id_idx ON usuarios (conta_id);

-- 0004_tokens_autenticacao_sessoes.sql
CREATE TABLE tokens_autenticacao (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id         uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  usuario_id       uuid,
  tipo             text NOT NULL
                   CHECK (tipo IN ('email_verification', 'password_reset', 'invitation', 'email_change')),
  email            text NOT NULL,
  hash_token       text NOT NULL UNIQUE,
  papel_convidado  text CHECK (papel_convidado IN ('owner', 'member')),
  criado_por       uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  expira_em        timestamptz NOT NULL,
  usado_em         timestamptz,
  criado_em        timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (usuario_id, conta_id) REFERENCES usuarios(id, conta_id) ON DELETE CASCADE,
  CHECK (tipo <> 'invitation' OR papel_convidado IS NOT NULL),
  CHECK (tipo = 'invitation' OR usuario_id IS NOT NULL)
);
CREATE INDEX tokens_autenticacao_conta_id_idx ON tokens_autenticacao (conta_id);
CREATE INDEX tokens_autenticacao_expira_em_idx ON tokens_autenticacao (expira_em);

CREATE TABLE sessoes (
  id_sessao   text PRIMARY KEY,
  usuario_id  uuid REFERENCES usuarios(id) ON DELETE CASCADE,
  dados       jsonb NOT NULL,
  expira_em   timestamptz NOT NULL
);
CREATE INDEX sessoes_expira_em_idx ON sessoes (expira_em);
CREATE INDEX sessoes_usuario_id_idx ON sessoes (usuario_id);

-- 0005_projetos.sql
CREATE TABLE projetos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id       uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  nome           text NOT NULL,
  criado_por     uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, conta_id)
);
CREATE INDEX projetos_conta_id_idx ON projetos (conta_id);
```

## Testes desta fase

- Isolamento: com duas contas, nenhuma rota devolve ou altera dados da outra, e o banco recusa gravação cruzada entre contas.
- Conta: links de e-mail expiram e não funcionam duas vezes; bloqueio temporário após 5 tentativas erradas; senha com menos de 10 caracteres é recusada; o guard `exigir-email-confirmado` bloqueia usuário sem e-mail confirmado; cadastro sem aceite dos termos é recusado e o aceite é gravado com a versão.
- Papéis: `member` recebe 403 nas ações exclusivas do `owner`; o `owner` não remove a si mesmo nem o último `owner`; remover usuário encerra as sessões dele; revogar convite invalida o link.
- Perfil: trocar senha exige a atual e encerra as outras sessões; trocar e-mail só vale depois do clique no link enviado ao novo endereço; redefinir a senha encerra todas as sessões do usuário.
- Enumeração: login com e-mail inexistente e com senha errada respondem igual; redefinição, reenvio e cadastro com e-mail existente não revelam se o e-mail existe.
- Limites: estourar o limite de cadastro, reenvio e redefinição por IP e por e-mail responde 429.
- Sessão: expira após 7 dias sem uso e após 30 dias absolutos, sobrevive a um reinício do servidor, e em produção o cookie usa `__Host-`.
- Entrada e saída: corpo com chave desconhecida é recusado; parâmetro que não é UUID é recusado; nenhuma resposta traz `hash_senha`, token ou segredo.
- Auditoria: as ações listadas geram log com `categoria: "auditoria"`, sem e-mail, senha nem token.
- Exclusão: apagar projeto e encerrar conta removem todos os dados dependentes.
- Banco: um token de autenticação de uma conta não pode apontar para um usuário de outra conta.
- Migrations: as três desta fase aplicadas duas vezes sem erro nem duplicação.

## Pronto quando

1. Criar duas contas de empresas diferentes e confirmar que uma não vê nada da outra.
2. Cadastrar, confirmar o e-mail pelo link que aparece no log, entrar, redefinir a senha e convidar um segundo usuário, tudo por requisições HTTP descritas no relatório.
3. Apagar um projeto e confirmar que nenhum dado dele sobrou no banco.
4. Reiniciar o servidor e continuar logado.
5. As migrations desta fase aplicadas num PostgreSQL 16 real, duas vezes, sem erro.

## Fora desta fase

- Telas de qualquer tipo. Elas começam na fase 3.
- Fila de jobs e agendador.
- Upload, classificação, cobrança e Google.
- Texto jurídico definitivo dos termos e da política de privacidade: a fase 3 usa texto provisório até eu fornecer o definitivo.

## Antes de parar

Passe pela lista de `AGENTS.md`. Confira também:

- [ ] Todo repositório recebe `contaId` como primeiro parâmetro, salvo os `*.sistema.repositorio.ts`, cada função com o comentário de justificativa.
- [ ] As migrations desta fase existem em `server/migrations` com o SQL da spec e foram aplicadas duas vezes, ou o relatório diz por que não foi possível.

Entregue o relatório e espere minha confirmação. Não comece a próxima fase.

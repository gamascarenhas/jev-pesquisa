# Configuração e ambientes

## Configuração pelos arquivos de ambiente

Os arquivos de ambiente são a **única** coisa que eu forneço. Depois de preenchidos uma vez, o sistema nunca mais precisa de mim para funcionar.

**Dois ambientes, dois arquivos:**

| Arquivo | Uso | Carregado por |
| --- | --- | --- |
| `.env.development` | rodar localmente e rodar os testes | `npm run dev` e `npm test` |
| `.env.production` | servidor de produção | `npm start` |

- O ambiente é definido por `AMBIENTE_APP`, com valores `development` ou `production`, **definido pelos scripts do `package.json`, nunca dentro dos arquivos de ambiente**, porque é ele que escolhe qual arquivo carregar. Os scripts também definem `NODE_ENV` correspondente. O `config.ts` carrega o arquivo certo e nunca mistura os dois.
- `npm run build` compila o código e não precisa de nenhum segredo.
- Entregue `.env.development.example` e `.env.production.example`, ambos versionados, completos, com comentários curtos em português (regra na seção 7 abaixo). Os arquivos preenchidos ficam no `.gitignore`.
- O `.env.development.example` deve funcionar **copiado sem nenhuma alteração**: todos os modos simulados ligados, banco local, e-mail no log, segredos de desenvolvimento já preenchidos com valores claramente marcados como inseguros. Clonar, copiar o arquivo e rodar deve bastar.
- O `.env.production.example` traz todas as variáveis vazias ou com valores seguros de exemplo, e cada comentário diz onde conseguir o valor real.

**Banco local para desenvolvimento e testes:**

- Um `docker-compose.dev.yml` sobe o PostgreSQL local. Esse arquivo é só para desenvolvimento; não é Docker de produção. O banco **não está rodando no início do projeto**: a fase 1 cria o arquivo e sobe o banco, e se o Docker Desktop estiver desligado o agente avisa no relatório em vez de dar as migrations como validadas.
- O arquivo de desenvolvimento tem `URL_BANCO` para uso local e `URL_BANCO_TESTES` apontando para **outro banco**. Os testes usam sempre `URL_BANCO_TESTES`, recriam o esquema antes de rodar e nunca tocam os dados de desenvolvimento.

**Travas da produção**, validadas pelo `config.ts` quando `AMBIENTE_APP=production`. Se qualquer uma falhar, o sistema não sobe:

- `JEV_SIMULADO`, `GOOGLE_EMPRESA_SIMULADO` precisam ser `false` e `LLM_PROVEDOR` não pode ser `mock`;
- `PROVEDOR_EMAIL` não pode ser `log`;
- `URL_APP` e `GOOGLE_URI_REDIRECIONAMENTO` precisam usar `https`;
- `SEGREDO_SESSAO` e `CHAVE_CRIPTOGRAFIA` precisam ter o tamanho mínimo e não podem ser iguais aos valores inseguros do `.env.development.example`, que ficam registrados na lista de `padroes-inseguros.ts`;
- `URL_BANCO_TESTES` não pode existir.

Em produção, o `config.ts` também liga automaticamente o `secure` dos cookies.

**Diferenças de comportamento entre os ambientes:**

- desenvolvimento: logs legíveis e detalhados, recarga automática do código, mensagens de erro técnicas na tela;
- produção: logs em JSON, nível `info`, mensagens de erro genéricas para o cliente com um identificador para eu rastrear no log, arquivos do front-end servidos já compilados e com cache.

Regras:

1. **Validação na inicialização**: um módulo `config.ts` lê e valida todas as variáveis com `zod` antes de qualquer outra coisa. Se faltar ou estiver errada alguma variável obrigatória para o modo configurado, o sistema **não sobe** e imprime uma lista clara com cada problema e como corrigir.
2. **Nenhum `process.env` fora de `config.ts`**. O resto do código recebe a configuração já validada e tipada.
3. **Migrações e dados iniciais automáticos**: ao iniciar, o sistema aplica as migrações pendentes e cria os planos iniciais se não existirem, de forma idempotente. Nunca exija comando manual para isso.
4. **Tudo que é recorrente é automático**: renovação de tokens do Google, virada de ciclo dos planos com retomada de jobs pausados, sincronização das avaliações a cada `GOOGLE_INTERVALO_SINCRONIZACAO_HORAS` e retentativas de jobs que falharam por erro temporário.
5. **Recuperação após reinício**: jobs em andamento quando o servidor caiu são retomados automaticamente ao subir de novo.
6. **Nenhum segredo em log, em mensagem de erro para o cliente ou no front-end.**
7. Nos dois arquivos de exemplo, um comentário de uma linha acima de cada variável que precise de explicação diz o que é, onde conseguir e se é obrigatória naquele ambiente. O cabeçalho do arquivo tem no máximo duas linhas; sem blocos longos.

Variáveis mínimas, comuns aos dois arquivos, com os valores de referência de produção. `AMBIENTE_APP` e `NODE_ENV` não entram aqui. Ajuste se a implementação exigir outras, mantendo a mesma regra, e acrescente `URL_BANCO_TESTES` só no de desenvolvimento:

```bash
# Aplicação
URL_APP=https://app.exemplo.com.br   # origem pública do app, usada nos links de e-mail e na checagem de origem (CSRF); em desenvolvimento, a origem do Vite
NOME_NEGOCIO=             # nome do negócio exibido aos clientes; obrigatório nos dois ambientes; no de desenvolvimento, o nome sugerido pelo agente na fase 3
VERSAO_TERMOS=1           # versão dos termos de uso e da política de privacidade aceitos no cadastro; aumente quando o texto mudar; obrigatória nos dois ambientes
PORT=3000
CONFIAR_PROXY=false       # true em produção atrás de proxy reverso (liga trustProxy, para o limite por IP ver o IP real); o proxy também precisa repassar o Host original
SEGREDO_SESSAO=           # string aleatória longa
CHAVE_CRIPTOGRAFIA=       # 32 bytes em base64, para criptografar tokens do Google

# Banco
URL_BANCO=postgres://usuario:senha@host:5432/banco

# E-mail
PROVEDOR_EMAIL=log        # log em desenvolvimento; smtp em produção
SMTP_SERVIDOR=
SMTP_PORTA=
SMTP_USUARIO=
SMTP_SENHA=
EMAIL_REMETENTE=

# Jev
JEV_SIMULADO=false
CHAVE_API_TYPESAFE=
JEV_MODELO=jev-1.13.0
JEV_CONCORRENCIA=10
JEV_PRECO_POR_MTOK=0.042

# LLM
LLM_PROVEDOR=anthropic    # anthropic ou mock
LLM_CHAVE_API=
LLM_MODELO=
LLM_PRECO_ENTRADA_POR_MTOK=
LLM_PRECO_SAIDA_POR_MTOK=
LLM_RESUMO_MAX_TOKENS=1200
RESUMO_LIMIAR_SUSTENTACAO=0.7

# Perguntar ao Jev
PERGUNTAR_MAX_COMENTARIOS=5000

# Google Perfil da Empresa
GOOGLE_EMPRESA_SIMULADO=false
GOOGLE_ID_CLIENTE=
GOOGLE_SEGREDO_CLIENTE=
GOOGLE_URI_REDIRECIONAMENTO=https://app.exemplo.com.br/api/google/callback
GOOGLE_INTERVALO_SINCRONIZACAO_HORAS=24

# Planos e cobrança
PLANO_PADRAO_ID=trial
COBRANCA_ATIVADA=false    # no MVP, sempre false; ligar exige o provedor real, que está fora do escopo

# Frontend
ORIGENS_ESTILO_EXTERNO=https://fonts.googleapis.com   # domínios permitidos para folhas de estilo externas, separados por vírgula
ORIGENS_FONTE_EXTERNA=https://fonts.gstatic.com       # domínios de onde as fontes carregam, separados por vírgula
```

**`URL_SITE` (fase 13):** origem pública da landing e do blog, no domínio principal, enquanto `URL_APP` é o subdomínio do app. A fase 13 acrescenta `URL_SITE=https://exemplo.com.br` aos dois arquivos de exemplo (em desenvolvimento, a origem do Fastify, como `http://localhost:3000`), ao esquema de `config.ts` e às travas de produção (`https` obrigatório, e host diferente do de `URL_APP` nos dois ambientes). O servidor atende os dois domínios pelo `Host` e substitui `%URL_SITE%`, `%URL_APP%` e `%NOME_NEGOCIO%` nas páginas na inicialização, então o build continua sem depender de ambiente.

Com `COBRANCA_ATIVADA=true` e sem provedor real implementado, o sistema não sobe.

`NOME_NEGOCIO` e `VERSAO_TERMOS` são obrigatórias e não têm valor padrão no código (o exemplo de desenvolvimento traz `Nome Provisório` até a fase 3 sugerir o nome): se faltar, o sistema não sobe e a lista de problemas da inicialização a aponta. O nome pode mudar com o tempo; trocá-lo exige apenas editar o arquivo de ambiente e reiniciar o servidor. Nenhum texto de interface nem e-mail escreve o nome fixo: todos usam o espaço reservado `{nomeNegocio}`, e o front-end recebe o nome pela rota pública `GET /api/configuracao-publica`, que devolve só `{ nomeNegocio }` e nenhum outro valor de configuração.

Em desenvolvimento, quando uma variável de modo simulado está `true`, as chaves reais correspondentes deixam de ser obrigatórias. Em produção, modo simulado é proibido.

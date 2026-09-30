# Estrutura do banco PostgreSQL

Nenhuma migration existe no início do projeto: `server/migrations` começa vazia. **Cada fase cria as próprias migrations**, com o SQL exato da seção "Migrations desta fase" do arquivo da fase, e somente as das tabelas que ela usa. O SQL de cada fase já está aprovado por constar na especificação. Qualquer mudança além dele, ou em migration já aplicada, exige minha aprovação. Corrigir uma migration aplicada é sempre criar uma nova migration, nunca editar a antiga.

**O banco local não está rodando no início.** A fase 1 cria o `docker-compose.dev.yml` e sobe o PostgreSQL 16 antes de aplicar qualquer migration. Se o Docker Desktop estiver desligado e o agente não conseguir subi-lo, ele avisa no relatório e **não** declara as migrations como validadas. Uma migration só conta como validada depois de aplicada num PostgreSQL 16 real, duas vezes seguidas, sem erro nem duplicação.

| Fase | Arquivo | Tabelas |
| --- | --- | --- |
| 1 | `0001_extensoes.sql` | extensão pgcrypto e `migracoes_aplicadas` (com `checksum`) |
| 1 | `0002_planos.sql` | `planos` |
| 2 | `0003_contas_usuarios.sql` | `contas`, `usuarios` |
| 2 | `0004_tokens_autenticacao_sessoes.sql` | `tokens_autenticacao`, `sessoes` |
| 2 | `0005_projetos.sql` | `projetos` |
| 4 | `0006_trabalhos.sql` | `trabalhos` |
| 5 | `0007_fontes.sql` | `fontes` |
| 5 | `0008_comentarios.sql` | `comentarios` |
| 6 | `0009_livro_razao_consumo.sql` | `livro_razao_consumo` |
| 7 | `0010_classificacoes_revisoes.sql` | `classificacoes`, `revisoes_classificacao` |
| 9 | `0011_alertas_consumo.sql` | `alertas_consumo` |
| 9 | `0012_execucoes_agendadas.sql` | `execucoes_agendadas` |
| 10 | `0013_conexoes_google.sql` | `conexoes_google` e a chave estrangeira de `fontes` para ela |
| 11 | `0014_resumos_tema.sql` | `resumos_tema` |
| 12 | `0015_perguntas_personalizadas.sql` | `perguntas_personalizadas`, `respostas_perguntas_personalizadas` |

O número da fase e o da migration seguem a mesma ordem de execução. `fontes` já nasce na fase 5 com as colunas de Google; a fase 10 cria `conexoes_google` e acrescenta a chave estrangeira composta `(conexao_google_id, conta_id)` por uma migration nova, sem editar a da fase 5. Desconectar o Google grava `revogado_em` e anula os tokens de `conexoes_google`, sem apagar a linha.

Leia a seção de migrations da fase antes de escrever qualquer repositório.

**Decisões de desenho que o esquema garante:**

- **Isolamento pelo próprio banco**: as tabelas filhas referenciam o pai pela dupla `(id, conta_id)`, inclusive `trabalhos` e `tokens_autenticacao`. Assim o banco recusa, por exemplo, um comentário da conta B num projeto da conta A, mesmo que o código erre. As colunas que só registram autoria (`criado_por`, `revisado_por`, `conectado_por`) usam chave estrangeira simples com `ON DELETE SET NULL`, porque anular um par com `conta_id` obrigatório é impossível.
- **Exclusão em cascata**: apagar uma conta ou um projeto remove tudo que depende deles.
- **Livro-razão preservado**: `livro_razao_consumo` guarda `conta_ref` sem chave estrangeira; quando a conta é apagada, `conta_id` vira nulo e o registro de custo permanece, sem nenhum texto.
- **Retomada exata dos jobs**: o progresso é derivado dos dados. A classificação retoma pelos comentários com `status_classificacao = 'pending'`; uma pergunta retoma pelos comentários do filtro sem linha em `respostas_perguntas_personalizadas`.
- **Avaliações só com estrelas**: gravadas com texto nulo e `status_classificacao = 'no_text'`; o banco impede que um comentário sem texto fique pendente de classificação.
- **Cache de resumos**: o índice único com `hash_dados`, que ignora os resumos `failed`, impede gerar duas vezes o mesmo resumo para os mesmos dados sem impedir tentar de novo depois de uma falha.
- **Um job ativo por vez**: índices únicos parciais em `trabalhos` impedem dois jobs ativos de classificação por projeto, de sincronização do Google por projeto e de execução da mesma pergunta.
- **Migrations à prova de adulteração**: `migracoes_aplicadas.checksum` guarda o SHA-256 de cada arquivo aplicado, e o executor recusa iniciar se um arquivo já aplicado mudou.

**Regras de preenchimento que o código deve seguir:**

- `hash_conteudo` de upload: SHA-256 do texto normalizado mais data, unidade e autor, se houver. Comentários idênticos de datas, unidades ou autores diferentes deixam de colapsar; a reimportação do mesmo arquivo com o mesmo mapeamento continua idempotente. `hash_conteudo` do Google: SHA-256 de `google:` seguido do `reviewId`.
- Quando uma avaliação do Google volta alterada na sincronização, pelo `updateTime`, atualize o texto, `fonte_atualizada_em` e `texto_mascarado`, apague a classificação, a revisão humana (`revisoes_classificacao`) e as respostas de perguntas daquele comentário, e volte o status para `pending`. Se o novo `comment` vier vazio, grave `texto_original` e `texto_mascarado` nulos e o status `no_text`, porque o banco não aceita comentário sem texto como `pending`.
- `gravidade_normalizada` é `gravidade_pontuacao` dividido pelo índice do nível mais alto.
- A soma do consumo do ciclo é feita sobre `livro_razao_consumo` filtrando por `conta_ref` e `ciclo_iniciado_em` igual ao ciclo atual da conta, considerando `real_usd` dos `settled` e `reservado_usd` dos `reserved`.
- Reservas com status `reserved` há mais de 15 minutos são liberadas por uma tarefa agendada, para uma queda do servidor não prender saldo.
- A tabela `sessoes` é usada por um armazenamento de sessão próprio, escrito para o `@fastify/session`, que grava `usuario_id` para permitir encerrar todas as sessões de um usuário ou de uma conta. O momento de criação da sessão fica em `dados`, para aplicar o limite absoluto de duração.
- `usuarios.termos_aceitos_em` e `versao_termos` são preenchidos no cadastro e na aceitação de convite, com o valor de `VERSAO_TERMOS`.
- Valores de USD do livro-razão são lidos e somados como inteiros em unidades de 1e-8 USD, nunca como `number` de ponto flutuante.
- Comentários sem `comentado_em` entram nos totais e na lista, mas ficam fora de qualquer filtro de período e de qualquer variação entre períodos.
- A tarefa agendada de limpeza apaga sessões e tokens expirados.
- Tópicos não têm restrição no banco, porque a lista vive em `questions.ts`; o repositório valida contra ela.
- Cada fase que cria tabela de dados de cliente estende o teste de isolamento entre contas e o teste de exclusão de projeto e de conta para cobrir as tabelas novas.

# Fase 5: Upload e importação

**Entrega 1.** Depende de: fases 3 e 4.

## Leia antes

- `AGENTS.md`
- `docs/spec/referencia/tecnologias.md`
- `docs/spec/referencia/padroes-de-engenharia.md`, seções de arquitetura e segurança
- `docs/spec/referencia/estrutura-server.md`, módulos `uploads` e `comments`, e `scripts`
- `docs/spec/referencia/estrutura-web.md`, funcionalidade `upload`
- `docs/spec/referencia/auxiliar-de-design-mobbin.md`, para consultar referências de design antes de desenhar as telas
- `docs/spec/referencia/banco-de-dados.md`, tabelas `fontes` e `comentarios`, e as regras de preenchimento

## Nesta fase

- **Migrations desta fase:** crie em `server/migrations` os dois arquivos da seção "Migrations desta fase", com o SQL exato dela, e aplique-os. A chave estrangeira de `fontes.conexao_google_id` para `conexoes_google` só nasce na fase 10.
- Módulo `uploads` com envio, prévia, sugestão de mapeamento e confirmação, a pasta `parsing` e `limpeza-envios.ts`.
- Módulo `comments`: `anonimizador.ts`, `hash-conteudo.ts` e inserção em lote idempotente. Os comentários importados ficam com `status_classificacao = 'pending'`.
- Handler `importar-envio`, registrado no executor da fase 4. O arquivo enviado fica em `server/tmp/uploads` com nome gerado pelo servidor e é apagado logo após a importação.
- Gancho de recuperação, registrado na fase 4, que chama `limpeza-envios.ts` na inicialização.
- `scripts/dev-semear-demo.ts`, comando `dev:semear-demo`: cria uma conta de demonstração com usuário confirmado, um projeto e 1.000 comentários gerados por semente fixa; recusa rodar em produção. Cada fase seguinte estende o script com os dados que ela cria.
- Tela de upload em `features/upload`: envio, prévia das 10 primeiras linhas, mapeamento de colunas, progresso do job e resumo com quantidade importada, ignorada e duplicada.

## Especificação

### Fonte 1: upload de CSV e Excel

Requisitos:

1. Aceitar `.csv` e `.xlsx` até 20 MB e até 50.000 linhas no MVP. Rejeitar acima disso com mensagem clara. Arquivos `.xls` antigos não são suportados pela biblioteca escolhida: rejeite com a orientação de salvar como `.xlsx` no Excel.
2. **CSV brasileiro**: detectar automaticamente separador `;` ou `,` e codificação UTF-8 ou Windows-1252, porque planilhas exportadas pelo Excel em português costumam vir com ponto e vírgula e acentuação em Windows-1252. Remover BOM.
3. **Excel**: usar a primeira aba por padrão e permitir escolher outra.
4. Depois do upload, mostrar uma **prévia das 10 primeiras linhas** e pedir ao usuário para mapear as colunas:
   - obrigatória: coluna do comentário;
   - opcionais: data, nota, unidade ou local, autor.
5. Tentar sugerir o mapeamento automaticamente por nome de coluna, como "comentário", "comment", "feedback", "observação", "avaliação", mas sempre deixar o usuário confirmar.
6. Ignorar linhas com comentário vazio ou com menos de 3 caracteres úteis, e contar quantas foram ignoradas.
7. Datas: aceitar `dd/mm/aaaa`, `aaaa-mm-dd` e datas seriais do Excel. Se não conseguir interpretar, gravar nulo e seguir.
8. Deduplicar pelo `hash_conteudo`, calculado como SHA-256 do texto normalizado em minúsculas e sem espaços duplicados, mais data, unidade e autor, se houver. Linhas idênticas em todos esses campos contam como duplicadas.
9. Processar a importação num job em segundo plano e mostrar o progresso. Um projeto pode ter vários envios em andamento ao mesmo tempo.

**Segurança do envio:**

- **Validar pelo conteúdo, não pela extensão nem pelo tipo declarado.** Um `.xlsx` precisa começar com a assinatura ZIP e conter `xl/workbook.xml`; um `.csv` não pode ter bytes nulos. Arquivo que não passar é rejeitado com "arquivo inválido" e apagado.
- **Excel sem estourar memória:** leia o XLSX em modo de fluxo (`exceljs` em streaming) e recuse arquivo cujo conteúdo descompactado passe de um limite em constante nomeada, contra arquivos comprimidos para inflar.
- **Nome e caminho:** o arquivo em disco usa nome gerado pelo servidor e nunca o nome enviado pelo cliente. O envio pertence à conta que o criou e nenhuma rota o entrega a outra.
- **Ciclo de vida do envio, sem tabela nova:** o arquivo fica em `server/tmp/uploads/<contaId>/<nome gerado>`, e a pasta da conta é a prova de posse; toda rota resolve o caminho pela `contaId` da sessão. O identificador devolvido ao cliente é o nome gerado. A linha em `fontes` (tipo `upload`, `nome` com o nome original do arquivo limpo) é criada quando o cliente confirma o mapeamento e o job `import_upload` é criado, e o `fonte_id` vai na carga do job.
- **Arquivos órfãos:** se o servidor cair ou o cliente abandonar o mapeamento, sobra arquivo em `server/tmp/uploads`. O gancho de recuperação apaga arquivos com mais de 24 horas que não pertencem a nenhum job ativo, tempo suficiente para o cliente ler a prévia e mapear as colunas. A fase 9 agenda a mesma limpeza periodicamente.

---

### Anonimização antes da classificação

Antes de enviar qualquer texto ao Jev, gerar `texto_mascarado` substituindo no código, por expressões regulares:

- CPF, com ou sem pontuação, por `[CPF]`;
- CNPJ por `[CNPJ]`;
- e-mail por `[EMAIL]`;
- telefone brasileiro, fixo ou celular, com ou sem DDD e `+55`, por `[TELEFONE]`;
- CEP, com hífen ou precedido da palavra "CEP", por `[CEP]`.

Só `texto_mascarado` é enviado a qualquer serviço de IA, seja Jev ou LLM. `texto_original` fica no banco e só é exibido aos usuários da própria conta. Cubra a anonimização com testes unitários com pelo menos 15 casos, incluindo falsos positivos que **não** devem ser mascarados, como valores em reais, datas e números de pedido.

**Limite conhecido:** expressões regulares não pegam nomes de pessoas, endereços por extenso, RG e outros identificadores escritos livremente. Isso não é mascarado, e a política de privacidade da fase 3 diz isso ao cliente.

## Migrations desta fase

Crie os arquivos abaixo em `server/migrations`, com este SQL exato.

```sql
-- 0007_fontes.sql
CREATE TABLE fontes (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id                 uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  projeto_id               uuid NOT NULL,
  tipo                     text NOT NULL CHECK (tipo IN ('upload', 'google_business')),
  nome                     text NOT NULL,
  conexao_google_id        uuid,
  nome_unidade_google      text,
  metadados                jsonb NOT NULL DEFAULT '{}'::jsonb,
  ultima_sincronizacao_em  timestamptz,
  criado_em                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, conta_id),
  FOREIGN KEY (projeto_id, conta_id) REFERENCES projetos(id, conta_id) ON DELETE CASCADE,
  CHECK (tipo <> 'google_business' OR nome_unidade_google IS NOT NULL)
);
CREATE INDEX fontes_projeto_id_idx ON fontes (projeto_id);
CREATE INDEX fontes_conta_id_idx ON fontes (conta_id);
CREATE UNIQUE INDEX fontes_unidade_google_unica
  ON fontes (projeto_id, nome_unidade_google) WHERE tipo = 'google_business';

-- 0008_comentarios.sql
CREATE TABLE comentarios (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id                  uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  projeto_id                uuid NOT NULL,
  fonte_id                  uuid NOT NULL,
  id_externo                text,
  texto_original            text,
  texto_mascarado           text,
  foi_truncado              boolean NOT NULL DEFAULT false,
  nota                      smallint CHECK (nota BETWEEN 1 AND 5),
  nome_unidade              text,
  nome_autor                text,
  comentado_em              timestamptz,
  fonte_atualizada_em       timestamptz,
  hash_conteudo             text NOT NULL,
  status_classificacao      text NOT NULL DEFAULT 'pending'
                            CHECK (status_classificacao IN ('pending', 'done', 'no_text', 'failed')),
  tentativas_classificacao  integer NOT NULL DEFAULT 0,
  erro_classificacao        text,
  criado_em                 timestamptz NOT NULL DEFAULT now(),
  atualizado_em             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, conta_id),
  FOREIGN KEY (projeto_id, conta_id) REFERENCES projetos(id, conta_id) ON DELETE CASCADE,
  FOREIGN KEY (fonte_id, conta_id) REFERENCES fontes(id, conta_id) ON DELETE CASCADE,
  CHECK ((texto_original IS NULL) = (texto_mascarado IS NULL)),
  CHECK (texto_original IS NOT NULL OR status_classificacao = 'no_text')
);
CREATE UNIQUE INDEX comentarios_projeto_hash_unico ON comentarios (projeto_id, hash_conteudo);
CREATE UNIQUE INDEX comentarios_fonte_externo_unico
  ON comentarios (fonte_id, id_externo) WHERE id_externo IS NOT NULL;
CREATE INDEX comentarios_conta_id_idx ON comentarios (conta_id);
CREATE INDEX comentarios_projeto_comentado_em_idx ON comentarios (projeto_id, comentado_em DESC);
CREATE INDEX comentarios_projeto_status_idx ON comentarios (projeto_id, status_classificacao);
CREATE INDEX comentarios_projeto_unidade_idx ON comentarios (projeto_id, nome_unidade);
```

## Testes desta fase

- Parser de CSV com `;` e com `,`.
- Codificação Windows-1252 e UTF-8 com BOM.
- Datas em `dd/mm/aaaa`, `aaaa-mm-dd` e seriais do Excel.
- Anonimização com pelo menos 15 casos, incluindo CEP e falsos positivos que não devem ser mascarados.
- Deduplicação e reimportação do mesmo arquivo sem duplicar; comentários iguais de datas, unidades ou autores diferentes não colapsam.
- `.xls` rejeitado com a orientação de salvar como `.xlsx`.
- Arquivo com extensão `.xlsx` mas conteúdo que não é ZIP, e CSV com bytes nulos, são rejeitados e apagados.
- Limites de 20 MB, 50.000 linhas e de tamanho descompactado.
- O nome do arquivo em disco não vem do cliente, e um envio não é acessível por outra conta.
- Arquivos órfãos com mais de 24 horas são apagados na inicialização, sem tocar nos de jobs ativos nem nos mais novos.
- Uma importação interrompida no meio termina sozinha depois da recuperação de jobs, sem duplicar comentários.
- Isolamento e exclusão: as rotas de envio só devolvem dados da própria conta, e apagar projeto e conta removem `fontes` e `comentarios`.
- Testes de componentes da tela de upload: mapeamento de colunas exige a coluna do comentário e a prévia mostra 10 linhas.
- As migrations desta fase aplicadas duas vezes sem erro.

## Pronto quando

1. Subir um CSV exportado de um Excel em português com 1.000 linhas, mapear a coluna e ver a importação concluir com a contagem de importados, ignorados e duplicados.
2. Subir o mesmo arquivo de novo e ver zero comentários novos.
3. Subir um `.xls` e ver a orientação correta.
4. Parar o servidor no meio de uma importação grande, subir de novo e ver a importação terminar sozinha.
5. As migrations desta fase aplicadas num PostgreSQL 16 real, duas vezes, sem erro.

## Fora desta fase

- Classificação e qualquer chamada ao Jev.
- Fonte Google.

## Antes de parar

Passe pela lista de `AGENTS.md`. Confira também:

- [ ] Reimportar o mesmo arquivo não duplica comentários.
- [ ] Só `texto_mascarado` é gravado para uso por IA, e `texto_original` nunca sai da conta.
- [ ] Todo envio é validado pelo conteúdo e apagado do disco ao fim ou na limpeza.
- [ ] Os testes de isolamento e de exclusão cobrem as tabelas novas.

Entregue o relatório e espere minha confirmação. Não comece a próxima fase.

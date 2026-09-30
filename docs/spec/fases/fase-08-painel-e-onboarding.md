# Fase 8: Painel, revisão, exportação e onboarding

**Entrega 1.** Depende de: fase 7.

## Leia antes

- `AGENTS.md`
- `docs/spec/referencia/tecnologias.md`, gráficos
- `docs/spec/referencia/configuracao.md`, variáveis `JEV_*`
- `docs/spec/referencia/interface-visual.md`
- `docs/spec/referencia/auxiliar-de-design-mobbin.md`
- `docs/spec/referencia/padroes-de-engenharia.md`, seções de arquitetura e segurança
- `docs/spec/referencia/estrutura-server.md`, módulos `dashboard`, `comments`, `classification` e `usage` (só `controle-custo.servico.ts`), e `shared`
- `docs/spec/fases/fase-06-controle-de-custo.md`, a fronteira do módulo `usage` e a estimativa de consumo
- `docs/spec/referencia/estrutura-web.md`, funcionalidades `dashboard`, `comments`, `review-queue` e `onboarding`
- `docs/spec/referencia/banco-de-dados.md`, tabelas `comentarios`, `classificacoes` e `revisoes_classificacao`

## Nesta fase

- Módulo `dashboard`: `painel.rotas.ts`, `painel.servico.ts` com os números e séries dos gráficos, `exportacao.servico.ts`, e `shared/safe-csv.ts`, que neutraliza células de texto que o Excel interpretaria como fórmula e fica em `shared/` porque a fase 12 também o usa.
- Módulo `comments`: `comentarios.rotas.ts`, `filtros-comentarios.ts` traduzindo os filtros da tela em SQL parametrizado, e paginação. Respostas e exportação usam a correção humana quando existir.
- Fila de revisão: correção de tema e sentimento gravada em `revisoes_classificacao` pelo `revisoes.repositorio`, sem apagar a resposta original do modelo.
- Tela de iniciar a classificação, com a estimativa de consumo em porcentagem do plano (por `estimarConsumoDoPlano`, da fase 6) e o progresso, e o aviso de que o usuário precisa confirmar o e-mail quando ainda não confirmou. Mostra também quantos comentários falharam e um botão "Reprocessar falhas", que usa a rota criada na fase 7, e uma **estimativa de tempo**, calculada no servidor: comentários pendentes dividido pela vazão efetiva em requisições por minuto, em minutos arredondados para cima. A vazão efetiva é o menor entre `JEV_CONCORRENCIA × 60 ÷ LATENCIA_MEDIA_JEV_SEGUNDOS` (constante nomeada, valor inicial 1) e 1.200 (limite de taxa do Jev, constante nomeada).
- Web: `components/charts`, `features/dashboard`, `features/comments`, `features/review-queue`, `features/onboarding`, `painel.api.ts` e `comentarios.api.ts`.
- Arquivo de exemplo para download em `web/public/exemplo-comentarios.csv`, com 100 comentários fictícios em português, separador `;` e UTF-8 com BOM, **gerado por `scripts/gerar-fixtures.ts`** com semente fixa, e não escrito à mão.- A opção de conectar o Google no onboarding só aparece a partir da fase 10. Deixe o passo preparado.

## Especificação

### Onboarding guiado

O cliente precisa chegar ao primeiro resultado sem ajuda. Depois do cadastro, mostre um passo a passo com progresso visível:

1. criar o primeiro projeto;
2. escolher a fonte: subir planilha ou conectar Google;
3. mapear colunas ou escolher unidades;
4. ver quanto do plano a classificação deve consumir e iniciar;
5. ver o painel.

Ofereça um **arquivo de exemplo para download** com 100 comentários fictícios, para o cliente testar antes de usar dados reais. Toda tela com estado vazio explica o próximo passo. Toda mensagem de erro diz o que o cliente deve fazer, sem jargão técnico.

---

### Painel e exportação

1. Cartões de resumo: total de comentários, classificados, pendentes de revisão, nota média quando houver.
2. Gráfico de barras por tema, dividido por sentimento.
3. Gráfico de distribuição de gravidade.
4. Filtros por fonte, unidade, tema, sentimento, período e "precisa de ação", este último por `precisa_acao >= LIMIAR_PRECISA_ACAO` (`shared/thresholds.ts`, fase 7). Comentários sem data ficam fora do filtro de período, mas aparecem quando ele está vazio.
5. Lista paginada com o comentário original, os rótulos em português, a confiança e um indicador visual de revisão.
6. **Fila de revisão**: comentários com `precisa_revisao` e sem linha em `revisoes_classificacao` (ao ser corrigido, o comentário sai da fila e do contador "pendentes de revisão"). A listagem e a gravação da correção ficam em `comentarios.rotas.ts`. O usuário corrige o usuário corrige tema e sentimento. A correção humana é gravada separadamente e prevalece na exibição e na exportação, sem apagar a resposta original do modelo.
7. Exportar CSV com separador `;` e UTF-8 com BOM, para abrir direto no Excel em português, contendo comentário original, fonte, unidade, autor, data, nota, tema, sentimento, gravidade, precisa de ação, confiança e se foi revisado.
8. **Proteção contra injeção de fórmula:** em toda célula de texto do CSV (comentário, unidade, autor, fonte), se o valor começar com `=`, `+`, `-`, `@`, tabulação ou retorno de carro, o `safe-csv.ts` prefixa uma aspa simples `'` para o Excel tratar como texto. Colunas numéricas não são alteradas.

## Testes desta fase

- Exportação em CSV com `;`, UTF-8 com BOM e acentos corretos.
- Filtros geram SQL parametrizado e a paginação é correta.
- A correção humana prevalece na tela, nos contadores e na exportação, e a resposta original do modelo continua gravada.
- Nenhuma rota devolve comentários de outra conta.
- Célula que começa com `=`, `+`, `-`, `@`, tabulação ou retorno de carro sai neutralizada no CSV, e texto comum e números ficam intactos.
- `member` consegue filtrar, revisar e exportar; usuário sem e-mail confirmado vê o aviso e não inicia a classificação.
- Testes de componentes: filtros do painel, fila de revisão (corrigir tema e sentimento) e o passo a passo do onboarding.
- O gráfico de barras renderiza sem violação da CSP `style-src 'self'` (sem estilo bloqueado no console); se o `recharts` exigir `<style>` injetado, registre a decisão no relatório antes de afrouxar a CSP.
- O script `gerar-fixtures.ts` gera o mesmo CSV a cada execução, e o CSV traz 100 linhas com acentos e separador `;`.
- A estimativa de tempo da tela de classificação bate com o cálculo descrito, incluindo o arredondamento para cima.
- Comentários sem data não entram no filtro de período, e o filtro vazio os inclui.

## Pronto quando

1. Classificar tudo e ver o painel com os gráficos e filtros funcionando.
2. Corrigir um comentário na fila de revisão e ver a correção refletida no painel.
3. Exportar o CSV e abrir no Excel com os acentos corretos.
4. Um usuário novo chega ao primeiro resultado usando só o passo a passo e o arquivo de exemplo, sem ajuda.

## Fora desta fase

- Resumo executivo, perguntas livres e Google.

## Antes de parar

Passe pela lista de `AGENTS.md`. Confira também:

- [ ] Nada visual se repete sem estilo compartilhado.
- [ ] Nenhum valor em dólar, token ou nome de modelo aparece ao cliente.
- [ ] Toda exportação em CSV passa pelo `shared/safe-csv.ts`.

Entregue o relatório e espere minha confirmação. Não comece a próxima fase.

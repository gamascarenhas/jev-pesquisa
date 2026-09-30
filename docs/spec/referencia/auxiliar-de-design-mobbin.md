# Mobbin: auxiliar de design

O Mobbin é uma biblioteca de referências de interface (telas, fluxos e seções de sites reais). O agente o consulta pelo MCP **enquanto desenha as telas**. Ele é ferramenta de desenvolvimento, **não** parte do produto: nada aqui entra em runtime, em `package.json`, em `.env.*` ou em `config.ts`.

Fonte: documentação oficial em `docs.mobbin.com` (visão geral, MCP, recursos, clientes, criar integração, limites, créditos de IA, revogação, início rápido da API) e as descrições das próprias ferramentas do servidor. O que a documentação não informa está marcado como "não confirmado".

## 1. Como o Mobbin funciona (fatos confirmados)

| Tema | Como é |
| --- | --- |
| Acesso | MCP para agentes de IA (planos Pro, Team e Enterprise) e REST API (só Team e Enterprise, com chave de API do workspace). **Usamos só o MCP.** |
| Endereço do MCP | `https://api.mobbin.com/mcp`, transporte Streamable HTTP. |
| Autenticação | OAuth pelo navegador na primeira conexão, sem chave manual. Registro dinâmico de cliente (RFC 7591), PKCE `S256`, escopo `openid`, com token de acesso e de atualização. Quem usa um SDK de MCP não implementa isso à mão. |
| Ferramentas | `search_screens` (telas), `search_flows` (fluxos de vários passos, como onboarding e checkout) e `search_sections` (seções de sites, como preços e rodapé). |
| Resultado | Imagens de baixa resolução inline para o agente ler, `image_url` em alta resolução, `mobbin_url` como link canônico e metadados. |
| Validade | `image_url` **expira em 30 dias**. |
| Limite de taxa | 60 requisições por 60 segundos por usuário no MCP. Excedeu: HTTP 429 com cabeçalho `Retry-After`; a documentação manda respeitar o tempo e usar backoff exponencial com jitter. |
| Créditos de IA | A busca `deep` custa 5 créditos por consulta bem-sucedida, e cada chamada cobra separadamente, com qualquer número de resultados. A busca `standard`, navegar, salvar e baixar não custam. Pro tem 300 créditos por mês (60 buscas `deep`); Team e Enterprise, 600 por membro, sem somar entre membros. Renova no aniversário da assinatura, sem acumular. A cobrança entra em beta a partir de 5 de outubro de 2026, e nesse período ultrapassar a cota não gera cobrança; depois do beta a busca `deep` pausa até a renovação. Falha ou erro do lado do Mobbin não desconta. |
| Revogação | Configurações da conta, seção MCP, lista de clientes conectados, menu do cliente, revogar. Vale na hora, e reconectar é possível a qualquer momento. |

## 2. Conexão (uma vez só)

- Preferência oficial: instalar o conector do Mobbin no Claude Desktop e Web, e o Claude Code herda o acesso.
- Alternativa só pelo terminal: `claude mcp add mobbin --scope user --transport http https://api.mobbin.com/mcp`, depois `/mcp` e escolher autenticar. O escopo `user` guarda a conexão fora do repositório, então nenhum token vai para o projeto.
- O agente **não** implementa OAuth, não guarda token e não usa a REST API. Se o servidor pedir autenticação, o agente diz isso no relatório e o usuário autoriza no navegador (`! claude /mcp`). É uma ação de uma vez só, porque o token de atualização renova o acesso sozinho.
- Sem plano, sem autenticação ou com o servidor fora do ar: siga com `interface-visual.md`, diga no relatório e **nunca cite referência que não foi devolvida pela ferramenta**.

## 3. Protocolo de uso pelo agente

**Quando consultar:** antes de desenhar cada tela ou fluxo novo listado na seção 4, e no plano de design da fase 3. Não consulte para ajustar detalhe de tela já desenhada.

**Qual ferramenta:**

- `search_screens` com `platform: "web"` para telas do aplicativo. Nunca `ios`: o produto é web.
- `search_flows` para jornadas (cadastro, onboarding, upload com mapeamento, conexão de conta externa).
- `search_sections` para as páginas públicas: a landing e o blog da fase 13 (apresentação, como funciona, perguntas frequentes, rodapé, lista e página de artigo). O painel do app não é seção de site.

**Como preencher os parâmetros:**

- `query`: uma tela ou um fluxo por chamada, em linguagem simples, com os elementos que se veem e como se relacionam. Sem negações, sem palavras vagas de estilo ("moderno", "limpo"), sem juntar várias telas e sem a plataforma no texto.
- `task_intent`: uma frase curta em inglês, **idêntica em todas as chamadas da mesma tarefa**.
- `output_destination: "code"` (a tela vai para código React), **idêntico em todas as chamadas da mesma tarefa**. `output_tool` fica ausente.
- `mode`: **sempre explícito**. O padrão da ferramenta é `deep`, que gasta créditos. Use `standard` por padrão (não gasta crédito). Use `deep` só para consulta sutil em que `standard` já falhou, com no máximo **5 consultas `deep` por fase**, e registre cada uma no relatório. Não use o valor `fast`, apelido descontinuado de `standard`.
- `limit`: 8 para telas e seções (o padrão é 20, com máximo de 30, e mais resultados enchem o contexto) e 3 para fluxos (padrão 5, máximo 10).
- `exclude_screen_ids` para não rever o que já foi visto; `page` para avançar em fluxos e seções (máximo 20 em fluxos).
- `image_format`: mantenha o padrão `webp`; use `jpg` só se o cliente não exibir `webp`.

**Privacidade:** `query` e `task_intent` descrevem só a interface. Nunca incluem texto de comentário, dados de cliente, e-mails, segredos ou mensagens literais do usuário. É o princípio 8 de `AGENTS.md` aplicado a mais um serviço externo.

**Limite de taxa:** faça as chamadas em sequência, sem rajadas. Em 429, espere o `Retry-After`, tente de novo com backoff exponencial e jitter, no máximo 3 vezes, e então pare e relate. Nunca repita em laço.

**Ler o resultado:**

- Olhe as imagens devolvidas. Não descreva uma tela só pelos metadados.
- Toda tela citada no relatório ou no plano de design vai como link Markdown para o seu `mobbin_url`.
- Se o resultado trouxer `ai_usage_notice`, mostre o texto **palavra por palavra**, em bloco próprio depois dos resultados, sem resumir nem juntar a outro texto.

**Imagens e direitos:**

- `image_url` expira e as telas pertencem a outros produtos. **Nenhuma imagem do Mobbin entra no repositório**, nem em `web/public`. Para inspecionar em alta resolução, baixe para uma pasta temporária fora do projeto.
- O que fica registrado é o `mobbin_url` e a decisão tirada dele.

**Referência não é cópia:**

- Extraia padrões: estrutura, hierarquia, densidade, estados vazios e de erro, ordem dos passos. Não reproduza a identidade visual de outro produto.
- Em conflito, **`interface-visual.md` e o plano de design aprovado vencem**: cores, fontes, tokens, componentes base, a regra dos três usos e os textos em `i18n/pt-BR.ts`. Um valor visto numa referência só entra no código como token dos arquivos de estilo.

**Registro:** o relatório da fase traz, dentro de "decisões tomadas", uma linha por referência usada: `tela ou fluxo → mobbin_url → o que foi adotado`, além das consultas `deep` feitas. Sem referência consultada, uma linha dizendo o motivo.

## 4. Consultas por fase

Sugestão de partida; o agente ajusta a `query` ao que a tela realmente tem.

| Fase | O que consultar |
| --- | --- |
| 3 | estrutura do aplicativo (barra superior e navegação lateral), cadastro e login, lista de projetos, configurações com usuários e convites, confirmação de exclusão digitando o nome, esboço do painel para o plano de design |
| 5 | fluxo de upload de arquivo com mapeamento de colunas e resultado da importação |
| 8 | painel de análise com cartões e gráficos, tabela com filtros e paginação, fila de revisão, fluxo de onboarding com progresso |
| 9 | medidor de uso do plano, aviso de limite, tela de planos e uso |
| 10 | fluxo de conexão de conta externa por OAuth e seleção de unidades |
| 11 | cartões de resumo com achados e evidências |
| 12 | campo de pergunta em linguagem natural, confirmação da interpretação e resultado em faixas |
| 13 | seções de landing (apresentação com chamada para cadastro, como funciona em passos, perguntas frequentes, rodapé) com `search_sections`, e lista e página de artigo de blog |

## 5. O que o Mobbin não herda das regras do projeto

Como é auxiliar de desenvolvimento, e não serviço do produto, fica de fora:

- a regra de serviços externos atrás de interface com versão simulada (princípio 3);
- a reserva e a liquidação de custo no `livro_razao_consumo` (princípio 7); o controle dos créditos é o do próprio Mobbin, pelos tetos da seção 3;
- variáveis de ambiente, travas de produção, migrations, repositórios e módulos em `server/`;
- as regras de exibição de custo ao cliente, porque nenhum dado do Mobbin chega ao cliente.

A REST API do Mobbin, qualquer chamada em runtime e qualquer uso pelo produto continuam **fora de escopo** (`fora-de-escopo.md`).

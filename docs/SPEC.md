# Especificação: análise de comentários com Jev e LLM

Este arquivo é o índice. Os detalhes de cada parte ficam em `docs/spec/`. Regras que valem para todas as fases ficam em `AGENTS.md`.

## Contexto

Estou construindo um produto para empresas médias e grandes que transforma milhares de comentários escritos por clientes e funcionários em informação organizada. Hoje essas empresas leem só uma amostra e perdem padrões importantes.

O motor de classificação é o **Jev**, modelo da TypeSafe AI. Ele não gera texto: recebe um contexto chamado `state` e um mapa de perguntas tipadas, e devolve para cada pergunta uma resposta estruturada com probabilidades. É barato e rápido o bastante para classificar cada comentário individualmente.

O produto é um **SaaS self-service**: cada empresa cliente cria a própria conta, conecta as próprias fontes e usa o sistema sozinha, sem nenhuma intervenção manual minha. Tudo que exigiria suporte humano deve ser resolvido pela interface.

Este é o **MVP**. Simplicidade vence completude, mas isolamento de dados entre clientes e controle de custo não são negociáveis.

## O que o cliente consegue fazer

A aplicação web permite que o cliente:

0. **Cria a conta da empresa**, confirma o e-mail, faz login e começa no plano inicial.
1. Cria um **projeto de análise**.
2. Traz comentários por uma de duas fontes:
   - **Upload de arquivo** CSV ou Excel, mapeando qual coluna contém o comentário.
   - **Conexão com o Perfil da Empresa no Google**, antigo Google Meu Negócio, importando as avaliações de uma ou mais unidades.
3. Dispara a **classificação** de todos os comentários pelo Jev.
4. Vê um **painel** com a distribuição por tema, sentimento e gravidade, uma lista filtrável dos comentários classificados, e a fila de comentários com baixa confiança para revisão humana.
5. Gera no topo do painel um **resumo executivo por tema**, escrito por um LLM em cima das decisões do Jev e verificado antes de aparecer.
6. **Pergunta ao Jev** qualquer coisa sobre os comentários, num campo de texto livre no painel, e vê quais comentários respondem sim, ordenados pela probabilidade.
7. **Exporta** o resultado em CSV.
8. **Apaga** projetos, desconecta o Google ou encerra a conta, com remoção real dos dados.

## Vocabulário

- **Área administrativa** é o próprio `web/`: a aplicação logada em que o cliente (o `owner` de cada empresa) administra usuários, projetos, plano, consumo e dados. Ela nasce nas fases 3, 8, 9 e seguintes, e não existe painel separado nem papel de administrador do SaaS.
- **Site público** é a landing page e o blog da fase 13, feitos por último, quando o produto inteiro estiver pronto.

## Fases

Execute na ordem da tabela. Cada fase é uma sessão própria do agente.

| Fase | Assunto | Arquivo | Entrega |
| --- | --- | --- | --- |
| 1 | Infraestrutura | `docs/spec/fases/fase-01-infraestrutura.md` | 1 |
| 2 | Contas e acesso | `docs/spec/fases/fase-02-contas-e-acesso.md` | 1 |
| 3 | Fundação visual | `docs/spec/fases/fase-03-fundacao-visual.md` | 1 |
| 4 | Fila de jobs | `docs/spec/fases/fase-04-fila-de-jobs.md` | 1 |
| 5 | Upload e importação | `docs/spec/fases/fase-05-upload.md` | 1 |
| 6 | Controle de custo | `docs/spec/fases/fase-06-controle-de-custo.md` | 1 |
| 7 | Classificação com o Jev | `docs/spec/fases/fase-07-classificacao.md` | 1 |
| 8 | Painel, revisão, exportação e onboarding | `docs/spec/fases/fase-08-painel-e-onboarding.md` | 1 |
| 9 | Planos e ciclos | `docs/spec/fases/fase-09-planos-e-ciclos.md` | 2 |
| 10 | Google Perfil da Empresa | `docs/spec/fases/fase-10-google.md` | 3 |
| 11 | Resumo executivo por tema | `docs/spec/fases/fase-11-resumo-executivo.md` | 3 |
| 12 | Perguntar ao Jev | `docs/spec/fases/fase-12-perguntar-ao-jev.md` | 3 |
| 13 | Landing page e blog | `docs/spec/fases/fase-13-landing-e-blog.md` | 4 |

O número da fase é a ordem de execução, e o mesmo número aparece nas referências entre arquivos e na ordem das migrations.

As migrations do banco não existem no início: cada fase cria as suas, com o SQL da própria spec. O PostgreSQL local também não está rodando no início; a fase 1 o sobe pelo Docker.

- **Entrega 1, prova de valor** (fases 1 a 8): um cliente real cria a conta, sobe planilhas, classifica e usa o painel. Nesta entrega, defina limites de custo generosos nos planos, porque um job pausado por limite só retoma sozinho, sem eu editar o seed, quando a fase 9 existir.
- **Entrega 2, operação autônoma** (fase 9): planos, consumo visível, avisos e virada de ciclo automática. A cobrança real fica para depois: a fase 9 deixa só a interface pronta.
- **Entrega 3, diferenciais** (fases 10 a 12): Google, resumo executivo e perguntas livres. O resumo precisa do painel; as perguntas precisam do resumo, porque reutilizam o `ProvedorLlm`.

- **Entrega 4, aquisição** (fase 13): landing page e blog em Markdown, pré-renderizados para SEO, depois de o produto inteiro estar pronto.

## Arquivos de referência

Cada fase lista os que precisa. Todos ficam em `docs/spec/referencia/`.

| Arquivo | Assunto |
| --- | --- |
| `tecnologias.md` | tecnologias e bibliotecas permitidas |
| `estrutura-server.md` | árvore exata da raiz e de `server/`, com a fase em que cada arquivo nasce |
| `estrutura-web.md` | árvore exata de `web/`, com a fase em que cada arquivo nasce |
| `estrutura-site.md` | árvore exata de `site/` (landing e blog) e a regra de importação entre `site/` e `web/`, fase 13 |
| `banco-de-dados.md` | migrations por fase, decisões de desenho e regras de preenchimento; o SQL de cada fase está no arquivo da fase |
| `configuracao.md` | ambientes, arquivos `.env`, travas de produção e variáveis |
| `interface-visual.md` | estilos, fontes, cores, tokens e componentes |
| `auxiliar-de-design-mobbin.md` | como o agente consulta o Mobbin (MCP) como auxiliar de design, limites e registro das referências |
| `padroes-de-engenharia.md` | TypeScript, arquitetura, convenções, segurança básica, testes e dependências |
| `fora-de-escopo.md` | o que não implementar |

## Como abrir cada sessão

Comece uma sessão nova do agente para cada fase e envie:

> Leia AGENTS.md. Implemente somente a fase indicada em docs/spec/fases/NOME-DO-ARQUIVO, lendo os arquivos de referência que ela lista. Ao terminar, pare e me entregue o relatório.

O agente não precisa ler este `SPEC.md`: ele é o índice e o aceite final, para mim.

## Aceite final

Quando todas as fases estiverem concluídas, usando o ambiente de desenvolvimento com os modos simulados e `COBRANCA_ATIVADA=false`, eu consigo:

1. clonar o projeto, copiar o `.env.development.example` sem alterar nada, subir o banco local e rodar, sem nenhum passo manual de banco;
2. remover uma variável obrigatória e ver o sistema recusar a inicialização com mensagem clara;
3. iniciar em produção com um modo simulado ligado e ver o sistema recusar a inicialização;
4. rodar os testes e confirmar que os dados do banco de desenvolvimento continuam intactos;
5. criar duas contas de empresas diferentes e confirmar que uma não vê nada da outra;
6. usar um plano com limite baixo, ver a classificação pausar ao atingir o limite, rodar `dev:avancar-ciclo` e ver a classificação retomar sozinha de onde parou;
7. subir um CSV exportado de um Excel em português com 1.000 linhas, mapear a coluna e ver a importação concluir;
8. conectar a conta simulada do Google, escolher duas unidades e importar as avaliações;
9. classificar tudo e ver o painel com os gráficos e filtros funcionando;
10. corrigir um comentário na fila de revisão;
11. exportar o CSV e abrir no Excel com acentos corretos;
12. gerar o resumo executivo, tocar num achado e ver os comentários que o sustentam, e gerar de novo sem mudança de dados sem novo custo;
13. fazer uma pergunta livre no campo da tabela, ver a interpretação, confirmar, ver o resultado em faixas e repetir a mesma pergunta pelo histórico, sem novo custo;
14. reiniciar o servidor no meio de um job e ver o job continuar sozinho, sem precisar fazer login de novo;
15. apagar um projeto e confirmar que nenhum dado dele sobrou no banco;
16. abrir a aba de rede do navegador e confirmar que as fontes vêm só dos domínios de `ORIGENS_FONTE_EXTERNA` e que estilos externos vêm só dos domínios permitidos;
17. abrir o domínio do site (`URL_SITE`), ver a landing completa no código-fonte da página, abrir o blog e `sitemap.xml`, e publicar um artigo criando só um arquivo Markdown e rodando o build;

e, preenchendo o `.env.production` com as chaves reais, a classificação com o Jev, os resumos com o LLM e a integração com o Google funcionam sem mudar código e sem nenhuma ação minha depois disso.

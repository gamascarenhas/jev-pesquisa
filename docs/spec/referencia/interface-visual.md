# Interface visual: estilos, fontes, cores e componentes

## Estilos, fontes e cores

### Regras centrais

1. **Fontes vêm de um provedor externo, como Google Fonts.** Nenhum arquivo de fonte é baixado para o repositório. As fontes são declaradas somente em `fontes.css`, com `@font-face` ou `@import` apontando para o provedor, e o domínio de onde as fontes carregam precisa estar na variável de ambiente `ORIGENS_FONTE_EXTERNA`, separada por vírgulas. O provedor padrão é o Google Fonts, carregado por `@import` no `fontes.css`, com `display=swap` e só os pesos usados. Nesse caso `https://fonts.googleapis.com` entra em `ORIGENS_ESTILO_EXTERNO` e `https://fonts.gstatic.com` entra em `ORIGENS_FONTE_EXTERNA`. Essa folha de estilo é a exceção às regras de versão fixa e `integrity` do item 2, porque o Google a gera dinamicamente e não permite SRI.
2. **Estilos podem vir de fontes externas**, como folhas de estilo de bibliotecas por CDN, desde que:
   - o domínio esteja na variável de ambiente `ORIGENS_ESTILO_EXTERNO`, separada por vírgulas;
   - a URL tenha versão fixa, nunca a mais recente sem número;
   - o `<link>` use `integrity` com hash SRI e `crossorigin`;
   - a folha de estilo externa de biblioteca **não carregue fontes**. Se carregar, não use, ou sobrescreva a família nos arquivos locais. As únicas fontes externas permitidas são as declaradas em `fontes.css`.
3. **Cores e fontes têm arquivo próprio**: `cores.css` e `fontes.css`, descritos abaixo. Estilos externos nunca definem as cores e as fontes da identidade do produto; esses dois arquivos prevalecem.

A localização exata de cada arquivo de estilo, fonte e componente está no arquivo `docs/spec/referencia/estrutura-web.md`. O arquivo `styles/index.css` importa os demais na ordem descrita abaixo.

**`fontes.css`**, o único arquivo que declara fontes:

- as regras `@font-face` ou `@import` apontando para o provedor externo;
- variáveis das famílias, com fallback de sistema;
- variáveis dos pesos usados;
- a escala tipográfica: tamanhos e alturas de linha nomeados;
- a variável de números tabulares.

Regras das fontes:

- Fontes de licença aberta.
- Formato `.woff2`, com subconjunto latino que inclua todos os acentos do português.
- `font-display: swap` e fontes de sistema como fallback declarado.
- No `index.html`, só `preconnect` às origens de `ORIGENS_ESTILO_EXTERNO` e `ORIGENS_FONTE_EXTERNA`. Não há `preload` de arquivo de fonte, porque a URL do arquivo só existe dentro do CSS do provedor e `fontes.css` é o único lugar que pode referenciar fontes.
- No máximo duas famílias, com pesos limitados aos realmente usados.
- Números da tabela e do painel usam a variável de números tabulares, para as colunas alinharem.

**`cores.css`**, o único arquivo com valores de cor, em duas seções:

- **paleta primitiva**: as escalas de cada cor da identidade com nomes neutros de tom, sem significado de uso;
- **cores semânticas**, apontando para a paleta: fundo, superfícies, texto principal e secundário, bordas, ação primária, foco, estados de sucesso, atenção, crítico e informação, faixas de probabilidade, níveis de alerta, paleta categórica dos temas e paleta divergente do sentimento nos gráficos, todas distinguíveis por pessoas com daltonismo.

**`tokens.css`**: espaçamento, raios de borda por nível de hierarquia, sombras, camadas de sobreposição, durações e curvas de animação. Sombras que usam cor referenciam variáveis de `cores.css`.

A ordem de importação é fixa: estilos externos primeiro, depois `cores.css`, `fontes.css`, `tokens.css` e o restante, para que os arquivos do projeto prevaleçam.

A configuração do Tailwind lê esses tokens pelas variáveis CSS; **nenhuma cor, tamanho ou fonte fixa espalhada pelos componentes**. Os tokens são organizados para permitir tema escuro no futuro, mas o MVP entrega só o tema claro.

**Estilos reutilizáveis para tudo que se repete.** Regra: **se um valor ou combinação de estilos aparece três vezes, ele vira um estilo compartilhado com nome.** Organize em quatro camadas, da mais básica para a mais composta, e cada camada só usa a de baixo:

1. **Tokens primitivos**: a paleta em `cores.css`, a escala tipográfica em `fontes.css` e espaçamento e raios em `tokens.css`. Só `cores.css` contém valores de cor, e só `fontes.css` contém tamanhos de fonte e nomes de família.
2. **Tokens semânticos**, nas cores em `cores.css` e nos demais em `tokens.css`: nomes pelo uso, apontando para os primitivos, como cor de texto secundário, cor de borda de campo, cor de fundo de linha selecionada, espaço entre seções. Componentes usam **somente** tokens semânticos, nunca primitivos.
3. **Estilos compartilhados** em `web/src/styles/`, um arquivo por grupo:
   - `tipografia.css`: estilos de texto nomeados que combinam família, tamanho, peso, altura de linha e cor, cobrindo título de página, título de seção, texto de corpo, texto auxiliar, rótulo de campo, número de destaque e texto de célula de tabela;
   - `status.css`: as combinações de cor de fundo, texto e borda para cada estado, sucesso, atenção, crítico e informação, e para cada faixa de probabilidade e nível de alerta, usadas igualmente em badges, cartões e linhas da tabela;
   - `layout.css`: contêiner de página, grade do painel, pilhas verticais e horizontais com espaçamento padronizado;
   - `superficies.css`: combinações de fundo, borda e sombra por nível de elevação, usando os tokens;
   - `movimento.css`: transições nomeadas montadas com as durações e curvas de `tokens.css`, com a versão reduzida para `prefers-reduced-motion`;
   - `graficos.ts`: tema único dos gráficos lendo os tokens, com cores, fonte, grade e tooltip, usado por todos os gráficos.
4. **Variantes de componentes**: tamanhos e tipos de botão, badge e campo são definidos uma vez por variantes nomeadas, com uma função utilitária de variantes como `class-variance-authority`, nunca repetindo listas de classes nas telas.

Regras de uso:

- Nas telas, prefira sempre, nesta ordem: componente base, depois estilo compartilhado, depois utilitário do Tailwind ligado a token. Classe utilitária solta só para ajuste de layout pontual que não se repete.
- Proibido valor arbitrário no Tailwind, como tamanhos ou cores entre colchetes, e proibido `style` inline com valores visuais.
- Ao criar algo novo que se pareça com um estilo existente, reutilize ou estenda o existente; não crie uma variação quase igual.

**Verificação automática**, rodando junto com os testes e falhando o build quando violada:

- `stylelint`, parte do script `verificar` a partir da fase 3, configurado para proibir cores literais fora de `cores.css`, e `@font-face`, famílias e tamanhos de fonte fixos fora de `fontes.css`;
- verificação de que nenhum arquivo do projeto referencia URL de fonte fora de `fontes.css`;
- regra de lint no código TypeScript proibindo cores hexadecimais, valores arbitrários do Tailwind e `style` inline com propriedades visuais nos componentes;
- esses mesmos padrões cobertos por `stylelint` e ESLint, que já listam cada ocorrência com arquivo e linha, sem script próprio;
- testes de componentes com Vitest e Testing Library, em arquivos `*.test.tsx` ao lado do código, cobrindo os componentes base e a lógica das telas de cada fase.

**Componentes base em `components/ui`**, usados por todas as telas: botão, campo de texto, seletor, tabela com ordenação e paginação, badge de rótulo, barra de progresso, modal, aviso temporário, estado vazio e cartão. Nenhuma tela cria estilo próprio para algo que já existe como componente base.

### Nome do negócio

vem da configuração `NOME_NEGOCIO`, buscada pela rota pública `GET /api/configuracao-publica` ao carregar e distribuída por um provedor. Aparece no título da aba, no logotipo em texto da `BarraSuperior` e nas telas de login e cadastro. Os textos usam o espaço reservado `{nomeNegocio}`, nunca o nome fixo. Em produção, o servidor substitui o marcador `%NOME_NEGOCIO%` do `index.html`, com escape de HTML, para o título da aba nascer certo; em desenvolvimento, o título é atualizado por código depois de buscar a rota pública.

### Textos

toda string visível vem de `i18n/pt-BR.ts`, inclusive os rótulos de temas e sentimentos e as mensagens de erro: a API devolve só ids e `codigo` estáveis, e o web os traduz pelo `i18n`. Frases curtas, voz ativa e sem jargão técnico. Botões dizem exatamente o que acontece ao clicar, e a mesma ação mantém o mesmo nome em todo o fluxo.

### Direção visual

o público são diretores e gestores de empresas médias e grandes, que abrem o painel para decidir. A interface deve transmitir clareza e confiança nos dados, com densidade de informação adequada a tabelas e gráficos. Evite o visual genérico de template, como cartões idênticos com a mesma sombra em tudo, degradês decorativos e rótulos em caixa alta sobre cada título. Hierarquia vem de tipografia, espaço e alinhamento.

### Plano de design antes do código

antes de construir qualquer tela, entregue um plano curto com a paleta em 4 a 6 cores nomeadas com hexadecimal, as fontes escolhidas com o papel de cada uma e o motivo da escolha, a escala tipográfica, um esboço em texto do layout do painel e uma sugestão de nome para o negócio. O plano cita também as referências consultadas no Mobbin, com o `mobbin_url` de cada uma e o que se adotou dela, seguindo `docs/spec/referencia/auxiliar-de-design-mobbin.md`; referência inspira estrutura e hierarquia, e a identidade visual do plano prevalece. **Aguarde minha aprovação** do plano antes de implementar, mas não aguarde pelo nome: preencha `NOME_NEGOCIO` no `.env.development.example` com a sugestão e siga; eu troco o valor se não gostar.

### Qualidade mínima

- contraste de texto no nível AA da WCAG;
- foco de teclado sempre visível;
- navegação completa por teclado nos formulários, na tabela e nos modais;
- `prefers-reduced-motion` respeitado; animação só como resposta a ação do usuário;
- responsivo até telas de celular, com a tabela rolando horizontalmente dentro do próprio contêiner;
- cabeçalho `Content-Security-Policy` servido pelo backend com `font-src 'self'` mais os domínios de `ORIGENS_FONTE_EXTERNA`, garantindo que nenhuma fonte de outro domínio carregue, e `style-src 'self'` mais os domínios de `ORIGENS_ESTILO_EXTERNO`.

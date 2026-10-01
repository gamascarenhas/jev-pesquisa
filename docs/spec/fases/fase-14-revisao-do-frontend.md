# Fase 14: Revisão completa do frontend

**Entrega 5.** Depende de: todas as fases anteriores, inclusive a 13. É a **última fase do projeto**: só começa com o produto inteiro pronto, porque revisa o `web/` como um todo e não tela por tela.

Cada fase anterior desenhou as próprias telas olhando só para o próprio escopo. Esta fase olha o conjunto. O objetivo é um frontend coeso, moderno, intuitivo e profissional, em que o cliente sinta que usa um único produto e não a soma de dez entregas.

**Esta spec não traz soluções prontas.** Ela define o que olhar, como decidir e o que não pode quebrar. As decisões de design (o que ajustar, reorganizar, dividir, simplificar, trocar ou padronizar) são suas, tomadas caso a caso com base no que você encontrar no sistema rodando.

## Leia antes

- `AGENTS.md`
- `docs/spec/referencia/interface-visual.md`
- `docs/spec/referencia/auxiliar-de-design-mobbin.md`
- `docs/spec/referencia/estrutura-web.md`
- `docs/spec/referencia/tecnologias.md`
- `docs/spec/referencia/padroes-de-engenharia.md`, seções de arquitetura e testes
- `docs/spec/referencia/fluxo-de-commits.md`
- O relatório de cada fase anterior que tiver tela, no que ele lista de pendências e riscos visuais

Diferente das outras fases, aqui você **deve** ler e navegar por todo o `web/src`, pelas telas de todas as fases. Não leia nem altere `server/`, a não ser para subir o ambiente e ler um contrato de API já existente.

## Nesta fase

### 1. Inventário e diagnóstico, antes de mudar qualquer coisa

- Suba o ambiente completo (`npm run dev`), com o modo simulado, e **percorra o produto como um cliente**: cadastro, login, primeiros passos, importação, classificação, painel, fila de revisão, plano e consumo, Google, configurações, termos, página não encontrada, estados de erro. Faça isso em largura de celular, tablet e desktop, e também só pelo teclado.
- Monte o inventário: todas as rotas, os fluxos entre elas, os componentes compartilhados e os usos duplicados ou divergentes deles.
- Se precisar de uma ferramenta de captura de tela ou de navegação automatizada que não esteja na stack, **pergunte antes de instalar**. Sem ela, descreva o que viu e o que não conseguiu verificar.
- Entregue o diagnóstico como parte do relatório final, curto e priorizado: o que está bom, o que está inconsistente, o que atrapalha o cliente, e o que você decidiu fazer a respeito, com o motivo. **Não espere minha aprovação do diagnóstico.** Siga em frente, salvo nos casos da seção "Quando parar e perguntar".

### 2. Eixos da revisão

Avalie cada um deles no sistema inteiro. A lista abaixo é de **perguntas**, não de soluções.

- **Fluxos e arquitetura da informação.** O cliente sabe onde está, o que fazer agora e como voltar? Os caminhos principais têm poucos passos? Há telas demais para o que fazem, ou de menos, com informação demais amontoada? A navegação lateral, a barra superior e os atalhos entre telas fazem sentido juntos? O que está escondido e deveria estar à vista, e o contrário?
- **Hierarquia visual.** Em cada tela, a ação principal é óbvia? Títulos, subtítulos, rótulos e textos auxiliares têm pesos coerentes? Dá para bater o olho e entender o estado do projeto?
- **Espaçamento, alinhamento e ritmo.** Os espaçamentos seguem uma escala única ou variam por tela? Cartões, tabelas, formulários e listas respiram de forma parecida?
- **Consistência entre páginas.** O mesmo conceito tem o mesmo nome, o mesmo componente e a mesma aparência em todo lugar? Há duas formas de fazer a mesma coisa (dois estilos de confirmação, de vazio, de carregamento, de erro, de paginação, de aviso)? Escolha uma e padronize.
- **Botões e ações.** Primário, secundário, perigoso e discreto são usados com critério? Há botões demais lado a lado? O texto de cada ação diz o que ela faz? Ações destrutivas pedem a confirmação proporcional ao estrago?
- **Ícones.** Os ícones ajudam ou só enfeitam? São de uma só família, com tamanho, traço e alinhamento coerentes? Ícone sozinho tem rótulo acessível?
- **Logos e marcas de serviços externos** (Google e qualquer outro que apareça). Onde o produto mostra um serviço de terceiro, ele usa o **logotipo oficial**, na versão e nas proporções que o próprio terceiro publica nas suas diretrizes de marca, e não um ícone genérico ou uma imitação. Consulte a documentação oficial de marca do serviço, cite a fonte no relatório e diga o que não conseguiu confirmar. Os arquivos do logo ficam em `web/src/assets/images`, como SVG, e não vêm do Mobbin. Respeite as regras de uso do terceiro (botão de login do Google, por exemplo, tem diretrizes próprias de aparência e texto). Na dúvida sobre licença ou uso, pergunte.
- **Estados.** Toda tela e todo componente de dados tem carregamento, vazio, erro, sucesso e, quando couber, parcial. Os textos desses estados explicam o que houve e o que fazer a seguir, e não repetem "Erro" ou "Carregando".
- **Formulários.** Rótulos, ajuda, validação em linha, mensagens de erro, foco, ordem de tabulação, tipo de teclado e comportamento de envio são coerentes entre os formulários.
- **Dados e tabelas.** Densidade, ordenação, filtros, paginação, números e datas legíveis e formatados do mesmo jeito em todo lugar.
- **Responsividade.** Nenhuma tela quebra, esconde ação essencial nem exige rolagem horizontal entre 360 px e telas largas. Tabelas, gráficos, filtros e diálogos têm um comportamento deliberado no celular, não apenas "encolhem".
- **Acessibilidade.** Contraste, foco visível, semântica, nomes acessíveis, navegação por teclado, armadilha de foco em diálogos, `prefers-reduced-motion`, tamanhos de alvo de toque. Trate como parte do UX, não como extra.
- **Texto e tom.** Português correto, claro e consistente. Mesmo termo para a mesma coisa. Mensagens curtas, sem jargão técnico, sem jamais expor dólar, tokens ou nomes de modelo ao cliente. Todos os textos continuam em `i18n/pt-BR.ts`.
- **Movimento e feedback.** Transições e indicadores de progresso ajudam a entender o que está acontecendo, sem distrair. O cliente recebe confirmação das ações importantes.
- **Estrutura do código do frontend.** Componentes grandes demais, props em excesso, lógica de dados misturada com apresentação, hooks duplicados, estilos repetidos três vezes ou mais, pastas fora da estrutura de `estrutura-web.md`. Divida, junte ou mova com critério.
- **Bibliotecas e ferramentas.** As que já estão na stack estão sendo bem usadas, ou há código à mão onde a biblioteca resolve melhor (e o contrário: biblioteca pesada para um uso trivial)? O que cada uma custa no bundle? Há rotas pesadas que valem carregamento sob demanda? Proponha trocas ou remoções **só com justificativa**, e dependência nova segue a regra de "Quando parar e perguntar".
- **Desempenho percebido.** Tamanho do bundle, carregamento inicial, quantidade de requisições por tela, layout que pula, listas longas.

### 3. Decisão e execução

- **Decida autonomamente.** Para cada problema, escolha a solução que melhor serve ao cliente naquele contexto. Não existe uma lista de mudanças esperada, e não existe obrigação de mudar o que já está bom: **mudança sem ganho claro é regressão**. Prefira poucas mudanças bem feitas, aplicadas em todo o sistema, a muitas mudanças pontuais.
- **Consulte referências.** Antes de redesenhar qualquer tela ou fluxo, consulte o Mobbin conforme `auxiliar-de-design-mobbin.md` (modo `standard`; `deep` só onde o `standard` for fraco, com o limite do auxiliar). Use a referência para estrutura e hierarquia, nunca copie, e a identidade da fase 3 prevalece.
- **Evolua a identidade, não a troque.** Cores, fontes, tokens e tom vêm da fase 3. Você pode refinar a escala (espaçamento, tipografia, raios, sombras, elevação, estados), acrescentar tokens e componentes e remover os que ficarem sem uso, desde que tudo continue nos arquivos de estilo certos, sem valor fixo fora deles, sem `style` inline visual e sem valor arbitrário do Tailwind. Mudar a paleta ou as fontes da identidade é decisão minha: se achar que precisa, **pare e proponha**.
- **Padronize pelo componente.** Quando duas telas resolvem o mesmo problema de formas diferentes, a correção é um componente ou estilo compartilhado com nome, usado nas duas. Remova o que ficar sem uso.
- **Execute em etapas pequenas e verificáveis**, rodando `verificar` ao fim de cada etapa, para nunca acumular uma quebra grande. Atualize os testes existentes quando a mudança for intencional, e escreva testes para o que for novo.
- **Comportamento preservado.** Esta fase muda apresentação, organização e fluxo de telas, não regra de negócio. Contratos de API, rotas do servidor, permissões (`owner` e `member`), exigência de e-mail confirmado e as regras de privacidade e de custo continuam como estão. Rotas do app podem ser reorganizadas, mas links antigos que o cliente possa ter salvo ou recebido por e-mail (confirmação, redefinição de senha, convite, retorno do Google) **não podem quebrar**.

### 4. Validação final

- Percorra de novo os mesmos fluxos do inventário, nas três larguras e pelo teclado, e confirme que cada problema listado no diagnóstico foi resolvido, adiado com motivo ou descartado com motivo.
- Rode `verificar`, `build` e `auditoria`. Compare o tamanho do bundle antes e depois e relate.
- Reinicie frontend, backend e o container do banco, conforme `fluxo-de-commits.md`, e confirme as portas.

## Quando parar e perguntar

Além dos casos do `AGENTS.md`, pare e pergunte antes de:

- instalar ou remover uma dependência;
- mudar a paleta, as fontes ou o nome da identidade da fase 3;
- remover ou mudar o papel de uma funcionalidade, ou de uma tela inteira que alguma fase entregou;
- mudar qualquer coisa em `server/`, no banco ou em contratos de API (se a melhor solução de UX exigir isso, descreva a necessidade e **não implemente**);
- usar um logotipo ou marca cuja licença ou diretriz de uso você não conseguiu confirmar;
- alterar o `site/` além do estritamente necessário para continuar compilando depois de uma mudança em componente compartilhado.

## Testes desta fase

- Os testes de todas as fases continuam passando; quando uma mudança de interface for intencional, o teste é atualizado junto, nunca apagado para passar.
- Todo componente ou estilo compartilhado novo tem teste de componente.
- Os testes de regras visuais existentes (`regras-visuais.test.ts`, `stylelint`) continuam passando sem exceção nova.
- Teste de acessibilidade básica nas telas principais (nomes acessíveis, foco, papéis), com as ferramentas já presentes na stack.
- Os links externos recebidos por e-mail ou pelo retorno do Google continuam levando à tela certa.

## Pronto quando

1. O relatório traz o diagnóstico priorizado e o que foi feito, adiado ou descartado de cada item, com o motivo.
2. Os fluxos principais (cadastro até o primeiro painel, importação, classificação, revisão, plano, Google, configurações) funcionam e parecem um produto só, em celular, tablet e desktop.
3. Não existem duas formas diferentes de fazer a mesma coisa na interface (confirmação, vazio, erro, carregamento, paginação, aviso).
4. Serviços externos mostrados na interface usam o logotipo oficial, com a fonte das diretrizes citada.
5. `verificar`, `build` e `auditoria` passam, sem nenhum valor visual fora dos arquivos de estilo.
6. O tamanho do bundle e as requisições por tela não pioraram sem justificativa.

## Fora desta fase

- Funcionalidades novas, endpoints novos, mudanças no banco e mudanças de regra de negócio.
- Redesenho da identidade (paleta, fontes, nome) sem minha aprovação.
- Reescrita do `site/` (landing e blog) além do necessário para continuar compilando.
- Testes ponta a ponta com navegador automatizado, a não ser que eu aprove a ferramenta.
- Internacionalização para outros idiomas.

## Antes de parar

Passe pela lista de `AGENTS.md`. Esta fase não tem migrations. Confira também:

- [ ] O cliente continua sem ver dólar, tokens ou nomes de modelos em qualquer tela.
- [ ] Nenhuma imagem, fonte ou arquivo do Mobbin entrou no repositório, e o relatório lista as referências com `mobbin_url`.
- [ ] Nenhuma dependência foi instalada ou removida sem minha resposta.
- [ ] Links de e-mail e retorno do Google antigos continuam funcionando.
- [ ] Nada visual se repete três vezes sem estilo compartilhado, e nada ficou sem uso.
- [ ] O diagnóstico do relatório cobre todos os eixos, mesmo os em que nada precisou mudar.

Entregue o relatório e espere minha confirmação. É a última fase: depois dela, o projeto está pronto para o lançamento.

# Fase 13: Landing page e blog

**Entrega 4.** Depende de: todas as fases anteriores. É a última coisa a construir, depois do produto inteiro pronto.

O `web/` já é a área logada do cliente, onde ele administra usuários, projetos, plano e dados. Esta fase cria o **site público** que apresenta o produto e traz visitantes para o cadastro: uma landing page e um blog. Ela não cria tela administrativa nova nem papel novo.

## Leia antes

- `AGENTS.md`
- `docs/spec/referencia/tecnologias.md`, seção do site público
- `docs/spec/referencia/interface-visual.md`
- `docs/spec/referencia/auxiliar-de-design-mobbin.md`
- `docs/spec/referencia/padroes-de-engenharia.md`, seções de arquitetura e segurança
- `docs/spec/referencia/estrutura-site.md` e, de `estrutura-web.md`, apenas as pastas `styles/`, `components/ui` e `lib`
- `docs/spec/referencia/estrutura-server.md`, `http/plugins/estaticos.plugin.ts` e `http/publico.rotas.ts`
- `docs/spec/referencia/configuracao.md`, variáveis `URL_APP`, `URL_SITE` e `NOME_NEGOCIO`, e as travas de produção
- `web/src/app/routes.tsx` e as telas de `features/legal` e `features/auth`, para não duplicar rotas

## Nesta fase

- **Primeiro passo, antes de qualquer página:** consulte o Mobbin conforme `auxiliar-de-design-mobbin.md` (`search_sections` para landing e blog) e entregue um **plano curto do site**: estrutura da landing seção por seção, estrutura do blog, as referências com `mobbin_url` e o que se adotou de cada uma, e o esboço do texto de cada seção. **Pare até eu aprovar.** A identidade visual é a do plano de design da fase 3, sem paleta nem fonte nova.
- **Workspace `site/`, separado do `web/`.** Crie o workspace conforme a árvore de `estrutura-site.md`, acrescente-o aos `workspaces` do `package.json` da raiz e faça `typecheck`, `lint`, `stylelint`, `test`, `verificar` e `build` da raiz cobrirem também o `site`. Acrescente `site/dist` ao `.gitignore`.
- **Direção das dependências entre `web/` e `site/`.** O `site/` importa só de `web/src/styles`, `web/src/components/ui` e `web/src/lib`; nada em `web/` importa de `site/`, e o `site/` não importa de `features`, `app`, `api` nem `hooks`. Imponha as duas regras com `no-restricted-imports` no ESLint e teste com um arquivo de exemplo que viole cada uma. No `site/`, o alias `@/` aponta para `web/src` e o do próprio site é `@site/`. O Tailwind do site lê os mesmos tokens e também varre os componentes de `web/` que ele importa. Se essa reutilização ficar frágil, **pare e me consulte** antes de extrair uma pasta compartilhada.
- **Dependências novas: pergunte antes de instalar.** A pré-renderização usa o `react-dom/server` do próprio React e o modo de renderização no servidor do Vite, que já estão na stack. Falta um leitor de Markdown e um de frontmatter, que entram só no `package.json` do `site/`. Sugestão: `react-markdown`, que não gera HTML bruto, e `gray-matter`. Confirme licença, manutenção e a documentação oficial antes de propor, e espere minha resposta.
- **Site pré-renderizado no build, sem servidor de renderização.** O script `site/scripts/prerender.ts` gera em `site/dist` o HTML estático completo de cada página pública, com o conteúdo já no HTML e quase nenhum JavaScript no navegador. O `npm run build` da raiz o roda e não depende de variável de ambiente nem de segredo.
- **Dois domínios, um processo.** O site público vive no domínio principal (`URL_SITE`, como `https://exemplo.com.br`) e o app no subdomínio (`URL_APP`, como `https://app.exemplo.com.br`). O mesmo servidor Fastify atende os dois e escolhe pelo cabeçalho `Host`; o que ele não reconhece responde 404.
- **Páginas públicas, só no domínio do site:** landing em `/`, lista do blog em `/blog`, cada artigo em `/blog/<slug>/`. Os termos e a política continuam nas telas de `features/legal` da fase 3, no app, e a landing e o rodapé apontam para `URL_APP`. A chamada para cadastro e o login da landing são links para o app.
- **Blog em Markdown no repositório:** um arquivo por artigo em `site/content/blog/`, com frontmatter validado por `zod` com `.strict()`: `titulo`, `descricao`, `slug`, `publicadoEm`, `atualizadoEm` (opcional), `autor`, `imagem` (opcional, com texto alternativo) e `rascunho`. Frontmatter inválido, `slug` repetido ou imagem sem texto alternativo **falham o build** com o nome do arquivo. Artigo com `rascunho: true` nunca entra no HTML, no sitemap nem no feed. Entregue um artigo modelo provisório, com `rascunho: true`, para eu copiar.
- **Servidor:** o `estaticos.plugin.ts` serve `web/dist` no domínio do app e `site/dist` no domínio do site, carrega as páginas geradas na inicialização, substitui `%NOME_NEGOCIO%`, `%URL_SITE%` e `%URL_APP%` com escape de HTML, e o novo `publico.rotas.ts` serve as páginas, `robots.txt`, `sitemap.xml` e `feed.xml`, gerados na inicialização a partir do índice de páginas que o build grava.
- **Variável nova `URL_SITE`:** origem pública do site, sem barra final. Entra no esquema de `config.ts`, nos dois arquivos `.env.*.example` (em desenvolvimento, a origem do Fastify, como `http://localhost:3000`; o exemplo de produção é `https://exemplo.com.br`) e nas travas de produção. As travas de produção passam a exigir também que `URL_SITE` use `https`. Em qualquer ambiente, a validação recusa iniciar se `URL_SITE` e `URL_APP` tiverem o **mesmo host** (host com porta). `PORT` e o resto continuam como estão.
- O servidor decide pelo `Host` da requisição, nunca por `X-Forwarded-Host`, que o cliente pode forjar. O README diz que o proxy do operador precisa repassar o `Host` original, e que o redirecionamento de `www` para o domínio principal e de `http` para `https` é do proxy e do DNS.
- **Estilo:** reutilize `cores.css`, `fontes.css`, `tokens.css` e os estilos compartilhados de `web/src/styles`, sem copiá-los. O que for exclusivo do site vai em `site/src/styles/site.css`, com nomes, sem valor fixo e seguindo a regra dos três usos. Nenhuma fonte nova além das do plano de design.
- **Textos:** vêm de `site/src/i18n/site.pt-BR.ts`, com `{nomeNegocio}` no lugar do nome. Como no texto jurídico, o texto da landing é **provisório** e identificado como tal no relatório.

## Especificação

### Conteúdo da landing

Seções na ordem: apresentação com a promessa e a chamada para o cadastro, o problema (empresas leem só uma amostra dos comentários), como funciona em três passos (subir planilha ou conectar o Google, classificar, usar o painel), o que o painel entrega, privacidade e controle dos dados (anonimização, exclusão pelo próprio cliente), perguntas frequentes e chamada final. Rodapé com links para blog, termos, política, login e cadastro.

Regras de conteúdo:

- **Nada inventado.** Nenhum depoimento, número de clientes, logotipo de cliente, selo, prêmio, preço ou comparação com concorrente. Só o que o produto faz hoje: criar a conta da empresa; criar projetos; trazer comentários por planilha CSV ou Excel ou pelo Perfil da Empresa no Google; classificar cada comentário por tema, sentimento e gravidade; ver um painel com filtros e uma fila de revisão; gerar um resumo executivo por tema, verificado antes de aparecer; perguntar livremente sobre os comentários e ver quais respondem sim; exportar em CSV; e apagar projetos, desconectar o Google ou encerrar a conta com remoção real dos dados. Nada além disso.
- **Sem preço.** A cobrança está fora do MVP. A chamada é para criar a conta e testar.
- A declaração de privacidade da landing bate com a da política da fase 3, inclusive o limite da anonimização (CPF, CNPJ, e-mail, telefone e CEP, mas não nomes nem endereços escritos no texto).
- **Sem rastreadores.** Nenhuma ferramenta de análise, pixel, fonte ou script de terceiros além do provedor de fontes declarado em `fontes.css`. Isso evita banner de cookies e decisão jurídica agora; análise de audiência é fora de escopo.
- Sem formulário de contato e sem newsletter: o único caminho de conversão é o cadastro.

### SEO técnico

Confirme cada item na documentação oficial (Google Search Central e Vite) antes de implementar, e diga no relatório o que não conseguiu confirmar.

- **HTML completo por página:** `lang="pt-BR"`, `<title>` e `meta description` únicos, **um só `h1`** e hierarquia de títulos sem saltos, `link rel="canonical"` com a URL absoluta, Open Graph e cartão do Twitter, com imagem de compartilhamento.
- **Dados estruturados em JSON-LD**, gerados por função pura e validados por teste: `Organization` e `WebSite` na landing; `BlogPosting` e `BreadcrumbList` nos artigos. Só campos que existem de fato.
- **`sitemap.xml`** só com páginas públicas indexáveis e `lastmod` real (data de atualização do artigo ou do build da landing); **`robots.txt`** do site apontando para o sitemap, sem bloquear nada; **`feed.xml`** RSS ou Atom dos artigos publicados.
- **Cada domínio com o seu:** `sitemap.xml` e `feed.xml` só existem no domínio do site, e as URLs de `canonical`, sitemap, feed e Open Graph usam `URL_SITE`. No domínio do app, o `robots.txt` (servido pelo `estaticos.plugin.ts`) não bloqueia nada, nem `/api/`, e não há sitemap.
- **App fora do índice:** todas as respostas do domínio do app (SPA e `/api`) trazem `X-Robots-Tag: noindex`. Como o `noindex` só vale se o buscador puder ler a página, o app **não** é bloqueado no `robots.txt`.
- **Sem conteúdo duplicado entre domínios:** as páginas públicas não existem no domínio do app, e no domínio do site as rotas do app (`/api`, login, cadastro, projetos e as demais do SPA) respondem 301 para o mesmo caminho em `URL_APP`.
- **URLs estáveis:** barra final consistente, redirecionamento 301 da variante sem barra, e slug inexistente responde **404 de verdade**, com página própria, nunca 200 com "não encontrado".
- **Desempenho (Core Web Vitals):** sem JavaScript de terceiros; imagens com `width`, `height`, `alt` e carregamento adiado fora da primeira dobra; `preconnect` só para as origens de `ORIGENS_ESTILO_EXTERNO` e `ORIGENS_FONTE_EXTERNA`, sem URL de arquivo de fonte fora de `fontes.css`; nada que desloque o layout; cabeçalhos de cache e `ETag` nas páginas e nos ativos com hash.
- As páginas públicas **não criam cookie de sessão**, para poderem ser cacheadas. O cookie da sessão continua host-only (com `__Host-` em produção), então nunca é enviado ao domínio do site.

### Segurança

- O Markdown dos artigos é conteúdo do repositório, mas é tratado como não confiável: HTML bruto e `script` num artigo não viram HTML executável, e nenhum componente usa `dangerouslySetInnerHTML`.
- A CSP da fase 3 continua valendo e as páginas públicas não a violam: nada de script ou estilo inline (o JSON-LD é bloco de dados, não script executável; confirme na medição manual do Chrome descrita em "Pronto quando", sem teste automatizado de navegador).
- As rotas públicas só aceitam GET e HEAD e não recebem parâmetro além do `slug`, validado por `zod`. A landing não chama a API, então não há CORS nem nova origem confiável no CSRF, que continua exigindo só `URL_APP`.
- `Host` desconhecido responde 404, e nenhuma resposta ecoa o `Host` recebido. **Exceção:** `GET /api/saude` responde por qualquer `Host`, porque verificadores de saúde chamam pelo IP. Os helpers de teste (`build-app.ts`) enviam por padrão o `Host` de `URL_APP`, para os testes das fases 1 a 12 continuarem passando sem alteração.
- Links externos com `rel="noopener noreferrer"`.

### Rotas do app

No domínio do app, `/` continua sendo do SPA. Confira que, sem sessão, ele leva ao login, e com sessão, à tela inicial de projetos da fase 3, e ajuste o mínimo em `routes.tsx` se preciso, registrando no relatório. A landing vive só no domínio do site.

## Testes desta fase

- O build gera um HTML por página, cada um com `lang`, `title`, `description` e `canonical` únicos e exatamente um `h1`.
- Frontmatter inválido, `slug` repetido e imagem sem `alt` falham o build; `rascunho: true` não aparece em nenhuma saída.
- `sitemap.xml` lista só páginas públicas com `lastmod`, sem rotas do app nem `/api`; `robots.txt` aponta para o sitemap; `feed.xml` é válido e só traz artigos publicados.
- Slug inexistente responde 404; variante sem barra final responde 301; toda resposta do domínio do app, SPA e `/api`, traz `X-Robots-Tag: noindex`, e a landing e o blog não.
- O JSON-LD de cada tipo de página é JSON válido com os campos exigidos.
- Artigo com `<script>` e HTML bruto no Markdown sai como texto, sem HTML executável.
- `%NOME_NEGOCIO%`, `%URL_SITE%` e `%URL_APP%` saem substituídos e escapados, e nenhuma URL nem nome de negócio aparece fixo nas páginas.
- Com o `Host` de `URL_SITE`, `/` e `/blog` respondem com a landing e o blog, e `/login` (ou a rota de login do app) responde 301 para `URL_APP`. Com o `Host` de `URL_APP`, `/blog` não serve o blog, e um `Host` desconhecido responde 404.
- `sitemap.xml` e `feed.xml` só respondem no domínio do site, com URLs de `URL_SITE`, e o domínio do app não tem sitemap.
- A configuração recusa iniciar se `URL_SITE` e `URL_APP` tiverem o mesmo host, ou se em produção `URL_SITE` não usar `https`.
- As páginas públicas não enviam `Set-Cookie`, e a CSP não é violada.
- `verificar`, `stylelint`, `build` e `auditoria` passam nos três workspaces; o lint de acessibilidade cobre os componentes do site.
- Um arquivo de exemplo em `web/` que importe de `site/`, e outro em `site/` que importe de `web/src/features`, fazem o lint falhar.
- O `npm run build` do `web/` e do `server/` continuam funcionando sem o `site/` instalado com as dependências novas, e o bundle do app não contém nada do site.
- Os testes das fases 1 a 12 continuam passando sem alteração, `GET /api/saude` responde com qualquer `Host`, e no domínio do app o login e a rota `/` continuam funcionando.

## Pronto quando

1. Depois do `npm run build` e do `npm start`, abro `URL_SITE`, `/blog` e um artigo modelo copiado sem `rascunho`, e vejo o conteúdo completo no código-fonte da página, sem depender de JavaScript.
2. `sitemap.xml`, `robots.txt` e `feed.xml` abrem e estão corretos.
3. Em uma medição pontual das páginas no Chrome (Lighthouse), desempenho, acessibilidade, boas práticas e SEO ficam em 90 ou mais, e o relatório traz os números.
4. Adicionar um artigo é criar um `.md` e rodar o build, sem tocar em código.
5. Nada recorrente depende de ação manual.

## Fora desta fase

- Editor de artigos, painel de blog, comentários, categorias, busca, newsletter, formulário de contato e outros idiomas.
- Análise de audiência, pixels e banner de cookies.
- Preços, depoimentos, estudos de caso e qualquer número que o produto ainda não tenha.
- Qualquer mudança nas telas do app além, no máximo, do ajuste de rota raiz descrito acima, e qualquer mudança em `web/` para acomodar o site que não seja a regra de importação.

## Antes de parar

Passe pela lista de `AGENTS.md`. Esta fase não tem migrations. Confira também:

- [ ] Nenhum arquivo de fonte ou imagem do Mobbin foi baixado para o projeto, e o relatório lista as referências com `mobbin_url`.
- [ ] Nenhum texto escreve o nome do negócio fixo e o relatório avisa que os textos da landing são provisórios.
- [ ] Nenhuma dependência foi instalada sem minha resposta.
- [ ] Nada visual se repete sem estilo compartilhado.

Entregue o relatório e espere minha confirmação.

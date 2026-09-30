# Arquitetura de pastas: site

Esta é a estrutura da fase 13. A raiz e o servidor estão em `estrutura-server.md`, e o app em `estrutura-web.md`. Siga **exatamente** esta estrutura, sem criar pastas fora dela sem me perguntar.

**Site público em `site/`**

Workspace próprio, ao lado de `server/` e `web/`, com a landing page e o blog. Compartilha a identidade visual com o app **somente lendo** de `web/`: `web/src/styles` (cores, fontes, tokens e estilos compartilhados), `web/src/components/ui` e `web/src/lib`. A dependência tem uma só direção: o `site/` importa desses três lugares, e **nada em `web/` importa de `site/`**. O `site/` também não importa de `features`, `app`, `api` nem `hooks` do `web/`. As duas regras são impostas por `no-restricted-imports`.

Como os arquivos de `web/` usam o alias `@/` apontando para `web/src`, no `site/` o alias `@/` aponta para `web/src` (no `tsconfig`, no Vite e no Vitest), e o código do próprio site usa o alias `@site/`, apontando para `site/src`.

```text
site/
├── package.json                            dependências só do site (leitor de Markdown e de frontmatter, com minha aprovação)
├── tsconfig.json
├── vite.config.ts                          build de renderização no servidor das páginas e do CSS
├── vitest.config.ts
├── eslint.config.js                        estende a raiz e impõe os no-restricted-imports entre site e web
├── stylelint.config.js
├── public/
│   ├── favicon.svg
│   └── imagem-compartilhamento.png         imagem padrão de Open Graph
├── content/
│   └── blog/                               um .md por artigo, com frontmatter; inclui um modelo provisório com rascunho: true
├── scripts/
│   └── prerender.ts                       gera o HTML estático das páginas públicas e o índice de páginas e de artigos em site/dist
└── src/
    ├── entry-server.tsx                   monta cada página para renderToStaticMarkup
    ├── pages/                            Landing.tsx, ListaBlog.tsx, ArtigoBlog.tsx, NaoEncontrado.tsx
    ├── components/                        seções da landing, cabeçalho e rodapé públicos, cartão de artigo
    ├── blog/                               carregar-artigos.ts (frontmatter com zod), renderizar-markdown.tsx
    ├── seo/                                metadados.ts, dados-estruturados.ts, sitemap.ts, feed.ts, robots.ts
    ├── styles/
    │   ├── index.css                       importa os estilos de web/src/styles na ordem fixa e depois site.css
    │   └── site.css                        estilos exclusivos do site, só com tokens
    └── i18n/
        └── site.pt-BR.ts                   textos da landing e do blog
```

`site/dist` fica no `.gitignore`.

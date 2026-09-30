# Arquitetura de pastas: web

Leia apenas as pastas das funcionalidades que a fase atual toca. A raiz e o servidor estão em `estrutura-server.md`. Siga **exatamente** esta estrutura, sem criar pastas fora dela sem me perguntar. O número entre parênteses diz em que fase o arquivo nasce. Componentes base e telas nascem sob demanda, quando a primeira tela os usa.

**Web em `web/`**

Organização por funcionalidade. Cada funcionalidade tem `pages/` para telas ligadas a rotas, `components/` para peças só dela e `hooks/` para busca de dados e estado dela. Testes de componentes ficam ao lado do código, em arquivos `*.test.tsx`.

```text
web/
├── package.json                            (3)
├── tsconfig.json
├── vite.config.ts                          proxy de /api para o server em desenvolvimento
├── vitest.config.ts                        testes de componentes
├── index.html                              preconnect às origens de fonte e estilo externos; título com o marcador %NOME_NEGOCIO%
├── eslint.config.js
├── stylelint.config.js
├── public/
│   ├── favicon.svg
│   └── exemplo-comentarios.csv             (8) 100 comentários fictícios
└── src/
    ├── main.tsx
    ├── app/
    │   ├── App.tsx
    │   ├── routes.tsx                       todas as rotas da aplicação
    │   ├── providers.tsx                  React Query e demais provedores
    │   └── guards/
    │       ├── ExigirAutenticacao.tsx
    │       └── ExigirEmailConfirmado.tsx
    ├── api/
    │   ├── http.ts                         (3) fetch com cookies, tratamento de erro padrão
    │   ├── chaves-consulta.ts              (3)
    │   ├── types.ts                         (3) tipos das respostas da API
    │   ├── autenticacao.api.ts             (3)
    │   ├── projetos.api.ts                 (3)
    │   ├── exclusao-dados.api.ts           (3)
    │   ├── trabalhos.api.ts                (5) status e progresso de jobs
    │   ├── envios.api.ts                   (5)
    │   ├── classificacao.api.ts            (8) estimar, iniciar, progresso e reprocessar falhas
    │   ├── comentarios.api.ts              (8)
    │   ├── painel.api.ts                   (8)
    │   ├── consumo.api.ts                  (9)
    │   ├── planos.api.ts                   (9)
    │   ├── google.api.ts                   (10)
    │   ├── resumos.api.ts                  (11)
    │   └── perguntar.api.ts                (12)
    ├── assets/
    │   └── images/                         SVGs
    ├── styles/                             (3)
    │   ├── index.css                       importa tudo na ordem fixa
    │   ├── cores.css
    │   ├── fontes.css
    │   ├── tokens.css
    │   ├── tipografia.css
    │   ├── status.css
    │   ├── layout.css
    │   ├── superficies.css
    │   ├── movimento.css
    │   ├── global.css
    │   └── graficos.ts                     (8) tema único dos gráficos
    ├── components/
    │   ├── ui/
    │   │   ├── variants.ts                 variantes nomeadas com class-variance-authority
    │   │   ├── Botao.tsx
    │   │   ├── CampoTexto.tsx
    │   │   ├── Seletor.tsx
    │   │   ├── TabelaDados.tsx
    │   │   ├── Etiqueta.tsx
    │   │   ├── BarraProgresso.tsx
    │   │   ├── Modal.tsx
    │   │   ├── DialogoConfirmacao.tsx
    │   │   ├── AvisoTemporario.tsx
    │   │   ├── EstadoVazio.tsx
    │   │   └── Cartao.tsx
    │   ├── charts/                         (8)
    │   │   ├── GraficoTemaSentimento.tsx
    │   │   └── GraficoGravidade.tsx
    │   └── layout/
    │       ├── EstruturaApp.tsx            (3)
    │       ├── BarraSuperior.tsx           (3)
    │       ├── NavegacaoLateral.tsx        (3)
    │       └── BarraConsumo.tsx            (9) consumo do plano em porcentagem
    ├── features/
    │   ├── auth/                           (3) cadastro, login, confirmação, redefinição, aceite de convite
    │   ├── legal/                          (3) termos de uso e política de privacidade
    │   ├── projects/                       (3)
    │   ├── settings/                       (3) perfil, usuários, convites, exclusão de dados, encerramento de conta
    │   ├── upload/                         (5) envio, prévia e mapeamento de colunas
    │   ├── dashboard/                      (8) cartões, gráficos e filtros
    │   ├── comments/                       (8) tabela e filtros
    │   ├── review-queue/                   (8)
    │   ├── onboarding/                     (8)
    │   ├── plans/                          (9) planos e consumo
    │   ├── google/                         (10) conexão e escolha de unidades
    │   ├── summaries/                      (11) cartões de resumo e evidências
    │   └── ask/                            (12) campo de pergunta, confirmação, resultado em faixas, histórico
    ├── hooks/                              hooks compartilhados entre funcionalidades
    ├── lib/
    │   ├── cn.ts               junção de classes
    │   └── format.ts                       números, porcentagens e datas em pt-BR
    └── i18n/
        └── pt-BR.ts                        os textos de cada fase entram na própria fase
```

# Fase 3: Fundação visual

**Entrega 1.** Depende de: fases 1 e 2.

## Leia antes

- `AGENTS.md`
- `docs/spec/referencia/tecnologias.md`, frontend
- `docs/spec/referencia/padroes-de-engenharia.md`
- `docs/spec/referencia/interface-visual.md`
- `docs/spec/referencia/auxiliar-de-design-mobbin.md`
- `docs/spec/referencia/estrutura-web.md`
- `docs/spec/referencia/estrutura-server.md`, apenas `http/plugins/estaticos.plugin.ts`
- o código de `server/src/modules/auth`, `projects`, `accounts` e `data-deletion`, para conhecer as rotas criadas na fase 2

## Nesta fase

- **Primeiro passo, antes de qualquer tela:** consulte o Mobbin conforme `auxiliar-de-design-mobbin.md` e entregue o plano de design descrito em `interface-visual.md`, com as referências (`mobbin_url`), paleta, fontes, escala tipográfica, esboço do painel e uma sugestão de nome para o negócio, e **pare até eu aprovar o plano**. O nome não precisa de aprovação: preencha `NOME_NEGOCIO` no `.env.development.example` com a sugestão e siga. Só depois da aprovação implemente o resto.
- Esqueleto de `web/`: `package.json`, `vite.config.ts` com proxy de `/api`, `vitest.config.ts`, `tsconfig.json`, `index.html`, configurações de ESLint (com as regras de React, hooks e acessibilidade de `padroes-de-engenharia.md`) e stylelint, Tailwind lendo os tokens. Adicione o workspace `web` ao `package.json` da raiz, junto com o script `stylelint`, e faça `typecheck`, `lint`, `test` e `verificar` da raiz cobrirem também o `web`.
- Todos os arquivos de `styles/`, as fontes externas declaradas em `fontes.css`, e o logotipo em SVG.
- Componentes base de `components/ui` **somente os que as telas desta fase usam**; os demais nascem na fase em que a primeira tela os pedir. Layout `EstruturaApp`, `BarraSuperior` e `NavegacaoLateral`. A `BarraConsumo` e os gráficos ficam para as fases 9 e 8.
- `api/http.ts`, `chaves-consulta.ts`, `types.ts`, `autenticacao.api.ts`, `projetos.api.ts` e `exclusao-dados.api.ts`.
- Telas de `features/auth`: cadastro com aceite dos termos, login, confirmação de e-mail com reenvio, redefinição de senha, aceite de convite (com aceite dos termos) e confirmação da troca de e-mail.
- Telas de `features/legal`: páginas de termos de uso e de política de privacidade, **públicas, sem exigir login**, com **texto provisório** identificado como tal. A política lista os serviços que recebem dados: TypeSafe AI (Jev), o provedor de LLM configurado, o Google (Perfil da Empresa e fontes) e o provedor de e-mail, e declara que a anonimização cobre CPF, CNPJ, e-mail, telefone e CEP, mas **não** nomes, endereços nem outros identificadores escritos no texto. O texto definitivo eu forneço depois.
- Telas de `features/projects`: lista, criar, renomear e apagar com confirmação digitando o nome.
- Telas de `features/settings`: perfil (trocar senha e e-mail), usuários (listar e remover), convites (enviar, listar pendentes e revogar), exclusão de dados e encerramento de conta. As ações exclusivas do `owner` ficam ocultas para o `member`.
- `i18n/pt-BR.ts` com os textos das telas desta fase, e cada fase seguinte acrescenta os seus, usando `{nomeNegocio}` no lugar do nome do negócio.
- Consumo da rota pública `GET /api/configuracao-publica`: o nome aparece no logotipo em texto da `BarraSuperior` e nas telas de login e cadastro.
- No servidor: `estaticos.plugin.ts` servindo o build do web em produção e substituindo `%NOME_NEGOCIO%` no `index.html`, já com escape de HTML, para o título da aba nascer certo. A política de segurança de conteúdo já existe desde a fase 1 e não é reescrita aqui. Em desenvolvimento, o front atualiza o título por código depois de buscar a rota pública.

## Especificação

Sem seção adicional. O detalhe está nos arquivos de referência.

## Testes desta fase

- `npm run build`, `verificar`, `stylelint` e `auditoria` passam sem ocorrências.
- Um componente com `dangerouslySetInnerHTML`, cor literal, valor arbitrário do Tailwind ou `style` visual inline faz o lint ou o stylelint falharem.
- Um teste com o `index.html` e o CSS reais do build garante que a política de segurança de conteúdo da fase 1 deixa carregar as fontes e estilos declarados e continua bloqueando fonte de domínio fora de `ORIGENS_FONTE_EXTERNA`.
- Um teste garante que o `index.html` servido em produção traz o nome do negócio no título, escapado.
- Testes de componentes com Vitest e Testing Library: `Botao`, `CampoTexto`, `Modal` (foco preso e retorno do foco), `DialogoConfirmacao` (só habilita ao digitar o nome) e os formulários de cadastro e login (validação, aceite dos termos e mensagens de erro).
- Teste de que ações exclusivas do `owner` não aparecem para o `member`.

## Pronto quando

1. Eu aprovei o plano de design antes de qualquer tela ser construída.
2. No navegador, contra a API real: cadastro, confirmação de e-mail pelo link que aparece no log, reenvio da confirmação, login, redefinição de senha, troca de senha e de e-mail, convite de um segundo usuário e revogação de outro convite, remoção de usuário, criar, renomear e apagar projeto e encerrar conta funcionam de ponta a ponta.
3. Na aba de rede do navegador, fontes vêm só dos domínios de `ORIGENS_FONTE_EXTERNA` e estilos externos vêm só dos domínios permitidos.
4. Nenhum componente tem cor, fonte ou tamanho fixo fora dos arquivos de estilo.

## Fora desta fase

- Upload, painel, planos e qualquer tela de dados de comentários.
- Testes ponta a ponta com navegador automatizado.

## Antes de parar

Passe pela lista de `AGENTS.md`. Confira também:

- [ ] Nenhum arquivo de fonte foi baixado para o projeto, toda cor está em `cores.css` e toda fonte em `fontes.css`.
- [ ] Nada visual se repete sem estilo compartilhado.
- [ ] Nenhum texto escreve o nome do negócio fixo, e o relatório informa o nome sugerido em `NOME_NEGOCIO`.
- [ ] Os textos jurídicos estão marcados como provisórios e o relatório avisa isso.

Entregue o relatório e espere minha confirmação. Não comece a próxima fase.

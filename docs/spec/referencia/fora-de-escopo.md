# Fora de escopo

Fora do escopo do MVP. **Não implemente** mesmo que pareça fácil:

- permissões granulares além de `owner` e `member`;
- login social, SSO corporativo ou autenticação em dois fatores;
- outras fontes além de upload e Google;
- qualquer uso de LLM além do resumo executivo por tema e da tradução de perguntas do arquivo `docs/spec/fases/fase-12-perguntar-ao-jev.md`;
- emissão de nota fiscal;
- provedor de pagamento real, webhook de cobrança, troca de plano, downgrade no próximo ciclo e suspensão por falta de pagamento;
- perguntas salvas como colunas da tabela e classificação automática delas nos comentários novos;
- geração automática semanal dos resumos executivos e botão de avaliação "útil / não útil";
- segundo provedor de LLM (o `ProvedorLlm` já permite acrescentar);
- deploy em nuvem, Docker de produção ou CI;
- testes ponta a ponta com navegador automatizado;
- prazo de expiração do plano `trial` e conversão para plano pago, que entram com a cobrança real;
- na fase 13: editor ou painel de blog, comentários, newsletter, formulário de contato, outros idiomas, análise de audiência, banner de cookies e preços ou depoimentos na landing;
- usar o Mobbin dentro do produto: a REST API, chamadas em runtime, chave ou token dele no código. Ele só auxilia o agente no design, pelo MCP (`auxiliar-de-design-mobbin.md`);
- texto jurídico definitivo dos termos de uso e da política de privacidade, que eu forneço; o sistema usa texto provisório até lá.

**Próximas versões, apenas para contexto de arquitetura.** Não implemente agora, mas não tome decisões que impeçam estes usos futuros da mesma interface `ProvedorLlm`:

- rascunho de resposta às avaliações do Google marcadas como precisa de ação, sempre aprovado por um humano antes de publicar;
- perguntas em linguagem natural que o LLM traduz para **filtros** de uma lista fechada definida pelo sistema, nunca SQL (a fase 12 já entrega outra coisa: a tradução da pergunta em uma pergunta sim ou não por comentário);
- segunda opinião do LLM para comentários com baixa confiança do Jev, antes da fila de revisão humana.

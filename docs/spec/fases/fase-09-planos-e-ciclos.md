# Fase 9: Planos e ciclos

**Entrega 2.** Depende de: fases 6, 7 e 8.

## Leia antes

- `AGENTS.md`
- `docs/spec/referencia/tecnologias.md`, agendamento
- `docs/spec/referencia/configuracao.md`, variáveis `COBRANCA_ATIVADA`, `GOOGLE_INTERVALO_SINCRONIZACAO_HORAS` e `PLANO_PADRAO_ID`
- `docs/spec/referencia/estrutura-server.md`, módulos `plans`, `billing`, `usage` e `scheduler`, e `scripts`
- `docs/spec/referencia/estrutura-web.md`, funcionalidade `plans` e `components/layout`
- `docs/spec/referencia/auxiliar-de-design-mobbin.md`, para consultar referências de design antes de desenhar as telas
- `docs/spec/referencia/banco-de-dados.md`, tabelas `planos`, `contas`, `alertas_consumo`, `livro_razao_consumo` e `execucoes_agendadas`
- `docs/spec/referencia/padroes-de-engenharia.md`, seções de arquitetura e segurança
- `docs/spec/fases/fase-06-controle-de-custo.md`, itens 5 a 7 e a parte de interface do limite de custo

## Nesta fase

- **Migrations desta fase:** crie em `server/migrations` os dois arquivos da seção "Migrations desta fase", com o SQL exato dela, e aplique-os.
- Módulo `billing`, somente a fronteira: a interface `ProvedorDeCobranca` e o `ProvedorDeCobrancaDesativado`, montado em `app.ts`. Sem rota de webhook, sem segredo e sem lógica de troca de plano: tudo isso entra junto com o provedor real.
- Módulo `usage`: `consumo.rotas.ts` com o consumo em porcentagem, `ciclos.servico.ts` com a virada de ciclo e a retomada de jobs pausados, o acréscimo em `consumo.sistema.repositorio.ts` da consulta que atravessa contas para achar as com ciclo vencido (as de reservas antigas e de jobs `paused_limit` vieram da fase 6), `alertas-consumo.servico.ts` com avisos em 80% e 100% por tela e por e-mail, uma vez por ciclo. O e-mail vai para todos os usuários `owner` da conta.
- Agendador em `scheduler/`: `agendador.ts` com trava em `execucoes_agendadas` e `agendamentos.ts` com a virada de ciclo, a liberação de reservas com mais de 15 minutos, a limpeza de sessões e tokens expirados e a limpeza de arquivos órfãos de `server/tmp/uploads`.
- `scripts/dev-avancar-ciclo.ts`, comando `dev:avancar-ciclo` que força a virada de ciclo de uma conta e se recusa a rodar em produção.
- Web: `BarraConsumo` no `BarraSuperior`, `features/plans` com a lista de planos, o plano atual e o consumo, `consumo.api.ts` e `planos.api.ts`.

## Especificação

### Planos e ciclos, com a cobrança fora do MVP

A integração com um provedor de pagamento é **futura**. Agora o sistema só deixa a fronteira pronta, para o provedor real entrar depois sem mexer nos serviços, e não cobra ninguém.

O que construir agora:

- Interface `ProvedorDeCobranca`, com os métodos para criar assinatura, trocar de plano e cancelar. Ela não fala de webhook: isso é detalhe do provedor real.
- Uma única implementação, `ProvedorDeCobrancaDesativado`, usada quando `COBRANCA_ATIVADA=false`. Com `COBRANCA_ATIVADA=true` e nenhum provedor real, o sistema não sobe. **Não implemente nenhum provedor real e não instale SDK de pagamento.**
- Tela de planos mostrando os planos, o atual e o consumo. O botão de trocar de plano aparece desabilitado com a mensagem "Troca de plano disponível em breve", e só o `owner` o vê.
- **Virada de ciclo:** quando `ciclo_termina_em` passa, a conta ganha um novo ciclo (`ciclo_iniciado_em` = agora, `ciclo_termina_em` = agora + 1 mês) e os jobs `paused_limit` dela são reavaliados e retomados, se agora couberem.
- **Reavaliação por mudança de limite:** já feita na inicialização pelo gancho da fase 6; esta fase só a reaproveita na virada de ciclo, sem reimplementá-la.
- **Quem dispara os avisos:** `alertas-consumo.servico.ts` é chamado por `controle-custo.servico.ts` depois de cada liquidação, e confere os limiares de 80% e 100% do ciclo atual.

Com a cobrança fora do ar, a mensagem de limite atingido diz apenas que o limite do mês foi atingido e quando renova.

O plano `trial` não tem prazo de expiração no MVP. Prazo de trial, troca de plano, downgrade no próximo ciclo, suspensão por falta de pagamento e webhook de confirmação entram junto com o provedor real.

## Migrations desta fase

Crie os arquivos abaixo em `server/migrations`, com este SQL exato.

```sql
-- 0011_alertas_consumo.sql
CREATE TABLE alertas_consumo (
  conta_id           uuid NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  ciclo_iniciado_em  timestamptz NOT NULL,
  limiar             smallint NOT NULL CHECK (limiar IN (80, 100)),
  enviado_em         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conta_id, ciclo_iniciado_em, limiar)
);

-- 0012_execucoes_agendadas.sql
CREATE TABLE execucoes_agendadas (
  nome           text NOT NULL,
  agendado_para  timestamptz NOT NULL,
  iniciado_em    timestamptz NOT NULL DEFAULT now(),
  finalizado_em  timestamptz,
  erro           text,
  PRIMARY KEY (nome, agendado_para)
);
```

## Testes desta fase

- Ao virar o ciclo, jobs em `paused_limit` da conta retomam automaticamente de onde pararam.
- Avisos de 80% e 100% são enviados uma única vez por ciclo.
- Com `COBRANCA_ATIVADA=true` e sem provedor real, o sistema não sobe.
- Os avisos de 80% e 100% chegam a todos os `owner` da conta e a nenhum `member`.
- A limpeza agendada apaga arquivos órfãos de `server/tmp/uploads` e não toca nos de jobs ativos.
- Testes de componentes da `BarraConsumo` (mostra só porcentagem, nunca dólar, tokens ou modelo) e da tela de planos (botão desabilitado com a cobrança desligada).
- O agendador não executa a mesma tarefa duas vezes.
- `dev:avancar-ciclo` se recusa a rodar em produção.
- A troca de plano aparece desabilitada, com a mensagem "Troca de plano disponível em breve", só para o `owner`.

## Pronto quando

1. Usar um plano com limite baixo, ver a classificação pausar ao atingir o limite, rodar `dev:avancar-ciclo` e ver a classificação retomar sozinha de onde parou.
2. Ver a barra de consumo em porcentagem no topo, sem nenhum valor em dólar nem nome de modelo.
3. As migrations desta fase aplicadas num PostgreSQL 16 real, duas vezes, sem erro.

## Fora desta fase

- Implementar qualquer provedor de pagamento real, instalar SDK de pagamento, rota de webhook ou lógica de troca de plano.
- Resumos, perguntas e Google.

## Antes de parar

Passe pela lista de `AGENTS.md`. Confira também:

- [ ] O cliente nunca vê dólar, tokens ou nomes de modelos.

Entregue o relatório e espere minha confirmação. Não comece a próxima fase.

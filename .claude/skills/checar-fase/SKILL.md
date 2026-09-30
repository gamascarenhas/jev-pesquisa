---
name: checar-fase
description: Use ao terminar uma fase do projeto, antes do relatório final. Detecta duplicação com o que já existe, roda o checklist do AGENTS.md e revisa só o diff da fase.
---

# Checar fase

Objetivo: barrar código redundante ou fora do padrão entre fases, lendo só o necessário.

## Passos

1. **Duplicação (antes de escrever e ao terminar).** Liste os arquivos novos e alterados pela fase. Para cada função, tipo, schema zod, componente ou constante nova, busque com Grep por nome e por intenção semelhante em `server/src`, `web/src` e `site/`. Se existir equivalente, reutilize ou mova para o módulo dono e remova a cópia. Não crie helper genérico para um único uso.
2. **Padrões.** Confira só os arquivos tocados contra `docs/spec/referencia/padroes-de-engenharia.md`: nomes em português, tamanho de função e arquivo, imports só por `*.servico.ts` e `*.tipos.ts`, erros, DTOs.
3. **Checklist.** Percorra "Antes de entregar qualquer fase" do `AGENTS.md`. Marque cada item com evidência curta (arquivo ou comando). Item sem evidência não passa.
4. **Revisão do diff.** Aplique `code-review` e `/security-review` apenas nos arquivos da fase. Foco: isolamento por `conta_id`, reserva de custo antes de chamar Jev/LLM, `texto_mascarado`, logs sem segredo, CSV neutralizado.
5. **Testes.** Toda regra nova tem teste. Use `tdd` ao criar. Rode `verificar`, `build` e `auditoria`.
6. **Arquitetura.** Se a fase adicionou módulo ou dependência entre módulos, rode `improve-codebase-architecture` só sobre esses módulos.

## Saída

Até 10 linhas: duplicações removidas, itens do checklist que falharam, achados de revisão e comandos que falharam. Nada além disso. Não reescreva o relatório de 40 linhas do `AGENTS.md`; alimente-o.

## Economia

Não releia fases anteriores nem a spec inteira. Não explique o que passou. Detalhe apenas o que falhou.

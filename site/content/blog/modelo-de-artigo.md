---
titulo: Modelo de artigo (copie este arquivo)
descricao: Artigo modelo provisório. Copie este arquivo, troque os campos e mude rascunho para false para publicar.
slug: modelo-de-artigo
publicadoEm: 2026-01-01
autor: Equipe
rascunho: true
---

Este arquivo é um **modelo**. Como usar:

1. Copie o arquivo para `site/content/blog/` com o nome que quiser (termina em `.md`).
2. Preencha o frontmatter: `titulo`, `descricao`, `slug` (letras minúsculas, números e hífens, sem repetir), `publicadoEm` e `autor`. `atualizadoEm` é opcional.
3. Para publicar, troque `rascunho: true` por `rascunho: false`.
4. Rode `npm run build`. Nenhum código precisa mudar.

Capa opcional, no frontmatter, com a imagem em `site/public/blog/`:

```yaml
imagem:
  arquivo: capa-do-artigo.png
  alt: Descrição da imagem para quem não a vê
  largura: 1200
  altura: 630
```

## Títulos e listas

Use `##` para as seções do artigo; o título da página é o `titulo` do frontmatter.

- Listas funcionam.
- Links externos recebem `rel="noopener noreferrer"` sozinhos, como [este](https://example.com).

> HTML bruto e `<script>` escritos aqui aparecem como texto, nunca são executados.

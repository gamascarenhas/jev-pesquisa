// Direção única das dependências: o site lê só de web/src/styles, web/src/components/ui e web/src/lib.
export const IMPORTACOES_PROIBIDAS_NO_SITE = {
  patterns: [
    {
      regex: '^@/(?!(styles|components/ui|lib)(/|$))',
      message: 'O site só importa de web/src/styles, web/src/components/ui e web/src/lib.',
    },
    {
      regex: '(^|/)web/src/',
      message: 'Importe do web pelo alias @/, e só de styles, components/ui e lib.',
    },
  ],
};

export const IMPORTACOES_PROIBIDAS_NO_WEB = {
  patterns: [
    {
      regex: '(^@site/)|(^|/)site/(src|scripts|content)(/|$)',
      message: 'Nada em web/ importa de site/.',
    },
  ],
};

// Tema único dos gráficos: só referencia tokens de cores.css e tokens.css, nunca valores fixos.
export const temaDosGraficos = {
  grade: 'var(--cor-borda)',
  eixo: 'var(--cor-borda-forte)',
  cursor: 'var(--cor-superficie-sutil)',
  sentimentos: {
    positive: 'var(--cor-sentimento-positivo)',
    neutral: 'var(--cor-sentimento-neutro)',
    negative: 'var(--cor-sentimento-negativo)',
    mixed: 'var(--cor-sentimento-misto)',
  } as Record<string, string>,
  gravidade: [
    'var(--cor-gravidade-0)',
    'var(--cor-gravidade-1)',
    'var(--cor-gravidade-2)',
    'var(--cor-gravidade-3)',
  ] as readonly string[],
  dimensaoInicial: { width: 640, height: 320 },
  alturaPorBarra: 40,
  alturaMinima: 240,
  margem: { top: 8, right: 16, bottom: 8, left: 8 },
  larguraDosRotulos: 150,
  raioDasBarras: 3,
} as const;

export const COR_PADRAO_DA_GRAVIDADE = 'var(--cor-gravidade-0)';

export const ORDEM_DOS_SENTIMENTOS = ['positive', 'neutral', 'mixed', 'negative'] as const;

import { cva, type VariantProps } from 'class-variance-authority';

export const botaoVariantes = cva(
  'inline-flex items-center justify-center gap-2 rounded-controle texto-rotulo movimento-cores disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variante: {
        primario: 'bg-acao text-acao-texto hover:bg-acao-hover',
        secundario: 'border border-borda-campo bg-superficie text-texto hover:bg-superficie-sutil',
        perigo: 'bg-perigo text-texto-invertido hover:bg-perigo-hover',
        fantasma: 'text-texto hover:bg-superficie-sutil',
      },
      tamanho: { md: 'h-10 px-4', sm: 'h-8 px-3' },
    },
    defaultVariants: { variante: 'primario', tamanho: 'md' },
  },
);

export const campoVariantes = cva(
  'h-10 w-full rounded-controle border bg-superficie px-3 texto-corpo placeholder:text-texto-secundario disabled:bg-superficie-sutil',
  {
    variants: { estado: { normal: 'border-borda-campo', erro: 'border-perigo' } },
    defaultVariants: { estado: 'normal' },
  },
);

export const etiquetaVariantes = cva(
  'inline-flex items-center rounded-pilula border px-2 texto-auxiliar font-medium',
  {
    variants: {
      tom: {
        sucesso: 'status-sucesso',
        atencao: 'status-atencao',
        critico: 'status-critico',
        info: 'status-info',
        neutro: 'status-neutro',
      },
    },
    defaultVariants: { tom: 'neutro' },
  },
);

export const alertaVariantes = cva('rounded-controle border px-3 py-2 texto-corpo', {
  variants: {
    tom: {
      sucesso: 'status-sucesso',
      atencao: 'status-atencao',
      critico: 'status-critico',
      info: 'status-info',
    },
  },
  defaultVariants: { tom: 'info' },
});

export const itemNavegacaoVariantes = cva(
  'flex h-9 items-center gap-2 rounded-controle px-3 texto-rotulo movimento-cores',
  {
    variants: {
      ativo: {
        sim: 'bg-acao-sutil text-acao',
        nao: 'text-texto-secundario hover:bg-superficie-sutil hover:text-texto',
      },
    },
    defaultVariants: { ativo: 'nao' },
  },
);

export type VariantesDoBotao = VariantProps<typeof botaoVariantes>;
export type TomDeAlerta = NonNullable<VariantProps<typeof alertaVariantes>['tom']>;
export type TomDeEtiqueta = NonNullable<VariantProps<typeof etiquetaVariantes>['tom']>;

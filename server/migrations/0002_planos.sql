CREATE TABLE planos (
  id                    text PRIMARY KEY,
  nome                  text NOT NULL,
  preco_mensal_centavos integer NOT NULL CHECK (preco_mensal_centavos >= 0),
  limite_custo_ia_usd   numeric(12,6) NOT NULL CHECK (limite_custo_ia_usd > 0),
  ativo                 boolean NOT NULL DEFAULT true,
  ordem                 integer NOT NULL DEFAULT 0,
  criado_em             timestamptz NOT NULL DEFAULT now()
);

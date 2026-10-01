import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { ContagemDeGravidade } from '@/api/types';
import { textos } from '@/i18n/pt-BR';
import { COR_PADRAO_DA_GRAVIDADE, temaDosGraficos } from '@/styles/graficos';

interface GraficoGravidadeProps {
  dados: ContagemDeGravidade[];
}

export function GraficoGravidade({ dados }: GraficoGravidadeProps) {
  const linhas = dados.map(({ nivel, total }) => ({
    nivel,
    rotulo: textos.rotulos.gravidade[nivel] ?? String(nivel),
    total,
    fill: temaDosGraficos.gravidade[nivel] ?? COR_PADRAO_DA_GRAVIDADE,
  }));

  return (
    <figure className="texto-grafico flex flex-col gap-3">
      <figcaption className="texto-titulo-secao">{textos.painel.graficoGravidade}</figcaption>
      <ResponsiveContainer
        width="100%"
        height={temaDosGraficos.alturaMinima}
        initialDimension={temaDosGraficos.dimensaoInicial}
      >
        <BarChart data={linhas} margin={temaDosGraficos.margem} accessibilityLayer>
          <CartesianGrid vertical={false} stroke={temaDosGraficos.grade} />
          <XAxis dataKey="rotulo" stroke={temaDosGraficos.eixo} />
          <YAxis allowDecimals={false} stroke={temaDosGraficos.eixo} />
          <Tooltip cursor={{ fill: temaDosGraficos.cursor }} />
          <Bar dataKey="total" name={textos.painel.quantidade} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}

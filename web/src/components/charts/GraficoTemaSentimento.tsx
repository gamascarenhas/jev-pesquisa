import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { ContagemTemaSentimento } from '@/api/types';
import { textos } from '@/i18n/pt-BR';
import { ORDEM_DOS_SENTIMENTOS, temaDosGraficos } from '@/styles/graficos';

interface LinhaDoGrafico {
  tema: string;
  rotulo: string;
  total: number;
  [sentimento: string]: string | number;
}

export function agruparPorTema(dados: ContagemTemaSentimento[]): LinhaDoGrafico[] {
  const linhas = new Map<string, LinhaDoGrafico>();
  for (const { tema, sentimento, total } of dados) {
    const linha = linhas.get(tema) ?? {
      tema,
      rotulo: textos.rotulos.temas[tema] ?? tema,
      total: 0,
    };
    linha[sentimento] = Number(linha[sentimento] ?? 0) + total;
    linha.total += total;
    linhas.set(tema, linha);
  }
  return [...linhas.values()].sort((a, b) => b.total - a.total);
}

interface GraficoTemaSentimentoProps {
  dados: ContagemTemaSentimento[];
}

export function GraficoTemaSentimento({ dados }: GraficoTemaSentimentoProps) {
  const linhas = agruparPorTema(dados);
  const altura = Math.max(
    temaDosGraficos.alturaMinima,
    linhas.length * temaDosGraficos.alturaPorBarra,
  );

  return (
    <figure className="texto-grafico flex flex-col gap-3">
      <figcaption className="texto-titulo-secao">{textos.painel.graficoTemas}</figcaption>
      <ResponsiveContainer
        width="100%"
        height={altura}
        initialDimension={{ width: temaDosGraficos.dimensaoInicial.width, height: altura }}
      >
        <BarChart
          data={linhas}
          layout="vertical"
          margin={temaDosGraficos.margem}
          accessibilityLayer
        >
          <CartesianGrid horizontal={false} stroke={temaDosGraficos.grade} />
          <XAxis type="number" allowDecimals={false} stroke={temaDosGraficos.eixo} />
          <YAxis
            type="category"
            dataKey="rotulo"
            width={temaDosGraficos.larguraDosRotulos}
            stroke={temaDosGraficos.eixo}
          />
          <Tooltip cursor={{ fill: temaDosGraficos.cursor }} />
          <Legend />
          {ORDEM_DOS_SENTIMENTOS.map((sentimento) => (
            <Bar
              key={sentimento}
              dataKey={sentimento}
              name={textos.rotulos.sentimentos[sentimento] ?? sentimento}
              stackId="tema"
              fill={temaDosGraficos.sentimentos[sentimento]}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}

import type { ResumoDoPainel } from '@/api/types';
import { textos } from '@/i18n/pt-BR';
import { formatarNumero } from '@/lib/format';

interface CartoesDeResumoProps {
  resumo: ResumoDoPainel;
}

interface Indicador {
  rotulo: string;
  valor: string;
}

export function CartoesDeResumo({ resumo }: CartoesDeResumoProps) {
  const indicadores: Indicador[] = [
    { rotulo: textos.painel.cartaoTotal, valor: formatarNumero(resumo.total) },
    { rotulo: textos.painel.cartaoClassificados, valor: formatarNumero(resumo.classificados) },
    { rotulo: textos.painel.cartaoRevisao, valor: formatarNumero(resumo.pendentesDeRevisao) },
    {
      rotulo: textos.painel.cartaoNota,
      valor:
        resumo.notaMedia === null
          ? textos.painel.semNota
          : resumo.notaMedia.toLocaleString('pt-BR', { minimumFractionDigits: 1 }),
    },
  ];
  return (
    <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {indicadores.map(({ rotulo, valor }) => (
        <div key={rotulo} className="superficie-plana flex flex-col gap-1 p-4">
          <dt className="texto-rotulo">{rotulo}</dt>
          <dd className="texto-destaque">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

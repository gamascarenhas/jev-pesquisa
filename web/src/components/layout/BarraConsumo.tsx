import { BarraProgresso } from '@/components/ui/BarraProgresso';
import { useConsumo } from '@/hooks/use-consumo';
import { textos } from '@/i18n/pt-BR';
import { formatarData, interpolar } from '@/lib/format';

const PORCENTAGEM_MAXIMA = 100;

// Só porcentagem do plano: o cliente nunca vê dólar, tokens nem modelo.
export function BarraConsumo() {
  const { data: consumo } = useConsumo();
  if (consumo === undefined) {
    return null;
  }
  const arredondada = Math.floor(consumo.porcentagem);
  const texto = consumo.limiteAtingido
    ? interpolar(textos.consumo.limiteAtingido, { data: formatarData(consumo.cicloTerminaEm) })
    : interpolar(textos.consumo.usado, { porcentagem: String(arredondada) });

  return (
    <div className="hidden w-48 flex-col gap-1 sm:flex" role="status">
      <span className="texto-auxiliar">{texto}</span>
      <BarraProgresso
        rotulo={textos.consumo.rotulo}
        valor={Math.min(arredondada, PORCENTAGEM_MAXIMA)}
        maximo={PORCENTAGEM_MAXIMA}
      />
    </div>
  );
}

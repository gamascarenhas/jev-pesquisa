import { Alerta } from '@/components/ui/Alerta';
import { BarraProgresso } from '@/components/ui/BarraProgresso';
import { Cartao } from '@/components/ui/Cartao';
import { useConsumo } from '@/hooks/use-consumo';
import { textos } from '@/i18n/pt-BR';
import { formatarData, interpolar } from '@/lib/format';

const PORCENTAGEM_MAXIMA = 100;

export function CartaoDeConsumo() {
  const { data: consumo } = useConsumo();
  if (consumo === undefined) {
    return null;
  }
  const { planos: t } = textos;
  const renovaEm = formatarData(consumo.cicloTerminaEm);
  const porcentagem = Math.floor(consumo.porcentagem);

  return (
    <Cartao titulo={t.consumoTitulo} descricao={interpolar(t.consumoTexto, { data: renovaEm })}>
      <BarraProgresso
        rotulo={textos.consumo.rotulo}
        valor={Math.min(porcentagem, PORCENTAGEM_MAXIMA)}
        maximo={PORCENTAGEM_MAXIMA}
      />
      <p className="texto-corpo">
        {interpolar(textos.consumo.usado, { porcentagem: String(porcentagem) })}
      </p>
      {consumo.limiteAtingido && (
        <Alerta tom="atencao">{interpolar(t.limiteAtingido, { data: renovaEm })}</Alerta>
      )}
    </Cartao>
  );
}

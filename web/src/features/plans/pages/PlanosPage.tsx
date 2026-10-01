import { Alerta } from '@/components/ui/Alerta';
import { Botao } from '@/components/ui/Botao';
import { Cartao } from '@/components/ui/Cartao';
import { Etiqueta } from '@/components/ui/Etiqueta';
import { useUsuarioAtual } from '@/hooks/use-usuario-atual';
import { useConta } from '@/features/settings/hooks/use-configuracoes';
import { textos } from '@/i18n/pt-BR';
import { formatarReais, interpolar } from '@/lib/format';

import { CartaoDeConsumo } from '../components/CartaoDeConsumo';
import { usePlanos } from '../hooks/use-planos';

export function PlanosPage() {
  const { data: usuario } = useUsuarioAtual();
  const { data: conta } = useConta();
  const { data: planos, isError } = usePlanos();
  const { planos: t } = textos;

  return (
    <div className="pilha-secoes">
      <h1 className="texto-titulo-pagina">{t.titulo}</h1>
      <CartaoDeConsumo />
      <Cartao titulo={t.listaTitulo}>
        {isError && <Alerta tom="critico">{t.erro}</Alerta>}
        <ul className="flex flex-col gap-3">
          {planos?.itens.map((plano) => (
            <li key={plano.id} className="pilha-horizontal justify-between">
              <span className="pilha-horizontal texto-corpo">
                {plano.nome}
                {plano.id === conta?.plano.id && <Etiqueta tom="sucesso">{t.atual}</Etiqueta>}
              </span>
              <span className="texto-secundario">
                {plano.precoMensalCentavos === 0
                  ? t.gratis
                  : interpolar(t.porMes, { preco: formatarReais(plano.precoMensalCentavos) })}
              </span>
            </li>
          ))}
        </ul>
        {usuario?.papel === 'owner' && (
          <div className="flex flex-col gap-1">
            <Botao variante="secundario" disabled aria-describedby="troca-em-breve">
              {t.trocar}
            </Botao>
            <p id="troca-em-breve" className="texto-auxiliar">
              {t.trocarEmBreve}
            </p>
          </div>
        )}
      </Cartao>
    </div>
  );
}

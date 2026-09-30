import { Alerta } from '@/components/ui/Alerta';
import { Cartao } from '@/components/ui/Cartao';
import { textos } from '@/i18n/pt-BR';

import { ApenasDono } from '../components/ApenasDono';
import { FormularioConvite } from '../components/FormularioConvite';
import { TabelaDeConvites } from '../components/TabelaDeConvites';
import { useConvites } from '../hooks/use-configuracoes';

function ConvitesPendentes() {
  const consulta = useConvites();
  const { convites } = textos.configuracoes;

  return (
    <section className="pilha-vertical">
      <h2 className="texto-titulo-secao">{convites.pendentes}</h2>
      {consulta.isPending && <p className="texto-corpo">{textos.comum.carregando}</p>}
      {consulta.isError && <Alerta tom="critico">{textos.comum.erroCarregar}</Alerta>}
      {consulta.data?.itens.length === 0 && (
        <p className="texto-corpo texto-secundario">{convites.vazio}</p>
      )}
      {consulta.data !== undefined && consulta.data.itens.length > 0 && (
        <TabelaDeConvites itens={consulta.data.itens} />
      )}
    </section>
  );
}

export function ConvitesPage() {
  const { convites } = textos.configuracoes;
  return (
    <div className="pilha-secoes">
      <header className="flex flex-col gap-1">
        <h1 className="texto-titulo-pagina">{convites.titulo}</h1>
        <p className="texto-corpo texto-secundario">{convites.descricao}</p>
      </header>
      <ApenasDono>
        <Cartao>
          <FormularioConvite />
        </Cartao>
        <ConvitesPendentes />
      </ApenasDono>
    </div>
  );
}

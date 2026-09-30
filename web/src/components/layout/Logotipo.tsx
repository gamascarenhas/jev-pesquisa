import { textos } from '@/i18n/pt-BR';
import { useNomeNegocio } from '@/hooks/use-nome-negocio';
import logotipo from '@/assets/images/logotipo.svg';
import { interpolar } from '@/lib/format';

export function Logotipo() {
  const nomeNegocio = useNomeNegocio();
  return (
    <span className="pilha-horizontal">
      <img
        src={logotipo}
        alt={interpolar(textos.navegacao.logotipo, { nomeNegocio })}
        className="size-8"
      />
      <span className="texto-titulo-secao">{nomeNegocio}</span>
    </span>
  );
}

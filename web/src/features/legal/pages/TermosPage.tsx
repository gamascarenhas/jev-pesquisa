import { useNomeNegocio } from '@/hooks/use-nome-negocio';
import { textos } from '@/i18n/pt-BR';
import { interpolar } from '@/lib/format';

import { PaginaLegal } from '../components/PaginaLegal';

export function TermosPage() {
  const nomeNegocio = useNomeNegocio();
  const { termos } = textos.legal;

  return (
    <PaginaLegal titulo={termos.titulo}>
      {termos.secoes.map((secao) => (
        <section key={secao.titulo} className="flex flex-col gap-1">
          <h2 className="texto-titulo-secao">{secao.titulo}</h2>
          <p className="texto-corpo">{interpolar(secao.texto, { nomeNegocio })}</p>
        </section>
      ))}
    </PaginaLegal>
  );
}

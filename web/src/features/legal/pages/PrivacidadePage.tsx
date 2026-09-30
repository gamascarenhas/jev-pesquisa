import { useNomeNegocio } from '@/hooks/use-nome-negocio';
import { textos } from '@/i18n/pt-BR';
import { interpolar } from '@/lib/format';

import { PaginaLegal } from '../components/PaginaLegal';

export function PrivacidadePage() {
  const nomeNegocio = useNomeNegocio();
  const { privacidade } = textos.legal;

  return (
    <PaginaLegal titulo={privacidade.titulo}>
      <p className="texto-corpo">{interpolar(privacidade.intro, { nomeNegocio })}</p>
      <section className="flex flex-col gap-2">
        <h2 className="texto-titulo-secao">{privacidade.servicosTitulo}</h2>
        <ul className="texto-corpo flex list-disc flex-col gap-1 pl-5">
          {privacidade.servicos.map((servico) => (
            <li key={servico}>{servico}</li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-1">
        <h2 className="texto-titulo-secao">{privacidade.anonimizacaoTitulo}</h2>
        <p className="texto-corpo">{privacidade.anonimizacao}</p>
      </section>
      <section className="flex flex-col gap-1">
        <h2 className="texto-titulo-secao">{privacidade.retencaoTitulo}</h2>
        <p className="texto-corpo">{privacidade.retencao}</p>
      </section>
    </PaginaLegal>
  );
}

import { comNomeDoNegocio, textosDoSite } from '@site/i18n/site.pt-BR';
import { urlDoApp } from '@site/seo/metadados';

function gruposDoRodape() {
  const { rodape, navegacao } = textosDoSite;
  return [
    {
      titulo: rodape.produto,
      links: [
        { rotulo: navegacao.comoFunciona, href: '/#como-funciona' },
        { rotulo: navegacao.demonstracao, href: '/#demonstracao' },
        { rotulo: navegacao.perguntas, href: '/#perguntas' },
      ],
    },
    { titulo: rodape.conteudo, links: [{ rotulo: rodape.blog, href: '/blog/' }] },
    {
      titulo: rodape.legal,
      links: [
        { rotulo: rodape.termos, href: urlDoApp('/termos') },
        { rotulo: rodape.privacidade, href: urlDoApp('/privacidade') },
      ],
    },
    {
      titulo: rodape.conta,
      links: [
        { rotulo: rodape.entrar, href: urlDoApp('/entrar') },
        { rotulo: rodape.criarConta, href: urlDoApp('/cadastro') },
      ],
    },
  ];
}

export function RodapePublico() {
  const { rodape } = textosDoSite;
  return (
    <footer className="site-rodape">
      <div className="site-conteudo flex flex-col gap-8">
        <div className="site-rodape-grade">
          <div className="flex flex-col gap-2">
            <a href="/" className="site-nome">
              <span className="site-logo" aria-hidden="true" />
              {comNomeDoNegocio('{nomeNegocio}')}
            </a>
            <p className="texto-corpo texto-secundario">{rodape.descricao}</p>
          </div>
          <nav aria-label={rodape.navegacao} className="site-rodape-grupos">
            {gruposDoRodape().map((grupo) => (
              <div key={grupo.titulo} className="flex flex-col gap-2">
                <p className="texto-rotulo">{grupo.titulo}</p>
                <ul className="flex flex-col gap-2">
                  {grupo.links.map((link) => (
                    <li key={link.rotulo}>
                      <a href={link.href} className="site-rodape-link">
                        {link.rotulo}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <p className="texto-auxiliar">{comNomeDoNegocio(rodape.direitos)}</p>
      </div>
    </footer>
  );
}

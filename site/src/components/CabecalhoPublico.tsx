import { botaoVariantes } from '@/components/ui/variants';
import { comNomeDoNegocio, textosDoSite } from '@site/i18n/site.pt-BR';
import { urlDoApp } from '@site/seo/metadados';

export function CabecalhoPublico() {
  const { navegacao } = textosDoSite;
  return (
    <header className="site-cabecalho">
      <div className="site-conteudo site-cabecalho-barra">
        <a href="/" className="site-nome">
          <span className="site-logo" aria-hidden="true" />
          {comNomeDoNegocio('{nomeNegocio}')}
        </a>
        <nav aria-label={navegacao.principal} className="site-menu">
          <a href="/#como-funciona" className="site-menu-ancora">
            {navegacao.comoFunciona}
          </a>
          <a href="/#demonstracao" className="site-menu-ancora">
            {navegacao.demonstracao}
          </a>
          <a href="/#perguntas" className="site-menu-ancora">
            {navegacao.perguntas}
          </a>
          <a href="/blog/">{navegacao.blog}</a>
          <a href={urlDoApp('/entrar')}>{navegacao.entrar}</a>
          <a
            href={urlDoApp('/cadastro')}
            className={botaoVariantes({ variante: 'primario', tamanho: 'sm' })}
          >
            {navegacao.criarConta}
          </a>
        </nav>
      </div>
    </header>
  );
}

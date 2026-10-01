import { Link } from 'react-router';

import type { Projeto } from '@/api/types';
import { Botao } from '@/components/ui/Botao';
import { botaoVariantes } from '@/components/ui/variants';
import { textos } from '@/i18n/pt-BR';
import { interpolar } from '@/lib/format';

interface AcoesDoProjetoProps {
  projeto: Projeto;
  ehDono: boolean;
  aoRenomear: (projeto: Projeto) => void;
  aoApagar: (projeto: Projeto) => void;
}

const LINKS_SECUNDARIOS = [
  { caminho: 'classificar', rotulo: textos.projetos.classificar },
  { caminho: 'importar', rotulo: textos.projetos.importar },
  { caminho: 'google', rotulo: textos.projetos.google },
];

export function AcoesDoProjeto({ projeto, ehDono, aoRenomear, aoApagar }: AcoesDoProjetoProps) {
  return (
    <div
      className="pilha-horizontal"
      role="group"
      aria-label={interpolar(textos.projetos.acoesDo, { nome: projeto.nome })}
    >
      <Link
        to={`/projetos/${projeto.id}/painel`}
        className={botaoVariantes({ variante: 'primario', tamanho: 'sm' })}
      >
        {textos.projetos.painel}
      </Link>
      {LINKS_SECUNDARIOS.map(({ caminho, rotulo }) => (
        <Link
          key={caminho}
          to={`/projetos/${projeto.id}/${caminho}`}
          className={botaoVariantes({ variante: 'secundario', tamanho: 'sm' })}
        >
          {rotulo}
        </Link>
      ))}
      <Botao
        variante="secundario"
        tamanho="sm"
        onClick={() => {
          aoRenomear(projeto);
        }}
      >
        {textos.projetos.renomear}
      </Botao>
      {ehDono && (
        <Botao
          variante="perigo"
          tamanho="sm"
          onClick={() => {
            aoApagar(projeto);
          }}
        >
          {textos.projetos.apagar}
        </Botao>
      )}
    </div>
  );
}

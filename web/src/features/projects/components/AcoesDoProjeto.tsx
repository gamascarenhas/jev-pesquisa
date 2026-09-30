import type { Projeto } from '@/api/types';
import { Botao } from '@/components/ui/Botao';
import { textos } from '@/i18n/pt-BR';
import { interpolar } from '@/lib/format';

interface AcoesDoProjetoProps {
  projeto: Projeto;
  ehDono: boolean;
  aoRenomear: (projeto: Projeto) => void;
  aoApagar: (projeto: Projeto) => void;
}

export function AcoesDoProjeto({ projeto, ehDono, aoRenomear, aoApagar }: AcoesDoProjetoProps) {
  return (
    <div
      className="pilha-horizontal"
      role="group"
      aria-label={interpolar(textos.projetos.acoesDo, { nome: projeto.nome })}
    >
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

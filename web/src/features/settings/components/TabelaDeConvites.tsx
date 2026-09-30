import type { Convite } from '@/api/types';
import { useAvisos } from '@/components/ui/AvisoTemporario';
import { Botao } from '@/components/ui/Botao';
import { Etiqueta } from '@/components/ui/Etiqueta';
import { TabelaDados, type ColunaDaTabela } from '@/components/ui/TabelaDados';
import { textos } from '@/i18n/pt-BR';
import { formatarData, interpolar } from '@/lib/format';

import { useRevogarConvite } from '../hooks/use-configuracoes';

const { convites } = textos.configuracoes;

function BotaoRevogar({ convite }: { convite: Convite }) {
  const avisar = useAvisos();
  const mutacao = useRevogarConvite(() => {
    avisar(convites.revogado);
  });
  return (
    <Botao
      variante="secundario"
      tamanho="sm"
      carregando={mutacao.isPending}
      aria-label={interpolar(convites.revogarDe, { email: convite.email })}
      onClick={() => {
        mutacao.mutate(convite.id);
      }}
    >
      {convites.revogar}
    </Botao>
  );
}

const COLUNAS: ColunaDaTabela<Convite>[] = [
  {
    chave: 'email',
    titulo: convites.colunaEmail,
    renderizar: (convite) => (
      <span className="pilha-horizontal">
        {convite.email}
        <Etiqueta tom="atencao">{convites.pendente}</Etiqueta>
      </span>
    ),
  },
  {
    chave: 'papel',
    titulo: convites.colunaPapel,
    renderizar: (convite) =>
      convite.papel === 'owner' ? textos.comum.papelOwner : textos.comum.papelMember,
  },
  {
    chave: 'expiraEm',
    titulo: convites.colunaExpira,
    renderizar: (convite) => formatarData(convite.expiraEm),
  },
  {
    chave: 'acoes',
    titulo: textos.projetos.colunaAcoes,
    renderizar: (convite) => <BotaoRevogar convite={convite} />,
  },
];

export function TabelaDeConvites({ itens }: { itens: Convite[] }) {
  return (
    <TabelaDados
      legenda={convites.pendentes}
      colunas={COLUNAS}
      linhas={itens}
      chaveDaLinha={(convite) => convite.id}
    />
  );
}

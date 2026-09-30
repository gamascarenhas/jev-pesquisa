import type { Usuario } from '@/api/types';
import { Botao } from '@/components/ui/Botao';
import { Etiqueta } from '@/components/ui/Etiqueta';
import type { ColunaDaTabela } from '@/components/ui/TabelaDados';
import { textos } from '@/i18n/pt-BR';
import { interpolar } from '@/lib/format';

const { usuarios } = textos.configuracoes;

export function colunasDeUsuarios(
  idAtual: string | undefined,
  aoRemover: (usuario: Usuario) => void,
): ColunaDaTabela<Usuario>[] {
  return [
    {
      chave: 'nome',
      titulo: usuarios.colunaNome,
      renderizar: (usuario) => (
        <span className="pilha-horizontal">
          {usuario.nome}
          {usuario.id === idAtual && <Etiqueta>{usuarios.voce}</Etiqueta>}
        </span>
      ),
    },
    { chave: 'email', titulo: usuarios.colunaEmail, renderizar: (usuario) => usuario.email },
    {
      chave: 'papel',
      titulo: usuarios.colunaPapel,
      renderizar: (usuario) =>
        usuario.papel === 'owner' ? textos.comum.papelOwner : textos.comum.papelMember,
    },
    {
      chave: 'acoes',
      titulo: textos.projetos.colunaAcoes,
      renderizar: (usuario) =>
        usuario.id === idAtual ? null : (
          <Botao
            variante="perigo"
            tamanho="sm"
            aria-label={interpolar(usuarios.removerDe, { nome: usuario.nome })}
            onClick={() => {
              aoRemover(usuario);
            }}
          >
            {usuarios.remover}
          </Botao>
        ),
    },
  ];
}

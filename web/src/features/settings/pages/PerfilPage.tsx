import { Cartao } from '@/components/ui/Cartao';
import { Etiqueta } from '@/components/ui/Etiqueta';
import { useUsuarioAtual } from '@/hooks/use-usuario-atual';
import { textos } from '@/i18n/pt-BR';

import { FormularioTrocarEmail } from '../components/FormularioTrocarEmail';
import { FormularioTrocarSenha } from '../components/FormularioTrocarSenha';

export function PerfilPage() {
  const { data: usuario } = useUsuarioAtual();
  const { perfil } = textos.configuracoes;

  return (
    <div className="pilha-secoes">
      <h1 className="texto-titulo-pagina">{perfil.titulo}</h1>
      {usuario && (
        <Cartao titulo={perfil.dados}>
          <dl className="flex flex-col gap-1">
            <dt className="texto-auxiliar">{textos.campos.nomeUsuario}</dt>
            <dd className="texto-corpo">{usuario.nome}</dd>
            <dt className="texto-auxiliar">{textos.campos.email}</dt>
            <dd className="pilha-horizontal texto-corpo">
              {usuario.email}
              <Etiqueta tom={usuario.emailConfirmado ? 'sucesso' : 'atencao'}>
                {usuario.emailConfirmado ? perfil.emailConfirmado : perfil.emailPendente}
              </Etiqueta>
            </dd>
          </dl>
        </Cartao>
      )}
      <Cartao titulo={perfil.emailTitulo} descricao={perfil.emailTexto}>
        <FormularioTrocarEmail />
      </Cartao>
      <Cartao titulo={perfil.senhaTitulo}>
        <FormularioTrocarSenha />
      </Cartao>
    </div>
  );
}

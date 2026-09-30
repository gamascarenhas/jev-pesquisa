import { useState } from 'react';

import type { Usuario } from '@/api/types';
import { Alerta } from '@/components/ui/Alerta';
import { TabelaDados } from '@/components/ui/TabelaDados';
import { useUsuarioAtual } from '@/hooks/use-usuario-atual';
import { textos } from '@/i18n/pt-BR';

import { ApenasDono } from '../components/ApenasDono';
import { colunasDeUsuarios } from '../components/colunas-de-usuarios';
import { ModalRemoverUsuario } from '../components/ModalRemoverUsuario';
import { useUsuarios } from '../hooks/use-configuracoes';

function ListaDeUsuarios() {
  const [removendo, setRemovendo] = useState<Usuario | null>(null);
  const { data: atual } = useUsuarioAtual();
  const consulta = useUsuarios();
  const colunas = colunasDeUsuarios(atual?.id, setRemovendo);

  return (
    <>
      {consulta.isPending && <p className="texto-corpo">{textos.comum.carregando}</p>}
      {consulta.isError && <Alerta tom="critico">{textos.comum.erroCarregar}</Alerta>}
      {consulta.data && (
        <TabelaDados
          legenda={textos.configuracoes.usuarios.titulo}
          colunas={colunas}
          linhas={consulta.data.itens}
          chaveDaLinha={(usuario) => usuario.id}
        />
      )}
      {removendo !== null && (
        <ModalRemoverUsuario
          usuario={removendo}
          aoFechar={() => {
            setRemovendo(null);
          }}
        />
      )}
    </>
  );
}

export function UsuariosPage() {
  return (
    <div className="pilha-vertical">
      <header className="flex flex-col gap-1">
        <h1 className="texto-titulo-pagina">{textos.configuracoes.usuarios.titulo}</h1>
        <p className="texto-corpo texto-secundario">{textos.configuracoes.usuarios.descricao}</p>
      </header>
      <ApenasDono>
        <ListaDeUsuarios />
      </ApenasDono>
    </div>
  );
}

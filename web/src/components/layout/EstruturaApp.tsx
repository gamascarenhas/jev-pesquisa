import { useState } from 'react';
import { Outlet } from 'react-router';

import type { Usuario } from '@/api/types';

import { AvisoEmailNaoConfirmado } from './AvisoEmailNaoConfirmado';
import { BarraSuperior } from './BarraSuperior';
import { NavegacaoLateral } from './NavegacaoLateral';

export function EstruturaApp({ usuario }: { usuario: Usuario }) {
  const [menuAberto, setMenuAberto] = useState(false);

  return (
    <div className="estrutura-app">
      <BarraSuperior
        usuario={usuario}
        menuAberto={menuAberto}
        aoAlternarMenu={() => {
          setMenuAberto((aberto) => !aberto);
        }}
      />
      <div className="estrutura-app-corpo">
        <NavegacaoLateral
          aberta={menuAberto}
          ehDono={usuario.papel === 'owner'}
          aoNavegar={() => {
            setMenuAberto(false);
          }}
        />
        <main className="pagina-conteudo pilha-vertical">
          {!usuario.emailConfirmado && <AvisoEmailNaoConfirmado usuario={usuario} />}
          <Outlet />
        </main>
      </div>
    </div>
  );
}

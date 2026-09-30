import { FolderOpen, Mail, ShieldAlert, User, Users, type LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router';

import { cn } from '@/lib/cn';
import { textos } from '@/i18n/pt-BR';

import { itemNavegacaoVariantes } from '../ui/variants';

interface ItemDeNavegacao {
  caminho: string;
  rotulo: string;
  icone: LucideIcon;
  somenteDono: boolean;
}

const ITENS_PRINCIPAIS: ItemDeNavegacao[] = [
  {
    caminho: '/projetos',
    rotulo: textos.navegacao.projetos,
    icone: FolderOpen,
    somenteDono: false,
  },
];

const ITENS_DE_CONFIGURACAO: ItemDeNavegacao[] = [
  {
    caminho: '/configuracoes/perfil',
    rotulo: textos.navegacao.perfil,
    icone: User,
    somenteDono: false,
  },
  {
    caminho: '/configuracoes/usuarios',
    rotulo: textos.navegacao.usuarios,
    icone: Users,
    somenteDono: true,
  },
  {
    caminho: '/configuracoes/convites',
    rotulo: textos.navegacao.convites,
    icone: Mail,
    somenteDono: true,
  },
  {
    caminho: '/configuracoes/dados',
    rotulo: textos.navegacao.dadosEConta,
    icone: ShieldAlert,
    somenteDono: true,
  },
];

interface NavegacaoLateralProps {
  aberta: boolean;
  ehDono: boolean;
  aoNavegar: () => void;
}

function Itens({
  itens,
  ehDono,
  aoNavegar,
}: {
  itens: ItemDeNavegacao[];
  ehDono: boolean;
  aoNavegar: () => void;
}) {
  return (
    <ul className="flex flex-col gap-1">
      {itens
        .filter((item) => ehDono || !item.somenteDono)
        .map(({ caminho, rotulo, icone: Icone }) => (
          <li key={caminho}>
            <NavLink
              to={caminho}
              onClick={aoNavegar}
              className={({ isActive }) =>
                itemNavegacaoVariantes({ ativo: isActive ? 'sim' : 'nao' })
              }
            >
              <Icone size="1.15rem" aria-hidden="true" />
              {rotulo}
            </NavLink>
          </li>
        ))}
    </ul>
  );
}

export function NavegacaoLateral({ aberta, ehDono, aoNavegar }: NavegacaoLateralProps) {
  return (
    <nav
      aria-label={textos.navegacao.principal}
      className={cn(
        'superficie-plana flex-col gap-6 rounded-none border-y-0 border-l-0 p-4',
        aberta ? 'camada-lateral fixed inset-x-0 top-14 bottom-0 flex' : 'hidden md:flex',
      )}
    >
      <Itens itens={ITENS_PRINCIPAIS} ehDono={ehDono} aoNavegar={aoNavegar} />
      <section className="flex flex-col gap-1">
        <h2 className="texto-auxiliar px-3 pb-1">{textos.navegacao.configuracoes}</h2>
        <Itens itens={ITENS_DE_CONFIGURACAO} ehDono={ehDono} aoNavegar={aoNavegar} />
      </section>
    </nav>
  );
}

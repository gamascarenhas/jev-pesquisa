import { Link, Navigate, type RouteObject } from 'react-router';

import { textos } from '@/i18n/pt-BR';
import { AceitarConvitePage } from '@/features/auth/pages/AceitarConvitePage';
import { CadastroPage } from '@/features/auth/pages/CadastroPage';
import { ConfirmarEmailPage } from '@/features/auth/pages/ConfirmarEmailPage';
import { ConfirmarNovoEmailPage } from '@/features/auth/pages/ConfirmarNovoEmailPage';
import { EsqueciSenhaPage } from '@/features/auth/pages/EsqueciSenhaPage';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { RedefinirSenhaPage } from '@/features/auth/pages/RedefinirSenhaPage';
import { PrivacidadePage } from '@/features/legal/pages/PrivacidadePage';
import { TermosPage } from '@/features/legal/pages/TermosPage';
import { ProjetosPage } from '@/features/projects/pages/ProjetosPage';
import { ConvitesPage } from '@/features/settings/pages/ConvitesPage';
import { DadosEContaPage } from '@/features/settings/pages/DadosEContaPage';
import { PerfilPage } from '@/features/settings/pages/PerfilPage';
import { UsuariosPage } from '@/features/settings/pages/UsuariosPage';

import { ExigirAutenticacao } from './guards/ExigirAutenticacao';

function NaoEncontradaPage() {
  return (
    <main className="tela-centralizada">
      <h1 className="texto-titulo-pagina">{textos.naoEncontrada.titulo}</h1>
      <p className="texto-corpo texto-secundario">{textos.naoEncontrada.texto}</p>
      <Link to="/" className="texto-link">
        {textos.naoEncontrada.voltar}
      </Link>
    </main>
  );
}

export const rotas: RouteObject[] = [
  { path: '/entrar', element: <LoginPage /> },
  { path: '/cadastro', element: <CadastroPage /> },
  { path: '/esqueci-senha', element: <EsqueciSenhaPage /> },
  { path: '/redefinir-senha', element: <RedefinirSenhaPage /> },
  { path: '/confirmar-email', element: <ConfirmarEmailPage /> },
  { path: '/confirmar-novo-email', element: <ConfirmarNovoEmailPage /> },
  { path: '/aceitar-convite', element: <AceitarConvitePage /> },
  { path: '/termos', element: <TermosPage /> },
  { path: '/privacidade', element: <PrivacidadePage /> },
  {
    element: <ExigirAutenticacao />,
    children: [
      { path: '/projetos', element: <ProjetosPage /> },
      { path: '/configuracoes/perfil', element: <PerfilPage /> },
      { path: '/configuracoes/usuarios', element: <UsuariosPage /> },
      { path: '/configuracoes/convites', element: <ConvitesPage /> },
      { path: '/configuracoes/dados', element: <DadosEContaPage /> },
    ],
  },
  { path: '/', element: <Navigate to="/projetos" replace /> },
  { path: '*', element: <NaoEncontradaPage /> },
];

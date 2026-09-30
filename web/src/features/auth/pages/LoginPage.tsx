import { Link, Navigate } from 'react-router';

import { useNomeNegocio } from '@/hooks/use-nome-negocio';
import { useUsuarioAtual } from '@/hooks/use-usuario-atual';
import { textos } from '@/i18n/pt-BR';
import { interpolar } from '@/lib/format';

import { FormularioLogin } from '../components/FormularioLogin';
import { TelaDeAutenticacao } from '../components/TelaDeAutenticacao';

export function LoginPage() {
  const nomeNegocio = useNomeNegocio();
  const { data: usuario } = useUsuarioAtual();

  if (usuario) {
    return <Navigate to="/projetos" replace />;
  }
  return (
    <TelaDeAutenticacao titulo={interpolar(textos.auth.login.titulo, { nomeNegocio })}>
      <FormularioLogin />
      <p className="texto-corpo texto-secundario">
        {textos.auth.login.semConta}{' '}
        <Link to="/cadastro" className="texto-link">
          {textos.auth.login.criarConta}
        </Link>
      </p>
    </TelaDeAutenticacao>
  );
}

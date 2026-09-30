import { Navigate } from 'react-router';

import { EstruturaApp } from '@/components/layout/EstruturaApp';
import { useUsuarioAtual } from '@/hooks/use-usuario-atual';
import { textos } from '@/i18n/pt-BR';

export function ExigirAutenticacao() {
  const { data: usuario, isPending, isError } = useUsuarioAtual();

  if (isPending) {
    return <p className="texto-corpo p-6">{textos.comum.carregando}</p>;
  }
  if (isError) {
    return <p className="texto-corpo texto-erro p-6">{textos.comum.erroCarregar}</p>;
  }
  if (usuario === null) {
    return <Navigate to="/entrar" replace />;
  }
  return <EstruturaApp usuario={usuario} />;
}

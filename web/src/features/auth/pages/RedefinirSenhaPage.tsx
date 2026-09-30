import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Alerta } from '@/components/ui/Alerta';
import { textos } from '@/i18n/pt-BR';

import { FormularioRedefinirSenha } from '../components/FormularioRedefinirSenha';
import { TelaDeAutenticacao } from '../components/TelaDeAutenticacao';

export function RedefinirSenhaPage() {
  const [parametros] = useSearchParams();
  const token = parametros.get('token');
  const [concluido, setConcluido] = useState(false);
  const { redefinirSenha } = textos.auth;

  return (
    <TelaDeAutenticacao titulo={redefinirSenha.titulo}>
      {token === null || token === '' ? (
        <Alerta tom="critico">{redefinirSenha.linkAusente}</Alerta>
      ) : concluido ? (
        <Alerta tom="sucesso">{redefinirSenha.sucesso}</Alerta>
      ) : (
        <FormularioRedefinirSenha
          token={token}
          aoConcluir={() => {
            setConcluido(true);
          }}
        />
      )}
      <Link to="/entrar" className="texto-link">
        {textos.auth.confirmarEmail.entrar}
      </Link>
    </TelaDeAutenticacao>
  );
}

import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Alerta } from '@/components/ui/Alerta';
import { useNomeNegocio } from '@/hooks/use-nome-negocio';
import { textos } from '@/i18n/pt-BR';
import { interpolar } from '@/lib/format';

import { FormularioAceitarConvite } from '../components/FormularioAceitarConvite';
import { TelaDeAutenticacao } from '../components/TelaDeAutenticacao';

export function AceitarConvitePage() {
  const nomeNegocio = useNomeNegocio();
  const [parametros] = useSearchParams();
  const token = parametros.get('token');
  const [concluido, setConcluido] = useState(false);
  const { aceitarConvite } = textos.auth;

  return (
    <TelaDeAutenticacao
      titulo={interpolar(aceitarConvite.titulo, { nomeNegocio })}
      subtitulo={aceitarConvite.subtitulo}
    >
      {token === null || token === '' ? (
        <Alerta tom="critico">{aceitarConvite.linkAusente}</Alerta>
      ) : concluido ? (
        <>
          <Alerta tom="sucesso">{aceitarConvite.sucesso}</Alerta>
          <Link to="/entrar" className="texto-link">
            {textos.auth.confirmarEmail.entrar}
          </Link>
        </>
      ) : (
        <FormularioAceitarConvite
          token={token}
          aoConcluir={() => {
            setConcluido(true);
          }}
        />
      )}
    </TelaDeAutenticacao>
  );
}

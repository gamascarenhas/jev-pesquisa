import { useState } from 'react';
import { Link } from 'react-router';

import { Alerta } from '@/components/ui/Alerta';
import { useNomeNegocio } from '@/hooks/use-nome-negocio';
import { textos } from '@/i18n/pt-BR';
import { interpolar } from '@/lib/format';

import { FormularioCadastro } from '../components/FormularioCadastro';
import { TelaDeAutenticacao } from '../components/TelaDeAutenticacao';

export function CadastroPage() {
  const nomeNegocio = useNomeNegocio();
  const [concluido, setConcluido] = useState(false);
  const { cadastro } = textos.auth;

  if (concluido) {
    return (
      <TelaDeAutenticacao titulo={cadastro.sucessoTitulo}>
        <Alerta tom="sucesso">{cadastro.sucessoTexto}</Alerta>
        <Link to="/entrar" className="texto-link">
          {cadastro.entrar}
        </Link>
      </TelaDeAutenticacao>
    );
  }
  return (
    <TelaDeAutenticacao
      titulo={interpolar(cadastro.titulo, { nomeNegocio })}
      subtitulo={cadastro.subtitulo}
    >
      <FormularioCadastro
        aoConcluir={() => {
          setConcluido(true);
        }}
      />
      <p className="texto-corpo texto-secundario">
        {cadastro.jaTemConta}{' '}
        <Link to="/entrar" className="texto-link">
          {cadastro.entrar}
        </Link>
      </p>
    </TelaDeAutenticacao>
  );
}

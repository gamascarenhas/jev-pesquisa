import { Link } from 'react-router';

import { autenticacaoApi } from '@/api/autenticacao.api';
import { textos } from '@/i18n/pt-BR';

import { FormularioSomenteEmail } from '../components/FormularioSomenteEmail';
import { TelaDeAutenticacao } from '../components/TelaDeAutenticacao';

export function EsqueciSenhaPage() {
  const { esqueciSenha } = textos.auth;
  return (
    <TelaDeAutenticacao titulo={esqueciSenha.titulo} subtitulo={esqueciSenha.subtitulo}>
      <FormularioSomenteEmail
        enviarEmail={autenticacaoApi.esqueciSenha}
        rotuloDaAcao={esqueciSenha.enviar}
        mensagemDeSucesso={esqueciSenha.enviado}
      />
      <Link to="/entrar" className="texto-link">
        {textos.comum.voltar}
      </Link>
    </TelaDeAutenticacao>
  );
}

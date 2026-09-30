import { Link, useSearchParams } from 'react-router';

import { autenticacaoApi } from '@/api/autenticacao.api';
import { Alerta } from '@/components/ui/Alerta';
import { textos } from '@/i18n/pt-BR';
import { mensagemDeErro } from '@/lib/errors';

import { FormularioSomenteEmail } from '../components/FormularioSomenteEmail';
import { TelaDeAutenticacao } from '../components/TelaDeAutenticacao';
import { useConfirmacaoPorToken } from '../hooks/use-confirmacao-por-token';

export function ConfirmarEmailPage() {
  const [parametros] = useSearchParams();
  const token = parametros.get('token');
  const confirmacao = useConfirmacaoPorToken('email', token, autenticacaoApi.confirmarEmail);
  const { confirmarEmail } = textos.auth;

  return (
    <TelaDeAutenticacao titulo={confirmarEmail.titulo}>
      {confirmacao.isPending && token !== null && (
        <p className="texto-corpo">{confirmarEmail.confirmando}</p>
      )}
      {confirmacao.isSuccess && (
        <>
          <Alerta tom="sucesso">{confirmarEmail.sucesso}</Alerta>
          <Link to="/entrar" className="texto-link">
            {confirmarEmail.entrar}
          </Link>
        </>
      )}
      {confirmacao.isError && <Alerta tom="critico">{mensagemDeErro(confirmacao.error)}</Alerta>}
      {!confirmacao.isSuccess && !(confirmacao.isPending && token !== null) && (
        <section className="flex flex-col gap-3">
          <h2 className="texto-titulo-secao">{confirmarEmail.reenviarTitulo}</h2>
          <FormularioSomenteEmail
            enviarEmail={autenticacaoApi.reenviarConfirmacao}
            rotuloDaAcao={confirmarEmail.reenviar}
            mensagemDeSucesso={confirmarEmail.reenviado}
          />
        </section>
      )}
    </TelaDeAutenticacao>
  );
}

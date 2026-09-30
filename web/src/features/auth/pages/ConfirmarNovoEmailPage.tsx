import { Link, useSearchParams } from 'react-router';

import { autenticacaoApi } from '@/api/autenticacao.api';
import { Alerta } from '@/components/ui/Alerta';
import { textos } from '@/i18n/pt-BR';
import { mensagemDeErro } from '@/lib/errors';

import { TelaDeAutenticacao } from '../components/TelaDeAutenticacao';
import { useConfirmacaoPorToken } from '../hooks/use-confirmacao-por-token';

export function ConfirmarNovoEmailPage() {
  const [parametros] = useSearchParams();
  const token = parametros.get('token');
  const confirmacao = useConfirmacaoPorToken(
    'novo-email',
    token,
    autenticacaoApi.confirmarTrocaDeEmail,
  );
  const { confirmarNovoEmail } = textos.auth;

  return (
    <TelaDeAutenticacao titulo={confirmarNovoEmail.titulo}>
      {confirmacao.isPending && token !== null && (
        <p className="texto-corpo">{confirmarNovoEmail.confirmando}</p>
      )}
      {confirmacao.isSuccess && <Alerta tom="sucesso">{confirmarNovoEmail.sucesso}</Alerta>}
      {(confirmacao.isError || token === null) && (
        <Alerta tom="critico">
          {confirmacao.isError ? mensagemDeErro(confirmacao.error) : confirmarNovoEmail.falha}
        </Alerta>
      )}
      <Link to="/entrar" className="texto-link">
        {textos.auth.confirmarEmail.entrar}
      </Link>
    </TelaDeAutenticacao>
  );
}

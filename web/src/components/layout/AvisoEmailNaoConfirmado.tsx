import { useMutation } from '@tanstack/react-query';

import { autenticacaoApi } from '@/api/autenticacao.api';
import type { Usuario } from '@/api/types';
import { textos } from '@/i18n/pt-BR';

import { Alerta } from '../ui/Alerta';
import { Botao } from '../ui/Botao';
import { useAvisos } from '../ui/AvisoTemporario';

export function AvisoEmailNaoConfirmado({ usuario }: { usuario: Usuario }) {
  const avisar = useAvisos();
  const reenvio = useMutation({
    mutationFn: () => autenticacaoApi.reenviarConfirmacao(usuario.email),
    onSuccess: () => {
      avisar(textos.auth.confirmarEmail.reenviado);
    },
  });

  return (
    <Alerta tom="atencao">
      <span className="pilha-horizontal">
        {textos.auth.emailNaoConfirmado.aviso}
        <Botao
          variante="secundario"
          tamanho="sm"
          carregando={reenvio.isPending}
          onClick={() => {
            reenvio.mutate();
          }}
        >
          {textos.auth.emailNaoConfirmado.reenviar}
        </Botao>
      </span>
    </Alerta>
  );
}

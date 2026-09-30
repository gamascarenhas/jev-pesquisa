import type { Usuario } from '@/api/types';
import { Alerta } from '@/components/ui/Alerta';
import { useAvisos } from '@/components/ui/AvisoTemporario';
import { Botao } from '@/components/ui/Botao';
import { Modal } from '@/components/ui/Modal';
import { textos } from '@/i18n/pt-BR';
import { mensagemDeErro } from '@/lib/errors';
import { interpolar } from '@/lib/format';

import { useRemoverUsuario } from '../hooks/use-configuracoes';

interface ModalRemoverUsuarioProps {
  usuario: Usuario;
  aoFechar: () => void;
}

export function ModalRemoverUsuario({ usuario, aoFechar }: ModalRemoverUsuarioProps) {
  const avisar = useAvisos();
  const { usuarios } = textos.configuracoes;
  const mutacao = useRemoverUsuario(() => {
    avisar(usuarios.removido);
    aoFechar();
  });

  return (
    <Modal
      titulo={interpolar(usuarios.removerTitulo, { nome: usuario.nome })}
      descricao={usuarios.removerTexto}
      aoFechar={aoFechar}
    >
      {mutacao.isError && <Alerta tom="critico">{mensagemDeErro(mutacao.error)}</Alerta>}
      <div className="flex justify-end gap-2">
        <Botao variante="secundario" onClick={aoFechar}>
          {textos.comum.cancelar}
        </Botao>
        <Botao
          variante="perigo"
          carregando={mutacao.isPending}
          onClick={() => {
            mutacao.mutate(usuario.id);
          }}
        >
          {usuarios.remover}
        </Botao>
      </div>
    </Modal>
  );
}

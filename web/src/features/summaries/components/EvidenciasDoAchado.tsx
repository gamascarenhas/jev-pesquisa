import { Alerta } from '@/components/ui/Alerta';
import { Botao } from '@/components/ui/Botao';
import { Modal } from '@/components/ui/Modal';
import { textos } from '@/i18n/pt-BR';
import { formatarData } from '@/lib/format';

import { useComentariosDoAchado } from '../hooks/use-resumos';

interface EvidenciasDoAchadoProps {
  projetoId: string;
  resumoId: string;
  indice: number;
  achado: string;
  aoFechar: () => void;
}

export function EvidenciasDoAchado({
  projetoId,
  resumoId,
  indice,
  achado,
  aoFechar,
}: EvidenciasDoAchadoProps) {
  const { data, isPending, isError } = useComentariosDoAchado(projetoId, resumoId, indice);
  const { resumos: t } = textos;

  return (
    <Modal titulo={t.comentariosDoAchado} descricao={achado} aoFechar={aoFechar}>
      {isPending && <p className="texto-corpo">{textos.comum.carregando}</p>}
      {isError && <Alerta tom="critico">{textos.comum.erroCarregar}</Alerta>}
      <ul className="flex flex-col gap-3">
        {data?.itens.map((comentario) => (
          <li key={comentario.id} className="superficie-plana flex flex-col gap-1 p-3">
            <p className="texto-corpo">{comentario.texto ?? t.semTexto}</p>
            <p className="texto-auxiliar">
              {[
                comentario.unidade,
                comentario.nota === null ? null : `${String(comentario.nota)}/5`,
                comentario.comentadoEm === null ? null : formatarData(comentario.comentadoEm),
              ]
                .filter((parte) => parte !== null)
                .join(' · ')}
            </p>
          </li>
        ))}
      </ul>
      <div>
        <Botao variante="secundario" onClick={aoFechar}>
          {t.fechar}
        </Botao>
      </div>
    </Modal>
  );
}

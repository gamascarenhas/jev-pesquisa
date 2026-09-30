import type { Projeto } from '@/api/types';

import { DialogoApagarProjeto } from './DialogoApagarProjeto';
import { ModalDeProjeto } from './ModalDeProjeto';

export type EdicaoDeProjeto =
  { tipo: 'criar' } | { tipo: 'renomear'; projeto: Projeto } | { tipo: 'apagar'; projeto: Projeto };

interface ModaisDeProjetoProps {
  edicao: EdicaoDeProjeto | null;
  aoFechar: () => void;
}

export function ModaisDeProjeto({ edicao, aoFechar }: ModaisDeProjetoProps) {
  switch (edicao?.tipo) {
    case 'criar':
      return <ModalDeProjeto projeto={null} aoFechar={aoFechar} />;
    case 'renomear':
      return <ModalDeProjeto projeto={edicao.projeto} aoFechar={aoFechar} />;
    case 'apagar':
      return <DialogoApagarProjeto projeto={edicao.projeto} aoFechar={aoFechar} />;
    case undefined:
      return null;
  }
}

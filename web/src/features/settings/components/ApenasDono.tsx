import type { ReactNode } from 'react';

import { Alerta } from '@/components/ui/Alerta';
import { useUsuarioAtual } from '@/hooks/use-usuario-atual';
import { textos } from '@/i18n/pt-BR';

export function ApenasDono({ children }: { children: ReactNode }) {
  const { data: usuario } = useUsuarioAtual();
  if (usuario?.papel !== 'owner') {
    return <Alerta tom="info">{textos.configuracoes.apenasDono}</Alerta>;
  }
  return <>{children}</>;
}

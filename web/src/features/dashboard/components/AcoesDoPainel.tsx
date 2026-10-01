import { Link } from 'react-router';

import { painelApi } from '@/api/painel.api';
import type { FiltrosDoPainel } from '@/api/types';
import { botaoVariantes } from '@/components/ui/variants';
import { textos } from '@/i18n/pt-BR';

interface AcoesDoPainelProps {
  projetoId: string;
  filtros: FiltrosDoPainel;
}

export function AcoesDoPainel({ projetoId, filtros }: AcoesDoPainelProps) {
  const variante = botaoVariantes({ variante: 'secundario', tamanho: 'sm' });
  return (
    <div className="pilha-horizontal">
      <Link to={`/projetos/${projetoId}/importar`} className={variante}>
        {textos.painel.importar}
      </Link>
      <Link to={`/projetos/${projetoId}/classificar`} className={variante}>
        {textos.painel.classificar}
      </Link>
      <Link to={`/projetos/${projetoId}/revisao`} className={variante}>
        {textos.painel.revisao}
      </Link>
      <a href={painelApi.enderecoDaExportacao(projetoId, filtros)} download className={variante}>
        {textos.painel.exportar}
      </a>
    </div>
  );
}

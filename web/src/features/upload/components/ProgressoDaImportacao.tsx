import type { Trabalho } from '@/api/types';
import { BarraProgresso } from '@/components/ui/BarraProgresso';
import { textos } from '@/i18n/pt-BR';
import { formatarNumero, interpolar } from '@/lib/format';

interface ProgressoDaImportacaoProps {
  trabalho: Trabalho | undefined;
}

export function ProgressoDaImportacao({ trabalho }: ProgressoDaImportacaoProps) {
  const total = trabalho?.progresso.total ?? 0;
  const feito = trabalho?.progresso.feito ?? 0;
  return (
    <div className="flex flex-col gap-3" role="status">
      <h2 className="texto-titulo-secao">{textos.upload.importando}</h2>
      <BarraProgresso rotulo={textos.upload.progressoRotulo} valor={feito} maximo={total} />
      {total > 0 && (
        <p className="texto-auxiliar">
          {interpolar(textos.upload.progresso, {
            feito: formatarNumero(feito),
            total: formatarNumero(total),
          })}
        </p>
      )}
    </div>
  );
}

import type { Comentario } from '@/api/types';
import { TabelaDados, type ColunaDaTabela } from '@/components/ui/TabelaDados';
import { textos } from '@/i18n/pt-BR';
import { formatarData, interpolar } from '@/lib/format';

import { EtiquetaDeSentimento, IndicadoresDoComentario } from './EtiquetasDoComentario';

const PERCENTUAL = 100;
const SEM_VALOR = '—';

function confianca(comentario: Comentario): string {
  if (comentario.temaConfianca === null || comentario.sentimentoConfianca === null) {
    return SEM_VALOR;
  }
  const menor = Math.min(comentario.temaConfianca, comentario.sentimentoConfianca);
  return interpolar(textos.comentarios.confianca, {
    valor: String(Math.round(menor * PERCENTUAL)),
  });
}

const COLUNAS: ColunaDaTabela<Comentario>[] = [
  {
    chave: 'comentario',
    titulo: textos.comentarios.colunaComentario,
    renderizar: (c) => <span className="whitespace-pre-line">{c.textoOriginal}</span>,
  },
  { chave: 'fonte', titulo: textos.comentarios.colunaFonte, renderizar: (c) => c.fonte },
  {
    chave: 'data',
    titulo: textos.comentarios.colunaData,
    renderizar: (c) =>
      c.comentadoEm === null ? textos.comentarios.semData : formatarData(c.comentadoEm),
  },
  {
    chave: 'tema',
    titulo: textos.comentarios.colunaTema,
    renderizar: (c) => (c.tema === null ? SEM_VALOR : (textos.rotulos.temas[c.tema] ?? c.tema)),
  },
  {
    chave: 'sentimento',
    titulo: textos.comentarios.colunaSentimento,
    renderizar: (c) => <EtiquetaDeSentimento sentimento={c.sentimento} />,
  },
  { chave: 'confianca', titulo: textos.comentarios.colunaConfianca, renderizar: confianca },
  {
    chave: 'acao',
    titulo: textos.comentarios.colunaAcao,
    renderizar: (c) => <IndicadoresDoComentario comentario={c} />,
  },
];

export function TabelaDeComentarios({ comentarios }: { comentarios: Comentario[] }) {
  return (
    <TabelaDados
      legenda={textos.comentarios.titulo}
      colunas={COLUNAS}
      linhas={comentarios}
      chaveDaLinha={(c) => c.id}
    />
  );
}

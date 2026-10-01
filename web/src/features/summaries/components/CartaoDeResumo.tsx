import { useState } from 'react';

import type { NivelDeAlerta, ResumoDoTema } from '@/api/types';
import { Botao } from '@/components/ui/Botao';
import { Etiqueta } from '@/components/ui/Etiqueta';
import type { TomDeEtiqueta } from '@/components/ui/variants';
import { textos } from '@/i18n/pt-BR';
import { formatarData, interpolar } from '@/lib/format';

import { EvidenciasDoAchado } from './EvidenciasDoAchado';

const TOM_DO_ALERTA: Record<NivelDeAlerta, TomDeEtiqueta> = {
  critical: 'critico',
  attention: 'atencao',
  stable: 'sucesso',
};

function formatarPorcentagem(valor: number): string {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

function Numeros({ resumo }: { resumo: ResumoDoTema }) {
  const { resumos: t } = textos;
  const { numeros } = resumo;
  const variacao = numeros.variacaoDoVolume;
  return (
    <div className="flex flex-col gap-1">
      <p className="texto-auxiliar">
        {interpolar(t.numeros, {
          volume: String(numeros.volume),
          negativos: formatarPorcentagem(numeros.percentualNegativo),
        })}
      </p>
      {variacao !== null && (
        <p className="texto-auxiliar">
          {interpolar(t.variacaoVolume, {
            sinal: variacao >= 0 ? '+' : '-',
            valor: formatarPorcentagem(Math.abs(variacao)),
          })}
        </p>
      )}
    </div>
  );
}

function Achados({ resumo, projetoId }: { resumo: ResumoDoTema; projetoId: string }) {
  const [aberto, setAberto] = useState<number | null>(null);
  const achado = aberto === null ? undefined : resumo.achados[aberto];
  return (
    <>
      <ul className="flex flex-col gap-3">
        {resumo.achados.map((item, indice) => (
          <li key={item.texto} className="flex flex-col items-start gap-1">
            <p className="texto-corpo">{item.texto}</p>
            <Botao
              variante="fantasma"
              tamanho="sm"
              onClick={() => {
                setAberto(indice);
              }}
            >
              {textos.resumos.verComentarios}
            </Botao>
          </li>
        ))}
      </ul>
      {aberto !== null && achado !== undefined && (
        <EvidenciasDoAchado
          projetoId={projetoId}
          resumoId={resumo.id}
          indice={aberto}
          achado={achado.texto}
          aoFechar={() => {
            setAberto(null);
          }}
        />
      )}
    </>
  );
}

function Corpo({ resumo, projetoId }: { resumo: ResumoDoTema; projetoId: string }) {
  const { resumos: t } = textos;
  if (resumo.status === 'too_few_comments') {
    return (
      <p className="texto-corpo texto-secundario">
        {interpolar(t.poucosComentarios, { volume: String(resumo.numeros.volume) })}
      </p>
    );
  }
  return (
    <>
      {resumo.status === 'numbers_only' ? (
        <p className="texto-corpo texto-secundario">{t.apenasNumeros}</p>
      ) : (
        <Achados resumo={resumo} projetoId={projetoId} />
      )}
      <Numeros resumo={resumo} />
    </>
  );
}

export function CartaoDeResumo({ resumo, projetoId }: { resumo: ResumoDoTema; projetoId: string }) {
  const { resumos: t } = textos;
  return (
    <article className="superficie-plana flex flex-col gap-3 p-5">
      <header className="flex flex-col gap-2">
        <div className="pilha-horizontal justify-between">
          <h3 className="texto-rotulo">{textos.rotulos.temas[resumo.tema] ?? resumo.tema}</h3>
          <Etiqueta tom={TOM_DO_ALERTA[resumo.nivelDeAlerta]}>
            {t.alerta[resumo.nivelDeAlerta] ?? resumo.nivelDeAlerta}
          </Etiqueta>
        </div>
        {resumo.titulo !== null && <p className="texto-titulo-secao">{resumo.titulo}</p>}
      </header>
      <Corpo resumo={resumo} projetoId={projetoId} />
      <footer className="texto-auxiliar">
        {resumo.status === 'ready' && `${t.geradoPorIa} `}
        {interpolar(t.geradoEm, { data: formatarData(resumo.criadoEm) })}
      </footer>
    </article>
  );
}

import type { ListaDeResumos } from '@/api/types';
import { Alerta } from '@/components/ui/Alerta';
import { Botao } from '@/components/ui/Botao';
import { EstadoVazio } from '@/components/ui/EstadoVazio';
import { textos } from '@/i18n/pt-BR';

import { useGerarResumos, useResumos } from '../hooks/use-resumos';
import { CartaoDeResumo } from './CartaoDeResumo';

interface SecaoDeResumosProps {
  projetoId: string;
  /** Sem comentários classificados não há o que resumir. */
  podeGerar: boolean;
}

function BotaoDeGerar({
  projetoId,
  podeGerar,
  lista,
}: SecaoDeResumosProps & { lista: ListaDeResumos | undefined }) {
  const gerar = useGerarResumos(projetoId);
  const { resumos: t } = textos;
  const gerando = gerar.isPending || lista?.emAndamento === true;
  const temResumo = (lista?.itens.length ?? 0) > 0;
  return (
    <div className="flex flex-col items-end gap-1">
      <Botao
        variante={temResumo ? 'secundario' : 'primario'}
        tamanho="sm"
        carregando={gerando}
        disabled={!podeGerar}
        onClick={() => {
          gerar.mutate();
        }}
      >
        {gerando ? t.gerando : temResumo ? t.gerarDeNovo : t.gerar}
      </Botao>
      {gerar.isError && <Alerta tom="critico">{gerar.error.message || t.erroGerar}</Alerta>}
    </div>
  );
}

function Conteudo({
  projetoId,
  podeGerar,
  lista,
}: SecaoDeResumosProps & { lista: ListaDeResumos }) {
  const { resumos: t } = textos;
  if (lista.itens.length > 0) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {lista.itens.map((resumo) => (
          <CartaoDeResumo key={resumo.id} resumo={resumo} projetoId={projetoId} />
        ))}
      </div>
    );
  }
  if (!podeGerar) {
    return <p className="texto-corpo texto-secundario">{t.semClassificados}</p>;
  }
  return lista.emAndamento ? null : <EstadoVazio titulo={t.vazioTitulo} texto={t.vazioTexto} />;
}

export function SecaoDeResumos({ projetoId, podeGerar }: SecaoDeResumosProps) {
  const { data, isError } = useResumos(projetoId);
  const { resumos: t } = textos;

  return (
    <section className="flex flex-col gap-4" aria-labelledby="titulo-dos-resumos">
      <header className="cabecalho-pagina">
        <div className="flex flex-col gap-1">
          <h2 id="titulo-dos-resumos" className="texto-titulo-secao">
            {t.titulo}
          </h2>
          <p className="texto-auxiliar">{t.descricao}</p>
        </div>
        <BotaoDeGerar projetoId={projetoId} podeGerar={podeGerar} lista={data} />
      </header>
      {isError && <Alerta tom="critico">{t.erroCarregar}</Alerta>}
      {data !== undefined && <Conteudo projetoId={projetoId} podeGerar={podeGerar} lista={data} />}
    </section>
  );
}

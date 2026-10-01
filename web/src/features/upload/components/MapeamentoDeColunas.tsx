import { useState, type SubmitEvent } from 'react';

import type { MapeamentoDeColunas as Mapeamento, PreviaDoEnvio } from '@/api/types';
import { Alerta } from '@/components/ui/Alerta';
import { Botao } from '@/components/ui/Botao';
import { Seletor } from '@/components/ui/Seletor';
import { textos } from '@/i18n/pt-BR';

type CampoMapeavel = 'comentario' | 'data' | 'nota' | 'unidade' | 'autor';
type Escolhas = Record<CampoMapeavel, string>;

const CAMPOS: { chave: CampoMapeavel; rotulo: string }[] = [
  { chave: 'comentario', rotulo: textos.upload.campoComentario },
  { chave: 'data', rotulo: textos.upload.campoData },
  { chave: 'nota', rotulo: textos.upload.campoNota },
  { chave: 'unidade', rotulo: textos.upload.campoUnidade },
  { chave: 'autor', rotulo: textos.upload.campoAutor },
];

type Resultado = { mapeamento: Mapeamento } | { erro: string };

function escolhasIniciais(sugestao: PreviaDoEnvio['sugestao']): Escolhas {
  const texto = (coluna: number | undefined): string =>
    coluna === undefined ? '' : String(coluna);
  return {
    comentario: texto(sugestao.comentario),
    data: texto(sugestao.data),
    nota: texto(sugestao.nota),
    unidade: texto(sugestao.unidade),
    autor: texto(sugestao.autor),
  };
}

export function montarMapeamento(escolhas: Escolhas): Resultado {
  if (escolhas.comentario === '') {
    return { erro: textos.upload.escolhaComentario };
  }
  const usadas = CAMPOS.map(({ chave }) => escolhas[chave]).filter((coluna) => coluna !== '');
  if (new Set(usadas).size !== usadas.length) {
    return { erro: textos.upload.colunaRepetida };
  }
  const opcional = (coluna: string): number | undefined =>
    coluna === '' ? undefined : Number(coluna);
  return {
    mapeamento: {
      comentario: Number(escolhas.comentario),
      data: opcional(escolhas.data),
      nota: opcional(escolhas.nota),
      unidade: opcional(escolhas.unidade),
      autor: opcional(escolhas.autor),
    },
  };
}

interface MapeamentoDeColunasProps {
  previa: PreviaDoEnvio;
  carregando: boolean;
  erroDoServidor?: string | undefined;
  aoConfirmar: (mapeamento: Mapeamento) => void;
  aoTrocarArquivo: () => void;
}

interface CamposDoMapeamentoProps {
  cabecalho: string[];
  escolhas: Escolhas;
  aoMudar: (escolhas: Escolhas) => void;
}

function CamposDoMapeamento({ cabecalho, escolhas, aoMudar }: CamposDoMapeamentoProps) {
  const opcoes = [
    { valor: '', rotulo: textos.upload.naoUsar },
    ...cabecalho.map((nome, indice) => ({ valor: String(indice), rotulo: nome })),
  ];
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {CAMPOS.map(({ chave, rotulo }) => (
        <Seletor
          key={chave}
          rotulo={rotulo}
          opcoes={opcoes}
          value={escolhas[chave]}
          onChange={(evento) => {
            aoMudar({ ...escolhas, [chave]: evento.target.value });
          }}
        />
      ))}
    </div>
  );
}

export function MapeamentoDeColunas({
  previa,
  carregando,
  erroDoServidor,
  aoConfirmar,
  aoTrocarArquivo,
}: MapeamentoDeColunasProps) {
  const [escolhas, setEscolhas] = useState<Escolhas>(() => escolhasIniciais(previa.sugestao));
  const [erro, setErro] = useState<string | undefined>(undefined);
  const mensagem = erro ?? erroDoServidor;

  function enviar(evento: SubmitEvent<HTMLFormElement>): void {
    evento.preventDefault();
    const resultado = montarMapeamento(escolhas);
    setErro('erro' in resultado ? resultado.erro : undefined);
    if ('mapeamento' in resultado) {
      aoConfirmar(resultado.mapeamento);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="texto-titulo-secao">{textos.upload.mapeamentoTitulo}</h2>
        <p className="texto-auxiliar">{textos.upload.mapeamentoDescricao}</p>
      </div>
      <CamposDoMapeamento cabecalho={previa.cabecalho} escolhas={escolhas} aoMudar={setEscolhas} />
      {mensagem !== undefined && <Alerta tom="critico">{mensagem}</Alerta>}
      <div className="flex flex-wrap justify-end gap-2">
        <Botao variante="secundario" onClick={aoTrocarArquivo}>
          {textos.upload.trocarArquivo}
        </Botao>
        <Botao type="submit" carregando={carregando}>
          {textos.upload.importar}
        </Botao>
      </div>
    </form>
  );
}

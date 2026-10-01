import { useState } from 'react';

import type { ContaDoGoogle } from '@/api/types';
import { Alerta } from '@/components/ui/Alerta';
import { Botao } from '@/components/ui/Botao';
import { Cartao } from '@/components/ui/Cartao';
import { CaixaDeSelecao } from '@/components/ui/CaixaDeSelecao';
import { textos } from '@/i18n/pt-BR';

import { useEscolherUnidades, useUnidadesDoGoogle } from '../hooks/use-google';

interface ListaDeContasProps {
  contas: ContaDoGoogle[];
  selecao: Set<string>;
  aoAlternar: (nome: string) => void;
}

function ListaDeContas({ contas, selecao, aoAlternar }: ListaDeContasProps) {
  return contas.map((conta) => (
    <fieldset key={conta.id} className="flex flex-col gap-2">
      <legend className="texto-rotulo">{conta.nome}</legend>
      {conta.unidades.map((unidade) => (
        <div key={unidade.nome} className="flex flex-col">
          <CaixaDeSelecao
            rotulo={unidade.titulo}
            checked={selecao.has(unidade.nome)}
            onChange={() => {
              aoAlternar(unidade.nome);
            }}
          />
          {unidade.endereco !== null && <span className="texto-auxiliar">{unidade.endereco}</span>}
        </div>
      ))}
    </fieldset>
  ));
}

function useSelecaoDeUnidades(contas: ContaDoGoogle[]) {
  const [marcadas, setMarcadas] = useState<Set<string> | undefined>(undefined);
  const jaEscolhidas = contas.flatMap((c) =>
    c.unidades.filter((u) => u.selecionada).map((u) => u.nome),
  );
  const selecao = marcadas ?? new Set(jaEscolhidas);
  const alternar = (nome: string): void => {
    const proxima = new Set(selecao);
    if (!proxima.delete(nome)) {
      proxima.add(nome);
    }
    setMarcadas(proxima);
  };
  return { selecao, alternar };
}

export function EscolhaDeUnidades({ projetoId }: { projetoId: string }) {
  const { data, isPending, isError } = useUnidadesDoGoogle(projetoId, true);
  const escolher = useEscolherUnidades(projetoId);
  const contas = data?.itens ?? [];
  const { selecao, alternar } = useSelecaoDeUnidades(contas);
  const { google: t } = textos;
  const semUnidades = data !== undefined && contas.every((conta) => conta.unidades.length === 0);

  return (
    <Cartao titulo={t.unidadesTitulo} descricao={t.unidadesTexto}>
      {isPending && <p className="texto-corpo">{textos.comum.carregando}</p>}
      {isError && <Alerta tom="critico">{t.erroCarregar}</Alerta>}
      {semUnidades && <p className="texto-corpo texto-secundario">{t.semUnidades}</p>}
      <ListaDeContas contas={contas} selecao={selecao} aoAlternar={alternar} />
      <div>
        <Botao
          carregando={escolher.isPending}
          disabled={selecao.size === 0}
          onClick={() => {
            escolher.mutate([...selecao]);
          }}
        >
          {t.salvar}
        </Botao>
      </div>
      {escolher.isError && <Alerta tom="critico">{escolher.error.message}</Alerta>}
    </Cartao>
  );
}

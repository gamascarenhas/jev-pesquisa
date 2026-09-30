import type { ReactNode } from 'react';

export interface ColunaDaTabela<T> {
  chave: string;
  titulo: string;
  renderizar: (linha: T) => ReactNode;
}

interface TabelaDadosProps<T> {
  legenda: string;
  colunas: ColunaDaTabela<T>[];
  linhas: T[];
  chaveDaLinha: (linha: T) => string;
}

export function TabelaDados<T>({ legenda, colunas, linhas, chaveDaLinha }: TabelaDadosProps<T>) {
  return (
    <div className="superficie-plana conteiner-rolavel">
      <table className="w-full border-collapse">
        <caption className="sr-only">{legenda}</caption>
        <thead>
          <tr className="border-b border-borda">
            {colunas.map((coluna) => (
              <th key={coluna.chave} scope="col" className="texto-cabecalho-tabela px-4 py-3">
                {coluna.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => (
            <tr key={chaveDaLinha(linha)} className="border-b border-borda last:border-b-0">
              {colunas.map((coluna) => (
                <td key={coluna.chave} className="texto-celula px-4 py-3">
                  {coluna.renderizar(linha)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

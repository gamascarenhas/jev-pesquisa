import { useState } from 'react';
import { Link } from 'react-router';

import { Botao } from '@/components/ui/Botao';
import { Cartao } from '@/components/ui/Cartao';
import { textos } from '@/i18n/pt-BR';

import { ApenasDono } from '../components/ApenasDono';
import { DialogoEncerrarConta } from '../components/DialogoEncerrarConta';
import { useConta } from '../hooks/use-configuracoes';

function CartaoEncerrarConta() {
  const [aberto, setAberto] = useState(false);
  const { data: conta } = useConta();
  const { dadosEConta } = textos.configuracoes;

  return (
    <Cartao titulo={dadosEConta.encerrarTitulo} descricao={dadosEConta.encerrarTexto}>
      <div>
        <Botao
          variante="perigo"
          disabled={conta === undefined}
          onClick={() => {
            setAberto(true);
          }}
        >
          {dadosEConta.encerrar}
        </Botao>
      </div>
      {aberto && conta && (
        <DialogoEncerrarConta
          nomeDaConta={conta.nome}
          aoFechar={() => {
            setAberto(false);
          }}
        />
      )}
    </Cartao>
  );
}

export function DadosEContaPage() {
  const { dadosEConta } = textos.configuracoes;
  return (
    <div className="pilha-secoes">
      <h1 className="texto-titulo-pagina">{dadosEConta.titulo}</h1>
      <ApenasDono>
        <Cartao titulo={dadosEConta.dadosTitulo} descricao={dadosEConta.dadosTexto}>
          <div>
            <Link to="/projetos" className="texto-link">
              {dadosEConta.irParaProjetos}
            </Link>
          </div>
        </Cartao>
        <CartaoEncerrarConta />
      </ApenasDono>
    </div>
  );
}

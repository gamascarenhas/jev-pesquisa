import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Menu, X } from 'lucide-react';
import { useNavigate } from 'react-router';

import { autenticacaoApi } from '@/api/autenticacao.api';
import { chavesConsulta } from '@/api/chaves-consulta';
import type { Usuario } from '@/api/types';
import { textos } from '@/i18n/pt-BR';

import { Botao } from '../ui/Botao';
import { BarraConsumo } from './BarraConsumo';
import { Logotipo } from './Logotipo';

interface BarraSuperiorProps {
  usuario: Usuario;
  menuAberto: boolean;
  aoAlternarMenu: () => void;
}

export function BarraSuperior({ usuario, menuAberto, aoAlternarMenu }: BarraSuperiorProps) {
  const cliente = useQueryClient();
  const navegar = useNavigate();
  const saida = useMutation({
    mutationFn: autenticacaoApi.sair,
    onSuccess: () => {
      cliente.removeQueries({
        predicate: (consulta) => consulta.queryKey[0] !== chavesConsulta.configuracaoPublica[0],
      });
      cliente.setQueryData(chavesConsulta.eu, null);
      void navegar('/entrar');
    },
  });
  const Icone = menuAberto ? X : Menu;

  return (
    <header className="camada-barra superficie-plana flex items-center justify-between gap-4 rounded-none border-x-0 border-t-0 px-4">
      <div className="pilha-horizontal">
        <Botao
          variante="fantasma"
          tamanho="sm"
          className="md:hidden"
          aria-expanded={menuAberto}
          aria-label={menuAberto ? textos.navegacao.fecharMenu : textos.navegacao.abrirMenu}
          onClick={aoAlternarMenu}
        >
          <Icone size="1.3rem" aria-hidden="true" />
        </Botao>
        <Logotipo />
      </div>
      <div className="pilha-horizontal">
        <BarraConsumo />
        <span className="texto-corpo texto-secundario hidden md:inline">{usuario.nome}</span>
        <Botao
          variante="secundario"
          tamanho="sm"
          carregando={saida.isPending}
          onClick={() => {
            saida.mutate();
          }}
        >
          {textos.navegacao.sair}
        </Botao>
      </div>
    </header>
  );
}

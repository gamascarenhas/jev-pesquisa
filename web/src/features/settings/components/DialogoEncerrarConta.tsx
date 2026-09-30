import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { chavesConsulta } from '@/api/chaves-consulta';
import { CampoTexto } from '@/components/ui/CampoTexto';
import { DialogoConfirmacao } from '@/components/ui/DialogoConfirmacao';
import { textos } from '@/i18n/pt-BR';
import { mensagemDeErro } from '@/lib/errors';
import { interpolar } from '@/lib/format';

import { useEncerrarConta } from '../hooks/use-configuracoes';

interface DialogoEncerrarContaProps {
  nomeDaConta: string;
  aoFechar: () => void;
}

export function DialogoEncerrarConta({ nomeDaConta, aoFechar }: DialogoEncerrarContaProps) {
  const cliente = useQueryClient();
  const navegar = useNavigate();
  const [senha, setSenha] = useState('');
  const { dadosEConta } = textos.configuracoes;
  const mutacao = useEncerrarConta(() => {
    cliente.removeQueries({
      predicate: (consulta) => consulta.queryKey[0] !== chavesConsulta.configuracaoPublica[0],
    });
    cliente.setQueryData(chavesConsulta.eu, null);
    void navegar('/entrar');
  });
  const valores = { nome: nomeDaConta };

  return (
    <DialogoConfirmacao
      titulo={interpolar(dadosEConta.encerrarDialogo, valores)}
      descricao={dadosEConta.encerrarTexto}
      nomeEsperado={nomeDaConta}
      rotuloDoCampo={interpolar(dadosEConta.encerrarConfirmacao, valores)}
      rotuloDaAcao={dadosEConta.encerrarAcao}
      podeConfirmar={senha !== ''}
      carregando={mutacao.isPending}
      erro={mutacao.isError ? mensagemDeErro(mutacao.error) : undefined}
      aoConfirmar={() => {
        mutacao.mutate(senha);
      }}
      aoCancelar={aoFechar}
    >
      <CampoTexto
        rotulo={dadosEConta.encerrarSenha}
        type="password"
        autoComplete="current-password"
        value={senha}
        onChange={(evento) => {
          setSenha(evento.target.value);
        }}
      />
    </DialogoConfirmacao>
  );
}

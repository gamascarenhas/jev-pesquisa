import { useParams, useSearchParams } from 'react-router';

import { Alerta } from '@/components/ui/Alerta';
import { useUsuarioAtual } from '@/hooks/use-usuario-atual';
import { textos } from '@/i18n/pt-BR';

import { ConexaoComGoogle } from '../components/ConexaoComGoogle';
import { EscolhaDeUnidades } from '../components/EscolhaDeUnidades';
import { useStatusDoGoogle } from '../hooks/use-google';

function mensagemDoErroDoRetorno(codigo: string | null): string | undefined {
  if (codigo === null) {
    return undefined;
  }
  const mensagens: Record<string, string | undefined> = textos.google.erros;
  return mensagens[codigo] ?? textos.comum.erroCarregar;
}

export function GooglePage() {
  const { projetoId = '' } = useParams();
  const [consulta] = useSearchParams();
  const { data: usuario } = useUsuarioAtual();
  const { data: status, isPending, isError } = useStatusDoGoogle(projetoId);
  const ehDono = usuario?.papel === 'owner';
  const mensagemDoErro = mensagemDoErroDoRetorno(consulta.get('erro'));

  return (
    <div className="pilha-secoes">
      <h1 className="texto-titulo-pagina">{textos.google.titulo}</h1>
      {mensagemDoErro !== undefined && <Alerta tom="critico">{mensagemDoErro}</Alerta>}
      {isPending && <p className="texto-corpo">{textos.comum.carregando}</p>}
      {isError && <Alerta tom="critico">{textos.google.erroCarregar}</Alerta>}
      {status !== undefined && (
        <>
          <ConexaoComGoogle projetoId={projetoId} status={status} ehDono={ehDono} />
          {status.conectado && ehDono && <EscolhaDeUnidades projetoId={projetoId} />}
        </>
      )}
    </div>
  );
}

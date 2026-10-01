import { useState } from 'react';

import type { StatusDoGoogle } from '@/api/types';
import { Alerta } from '@/components/ui/Alerta';
import { Botao } from '@/components/ui/Botao';
import { Cartao } from '@/components/ui/Cartao';
import { Etiqueta } from '@/components/ui/Etiqueta';
import { textos } from '@/i18n/pt-BR';
import { formatarData, interpolar } from '@/lib/format';

import { useConectarGoogle, useDesconectarGoogle, useSincronizarGoogle } from '../hooks/use-google';

interface ConexaoComGoogleProps {
  projetoId: string;
  status: StatusDoGoogle;
  ehDono: boolean;
}

function Desconectar({ projetoId }: { projetoId: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const desconectar = useDesconectarGoogle(projetoId);
  const { google: t } = textos;

  if (!confirmando) {
    return (
      <Botao
        variante="secundario"
        onClick={() => {
          setConfirmando(true);
        }}
      >
        {t.desconectar}
      </Botao>
    );
  }
  return (
    <Alerta tom="atencao">
      <div className="flex flex-col gap-2">
        <strong>{t.desconectarTitulo}</strong>
        <p>{t.desconectarTexto}</p>
        <div className="pilha-horizontal">
          <Botao
            variante="perigo"
            carregando={desconectar.isPending}
            onClick={() => {
              desconectar.mutate();
            }}
          >
            {t.desconectarConfirmar}
          </Botao>
          <Botao
            variante="fantasma"
            onClick={() => {
              setConfirmando(false);
            }}
          >
            {t.cancelar}
          </Botao>
        </div>
      </div>
    </Alerta>
  );
}

function Unidades({ status }: { status: StatusDoGoogle }) {
  const { google: t } = textos;
  return (
    <ul className="flex flex-col gap-2">
      {status.unidades.map((unidade) => (
        <li key={unidade.nomeUnidade} className="flex flex-col gap-1">
          <span className="texto-corpo">{unidade.titulo}</span>
          <span className="texto-auxiliar">
            {unidade.ultimaSincronizacaoEm === null
              ? t.nuncaSincronizada
              : interpolar(t.ultimaSincronizacao, {
                  data: formatarData(unidade.ultimaSincronizacaoEm),
                })}
          </span>
          {unidade.falha !== null && <Alerta tom="critico">{unidade.falha.mensagem}</Alerta>}
        </li>
      ))}
    </ul>
  );
}

function NaoConectado({ projetoId, ehDono }: { projetoId: string; ehDono: boolean }) {
  const conectar = useConectarGoogle(projetoId);
  const { google: t } = textos;
  return (
    <Cartao titulo={t.titulo} descricao={t.descricao}>
      <p className="texto-corpo">{t.naoConectado}</p>
      {ehDono ? (
        <div>
          <Botao
            carregando={conectar.isPending}
            onClick={() => {
              conectar.mutate();
            }}
          >
            {conectar.isPending ? t.conectando : t.conectar}
          </Botao>
        </div>
      ) : (
        <Alerta tom="info">{t.apenasDono}</Alerta>
      )}
    </Cartao>
  );
}

function Conectado({ projetoId, status, ehDono }: ConexaoComGoogleProps) {
  const sincronizar = useSincronizarGoogle(projetoId);
  const { google: t } = textos;
  const temUnidades = status.unidades.length > 0;
  return (
    <Cartao
      titulo={t.titulo}
      descricao={interpolar(t.conectadoComo, { email: status.email ?? '' })}
    >
      {status.simulado && <Etiqueta tom="info">{t.simulado}</Etiqueta>}
      {temUnidades && <Unidades status={status} />}
      {status.sincronizando && <p className="texto-auxiliar">{t.sincronizando}</p>}
      {ehDono && (
        <div className="pilha-horizontal">
          {temUnidades && (
            <Botao
              carregando={sincronizar.isPending || status.sincronizando}
              onClick={() => {
                sincronizar.mutate();
              }}
            >
              {t.sincronizar}
            </Botao>
          )}
          <Desconectar projetoId={projetoId} />
        </div>
      )}
    </Cartao>
  );
}

export function ConexaoComGoogle(props: ConexaoComGoogleProps) {
  return props.status.conectado ? (
    <Conectado {...props} />
  ) : (
    <NaoConectado projetoId={props.projetoId} ehDono={props.ehDono} />
  );
}

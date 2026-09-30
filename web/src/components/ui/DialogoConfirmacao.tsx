import { useState, type ReactNode, type SubmitEvent } from 'react';

import { textos } from '@/i18n/pt-BR';

import { Alerta } from './Alerta';
import { Botao } from './Botao';
import { CampoTexto } from './CampoTexto';
import { Modal } from './Modal';

interface DialogoConfirmacaoProps {
  titulo: string;
  descricao: string;
  nomeEsperado: string;
  rotuloDoCampo: string;
  rotuloDaAcao: string;
  carregando?: boolean;
  erro?: string | undefined;
  podeConfirmar?: boolean;
  aoConfirmar: () => void;
  aoCancelar: () => void;
  children?: ReactNode;
}

export function DialogoConfirmacao({
  titulo,
  descricao,
  nomeEsperado,
  rotuloDoCampo,
  rotuloDaAcao,
  carregando = false,
  erro,
  podeConfirmar = true,
  aoConfirmar,
  aoCancelar,
  children,
}: DialogoConfirmacaoProps) {
  const [digitado, setDigitado] = useState('');
  const habilitado = digitado === nomeEsperado && podeConfirmar;

  function enviar(evento: SubmitEvent<HTMLFormElement>): void {
    evento.preventDefault();
    if (habilitado && !carregando) {
      aoConfirmar();
    }
  }

  return (
    <Modal titulo={titulo} descricao={descricao} aoFechar={aoCancelar}>
      <form onSubmit={enviar} className="flex flex-col gap-4">
        <CampoTexto
          rotulo={rotuloDoCampo}
          value={digitado}
          autoComplete="off"
          onChange={(evento) => {
            setDigitado(evento.target.value);
          }}
        />
        {children}
        {erro !== undefined && <Alerta tom="critico">{erro}</Alerta>}
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={aoCancelar}>
            {textos.comum.cancelar}
          </Botao>
          <Botao type="submit" variante="perigo" disabled={!habilitado} carregando={carregando}>
            {rotuloDaAcao}
          </Botao>
        </div>
      </form>
    </Modal>
  );
}

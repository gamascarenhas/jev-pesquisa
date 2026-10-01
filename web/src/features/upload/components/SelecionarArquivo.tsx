import { useRef, useState, type DragEvent, type RefObject } from 'react';

import { Alerta } from '@/components/ui/Alerta';
import { Botao } from '@/components/ui/Botao';
import { textos } from '@/i18n/pt-BR';
import { cn } from '@/lib/cn';
import { formatarNumero, interpolar } from '@/lib/format';

import { EXTENSOES_ACEITAS, LIMITE_DE_LINHAS, TAMANHO_MAXIMO_ENVIO_MB } from '../limites';

interface SelecionarArquivoProps {
  enviando: boolean;
  erro?: string | undefined;
  aoEscolher: (arquivo: File) => void;
}

function LimitesDoEnvio() {
  return (
    <p className="texto-auxiliar">
      {interpolar(textos.upload.limites, {
        tamanho: String(TAMANHO_MAXIMO_ENVIO_MB),
        linhas: formatarNumero(LIMITE_DE_LINHAS),
      })}
    </p>
  );
}

interface EntradaOcultaProps {
  referencia: RefObject<HTMLInputElement | null>;
  aoEscolher: (arquivo: File) => void;
}

function EntradaOculta({ referencia, aoEscolher }: EntradaOcultaProps) {
  return (
    <input
      ref={referencia}
      type="file"
      accept={EXTENSOES_ACEITAS}
      className="sr-only"
      tabIndex={-1}
      aria-label={textos.upload.escolherArquivo}
      onChange={(evento) => {
        const arquivo = evento.target.files?.[0];
        evento.target.value = '';
        if (arquivo !== undefined) {
          aoEscolher(arquivo);
        }
      }}
    />
  );
}

function AreaDeSoltar({ enviando, aoEscolher }: Omit<SelecionarArquivoProps, 'erro'>) {
  const entrada = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);

  function soltar(evento: DragEvent<HTMLDivElement>): void {
    evento.preventDefault();
    setArrastando(false);
    const arquivo = evento.dataTransfer.files[0];
    if (arquivo !== undefined && !enviando) {
      aoEscolher(arquivo);
    }
  }

  function arrastarSobre(evento: DragEvent<HTMLDivElement>): void {
    evento.preventDefault();
    setArrastando(true);
  }

  return (
    <div
      className={cn(
        'area-envio flex flex-col items-center gap-3 px-6 py-12 text-center',
        arrastando && 'area-envio-ativa',
      )}
      onDragOver={arrastarSobre}
      onDragLeave={() => {
        setArrastando(false);
      }}
      onDrop={soltar}
    >
      <EntradaOculta referencia={entrada} aoEscolher={aoEscolher} />
      <Botao
        carregando={enviando}
        onClick={() => {
          entrada.current?.click();
        }}
      >
        {enviando ? textos.upload.enviando : textos.upload.escolherArquivo}
      </Botao>
      <p className="texto-corpo texto-secundario">{textos.upload.arrasteAqui}</p>
      <LimitesDoEnvio />
    </div>
  );
}

export function SelecionarArquivo({ enviando, erro, aoEscolher }: SelecionarArquivoProps) {
  return (
    <div className="flex flex-col gap-3">
      <AreaDeSoltar enviando={enviando} aoEscolher={aoEscolher} />
      {erro !== undefined && <Alerta tom="critico">{erro}</Alerta>}
    </div>
  );
}

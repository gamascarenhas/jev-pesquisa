import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { Alerta } from './Alerta';

const DURACAO_DO_AVISO_MS = 5000;

interface Aviso {
  id: number;
  texto: string;
}

type Avisar = (texto: string) => void;

const ContextoDeAvisos = createContext<Avisar | null>(null);

export function ProvedorDeAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  const avisar = useCallback<Avisar>((texto) => {
    const id = Date.now() + Math.random();
    setAvisos((atuais) => [...atuais, { id, texto }]);
    setTimeout(() => {
      setAvisos((atuais) => atuais.filter((aviso) => aviso.id !== id));
    }, DURACAO_DO_AVISO_MS);
  }, []);

  const valor = useMemo(() => avisar, [avisar]);

  return (
    <ContextoDeAvisos value={valor}>
      {children}
      <div className="camada-aviso movimento-entrada fixed right-4 bottom-4 flex flex-col gap-2">
        {avisos.map((aviso) => (
          <Alerta key={aviso.id} tom="sucesso">
            {aviso.texto}
          </Alerta>
        ))}
      </div>
    </ContextoDeAvisos>
  );
}

export function useAvisos(): Avisar {
  const avisar = useContext(ContextoDeAvisos);
  if (avisar === null) {
    throw new Error('useAvisos precisa estar dentro de ProvedorDeAvisos.');
  }
  return avisar;
}

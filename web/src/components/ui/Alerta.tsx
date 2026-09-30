import type { ReactNode } from 'react';

import { alertaVariantes, type TomDeAlerta } from './variants';

interface AlertaProps {
  tom?: TomDeAlerta;
  children: ReactNode;
}

export function Alerta({ tom, children }: AlertaProps) {
  return (
    <div role={tom === 'critico' ? 'alert' : 'status'} className={alertaVariantes({ tom })}>
      {children}
    </div>
  );
}

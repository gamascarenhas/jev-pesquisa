import type { ReactNode } from 'react';

import { etiquetaVariantes, type TomDeEtiqueta } from './variants';

interface EtiquetaProps {
  tom?: TomDeEtiqueta;
  children: ReactNode;
}

export function Etiqueta({ tom, children }: EtiquetaProps) {
  return <span className={etiquetaVariantes({ tom })}>{children}</span>;
}

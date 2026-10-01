import { createHash } from 'node:crypto';

import type { Agregados } from './resumos.tipos.js';

// Mesmos comentários, classificações, correções e agregados dão o mesmo hash: o resumo vem do cache.
export function calcularHashDeDados(impressaoDosComentarios: string, agregados: Agregados): string {
  return createHash('sha256')
    .update(impressaoDosComentarios)
    .update('\u0000')
    .update(JSON.stringify(agregados))
    .digest('hex');
}

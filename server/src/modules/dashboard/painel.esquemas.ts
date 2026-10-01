import { z } from 'zod';

export const esquemaParametrosDoPainel = z.object({ projetoId: z.uuid() }).strict();

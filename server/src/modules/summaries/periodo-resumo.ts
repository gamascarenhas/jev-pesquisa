import { dataNoFusoLocal } from '../../shared/clock.js';
import { ErroDeValidacao } from '../../shared/errors.js';

export const DIAS_DO_PERIODO_PADRAO = 30;
export const DIAS_DO_PERIODO_MAXIMO = 366;
const MS_POR_DIA = 86_400_000;
const DESLOCAMENTO_DE_BRASILIA = '-03:00';

export interface EntradaDoPeriodo {
  de?: string | undefined;
  ate?: string | undefined;
}

export function inicioDoDia(dia: string): Date {
  return new Date(`${dia}T00:00:00${DESLOCAMENTO_DE_BRASILIA}`);
}

export function somarDias(dia: string, dias: number): string {
  return dataNoFusoLocal(new Date(inicioDoDia(dia).getTime() + dias * MS_POR_DIA));
}

function diasEntre(de: string, ate: string): number {
  return Math.round((inicioDoDia(ate).getTime() - inicioDoDia(de).getTime()) / MS_POR_DIA) + 1;
}

export function resolverPeriodo(
  entrada: EntradaDoPeriodo,
  hoje: string,
): { de: string; ate: string } {
  const ate = entrada.ate ?? hoje;
  const de = entrada.de ?? somarDias(ate, -(DIAS_DO_PERIODO_PADRAO - 1));
  const dias = diasEntre(de, ate);
  if (dias < 1 || dias > DIAS_DO_PERIODO_MAXIMO) {
    throw new ErroDeValidacao(
      `Escolha um período de 1 a ${String(DIAS_DO_PERIODO_MAXIMO)} dias.`,
      'periodo_invalido',
    );
  }
  return { de, ate };
}

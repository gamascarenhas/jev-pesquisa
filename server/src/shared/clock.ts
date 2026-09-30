export const FUSO_HORARIO = 'America/Sao_Paulo';

export interface Relogio {
  agora(): Date;
}

export const relogioDoSistema: Relogio = {
  agora: () => new Date(),
};

const formatadorDeDataLocal = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO_HORARIO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function dataNoFusoLocal(data: Date): string {
  return formatadorDeDataLocal.format(data);
}

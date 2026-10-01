export const LATENCIA_MEDIA_JEV_SEGUNDOS = 1;
// Limite de taxa do Jev: requisições por minuto.
export const LIMITE_DE_REQUISICOES_POR_MINUTO_DO_JEV = 1_200;
const SEGUNDOS_POR_MINUTO = 60;

export function vazaoEfetivaPorMinuto(concorrencia: number): number {
  return Math.min(
    (concorrencia * SEGUNDOS_POR_MINUTO) / LATENCIA_MEDIA_JEV_SEGUNDOS,
    LIMITE_DE_REQUISICOES_POR_MINUTO_DO_JEV,
  );
}

// Pendentes divididos pela vazão efetiva, em minutos arredondados para cima.
export function estimarMinutos(pendentes: number, concorrencia: number): number {
  return pendentes <= 0 ? 0 : Math.ceil(pendentes / vazaoEfetivaPorMinuto(concorrencia));
}

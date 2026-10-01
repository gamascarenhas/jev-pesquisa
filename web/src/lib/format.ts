const formatadorDeData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' });

export function interpolar(texto: string, valores: Record<string, string>): string {
  return texto.replace(/\{(\w+)\}/g, (marcador, chave: string) => valores[chave] ?? marcador);
}

export function formatarData(iso: string): string {
  return formatadorDeData.format(new Date(iso));
}

const formatadorDeNumero = new Intl.NumberFormat('pt-BR');

export function formatarNumero(valor: number): string {
  return formatadorDeNumero.format(valor);
}

const formatadorDeReais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const CENTAVOS_POR_REAL = 100;

export function formatarReais(centavos: number): string {
  return formatadorDeReais.format(centavos / CENTAVOS_POR_REAL);
}

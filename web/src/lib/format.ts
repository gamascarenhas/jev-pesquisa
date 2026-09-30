const formatadorDeData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' });

export function interpolar(texto: string, valores: Record<string, string>): string {
  return texto.replace(/\{(\w+)\}/g, (marcador, chave: string) => valores[chave] ?? marcador);
}

export function formatarData(iso: string): string {
  return formatadorDeData.format(new Date(iso));
}

const formatador = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' });

// A data do artigo é só dia (AAAA-MM-DD): lida em UTC para nunca andar um dia com o fuso da máquina.
export function formatarDataDoArtigo(dia: string): string {
  return formatador.format(new Date(`${dia}T00:00:00Z`));
}

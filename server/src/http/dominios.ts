export type Dominio = 'app' | 'site' | 'desconhecido';

export interface OrigensDosDominios {
  origemApp: string;
  origemSite: string;
}

/** Só o cabeçalho `Host` decide: `X-Forwarded-Host` pode ser forjado pelo cliente. */
export function identificarDominio(
  host: string | undefined,
  { origemApp, origemSite }: OrigensDosDominios,
): Dominio {
  const recebido = host?.toLowerCase();
  if (recebido === undefined) {
    return 'desconhecido';
  }
  if (recebido === new URL(origemSite).host.toLowerCase()) {
    return 'site';
  }
  return recebido === new URL(origemApp).host.toLowerCase() ? 'app' : 'desconhecido';
}

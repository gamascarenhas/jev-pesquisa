type ValorDeConsulta = string | number | boolean | undefined;

// Só entram os valores preenchidos; o resto da tela continua sem filtro.
export function montarConsulta(parametros: Record<string, ValorDeConsulta>): string {
  const busca = new URLSearchParams();
  for (const [nome, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== '' && valor !== false) {
      busca.set(nome, String(valor));
    }
  }
  const texto = busca.toString();
  return texto === '' ? '' : `?${texto}`;
}

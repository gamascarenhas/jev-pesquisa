const MASCARA_CPF = '[CPF]';
const MASCARA_CNPJ = '[CNPJ]';
const MASCARA_EMAIL = '[EMAIL]';
const MASCARA_TELEFONE = '[TELEFONE]';
const MASCARA_CEP = '[CEP]';

const REGEX_EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}/gu;
const REGEX_CNPJ = /(?<![\d.\-/])(?:\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14})(?![\d\-/])/g;
const REGEX_CPF = /(?<![\d.\-/])(?:\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11})(?![\d\-/])/g;
const REGEX_CEP = /\bCEP:?\s*\d{5}-?\d{3}(?!\d)|(?<![\d.\-/])\d{5}-\d{3}(?![\d\-/])/gi;
const REGEX_TELEFONE = new RegExp(
  [
    String.raw`(?:\+55[\s.-]?)?\(\d{2}\)[\s.-]?9?\d{4}[\s.-]?\d{4}`,
    String.raw`\+55[\s.-]?\d{2}[\s.-]?9?\d{4}[\s.-]?\d{4}`,
    String.raw`(?<![\d.,/-])\d{2}[\s.-]9?\d{4}-\d{4}(?![\d-])`,
    String.raw`(?<![\d.,/-])9?\d{4}-\d{4}(?![\d-])`,
    String.raw`(?<![\d.,/-])\d{2}9\d{8}(?![\d.,/-])`,
  ].join('|'),
  'g',
);

function todosIguais(digitos: string): boolean {
  return /^(\d)\1+$/.test(digitos);
}

function digitoVerificador(digitos: number[], pesos: number[]): number {
  const soma = digitos.reduce((total, digito, indice) => total + digito * (pesos[indice] ?? 0), 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function validarCpf(digitos: string): boolean {
  if (todosIguais(digitos)) {
    return false;
  }
  const numeros = Array.from(digitos, Number);
  const primeiro = digitoVerificador(numeros.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = digitoVerificador(numeros.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return primeiro === numeros[9] && segundo === numeros[10];
}

function validarCnpj(digitos: string): boolean {
  if (todosIguais(digitos)) {
    return false;
  }
  const numeros = Array.from(digitos, Number);
  const primeiro = digitoVerificador(numeros.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = digitoVerificador(numeros.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return primeiro === numeros[12] && segundo === numeros[13];
}

const SEM_PONTUACAO = /^\d+$/;

// Sem pontuação, só números com dígito verificador válido contam; senão um número de pedido viraria CPF.
function mascararDocumento(
  trecho: string,
  mascara: string,
  validar: (digitos: string) => boolean,
): string {
  return SEM_PONTUACAO.test(trecho) && !validar(trecho) ? trecho : mascara;
}

export function mascararTexto(texto: string): string {
  return texto
    .replace(REGEX_EMAIL, MASCARA_EMAIL)
    .replace(REGEX_CNPJ, (trecho) => mascararDocumento(trecho, MASCARA_CNPJ, validarCnpj))
    .replace(REGEX_CPF, (trecho) => mascararDocumento(trecho, MASCARA_CPF, validarCpf))
    .replace(REGEX_CEP, MASCARA_CEP)
    .replace(REGEX_TELEFONE, MASCARA_TELEFONE);
}

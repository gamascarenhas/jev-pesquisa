import type { CelulaBruta } from '../envios.tipos.js';

const MS_POR_DIA = 86_400_000;
const EPOCA_SERIAL_EXCEL_MS = Date.UTC(1899, 11, 30);
const SERIAL_MINIMO = 18_264;
const SERIAL_MAXIMO = 73_050;
const FUSO_PADRAO = '-03:00';
const REGEX_BR = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
const REGEX_ISO = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
const REGEX_SERIAL = /^\d{4,6}(?:[.,]\d+)?$/;

interface PartesDaData {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
}

function doisDigitos(valor: number): string {
  return String(valor).padStart(2, '0');
}

function paraData(partes: PartesDaData): Date | null {
  const { ano, mes, dia, hora, minuto, segundo } = partes;
  const calendario = new Date(Date.UTC(ano, mes - 1, dia, hora, minuto, segundo));
  const valida =
    calendario.getUTCFullYear() === ano &&
    calendario.getUTCMonth() === mes - 1 &&
    calendario.getUTCDate() === dia &&
    hora < 24 &&
    minuto < 60 &&
    segundo < 60;
  if (!valida) {
    return null;
  }
  const iso = `${String(ano).padStart(4, '0')}-${doisDigitos(mes)}-${doisDigitos(dia)}`;
  const horario = `${doisDigitos(hora)}:${doisDigitos(minuto)}:${doisDigitos(segundo)}`;
  return new Date(`${iso}T${horario}${FUSO_PADRAO}`);
}

function partesDeUtc(data: Date): PartesDaData {
  return {
    ano: data.getUTCFullYear(),
    mes: data.getUTCMonth() + 1,
    dia: data.getUTCDate(),
    hora: data.getUTCHours(),
    minuto: data.getUTCMinutes(),
    segundo: data.getUTCSeconds(),
  };
}

function deSerial(serial: number): Date | null {
  if (!(serial >= SERIAL_MINIMO && serial <= SERIAL_MAXIMO)) {
    return null;
  }
  return paraData(partesDeUtc(new Date(EPOCA_SERIAL_EXCEL_MS + Math.round(serial * MS_POR_DIA))));
}

function partesDoTexto(correspondencia: RegExpExecArray, ordem: 'br' | 'iso'): PartesDaData {
  const [, primeiro, segundoCampo, terceiro, hora, minuto, segundo] = correspondencia;
  const [ano, mes, dia] =
    ordem === 'br' ? [terceiro, segundoCampo, primeiro] : [primeiro, segundoCampo, terceiro];
  return {
    ano: Number(ano),
    mes: Number(mes),
    dia: Number(dia),
    hora: Number(hora ?? 0),
    minuto: Number(minuto ?? 0),
    segundo: Number(segundo ?? 0),
  };
}

function deTexto(texto: string): Date | null {
  const br = REGEX_BR.exec(texto);
  if (br) {
    return paraData(partesDoTexto(br, 'br'));
  }
  const iso = REGEX_ISO.exec(texto);
  if (iso) {
    return paraData(partesDoTexto(iso, 'iso'));
  }
  return REGEX_SERIAL.test(texto) ? deSerial(Number(texto.replace(',', '.'))) : null;
}

// Datas sem fuso são lidas em horário de Brasília; o Excel guarda serial e Date como relógio de parede em UTC.
export function interpretarData(valor: CelulaBruta): Date | null {
  if (valor === null) {
    return null;
  }
  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? null : paraData(partesDeUtc(valor));
  }
  if (typeof valor === 'number') {
    return deSerial(valor);
  }
  return deTexto(valor.trim());
}

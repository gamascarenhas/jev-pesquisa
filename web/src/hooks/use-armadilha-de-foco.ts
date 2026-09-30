import { useEffect, useRef, type RefObject } from 'react';

const SELETOR_FOCAVEL =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const SELETOR_CAMPO = 'input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

function listarFocaveis(raiz: HTMLElement): HTMLElement[] {
  return Array.from(raiz.querySelectorAll<HTMLElement>(SELETOR_FOCAVEL));
}

function prenderFoco(evento: KeyboardEvent, raiz: HTMLElement): void {
  const focaveis = listarFocaveis(raiz);
  const primeiro = focaveis[0];
  const ultimo = focaveis[focaveis.length - 1];
  if (primeiro === undefined || ultimo === undefined) {
    evento.preventDefault();
    return;
  }
  const ativo = document.activeElement;
  const estaFora = !raiz.contains(ativo);
  if (evento.shiftKey && (ativo === primeiro || estaFora)) {
    evento.preventDefault();
    ultimo.focus();
  } else if (!evento.shiftKey && (ativo === ultimo || estaFora)) {
    evento.preventDefault();
    primeiro.focus();
  }
}

function focarPrimeiro(raiz: HTMLElement): void {
  const alvo = raiz.querySelector<HTMLElement>(SELETOR_CAMPO) ?? listarFocaveis(raiz)[0];
  (alvo ?? raiz).focus();
}

/** Prende o foco na raiz, fecha com Escape e devolve o foco a quem o tinha ao abrir. */
export function useArmadilhaDeFoco(
  raiz: RefObject<HTMLElement | null>,
  aoFechar: () => void,
): void {
  const refAoFechar = useRef(aoFechar);

  useEffect(() => {
    refAoFechar.current = aoFechar;
  }, [aoFechar]);

  useEffect(() => {
    const elemento = raiz.current;
    if (elemento === null) {
      return undefined;
    }
    const elementoAnterior = document.activeElement;
    focarPrimeiro(elemento);

    function aoTeclar(evento: KeyboardEvent): void {
      if (evento.key === 'Escape') {
        refAoFechar.current();
      } else if (evento.key === 'Tab' && elemento !== null) {
        prenderFoco(evento, elemento);
      }
    }
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      if (elementoAnterior instanceof HTMLElement) {
        elementoAnterior.focus();
      }
    };
  }, [raiz]);
}

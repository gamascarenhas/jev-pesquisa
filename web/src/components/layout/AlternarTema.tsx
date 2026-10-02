import { Moon, Sun } from 'lucide-react';

import { useTema } from '@/hooks/use-tema';
import { textos } from '@/i18n/pt-BR';

import { Botao } from '../ui/Botao';

export function AlternarTema() {
  const { tema, alternarTema } = useTema();
  const escuro = tema === 'escuro';
  const Icone = escuro ? Sun : Moon;
  const rotulo = escuro ? textos.navegacao.usarTemaClaro : textos.navegacao.usarTemaEscuro;
  return (
    <Botao variante="fantasma" tamanho="sm" aria-label={rotulo} title={rotulo} onClick={alternarTema}>
      <Icone size="1.1rem" aria-hidden="true" />
    </Botao>
  );
}

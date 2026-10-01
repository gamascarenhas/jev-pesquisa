import type { Projeto, ProgressoDaClassificacao } from '@/api/types';
import { useProgressoDaClassificacao } from '@/features/dashboard/hooks/use-classificacao';
import { useProjetos } from '@/features/projects/hooks/use-projetos';

export const TOTAL_DE_PASSOS = 5;

export type PassoDoOnboarding = 'projeto' | 'fonte' | 'colunas' | 'classificar' | 'painel';

export const PASSOS: PassoDoOnboarding[] = ['projeto', 'fonte', 'colunas', 'classificar', 'painel'];

function totalDeComentarios(progresso: ProgressoDaClassificacao | undefined): number {
  return progresso ? progresso.pendentes + progresso.classificados + progresso.falhos : 0;
}

function classificouTudo(progresso: ProgressoDaClassificacao | undefined): boolean {
  return progresso !== undefined && progresso.classificados > 0 && progresso.pendentes === 0;
}

// O passo atual sai dos dados que já existem; nada fica salvo à parte.
export function calcularPassoAtual(
  projeto: Projeto | undefined,
  progresso: ProgressoDaClassificacao | undefined,
): number {
  if (projeto === undefined) {
    return 1;
  }
  if (totalDeComentarios(progresso) === 0) {
    return 2;
  }
  return classificouTudo(progresso) ? 5 : 4;
}

export function useEstadoDoOnboarding() {
  const projetos = useProjetos(1);
  const projeto = projetos.data?.itens[0];
  const progresso = useProgressoDaClassificacao(projeto?.id ?? '');
  const carregando = projetos.isPending || (projeto !== undefined && progresso.isPending);
  return {
    carregando,
    erro: projetos.isError,
    projeto,
    passoAtual: calcularPassoAtual(projeto, progresso.data),
  };
}

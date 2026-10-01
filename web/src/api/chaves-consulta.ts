export const chavesConsulta = {
  configuracaoPublica: ['configuracao-publica'] as const,
  eu: ['auth', 'eu'] as const,
  conta: ['conta'] as const,
  consumo: ['consumo'] as const,
  google: (projetoId: string) => ['google', projetoId] as const,
  unidadesDoGoogle: (projetoId: string) => ['google', projetoId, 'unidades'] as const,
  planos: ['planos'] as const,
  usuarios: ['usuarios'] as const,
  convites: ['convites'] as const,
  projetos: (pagina: number) => ['projetos', { pagina }] as const,
  todosOsProjetos: ['projetos'] as const,
  trabalho: (id: string) => ['trabalhos', id] as const,
  previaDoEnvio: (envioId: string, aba: string | null) => ['envios', envioId, { aba }] as const,
  fonte: (projetoId: string, fonteId: string) => ['fontes', projetoId, fonteId] as const,
  painel: (projetoId: string) => ['painel', projetoId] as const,
  dadosDoPainel: (projetoId: string, filtros: object) =>
    ['painel', projetoId, 'dados', filtros] as const,
  opcoesDoPainel: (projetoId: string) => ['painel', projetoId, 'opcoes'] as const,
  comentarios: (projetoId: string, filtros: object, pagina: number) =>
    ['painel', projetoId, 'comentarios', filtros, { pagina }] as const,
  filaDeRevisao: (projetoId: string, pagina: number) =>
    ['painel', projetoId, 'revisao', { pagina }] as const,
  estimativa: (projetoId: string) => ['classificacao', projetoId, 'estimativa'] as const,
  progressoDaClassificacao: (projetoId: string) =>
    ['classificacao', projetoId, 'progresso'] as const,
};

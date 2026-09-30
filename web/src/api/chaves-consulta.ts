export const chavesConsulta = {
  configuracaoPublica: ['configuracao-publica'] as const,
  eu: ['auth', 'eu'] as const,
  conta: ['conta'] as const,
  usuarios: ['usuarios'] as const,
  convites: ['convites'] as const,
  projetos: (pagina: number) => ['projetos', { pagina }] as const,
  todosOsProjetos: ['projetos'] as const,
};

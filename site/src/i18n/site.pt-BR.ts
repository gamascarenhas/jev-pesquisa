// Textos PROVISÓRIOS da landing e do blog. O nome do negócio vem de {nomeNegocio}, nunca escrito aqui.
// Só entra o que o produto faz hoje: sem preço, depoimento, número de clientes ou comparação.
export const MARCADOR_NOME_NEGOCIO = '%NOME_NEGOCIO%';

export const textosDoSite = {
  idioma: 'pt-BR',
  navegacao: {
    principal: 'Navegação principal',
    blog: 'Blog',
    entrar: 'Entrar',
    criarConta: 'Criar conta',
    irParaOConteudo: 'Ir para o conteúdo',
    comoFunciona: 'Como funciona',
    demonstracao: 'Demonstração',
    perguntas: 'Perguntas',
  },
  vinhetas: {
    desordem: {
      planilha: ['Demorou demais pra…', 'Atendente educado…', 'Produto veio errad…'],
      avaliacao: { estrelas: '★★☆☆☆', texto: 'Esperei 40 minutos e ninguém me…' },
      mensagem: 'Vocês vão responder minha reclamação?',
      naoLidos: '1.248 sem leitura',
    },
    ordem: [
      { texto: 'Esperei 40 minutos no caixa.', tema: 'Tempo de espera', tom: 'critico', sentimento: 'Negativo' },
      { texto: 'Equipe muito simpática.', tema: 'Atendimento', tom: 'sucesso', sentimento: 'Positivo' },
      { texto: 'O app trava ao pagar.', tema: 'Canais digitais', tom: 'critico', sentimento: 'Negativo' },
    ],
    importar: {
      arquivo: 'comentarios-setembro.xlsx',
      linhas: '1.248 linhas',
      google: 'Perfil da Empresa no Google',
      unidades: '3 unidades',
    },
    classificar: {
      texto: 'A entrega atrasou três dias e ninguém respondeu.',
      etiquetas: [
        { rotulo: 'Entrega', tom: 'info' },
        { rotulo: 'Negativo', tom: 'critico' },
        { rotulo: 'Problema sério', tom: 'critico' },
      ],
      confianca: 'Confiança',
      valor: 94,
    },
    painel: {
      destaques: [
        { rotulo: 'Comentários', valor: '1.248' },
        { rotulo: 'Para revisar', valor: '37' },
      ],
      temas: [
        { nome: 'Tempo de espera', volume: 70 },
        { nome: 'Atendimento', volume: 45 },
        { nome: 'Preço', volume: 28 },
      ],
    },
    filtros: {
      chips: ['Unidade: Centro', 'Últimos 30 dias', 'Negativo'],
      linhas: ['Fila enorme no sábado.', 'Achei ok, nada demais.', 'Cobraram duas vezes.'],
      revisar: 'Revisar',
      confirmar: 'Salvar correção',
    },
    resumo: {
      tema: 'Tempo de espera',
      alerta: 'Crítico',
      numeros: '312 comentários · 70% negativos',
      texto: 'As reclamações se concentram no caixa nos fins de semana.',
      link: 'Ver comentários',
    },
    perguntas: {
      pergunta: 'Quem reclamou da fila de espera?',
      maximo: 216,
      faixas: [
        { rotulo: 'Provavelmente sim', total: 84 },
        { rotulo: 'Incerto', total: 12 },
        { rotulo: 'Provavelmente não', total: 216 },
      ],
    },
    exportacao: {
      arquivo: 'comentarios-classificados.csv',
      colunas: ['comentario', 'tema', 'sentimento', 'confianca'],
      botao: 'Exportar CSV',
    },
  },
  apresentacao: {
    titulo: 'Entenda o que seus clientes dizem. Todos os comentários, não só uma amostra.',
    subtitulo:
      '{nomeNegocio} lê cada comentário, classifica por tema, sentimento e gravidade e mostra num painel o que pede a sua atenção.',
    chamada: 'Criar conta e testar',
    entrar: 'Já tenho conta',
    nota: 'Teste com os seus próprios comentários.',
  },
  maquete: {
    rotulo: 'Exemplo do painel com comentários classificados',
    aviso: 'Exemplo ilustrativo, com dados fictícios.',
    titulo: 'Comentários',
    periodo: 'Últimos 30 dias',
    confianca: 'Confiança',
    revisar: 'Revisar',
    temasTitulo: 'Temas mais citados',
    comentarios: [
      {
        texto: 'A entrega atrasou três dias e ninguém respondeu o meu e-mail.',
        tema: 'Entrega',
        sentimento: { rotulo: 'Negativo', tom: 'critico' },
        gravidade: { rotulo: 'Problema sério', tom: 'critico' },
        confianca: 94,
        revisar: false,
      },
      {
        texto: 'Atendimento muito atencioso, resolveram tudo na hora.',
        tema: 'Atendimento',
        sentimento: { rotulo: 'Positivo', tom: 'sucesso' },
        gravidade: { rotulo: 'Sem problema', tom: 'neutro' },
        confianca: 97,
        revisar: false,
      },
      {
        texto: 'O produto é bom, mas o preço subiu demais este mês.',
        tema: 'Preço',
        sentimento: { rotulo: 'Misto', tom: 'atencao' },
        gravidade: { rotulo: 'Incômodo pequeno', tom: 'atencao' },
        confianca: 71,
        revisar: true,
      },
    ],
    temas: [
      { nome: 'Entrega', volume: 38 },
      { nome: 'Atendimento', volume: 27 },
      { nome: 'Preço', volume: 21 },
      { nome: 'Produto', volume: 14 },
    ],
  },
  formatos: {
    titulo: 'Traga os comentários de onde eles já estão',
    itens: ['Planilhas CSV', 'Planilhas Excel', 'Perfil da Empresa no Google'],
  },
  demonstracao: {
    titulo: 'Veja funcionando',
    subtitulo: 'Escolha uma etapa para ver a tela no computador e no celular.',
    abasRotulo: 'Etapas da demonstração',
    aviso:
      'Telas simuladas com dados fictícios. No computador, o tema claro, que é o padrão; no celular, o tema escuro.',
    rotuloComputador: 'Tela simulada no computador: {etapa}',
    rotuloCelular: 'Tela simulada no celular: {etapa}',
    app: {
      navegacao: ['Projetos', 'Primeiros passos', 'Configurações'],
      consumo: 'Plano: 32% usado',
    },
    etapas: [
      {
        id: 'importar',
        aba: 'Importar',
        titulo: 'Importe a planilha',
        texto:
          'Envie um CSV ou Excel e diga qual coluna é o comentário. Importar o mesmo arquivo de novo não duplica nada.',
      },
      {
        id: 'classificar',
        aba: 'Classificar',
        titulo: 'Cada comentário classificado',
        texto:
          'Tema, sentimento e confiança em cada linha. O que ficou incerto vai para a fila de revisão.',
      },
      {
        id: 'painel',
        aba: 'Painel',
        titulo: 'O painel mostra o que pede atenção',
        texto: 'Totais, temas por sentimento e gravidade, com filtros por unidade e período.',
      },
      {
        id: 'resumo',
        aba: 'Resumo',
        titulo: 'Resumo executivo por tema',
        texto:
          'Um texto curto por tema, com números calculados pelo sistema e os comentários que sustentam cada achado.',
      },
    ],
    importar: {
      titulo: 'Importar comentários',
      passos: ['Arquivo', 'Colunas', 'Importação'],
      mapeamentoTitulo: 'Diga o que é cada coluna',
      colunas: [
        { coluna: 'comentario_cliente', uso: 'Comentário (obrigatório)' },
        { coluna: 'data_visita', uso: 'Data' },
        { coluna: 'nota', uso: 'Nota' },
        { coluna: 'loja', uso: 'Unidade ou local' },
      ],
      botao: 'Importar comentários',
    },
    classificar: {
      titulo: 'Comentários',
      colunas: ['Comentário', 'Tema', 'Sentimento', 'Confiança'],
      revisar: 'Revisar',
      linhas: [
        {
          texto: 'Esperei 40 minutos para ser atendido no caixa.',
          tema: 'Tempo de espera',
          sentimento: { rotulo: 'Negativo', tom: 'critico' },
          confianca: 96,
          revisar: false,
        },
        {
          texto: 'Equipe muito simpática, volto com certeza.',
          tema: 'Atendimento',
          sentimento: { rotulo: 'Positivo', tom: 'sucesso' },
          confianca: 98,
          revisar: false,
        },
        {
          texto: 'O app trava na hora de pagar.',
          tema: 'Canais digitais',
          sentimento: { rotulo: 'Negativo', tom: 'critico' },
          confianca: 91,
          revisar: false,
        },
        {
          texto: 'Achei ok, nada demais.',
          tema: 'Outro',
          sentimento: { rotulo: 'Neutro', tom: 'neutro' },
          confianca: 62,
          revisar: true,
        },
      ],
    },
    painel: {
      titulo: 'Painel',
      cartoes: [
        { rotulo: 'Comentários', valor: '1.248' },
        { rotulo: 'Classificados', valor: '1.236' },
        { rotulo: 'Para revisar', valor: '37' },
        { rotulo: 'Nota média', valor: '4,1' },
      ],
      graficoTitulo: 'Comentários por tema e sentimento',
      legenda: { positivo: 'Positivo', neutro: 'Neutro', misto: 'Misto', negativo: 'Negativo' },
      temas: [
        { nome: 'Tempo de espera', positivo: 10, neutro: 12, misto: 8, negativo: 70 },
        { nome: 'Atendimento', positivo: 62, neutro: 18, misto: 8, negativo: 12 },
        { nome: 'Canais digitais', positivo: 20, neutro: 20, misto: 10, negativo: 50 },
        { nome: 'Preço', positivo: 15, neutro: 25, misto: 20, negativo: 40 },
      ],
    },
    resumo: {
      titulo: 'Resumo executivo',
      verComentarios: 'Ver comentários',
      geradoPorIa: 'Texto gerado por IA e verificado contra os comentários.',
      cartoes: [
        {
          tema: 'Tempo de espera',
          alerta: { rotulo: 'Crítico', tom: 'critico' },
          numeros: '312 comentários · 70% negativos',
          variacao: 'Volume +18% contra o período anterior',
          texto:
            'As reclamações se concentram no caixa nos fins de semana, com esperas de mais de 30 minutos citadas em várias unidades.',
        },
        {
          tema: 'Atendimento',
          alerta: { rotulo: 'Estável', tom: 'sucesso' },
          numeros: '274 comentários · 12% negativos',
          variacao: 'Volume −4% contra o período anterior',
          texto: 'Os clientes elogiam a simpatia da equipe, principalmente na unidade Centro.',
        },
      ],
    },
  },
  problema: {
    titulo: 'Hoje, a maioria das empresas lê só uma amostra',
    antes: {
      titulo: 'Hoje',
      itens: [
        {
          titulo: 'Comentários espalhados',
          texto: 'Planilhas, avaliações e mensagens em lugares diferentes, sem uma visão única.',
        },
        {
          titulo: 'Leitura por amostragem',
          texto: 'Ninguém consegue ler tudo, então o que não foi lido continua escondido.',
        },
        {
          titulo: 'Decisão sem evidência',
          texto:
            'Sem saber o que mais aparece e o que é mais grave, fica difícil escolher o que resolver primeiro.',
        },
      ],
    },
    depois: {
      titulo: 'Com {nomeNegocio}',
      itens: [
        {
          titulo: 'Uma visão única',
          texto: 'Planilhas e avaliações do Google reunidas no mesmo painel.',
        },
        {
          titulo: 'Todos os comentários lidos',
          texto: 'Cada um recebe tema, sentimento e gravidade, não só uma amostra.',
        },
        {
          titulo: 'Decisão com evidência',
          texto: 'Veja o que mais aparece e o que é mais grave, e escolha o que resolver primeiro.',
        },
      ],
    },
  },
  comoFunciona: {
    titulo: 'Como funciona',
    subtitulo: 'Do arquivo ao painel em três passos.',
    passos: [
      {
        titulo: 'Traga os comentários',
        texto:
          'Envie uma planilha CSV ou Excel, ou conecte o Perfil da Empresa no Google para importar as avaliações das suas unidades.',
      },
      {
        titulo: 'Classificamos cada um',
        texto:
          'Cada comentário recebe um tema, um sentimento e um nível de gravidade, com a confiança de cada resposta.',
      },
      {
        titulo: 'Use o painel',
        texto:
          'Filtre, revise o que ficou incerto, leia o resumo por tema e exporte o que precisar.',
      },
    ],
  },
  entrega: {
    titulo: 'O que o painel entrega',
    subtitulo: 'Tudo o que você precisa para escolher o que resolver primeiro.',
    itens: [
      {
        titulo: 'Classificação de cada comentário',
        texto:
          'Tema, sentimento e gravidade, e uma indicação de quando vale a pena uma pessoa conferir.',
      },
      {
        titulo: 'Painel com filtros e fila de revisão',
        texto:
          'Veja o conjunto por unidade, período, tema ou sentimento e corrija o que estiver errado.',
      },
      {
        titulo: 'Resumo executivo por tema',
        texto:
          'Um texto curto para ler em um minuto. Os números são calculados pelo sistema e cada achado só aparece depois de conferido com os comentários.',
      },
      {
        titulo: 'Perguntas livres',
        texto:
          'Pergunte algo sobre os comentários e veja quais deles respondem sim, em faixas de probabilidade.',
      },
      {
        titulo: 'Exportação em CSV',
        texto: 'Leve os dados classificados para a ferramenta que você já usa.',
      },
    ],
  },
  privacidade: {
    titulo: 'Privacidade e controle dos dados',
    subtitulo:
      'Os comentários dos seus clientes são tratados como dados sensíveis desde a importação.',
    exemplo: {
      rotulo: 'Exemplo de anonimização',
      antesRotulo: 'Comentário original',
      antes: 'Meu e-mail é ana@exemplo.com, me liguem no (11) 98765-4321.',
      depoisRotulo: 'O que vai para a análise por IA',
      depois: 'Meu e-mail é [EMAIL], me liguem no [TELEFONE].',
    },
    itens: [
      {
        titulo: 'Anonimização antes da análise por IA',
        texto:
          'CPF, CNPJ, e-mail, telefone e CEP são mascarados. Nomes e endereços escritos no meio do texto não são cobertos.',
      },
      {
        titulo: 'Seus dados, sob o seu controle',
        texto:
          'Você apaga projetos, desconecta o Google ou encerra a conta, e os dados são removidos de verdade.',
      },
      {
        titulo: 'Cada empresa vê só o que é seu',
        texto: 'Os dados de uma conta nunca aparecem em outra.',
      },
    ],
    link: 'Ler a política de privacidade',
  },
  perguntas: {
    titulo: 'Perguntas frequentes',
    subtitulo: 'O que as pessoas mais perguntam antes de criar a conta.',
    itens: [
      {
        pergunta: 'Que arquivos posso enviar?',
        resposta:
          'Planilhas CSV e Excel. Você escolhe qual coluna é o comentário e, se quiser, data, nota, unidade e autor.',
      },
      {
        pergunta: 'Preciso conectar o Google?',
        resposta:
          'Não. A conexão com o Perfil da Empresa no Google é opcional, só para quem quer importar avaliações por lá.',
      },
      {
        pergunta: 'A IA pode inventar números no resumo?',
        resposta:
          'Os números são calculados pelo sistema, não pela IA. A IA só escreve o texto, e cada achado só aparece depois de conferido com os comentários que o sustentam.',
      },
      {
        pergunta: 'Os resultados são certezas?',
        resposta:
          'Não. O sistema indica probabilidade e mostra a confiança. Você pode corrigir o que estiver errado na fila de revisão.',
      },
      {
        pergunta: 'Como apago os meus dados?',
        resposta:
          'Dentro da conta você apaga projetos, desconecta o Google e encerra a conta. A remoção é real.',
      },
      {
        pergunta: 'Quanto custa?',
        resposta: 'A cobrança ainda não está ativa. Crie a conta e teste com os seus comentários.',
      },
    ],
  },
  chamadaFinal: {
    titulo: 'Crie a conta da sua empresa e teste com os seus próprios comentários',
    chamada: 'Criar conta e testar',
    garantias: [
      'A cobrança ainda não está ativa',
      'Teste com os seus próprios comentários',
      'Apague os seus dados quando quiser',
    ],
  },
  rodape: {
    navegacao: 'Rodapé',
    descricao: 'Todos os comentários dos seus clientes, lidos e classificados.',
    produto: 'Produto',
    conteudo: 'Conteúdo',
    legal: 'Legal',
    conta: 'Conta',
    blog: 'Blog',
    termos: 'Termos de uso',
    privacidade: 'Política de privacidade',
    entrar: 'Entrar',
    criarConta: 'Criar conta',
    direitos: '{nomeNegocio}. Todos os direitos reservados.',
  },
  blog: {
    titulo: 'Blog',
    descricao: 'Artigos sobre como ouvir melhor os comentários dos clientes.',
    tituloDaPagina: 'Blog',
    vazio: 'Ainda não há artigos publicados.',
    lerArtigo: 'Ler o artigo',
    publicadoEm: 'Publicado em',
    atualizadoEm: 'Atualizado em',
    porAutor: 'Por',
    trilha: 'Trilha de navegação',
    inicio: 'Início',
    voltar: 'Voltar para o blog',
  },
  naoEncontrada: {
    titulo: 'Página não encontrada',
    texto: 'O endereço não existe ou foi movido.',
    voltar: 'Ir para o início',
    tituloDaPagina: 'Página não encontrada',
  },
  seo: {
    tituloDaLanding: '{nomeNegocio}: entenda todos os comentários dos seus clientes',
    descricaoDaLanding:
      'Classifique cada comentário por tema, sentimento e gravidade e use um painel para decidir o que resolver primeiro.',
    tituloDoBlog: 'Blog | {nomeNegocio}',
    descricaoDoBlog: 'Artigos sobre como ouvir melhor os comentários dos clientes.',
    sufixoDoArtigo: '{nomeNegocio}',
    descricaoDaImagem: 'Imagem de compartilhamento de {nomeNegocio}',
  },
} as const;

export function comNomeDoNegocio(texto: string): string {
  return texto.replaceAll('{nomeNegocio}', MARCADOR_NOME_NEGOCIO);
}

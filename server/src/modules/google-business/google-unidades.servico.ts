import type {
  FonteDeAvaliacoes,
  UnidadeDoGoogle,
} from '../../integrations/google/fonte-avaliacoes.js';
import type { TrabalhosServico } from '../../jobs/trabalhos.servico.js';
import { ErroDeConflito, ErroDeValidacao } from '../../shared/errors.js';
import type { ContaId, ProjetoId, TrabalhoId, UsuarioId } from '../../shared/ids.js';
import type { ProjetosServico } from '../projects/projetos.servico.js';
import type { ConexoesGoogleRepositorio } from './conexoes-google.repositorio.js';
import type { ConexaoGoogle, FonteGoogle } from './conexoes-google.tipos.js';
import { traduzirErroDoGoogle } from './erros-google.js';
import type { FontesGoogleRepositorio } from './fontes-google.repositorio.js';
import type { GoogleOauthServico } from './google-oauth.servico.js';

export interface StatusDoGoogle {
  conectado: boolean;
  email: string | null;
  simulado: boolean;
  sincronizando: boolean;
  unidades: FonteGoogle[];
}

export interface ContaComUnidades {
  id: string;
  nome: string;
  unidades: { nome: string; titulo: string; endereco: string | null; selecionada: boolean }[];
}

export interface InicioDeSincronizacao {
  trabalhoId: TrabalhoId;
  jaExistia: boolean;
}

export interface GoogleUnidadesServico {
  status(contaId: ContaId, projetoId: ProjetoId): Promise<StatusDoGoogle>;
  listarDisponiveis(contaId: ContaId, projetoId: ProjetoId): Promise<ContaComUnidades[]>;
  selecionar(
    contaId: ContaId,
    usuarioId: UsuarioId,
    projetoId: ProjetoId,
    unidades: string[],
  ): Promise<InicioDeSincronizacao>;
  sincronizar(
    contaId: ContaId,
    usuarioId: UsuarioId,
    projetoId: ProjetoId,
  ): Promise<InicioDeSincronizacao>;
}

export interface DependenciasDasUnidades {
  fonte: FonteDeAvaliacoes;
  simulado: boolean;
  oauth: Pick<GoogleOauthServico, 'obterTokenDeAcesso'>;
  conexoes: ConexoesGoogleRepositorio;
  fontes: FontesGoogleRepositorio;
  projetos: ProjetosServico;
  trabalhos: Pick<TrabalhosServico, 'criar' | 'listarAtivosDoTipo'>;
}

class GoogleUnidadesServicoImpl implements GoogleUnidadesServico {
  constructor(private readonly dep: DependenciasDasUnidades) {}

  async status(contaId: ContaId, projetoId: ProjetoId): Promise<StatusDoGoogle> {
    await this.dep.projetos.obter(contaId, projetoId);
    const conexao = await this.dep.conexoes.buscarAtiva(contaId, projetoId);
    const ativos = await this.dep.trabalhos.listarAtivosDoTipo(contaId, 'google_sync');
    return {
      conectado: conexao !== undefined,
      email: conexao?.email ?? null,
      simulado: this.dep.simulado,
      sincronizando: ativos.some((trabalho) => trabalho.projetoId === projetoId),
      unidades: conexao === undefined ? [] : await this.dep.fontes.listar(contaId, projetoId),
    };
  }

  async listarDisponiveis(contaId: ContaId, projetoId: ProjetoId): Promise<ContaComUnidades[]> {
    const conexao = await this.exigirConexao(contaId, projetoId);
    const escolhidas = new Set(
      (await this.dep.fontes.listar(contaId, projetoId)).map((fonte) => fonte.nomeUnidade),
    );
    return (await this.listarNoGoogle(conexao)).map(({ id, nome, unidades }) => ({
      id,
      nome,
      unidades: unidades.map((u) => ({ ...u, selecionada: escolhidas.has(u.nome) })),
    }));
  }

  async selecionar(
    contaId: ContaId,
    usuarioId: UsuarioId,
    projetoId: ProjetoId,
    nomes: string[],
  ): Promise<InicioDeSincronizacao> {
    const conexao = await this.exigirConexao(contaId, projetoId);
    // Só entram unidades que o Google realmente listou para esta conexão.
    const conhecidas = new Map<string, UnidadeDoGoogle>(
      (await this.listarNoGoogle(conexao)).flatMap(({ unidades }) =>
        unidades.map((unidade) => [unidade.nome, unidade] as const),
      ),
    );
    const escolhidas = [...new Set(nomes)].flatMap((nome) => conhecidas.get(nome) ?? []);
    if (escolhidas.length === 0 || escolhidas.length < new Set(nomes).size) {
      throw new ErroDeValidacao(
        'Escolha unidades da sua conta do Google.',
        'google_unidade_invalida',
      );
    }
    for (const unidade of escolhidas) {
      await this.dep.fontes.garantir(contaId, projetoId, conexao.id, unidade.nome, unidade.titulo);
    }
    return this.enfileirar(contaId, usuarioId, projetoId);
  }

  async sincronizar(
    contaId: ContaId,
    usuarioId: UsuarioId,
    projetoId: ProjetoId,
  ): Promise<InicioDeSincronizacao> {
    await this.exigirConexao(contaId, projetoId);
    if ((await this.dep.fontes.listar(contaId, projetoId)).length === 0) {
      throw new ErroDeValidacao(
        'Escolha ao menos uma unidade para importar.',
        'google_sem_unidades',
      );
    }
    return this.enfileirar(contaId, usuarioId, projetoId);
  }

  private async exigirConexao(contaId: ContaId, projetoId: ProjetoId): Promise<ConexaoGoogle> {
    await this.dep.projetos.obter(contaId, projetoId);
    const conexao = await this.dep.conexoes.buscarAtiva(contaId, projetoId);
    if (conexao === undefined) {
      throw new ErroDeConflito('Conecte o projeto ao Google primeiro.', 'google_nao_conectado');
    }
    return conexao;
  }

  private async listarNoGoogle(conexao: ConexaoGoogle) {
    try {
      const token = await this.dep.oauth.obterTokenDeAcesso(conexao);
      const contas = await this.dep.fonte.listarContas(token);
      return await Promise.all(
        contas.map(async (conta) => ({
          ...conta,
          unidades: await this.dep.fonte.listarUnidades(token, conta.id),
        })),
      );
    } catch (erro) {
      throw traduzirErroDoGoogle(erro);
    }
  }

  private async enfileirar(
    contaId: ContaId,
    usuarioId: UsuarioId,
    projetoId: ProjetoId,
  ): Promise<InicioDeSincronizacao> {
    const { trabalho, jaExistia } = await this.dep.trabalhos.criar(contaId, {
      tipo: 'google_sync',
      projetoId,
      criadoPor: usuarioId,
    });
    return { trabalhoId: trabalho.id, jaExistia };
  }
}

export function criarGoogleUnidadesServico(dep: DependenciasDasUnidades): GoogleUnidadesServico {
  return new GoogleUnidadesServicoImpl(dep);
}

import { carregarConfiguracao } from '../src/config/config.js';
import { criarBanco, type Banco } from '../src/db/conexoes.js';
import { semearPlanos } from '../src/db/dados-iniciais.js';
import { aplicarMigracoes } from '../src/db/migrar.js';
import { criarAutenticacaoSistemaRepositorio } from '../src/modules/auth/autenticacao.sistema.repositorio.js';
import { gerarHashDeSenha } from '../src/modules/auth/senha.js';
import { criarUsuariosRepositorio } from '../src/modules/auth/usuarios.repositorio.js';
import { criarComentariosRepositorio } from '../src/modules/comments/comentarios.repositorio.js';
import { criarImportadorDeComentarios } from '../src/modules/comments/comentarios.servico.js';
import { criarEnviadorLog } from '../src/integrations/mail/enviador-log.js';
import { criarClassificadorSimulado } from '../src/integrations/jev/classificador-simulado.js';
import { criarTrabalhosRepositorio } from '../src/jobs/trabalhos.repositorio.js';
import { criarTrabalhosServico } from '../src/jobs/trabalhos.servico.js';
import { criarClassificacoesRepositorio } from '../src/modules/classification/classificacoes.repositorio.js';
import { criarRevisoesRepositorio } from '../src/modules/classification/revisoes.repositorio.js';
import { criarClassificacaoServico } from '../src/modules/classification/classificacao.servico.js';
import { criarProjetosServico } from '../src/modules/projects/projetos.servico.js';
import { criarControleDeCustoDoSistema } from '../src/modules/usage/controle-custo-sistema.js';
import { relogioDoSistema } from '../src/shared/clock.js';
import { exigirDesenvolvimento } from './somente-desenvolvimento.js';
import { gerarComentariosDeDemonstracao } from './dados-demonstracao.js';
import { criarFontesRepositorio } from '../src/modules/uploads/fontes.repositorio.js';
import { criarProjetosRepositorio } from '../src/modules/projects/projetos.repositorio.js';
import { comoUsuarioId, type ContaId, type FonteId, type ProjetoId } from '../src/shared/ids.js';
import { criarRegistrador } from '../src/shared/logger.js';

const EMAIL_DA_DEMONSTRACAO = 'demo@exemplo.com.br';
const SENHA_DA_DEMONSTRACAO = 'demonstracao-123';
const NOME_DO_PROJETO = 'Projeto de demonstração';
const NOME_DA_FONTE = 'demonstracao.csv';
const QUANTIDADE_DE_COMENTARIOS = 1_000;

async function obterContaDaDemonstracao(banco: Banco, versaoTermos: string): Promise<ContaId> {
  const existente = await banco.query<{ conta_id: ContaId }>(
    'SELECT conta_id FROM usuarios WHERE lower(email) = $1',
    [EMAIL_DA_DEMONSTRACAO],
  );
  if (existente.rows[0] !== undefined) {
    return existente.rows[0].conta_id;
  }
  const contaId = await criarAutenticacaoSistemaRepositorio(banco).criarConta({
    nome: 'Empresa de demonstração',
    planoId: 'trial',
  });
  await criarUsuariosRepositorio(banco).criar(contaId, {
    nome: 'Usuário de demonstração',
    email: EMAIL_DA_DEMONSTRACAO,
    hashSenha: await gerarHashDeSenha(SENHA_DA_DEMONSTRACAO),
    papel: 'owner',
    emailConfirmadoEm: new Date(),
    termosAceitosEm: new Date(),
    versaoTermos,
  });
  return contaId;
}

async function obterProjeto(banco: Banco, contaId: ContaId): Promise<ProjetoId> {
  const existente = await banco.query<{ id: ProjetoId }>(
    'SELECT id FROM projetos WHERE conta_id = $1 AND nome = $2',
    [contaId, NOME_DO_PROJETO],
  );
  if (existente.rows[0] !== undefined) {
    return existente.rows[0].id;
  }
  const projetos = criarProjetosRepositorio(banco);
  const usuario = await banco.query<{ id: string }>(
    'SELECT id FROM usuarios WHERE conta_id = $1 LIMIT 1',
    [contaId],
  );
  return (await projetos.criar(contaId, NOME_DO_PROJETO, comoUsuarioId(usuario.rows[0]?.id ?? '')))
    .id;
}

async function obterFonte(banco: Banco, contaId: ContaId, projetoId: ProjetoId): Promise<FonteId> {
  const existente = await banco.query<{ id: FonteId }>(
    "SELECT id FROM fontes WHERE conta_id = $1 AND projeto_id = $2 AND tipo = 'upload' AND nome = $3",
    [contaId, projetoId, NOME_DA_FONTE],
  );
  return (
    existente.rows[0]?.id ??
    (await criarFontesRepositorio(banco).criarUpload(contaId, projetoId, NOME_DA_FONTE)).id
  );
}

// Classifica com o Jev simulado, passando pelo controle de custo como em qualquer outra chamada.
async function classificarComentarios(
  banco: Banco,
  configuracao: ReturnType<typeof carregarConfiguracao>,
  contaId: ContaId,
  projetoId: ProjetoId,
): Promise<string> {
  const registrador = criarRegistrador({ nivel: 'warn', legivel: true });
  const classificacao = criarClassificacaoServico({
    classificacoes: criarClassificacoesRepositorio(banco),
    projetos: criarProjetosServico(criarProjetosRepositorio(banco)),
    revisoes: criarRevisoesRepositorio(banco),
    trabalhos: criarTrabalhosServico(criarTrabalhosRepositorio(banco)),
    controleDeCusto: criarControleDeCustoDoSistema({
      banco,
      configuracao,
      registrador,
      relogio: relogioDoSistema,
      retomarJob: () => Promise.resolve(false),
      enviador: criarEnviadorLog(registrador),
      listarDonos: () => Promise.resolve([]),
    }),
    classificador: criarClassificadorSimulado(),
    registrador,
    concorrencia: configuracao.jev.concorrencia,
  });
  try {
    await classificacao.classificarPendentes(contaId, projetoId, {
      aoProgredir: () => Promise.resolve(),
    });
    return 'Comentários classificados com o Jev simulado.';
  } catch (erro) {
    return `Classificação interrompida: ${erro instanceof Error ? erro.name : 'erro'}.`;
  }
}

async function semear(): Promise<void> {
  const configuracao = carregarConfiguracao();
  exigirDesenvolvimento(configuracao);
  const banco = criarBanco(configuracao.urlBanco);
  try {
    await aplicarMigracoes(banco, criarRegistrador({ nivel: 'warn', legivel: true }));
    await semearPlanos(banco);
    const contaId = await obterContaDaDemonstracao(banco, configuracao.versaoTermos);
    const projetoId = await obterProjeto(banco, contaId);
    const fonteId = await obterFonte(banco, contaId, projetoId);
    const comentarios = criarImportadorDeComentarios(criarComentariosRepositorio(banco));
    const resultado = await comentarios.importarLote(
      contaId,
      projetoId,
      fonteId,
      gerarComentariosDeDemonstracao(QUANTIDADE_DE_COMENTARIOS),
    );
    const classificacao = await classificarComentarios(banco, configuracao, contaId, projetoId);
    process.stdout.write(
      `Demonstração pronta: ${String(resultado.inseridos)} comentários novos, ` +
        `${String(resultado.duplicados)} já existiam. ${classificacao}\n` +
        `Entre com ${EMAIL_DA_DEMONSTRACAO} e a senha ${SENHA_DA_DEMONSTRACAO}.\n`,
    );
  } finally {
    await banco.end();
  }
}

semear().catch((erro: unknown) => {
  process.stderr.write(`${erro instanceof Error ? erro.message : String(erro)}\n`);
  process.exit(1);
});

import { spawn, type ChildProcess } from 'node:child_process';

// Sobe a API e o Vite juntos, para o desenvolvimento não exigir dois terminais.
const COMANDOS: { nome: string; argumentos: string[] }[] = [
  { nome: 'server', argumentos: ['run', 'dev', '-w', 'server'] },
  { nome: 'web', argumentos: ['run', 'dev', '-w', 'web'] },
];

const filhos: ChildProcess[] = COMANDOS.map(({ argumentos }) =>
  spawn('npm', argumentos, { stdio: 'inherit', shell: true }),
);

function encerrarTodos(codigo: number): void {
  for (const filho of filhos) {
    filho.kill();
  }
  process.exit(codigo);
}

for (const filho of filhos) {
  filho.on('exit', (codigo) => {
    encerrarTodos(codigo ?? 1);
  });
}
process.on('SIGINT', () => {
  encerrarTodos(0);
});
process.on('SIGTERM', () => {
  encerrarTodos(0);
});

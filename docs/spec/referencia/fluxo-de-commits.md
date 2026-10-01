# Fluxo de commits e push por fase

## Permissão permanente

Sempre que eu pedir para começar uma nova fase, você está autorizado a, **antes de escrever qualquer código dela**:

1. Rodar `git status` e conferir se o trabalho da fase anterior já foi commitado e enviado (`git log origin/main..HEAD` vazio).
2. Se não foi, commitar o que estiver pendente e dar `git push`, sem pedir confirmação.
3. Só então começar a fase pedida.

## Regras

- Um commit por fase, com a mensagem `feat: fase N - nome da fase`, no padrão do histórico.
- Antes de commitar, `verificar` e `build` precisam passar. Se falharem, não commite: avise no relatório.
- Nunca commitar `.env*` reais, `server/tmp/`, `dist/`, imagens do Mobbin ou qualquer segredo. Confira o que está em stage antes do commit.
- Push só para a branch atual e sem `--force`. Se o push for recusado, pare e me avise em vez de forçar.
- Esta permissão cobre só commit e push do trabalho da fase anterior. Outras ações externas continuam exigindo meu pedido.

## Ao terminar cada fase

Antes de entregar o relatório, reinicie o frontend, o backend e o container do banco de dados (`jev-pesquisa-banco`), sem apagar o volume, e confirme que as portas 5432, 3000 e 5173 respondem. Registre o resultado no relatório.

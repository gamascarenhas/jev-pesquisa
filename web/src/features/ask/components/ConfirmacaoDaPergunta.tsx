import type { PerguntaDetalhada } from '@/api/types';
import { Alerta } from '@/components/ui/Alerta';
import { Botao } from '@/components/ui/Botao';
import { Cartao } from '@/components/ui/Cartao';
import { textos } from '@/i18n/pt-BR';
import { formatarNumero, interpolar } from '@/lib/format';

interface ConfirmacaoDaPerguntaProps {
  pergunta: PerguntaDetalhada;
  confirmando: boolean;
  aoConfirmar: () => void;
  aoEditar: () => void;
}

function formatarPorcentagem(valor: number): string {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

// Nada roda antes deste passo: o usuário vê o que será avaliado e quanto do plano isso consome.
export function ConfirmacaoDaPergunta({
  pergunta,
  confirmando,
  aoConfirmar,
  aoEditar,
}: ConfirmacaoDaPerguntaProps) {
  const { perguntar: t } = textos;
  const { confirmacao } = pergunta;

  return (
    <Cartao titulo={t.comoEntendi} descricao={pergunta.interpretacao ?? ''}>
      {confirmacao !== null && (
        <ul className="flex flex-col gap-1">
          <li className="texto-corpo">
            {interpolar(t.avaliar, { total: formatarNumero(confirmacao.totalAvaliar) })}
          </li>
          {confirmacao.foraDoLimite > 0 && (
            <li className="texto-auxiliar">
              {interpolar(t.foraDoLimite, { fora: formatarNumero(confirmacao.foraDoLimite) })}
            </li>
          )}
          {confirmacao.jaRespondidos > 0 && (
            <li className="texto-auxiliar">
              {interpolar(t.jaRespondidos, {
                respondidos: formatarNumero(confirmacao.jaRespondidos),
              })}
            </li>
          )}
          <li className="texto-corpo">
            {interpolar(t.estimativa, {
              porcentagem: formatarPorcentagem(confirmacao.porcentagemEstimada),
            })}
          </li>
        </ul>
      )}
      {confirmacao?.cabe === false && <Alerta tom="atencao">{t.naoCabe}</Alerta>}
      <div className="pilha-horizontal">
        <Botao carregando={confirmando} onClick={aoConfirmar}>
          {t.confirmar}
        </Botao>
        <Botao variante="secundario" onClick={aoEditar}>
          {t.editar}
        </Botao>
      </div>
    </Cartao>
  );
}

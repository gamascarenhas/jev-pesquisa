import { LayoutPublico } from '@site/components/LayoutPublico';
import { SecaoApresentacao } from '@site/components/SecaoApresentacao';
import { SecaoChamadaFinal } from '@site/components/SecaoChamadaFinal';
import { SecaoComoFunciona } from '@site/components/SecaoComoFunciona';
import { SecaoDemonstracao } from '@site/components/SecaoDemonstracao';
import { SecaoFormatos } from '@site/components/SecaoFormatos';
import { SecaoOQueEntrega } from '@site/components/SecaoOQueEntrega';
import { SecaoPerguntas } from '@site/components/SecaoPerguntas';
import { SecaoPrivacidade } from '@site/components/SecaoPrivacidade';
import { SecaoProblema } from '@site/components/SecaoProblema';
import { metadadosDaLanding } from '@site/seo/metadados';

export function Landing({ arquivosCss }: { arquivosCss: string[] }) {
  return (
    <LayoutPublico metadados={metadadosDaLanding()} arquivosCss={arquivosCss}>
      <SecaoApresentacao />
      <SecaoFormatos />
      <SecaoProblema />
      <SecaoComoFunciona />
      <SecaoDemonstracao />
      <SecaoOQueEntrega />
      <SecaoPrivacidade />
      <SecaoPerguntas />
      <SecaoChamadaFinal />
    </LayoutPublico>
  );
}

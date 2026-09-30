import { Link } from 'react-router';

import { textos } from '@/i18n/pt-BR';

export function AceiteDosTermos({ erro }: { erro: string | undefined }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="texto-corpo flex items-start gap-2">
        <input
          type="checkbox"
          name="aceiteTermos"
          aria-invalid={erro !== undefined}
          className="mt-1"
        />
        <span>
          {textos.termos.aceite}{' '}
          <Link to="/termos" target="_blank" className="texto-link">
            {textos.termos.termosDeUso}
          </Link>{' '}
          {textos.termos.e}{' '}
          <Link to="/privacidade" target="_blank" className="texto-link">
            {textos.termos.politica}
          </Link>
        </span>
      </label>
      {erro !== undefined && <p className="texto-auxiliar texto-erro">{erro}</p>}
    </div>
  );
}

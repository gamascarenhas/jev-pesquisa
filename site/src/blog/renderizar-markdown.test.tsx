import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CorpoDoArtigo } from './renderizar-markdown';

const html = (markdown: string) => renderToStaticMarkup(<CorpoDoArtigo markdown={markdown} />);

describe('CorpoDoArtigo', () => {
  it('mostra HTML bruto como texto, nunca como tag', () => {
    const saida = html('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>');

    expect(saida).not.toContain('<script');
    expect(saida).not.toContain('<img');
    expect(saida).toContain('&lt;script&gt;');
  });

  it('desce os títulos um nível e limita em h6', () => {
    const saida = html('# um\n\n## dois\n\n###### seis');

    expect(saida).toContain('<h2>um</h2>');
    expect(saida).toContain('<h3>dois</h3>');
    expect(saida).toContain('<h6>seis</h6>');
    expect(saida).not.toContain('<h1');
  });

  it('protege só os links externos e descarta imagens soltas', () => {
    const saida = html('[fora](https://example.com) e [dentro](/blog/) ![x](a.png)');

    expect(saida).toContain('<a href="https://example.com" rel="noopener noreferrer">');
    expect(saida).toContain('<a href="/blog/">');
    expect(saida).not.toContain('<img');
  });

  it('não gera href perigoso', () => {
    expect(html('[x](javascript:alert(1))')).not.toContain('javascript:');
  });
});

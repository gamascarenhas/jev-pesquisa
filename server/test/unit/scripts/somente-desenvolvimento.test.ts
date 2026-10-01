import { describe, expect, it } from 'vitest';

import { exigirDesenvolvimento } from '../../../scripts/somente-desenvolvimento.js';

describe('exigirDesenvolvimento', () => {
  it('se recusa a rodar em produção', () => {
    expect(() => {
      exigirDesenvolvimento({ estaEmProducao: true });
    }).toThrow('só roda em desenvolvimento');
  });

  it('deixa passar em desenvolvimento', () => {
    expect(() => {
      exigirDesenvolvimento({ estaEmProducao: false });
    }).not.toThrow();
  });
});

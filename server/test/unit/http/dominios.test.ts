import { describe, expect, it } from 'vitest';

import { identificarDominio } from '../../../src/http/dominios.js';

const origens = { origemApp: 'https://app.exemplo.com.br', origemSite: 'https://exemplo.com.br' };

describe('identificarDominio', () => {
  it.each([
    ['exemplo.com.br', 'site'],
    ['EXEMPLO.com.br', 'site'],
    ['app.exemplo.com.br', 'app'],
    ['outro.com.br', 'desconhecido'],
    ['exemplo.com.br:8080', 'desconhecido'],
    [undefined, 'desconhecido'],
  ])('Host %s vira %s', (host, esperado) => {
    expect(identificarDominio(host, origens)).toBe(esperado);
  });

  it('considera a porta quando a origem a tem', () => {
    const local = { origemApp: 'http://localhost:5173', origemSite: 'http://localhost:3000' };

    expect(identificarDominio('localhost:3000', local)).toBe('site');
    expect(identificarDominio('localhost:5173', local)).toBe('app');
    expect(identificarDominio('localhost', local)).toBe('desconhecido');
  });
});

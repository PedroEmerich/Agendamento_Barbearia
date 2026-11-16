import { describe, expect, it } from 'vitest';
import { mascararCpf, normalizarCpf } from '../src/lib/cpf';

describe('cpf', () => {
  it('aceita CPF válido com ou sem máscara', () => {
    expect(normalizarCpf('529.982.247-25')).toBe('52998224725');
    expect(normalizarCpf('52998224725')).toBe('52998224725');
  });
  it('rejeita dígito errado, tamanho errado e sequências repetidas', () => {
    expect(normalizarCpf('529.982.247-24')).toBeNull();
    expect(normalizarCpf('1234567890')).toBeNull();
    expect(normalizarCpf('111.111.111-11')).toBeNull();
  });
  it('aplica a máscara enquanto digita', () => {
    expect(mascararCpf('529')).toBe('529');
    expect(mascararCpf('5299822')).toBe('529.982.2');
    expect(mascararCpf('52998224725')).toBe('529.982.247-25');
  });
});

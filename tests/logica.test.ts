import { describe, expect, it } from 'vitest';
import { calcularSlots } from '../src/lib/disponibilidade';
import { agoraSP, diaSemana, formatarDataCurta, minParaHhmm, somarDias } from '../src/lib/datas';
import { mascararTelefone, normalizarTelefone } from '../src/lib/telefone';

const horas = (slots: number[]) => slots.map(minParaHhmm);
const base = { expediente: { inicio: 540, fim: 1140 }, ocupados: [], intervaloSlotMin: 30 };

describe('calcularSlots', () => {
  it('gera a grade no expediente simples', () => {
    const slots = horas(calcularSlots({ ...base, duracaoMin: 30 }));
    expect(slots[0]).toBe('09:00');
    expect(slots.at(-1)).toBe('18:30');
    expect(slots).toHaveLength(20);
  });

  it('serviço de 60 min não passa do fim do expediente', () => {
    expect(horas(calcularSlots({ ...base, duracaoMin: 60 })).at(-1)).toBe('18:00');
  });

  it('respeita a pausa', () => {
    const slots = horas(
      calcularSlots({ ...base, pausa: { inicio: 720, fim: 780 }, duracaoMin: 60 }),
    );
    expect(slots).toContain('11:00');
    expect(slots).not.toContain('11:30');
    expect(slots).not.toContain('12:00');
    expect(slots).toContain('13:00');
  });

  it('agendamento bloqueia sobrepostos, mas não os adjacentes', () => {
    const slots = horas(
      calcularSlots({ ...base, ocupados: [{ inicio: 600, fim: 660 }], duracaoMin: 30 }),
    );
    expect(slots).toContain('09:30');
    expect(slots).not.toContain('10:00');
    expect(slots).not.toContain('10:30');
    expect(slots).toContain('11:00');
  });

  it('bloqueio de dia inteiro e dia sem expediente não têm horários', () => {
    expect(
      calcularSlots({ ...base, ocupados: [{ inicio: 0, fim: 1440 }], duracaoMin: 30 }),
    ).toEqual([]);
    expect(calcularSlots({ ...base, expediente: null, duracaoMin: 30 })).toEqual([]);
  });

  it('antecedência mínima remove os horários próximos de agora', () => {
    const slots = horas(calcularSlots({ ...base, duracaoMin: 30, inicioMinimo: 615 }));
    expect(slots[0]).toBe('10:30');
  });
});

describe('telefone', () => {
  it('normaliza com e sem 55, com máscara', () => {
    expect(normalizarTelefone('(11) 98765-4321')).toBe('5511987654321');
    expect(normalizarTelefone('5511987654321')).toBe('5511987654321');
    expect(normalizarTelefone('+55 11 98765-4321')).toBe('5511987654321');
    expect(normalizarTelefone('1132654321')).toBe('551132654321');
  });

  it('rejeita números incompletos ou inválidos', () => {
    expect(normalizarTelefone('98765-4321')).toBeNull();
    expect(normalizarTelefone('(01) 98765-4321')).toBeNull();
    expect(normalizarTelefone('(11) 58765-4321')).toBeNull();
  });

  it('aplica a máscara enquanto digita', () => {
    expect(mascararTelefone('11')).toBe('(11');
    expect(mascararTelefone('119876')).toBe('(11) 9876');
    expect(mascararTelefone('11987654321')).toBe('(11) 98765-4321');
  });
});

describe('datas', () => {
  it('usa o fuso de São Paulo, não o do aparelho', () => {
    // 02:30 UTC ainda é o dia anterior em São Paulo (UTC-3).
    expect(agoraSP(new Date('2026-11-13T02:30:00Z'))).toEqual({
      data: '2026-11-12',
      minutos: 1410,
    });
  });

  it('soma dias atravessando o mês e formata', () => {
    expect(somarDias('2026-11-30', 1)).toBe('2026-12-01');
    expect(diaSemana('2026-11-12')).toBe(4);
    expect(formatarDataCurta('2026-11-12')).toBe('qui, 12/11');
  });
});

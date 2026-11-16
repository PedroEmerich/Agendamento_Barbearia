import { describe, expect, it } from 'vitest';
import {
  cicloDoMes,
  encaixarNaAgenda,
  gerarHorariosDoPlano,
  textoFixo,
  usoNoMes,
} from '../src/lib/assinaturas';
import type { Assinatura, Plano } from '../src/types';
import type { RegistroSemente } from '../src/lib/semente';

const jornada = { jornada: { inicio: 570, fim: 1200 }, pausa: { inicio: 750, fim: 810 } };
const expediente = { 2: jornada, 3: jornada, 4: jornada, 5: jornada, 6: jornada };
const planos: Plano[] = [
  {
    id: 'p1',
    nome: 'Plano Corte',
    descricao: '',
    servico_id: 's1',
    creditos_mes: 4,
    preco_mensal: 150,
    preco_avulso_mes: 180,
  },
];
const servicos = [{ id: 's1', nome: 'Corte', duracao_min: 30 }];

function assinatura(extra: Partial<Assinatura> = {}): Assinatura {
  return {
    id: 'a1',
    token: 't',
    cliente_nome: 'Marcos',
    cliente_telefone: '5511999999999',
    plano_id: 'p1',
    barbeiro_id: 'b1',
    fixo: { dia_semana: 4, hora: '18:00' },
    status: 'ATIVA',
    inicio: '2026-09-01',
    pago_ate: '2026-11',
    ...extra,
  };
}

const gerar = (a: Assinatura, simularUso = ['a1']) =>
  gerarHorariosDoPlano({
    simularUso,
    assinaturas: [a],
    planos,
    servicos,
    expediente,
    hoje: '2026-11-16',
    agoraMin: 600,
  });

describe('horários do plano', () => {
  it('dia fixo gera uma vez por semana, no dia e hora certos', () => {
    const regs = gerar(assinatura());
    expect(regs.length).toBeGreaterThan(8);
    for (const r of regs) {
      expect(new Date(`${r.data}T12:00:00Z`).getUTCDay()).toBe(4);
      expect(r.hora_inicio).toBe('18:00');
      expect(r.assinatura_id).toBe('a1');
      expect(r.preco).toBe(0);
    }
  });

  it('nunca passa dos créditos do mês (mês com 5 quintas)', () => {
    // Outubro de 2026 tem 5 quintas-feiras.
    const outubro = gerar(assinatura()).filter((r) => r.data.startsWith('2026-10'));
    expect(outubro.filter((r) => r.status !== 'CANCELADO').length).toBeLessThanOrEqual(4);
  });

  it('já reserva as próximas semanas e o passado não fica pendente', () => {
    const regs = gerar(assinatura());
    expect(regs.some((r) => r.data > '2026-12-01')).toBe(true);
    expect(regs.some((r) => r.data < '2026-11-16' && r.status === 'AGENDADO')).toBe(false);
  });

  it('plano pausado não reserva nada no futuro', () => {
    const regs = gerar(assinatura({ status: 'PAUSADA' }));
    expect(regs.some((r) => r.data > '2026-11-16')).toBe(false);
  });

  it('assinatura real sem dia fixo não ganha horários inventados', () => {
    expect(gerar(assinatura({ fixo: null }), [])).toEqual([]);
  });

  it('sem dia fixo usa os créditos em dias variados, sem passar do limite', () => {
    const regs = gerar(assinatura({ fixo: null }));
    const porMes = new Map<string, number>();
    for (const r of regs) porMes.set(r.data.slice(0, 7), (porMes.get(r.data.slice(0, 7)) ?? 0) + 1);
    for (const n of porMes.values()) expect(n).toBeLessThanOrEqual(4);
    expect(
      new Set(regs.map((r) => new Date(`${r.data}T12:00:00Z`).getUTCDay())).size,
    ).toBeGreaterThan(1);
  });
});

describe('créditos', () => {
  const ag = (data: string, status: RegistroSemente['status'], id = data) => ({
    id,
    data,
    status,
    assinatura_id: 'a1',
  });

  it('separa usados, marcados e livres; cancelado devolve o crédito', () => {
    const uso = usoNoMes(
      [
        ag('2026-11-05', 'CONCLUIDO'),
        ag('2026-11-12', 'NAO_COMPARECEU'),
        ag('2026-11-19', 'AGENDADO'),
        ag('2026-11-26', 'CANCELADO'),
        ag('2026-12-03', 'AGENDADO'),
      ],
      'a1',
      '2026-11',
      4,
    );
    expect(uso).toEqual({ total: 4, usados: 2, agendados: 1, livres: 1 });
  });

  it('numa troca o horário antigo não conta', () => {
    const lista = [
      ag('2026-11-19', 'AGENDADO', 'x'),
      ag('2026-11-26', 'AGENDADO', 'y'),
      ag('2026-11-12', 'CONCLUIDO'),
      ag('2026-11-05', 'CONCLUIDO'),
    ];
    expect(usoNoMes(lista, 'a1', '2026-11', 4).livres).toBe(0);
    expect(usoNoMes(lista, 'a1', '2026-11', 4, 'y').livres).toBe(1);
  });

  it('ciclo é o mês do calendário', () => {
    expect(cicloDoMes('2026-02-10')).toEqual({ de: '2026-02-01', ate: '2026-02-28' });
  });
});

describe('agenda e textos', () => {
  it('o horário do plano tira da agenda o que colidir com ele', () => {
    const base = {
      codigo: 'X',
      token: 't',
      barbeiro_id: 'b1',
      servico_nome: 'Corte',
      duracao_min: 60,
      preco: 45,
      data: '2026-11-19',
      cliente_nome: 'A',
      cliente_telefone: '55',
      observacao: '',
      status: 'AGENDADO' as const,
      origem: 'CLIENTE' as const,
    };
    const agenda = [
      { ...base, id: 'r1', hora_inicio: '17:30', hora_fim: '18:30' },
      { ...base, id: 'r2', hora_inicio: '18:30', hora_fim: '19:00' },
    ];
    const plano = [
      { ...base, id: 'p', hora_inicio: '18:00', hora_fim: '18:30', assinatura_id: 'a1' },
    ];
    expect(encaixarNaAgenda(agenda, plano).map((r) => r.id)).toEqual(['r2', 'p']);
  });

  it('descreve o dia fixo em português', () => {
    expect(textoFixo({ dia_semana: 4, hora: '18:00' })).toBe('Toda quinta-feira às 18:00');
    expect(textoFixo({ dia_semana: 6, hora: '10:00' })).toBe('Todo sábado às 10:00');
    expect(textoFixo(null)).toBe('Sem dia fixo');
  });
});

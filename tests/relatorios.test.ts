import { describe, expect, it } from 'vitest';
import {
  agruparPorPeriodo,
  fimMes,
  inicioSemana,
  porDiaSemana,
  porServico,
  resumir,
  variacao,
} from '../src/lib/relatorios';
import { gerarAgenda } from '../src/lib/semente';
import type { AgendamentoPainel, StatusAgendamento } from '../src/types';

function ag(
  data: string,
  status: StatusAgendamento,
  preco = 50,
  servico = 'Corte',
): AgendamentoPainel {
  return {
    id: `${data}-${Math.random()}`,
    codigo: 'X',
    barbeiro_id: 'b1',
    servico_nome: servico,
    duracao_min: 30,
    preco,
    data,
    hora_inicio: '10:00',
    hora_fim: '10:30',
    cliente_nome: 'Fulano',
    cliente_telefone: '5511999999999',
    observacao: '',
    status,
    origem: 'CLIENTE',
  };
}

describe('datas de período', () => {
  it('semana começa na segunda', () => {
    expect(inicioSemana('2026-11-16')).toBe('2026-11-16'); // segunda
    expect(inicioSemana('2026-11-22')).toBe('2026-11-16'); // domingo
    expect(inicioSemana('2026-11-21')).toBe('2026-11-16'); // sábado
  });
  it('último dia do mês, inclusive fevereiro', () => {
    expect(fimMes('2026-11-05')).toBe('2026-11-30');
    expect(fimMes('2028-02-10')).toBe('2028-02-29');
  });
});

describe('resumir', () => {
  it('conta status, faturamento só dos concluídos e comparecimento', () => {
    const r = resumir([
      ag('2026-11-10', 'CONCLUIDO', 45),
      ag('2026-11-10', 'CONCLUIDO', 75),
      ag('2026-11-10', 'NAO_COMPARECEU'),
      ag('2026-11-10', 'CANCELADO'),
      ag('2026-11-20', 'AGENDADO', 35),
    ]);
    expect(r.total).toBe(4);
    expect(r.concluidos).toBe(2);
    expect(r.faturamento).toBe(120);
    expect(r.faturamentoPrevisto).toBe(35);
    expect(r.ticketMedio).toBe(60);
    expect(r.comparecimento).toBeCloseTo(2 / 3);
  });
  it('sem dados não divide por zero', () => {
    expect(resumir([]).comparecimento).toBeNull();
    expect(resumir([]).ticketMedio).toBe(0);
  });
});

describe('agruparPorPeriodo', () => {
  const dados = [
    ag('2026-11-03', 'CONCLUIDO'),
    ag('2026-11-10', 'CONCLUIDO'),
    ag('2026-11-17', 'AGENDADO'),
  ];
  it('por semana termina na semana atual e marca em andamento', () => {
    const p = agruparPorPeriodo(dados, 'semana', '2026-11-18', 3);
    expect(p.map((x) => x.de)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16']);
    expect(p.map((x) => x.total)).toEqual([1, 1, 1]);
    expect(p[2].emAndamento).toBe(true);
    expect(p[2].rotuloLongo).toBe('16/11 a 22/11');
  });
  it('por mês atravessa a virada do ano', () => {
    const p = agruparPorPeriodo([], 'mes', '2026-01-15', 3);
    expect(p.map((x) => x.de)).toEqual(['2025-11-01', '2025-12-01', '2026-01-01']);
    expect(p.map((x) => x.rotulo)).toEqual(['nov', 'dez', 'jan']);
  });
});

describe('agrupamentos', () => {
  it('ignora cancelados e ordena serviços por quantidade', () => {
    const s = porServico([
      ag('2026-11-10', 'CONCLUIDO', 45, 'Corte'),
      ag('2026-11-10', 'CONCLUIDO', 35, 'Barba'),
      ag('2026-11-11', 'AGENDADO', 45, 'Corte'),
      ag('2026-11-11', 'CANCELADO', 45, 'Barba'),
    ]);
    expect(s).toEqual([
      { chave: 'Corte', quantidade: 2, faturamento: 45 },
      { chave: 'Barba', quantidade: 1, faturamento: 35 },
    ]);
  });
  it('dia da semana sempre traz os 7 dias, começando na segunda', () => {
    const d = porDiaSemana([ag('2026-11-14', 'CONCLUIDO')]); // sábado
    expect(d.map((x) => x.chave)).toEqual(['1', '2', '3', '4', '5', '6', '0']);
    expect(d[5].quantidade).toBe(1);
  });
  it('variação', () => {
    expect(variacao(110, 100)).toBeCloseTo(0.1);
    expect(variacao(5, 0)).toBeNull();
  });
});

describe('agenda simulada', () => {
  const jornada = { jornada: { inicio: 570, fim: 1200 }, pausa: { inicio: 750, fim: 810 } };
  const gerar = () =>
    gerarAgenda({
      hoje: '2026-11-16',
      agoraMin: 600,
      barbeiroIds: ['b1', 'b2'],
      servicos: [
        { id: 's1', nome: 'Corte', duracao_min: 30, preco: 45, peso: 3 },
        { id: 's3', nome: 'Corte + Barba', duracao_min: 60, preco: 75, peso: 2 },
      ],
      expediente: { 2: jornada, 3: jornada, 4: jornada, 5: jornada, 6: jornada },
      intervaloMin: 30,
    });

  it('é determinística', () => {
    expect(gerar().map((r) => r.id)).toEqual(gerar().map((r) => r.id));
  });

  it('não sobrepõe horários nem invade a pausa, e passado não fica pendente', () => {
    const regs = gerar();
    const min = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
    const porDia = new Map<string, typeof regs>();
    for (const r of regs)
      porDia.set(`${r.data}|${r.barbeiro_id}`, [
        ...(porDia.get(`${r.data}|${r.barbeiro_id}`) ?? []),
        r,
      ]);
    for (const lista of porDia.values()) {
      lista.sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
      for (let i = 1; i < lista.length; i++)
        expect(min(lista[i].hora_inicio)).toBeGreaterThanOrEqual(min(lista[i - 1].hora_fim));
      for (const r of lista) expect(min(r.hora_inicio) >= 810 || min(r.hora_fim) <= 750).toBe(true);
    }
    expect(
      regs.some(
        (r) => r.data < '2026-11-16' && (r.status === 'AGENDADO' || r.status === 'CONFIRMADO'),
      ),
    ).toBe(false);
    expect(regs.some((r) => r.data > '2026-11-16' && r.status === 'CONCLUIDO')).toBe(false);
  });

  it('esta semana fica bem cheia', () => {
    const semana = gerar().filter((r) => r.data >= '2026-11-17' && r.data <= '2026-11-21');
    expect(semana.length).toBeGreaterThan(60);
  });
});

// Cálculos do dashboard e dos relatórios (funções puras, sem API nem DOM).

import type { AgendamentoPainel, StatusAgendamento } from '../types';
import { diaSemana, somarDias } from './datas';

export type Agrupamento = 'semana' | 'mes';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_LONGOS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];
export const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const ATIVOS: StatusAgendamento[] = ['AGENDADO', 'CONFIRMADO'];

/** Segunda-feira da semana da data. */
export function inicioSemana(data: string): string {
  const ds = diaSemana(data);
  return somarDias(data, ds === 0 ? -6 : 1 - ds);
}

export function inicioMes(data: string): string {
  return `${data.slice(0, 7)}-01`;
}

export function fimMes(data: string): string {
  const [a, m] = data.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export interface Resumo {
  /** Agendamentos que não foram cancelados. */
  total: number;
  concluidos: number;
  cancelados: number;
  faltas: number;
  /** Ainda por acontecer (agendado ou confirmado). */
  pendentes: number;
  faturamento: number;
  faturamentoPrevisto: number;
  ticketMedio: number;
  /** Concluídos / (concluídos + faltas), de 0 a 1; null sem dados. */
  comparecimento: number | null;
  /** Atendimentos (não cancelados) que usaram crédito de plano. */
  doPlano: number;
}

export function resumir(ags: AgendamentoPainel[]): Resumo {
  let concluidos = 0;
  let concluidosAvulsos = 0;
  let cancelados = 0;
  let faltas = 0;
  let pendentes = 0;
  let faturamento = 0;
  let faturamentoPrevisto = 0;
  for (const a of ags) {
    if (a.status === 'CONCLUIDO') {
      concluidos++;
      if (!a.assinatura_id) concluidosAvulsos++;
      faturamento += a.preco;
    } else if (a.status === 'CANCELADO') cancelados++;
    else if (a.status === 'NAO_COMPARECEU') faltas++;
    else if (ATIVOS.includes(a.status)) {
      pendentes++;
      faturamentoPrevisto += a.preco;
    }
  }
  return {
    total: ags.length - cancelados,
    concluidos,
    cancelados,
    faltas,
    pendentes,
    faturamento,
    faturamentoPrevisto,
    // Atendimentos de plano entram com R$ 0; o ticket médio considera só os avulsos.
    ticketMedio: concluidosAvulsos ? faturamento / concluidosAvulsos : 0,
    comparecimento: concluidos + faltas ? concluidos / (concluidos + faltas) : null,
    doPlano: ags.filter((a) => a.assinatura_id && a.status !== 'CANCELADO').length,
  };
}

export interface Periodo extends Resumo {
  de: string;
  ate: string;
  /** Rótulo curto para o eixo: "16/11" ou "nov". */
  rotulo: string;
  /** Rótulo completo para a dica: "16/11 a 22/11" ou "novembro de 2026". */
  rotuloLongo: string;
  /** O período contém hoje (ainda não terminou). */
  emAndamento: boolean;
}

/** Os últimos `quantidade` períodos (semanas ou meses), terminando no período atual. */
export function agruparPorPeriodo(
  ags: AgendamentoPainel[],
  agrupamento: Agrupamento,
  hoje: string,
  quantidade: number,
): Periodo[] {
  const periodos: { de: string; ate: string }[] = [];
  if (agrupamento === 'semana') {
    const atual = inicioSemana(hoje);
    for (let i = quantidade - 1; i >= 0; i--) {
      const de = somarDias(atual, -7 * i);
      periodos.push({ de, ate: somarDias(de, 6) });
    }
  } else {
    const [a, m] = hoje.split('-').map(Number);
    for (let i = quantidade - 1; i >= 0; i--) {
      const de = new Date(Date.UTC(a, m - 1 - i, 1)).toISOString().slice(0, 10);
      periodos.push({ de, ate: fimMes(de) });
    }
  }
  return periodos.map(({ de, ate }) => {
    const doPeriodo = ags.filter((x) => x.data >= de && x.data <= ate);
    const mes = Number(de.slice(5, 7)) - 1;
    return {
      ...resumir(doPeriodo),
      de,
      ate,
      rotulo: agrupamento === 'semana' ? ddmm(de) : MESES[mes],
      rotuloLongo:
        agrupamento === 'semana'
          ? `${ddmm(de)} a ${ddmm(ate)}`
          : `${MESES_LONGOS[mes]} de ${de.slice(0, 4)}`,
      emAndamento: hoje >= de && hoje <= ate,
    };
  });
}

/** Variação relativa (0.12 = +12%). null quando não há base de comparação. */
export function variacao(atual: number, anterior: number): number | null {
  if (!anterior) return null;
  return (atual - anterior) / anterior;
}

export interface Linha {
  chave: string;
  quantidade: number;
  faturamento: number;
}

function agrupar(ags: AgendamentoPainel[], chave: (a: AgendamentoPainel) => string): Linha[] {
  const mapa = new Map<string, Linha>();
  for (const a of ags) {
    if (a.status === 'CANCELADO') continue;
    const k = chave(a);
    const linha = mapa.get(k) ?? { chave: k, quantidade: 0, faturamento: 0 };
    linha.quantidade++;
    if (a.status === 'CONCLUIDO') linha.faturamento += a.preco;
    mapa.set(k, linha);
  }
  return [...mapa.values()];
}

export const porServico = (ags: AgendamentoPainel[]) =>
  agrupar(ags, (a) => a.servico_nome).sort((a, b) => b.quantidade - a.quantidade);

export const porBarbeiro = (ags: AgendamentoPainel[]) =>
  agrupar(ags, (a) => a.barbeiro_id).sort((a, b) => b.quantidade - a.quantidade);

/** Segunda a domingo, sempre os 7 dias (dias sem movimento ficam com zero). */
export function porDiaSemana(ags: AgendamentoPainel[]): Linha[] {
  const linhas = agrupar(ags, (a) => String(diaSemana(a.data)));
  return [1, 2, 3, 4, 5, 6, 0].map(
    (d) =>
      linhas.find((l) => l.chave === String(d)) ?? {
        chave: String(d),
        quantidade: 0,
        faturamento: 0,
      },
  );
}

export const ROTULO_STATUS: Record<StatusAgendamento, string> = {
  AGENDADO: 'Agendado',
  CONFIRMADO: 'Confirmado',
  CANCELADO: 'Cancelado',
  CONCLUIDO: 'Concluído',
  NAO_COMPARECEU: 'Não compareceu',
};

// Regras dos planos de assinatura (funções puras, testáveis).
//
// Regras provisórias, até a barbearia definir as dela:
// - o ciclo é o mês do calendário e crédito não usado não acumula;
// - falta (não compareceu) conta como crédito usado; cancelamento devolve o crédito;
// - o horário fixo gera um agendamento por semana, até acabarem os créditos do mês.

import type { Assinatura, AgendamentoPainel, Plano, StatusAgendamento } from '../types';
import { diaSemana, hhmmParaMin, minParaHhmm, somarDias } from './datas';
import type { Jornada, RegistroSemente } from './semente';

export const ANTECEDENCIA_TROCA_MIN = 120;
/** Assinante enxerga a agenda mais longe que o público. */
export const JANELA_ASSINANTE_DIAS = 45;
/** Por quantos dias à frente os horários fixos já ficam reservados. */
export const RESERVA_FIXOS_DIAS = 35;

export const mesDe = (data: string) => data.slice(0, 7);

export function cicloDoMes(data: string): { de: string; ate: string } {
  const [a, m] = data.split('-').map(Number);
  return {
    de: `${data.slice(0, 7)}-01`,
    ate: new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10),
  };
}

export interface UsoCreditos {
  total: number;
  /** Já consumidos: concluídos e faltas. */
  usados: number;
  /** Marcados e ainda por acontecer. */
  agendados: number;
  livres: number;
}

/** Uso dos créditos de uma assinatura num mês ('yyyy-MM'). Cancelados não contam. */
export function usoNoMes(
  ags: Pick<AgendamentoPainel, 'assinatura_id' | 'data' | 'status'>[],
  assinaturaId: string,
  mes: string,
  total: number,
  ignorarId?: string,
): UsoCreditos {
  let usados = 0;
  let agendados = 0;
  for (const a of ags) {
    if (a.assinatura_id !== assinaturaId || mesDe(a.data) !== mes) continue;
    if ((a as { id?: string }).id === ignorarId) continue;
    if (a.status === 'CONCLUIDO' || a.status === 'NAO_COMPARECEU') usados++;
    else if (a.status === 'AGENDADO' || a.status === 'CONFIRMADO') agendados++;
  }
  return { total, usados, agendados, livres: Math.max(0, total - usados - agendados) };
}

/* ----------------------------------------------- geração dos horários do plano */

function gerador(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return h >>> 0;
}

const sobrepoe = (a: { inicio: number; fim: number }, b: { inicio: number; fim: number }) =>
  a.inicio < b.fim && b.inicio < a.fim;

export function gerarHorariosDoPlano(opcoes: {
  assinaturas: Assinatura[];
  planos: Plano[];
  servicos: { id: string; nome: string; duracao_min: number }[];
  expediente: Record<number, Jornada | undefined>;
  hoje: string;
  agoraMin: number;
}): RegistroSemente[] {
  const { assinaturas, planos, servicos, expediente, hoje, agoraMin } = opcoes;
  const fim = somarDias(hoje, RESERVA_FIXOS_DIAS);
  const registros: RegistroSemente[] = [];
  const ocupado = (barbeiro: string, data: string, ini: number, f: number) =>
    registros.some(
      (r) =>
        r.barbeiro_id === barbeiro &&
        r.data === data &&
        sobrepoe(
          { inicio: ini, fim: f },
          { inicio: hhmmParaMin(r.hora_inicio), fim: hhmmParaMin(r.hora_fim) },
        ),
    );

  for (const a of assinaturas) {
    const plano = planos.find((p) => p.id === a.plano_id);
    const servico = servicos.find((s) => s.id === plano?.servico_id);
    if (!plano || !servico) continue;
    const rnd = gerador(hash(a.id));
    // Plano pausado ou cancelado não reserva nada daqui para frente.
    const limite = a.status === 'PAUSADA' || a.status === 'CANCELADA' ? hoje : fim;
    const porMes = new Map<string, number>();

    const criar = (data: string, inicio: number) => {
      const passado = data < hoje || (data === hoje && inicio + servico.duracao_min <= agoraMin);
      const r = rnd();
      let status: StatusAgendamento;
      if (passado) status = r < 0.93 ? 'CONCLUIDO' : r < 0.96 ? 'NAO_COMPARECEU' : 'CANCELADO';
      else status = data <= somarDias(hoje, 1) ? 'CONFIRMADO' : 'AGENDADO';
      const id = `p-${a.id}-${data}`;
      const h = hash(id);
      registros.push({
        id,
        codigo: h
          .toString(36)
          .toUpperCase()
          .replace(/[01OI]/g, 'P')
          .padStart(6, 'P')
          .slice(-6),
        token: `plano${h.toString(36)}${hash(id + 'x').toString(36)}`,
        barbeiro_id: a.barbeiro_id,
        servico_nome: servico.nome,
        duracao_min: servico.duracao_min,
        preco: 0,
        data,
        hora_inicio: minParaHhmm(inicio),
        hora_fim: minParaHhmm(inicio + servico.duracao_min),
        cliente_nome: a.cliente_nome,
        cliente_telefone: a.cliente_telefone,
        observacao: '',
        status,
        origem: 'CLIENTE',
        assinatura_id: a.id,
      });
      if (status !== 'CANCELADO') porMes.set(mesDe(data), (porMes.get(mesDe(data)) ?? 0) + 1);
    };

    if (a.fixo) {
      // Uma vez por semana no dia fixo, enquanto houver crédito no mês.
      let d = a.inicio;
      while (diaSemana(d) !== a.fixo.dia_semana) d = somarDias(d, 1);
      const ini = hhmmParaMin(a.fixo.hora);
      for (; d <= limite; d = somarDias(d, 7)) {
        if (!expediente[diaSemana(d)]) continue;
        if ((porMes.get(mesDe(d)) ?? 0) >= plano.creditos_mes) continue;
        if (!ocupado(a.barbeiro_id, d, ini, ini + servico.duracao_min)) criar(d, ini);
      }
    } else {
      // Sem dia fixo: usa os créditos em dias variados do mês (histórico e próximos dias).
      for (
        let mesIni = `${a.inicio.slice(0, 7)}-01`;
        mesIni <= limite;
        mesIni = somarDias(cicloDoMes(mesIni).ate, 1)
      ) {
        const { ate } = cicloDoMes(mesIni);
        const dias: string[] = [];
        for (let d = mesIni; d <= ate; d = somarDias(d, 1))
          if (expediente[diaSemana(d)] && d >= a.inicio) dias.push(d);
        // No mês atual, quem não tem dia fixo ainda tem um crédito para marcar quando quiser.
        const mesCorrente = mesDe(mesIni) === mesDe(hoje);
        const quantos = plano.creditos_mes - (mesCorrente || rnd() < 0.4 ? 1 : 0);
        const escolhidos = [...dias]
          .sort(() => rnd() - 0.5)
          .slice(0, quantos)
          .sort();
        for (const d of escolhidos) {
          if (d > limite) continue;
          const jornada = expediente[diaSemana(d)]!;
          let ini = jornada.jornada.inicio + Math.floor(rnd() * 16) * 30;
          for (let tentativa = 0; tentativa < 20; tentativa++) {
            const f = ini + servico.duracao_min;
            const naPausa = sobrepoe({ inicio: ini, fim: f }, jornada.pausa);
            if (f <= jornada.jornada.fim && !naPausa && !ocupado(a.barbeiro_id, d, ini, f)) {
              criar(d, ini);
              break;
            }
            ini = ini + 30 >= jornada.jornada.fim ? jornada.jornada.inicio : ini + 30;
          }
        }
      }
    }
  }
  return registros;
}

/** Junta os horários do plano à agenda, tirando o que colidir com eles (o plano tem prioridade). */
export function encaixarNaAgenda(
  agenda: RegistroSemente[],
  doPlano: RegistroSemente[],
): RegistroSemente[] {
  const livres = agenda.filter(
    (r) =>
      !doPlano.some(
        (p) =>
          p.barbeiro_id === r.barbeiro_id &&
          p.data === r.data &&
          sobrepoe(
            { inicio: hhmmParaMin(p.hora_inicio), fim: hhmmParaMin(p.hora_fim) },
            { inicio: hhmmParaMin(r.hora_inicio), fim: hhmmParaMin(r.hora_fim) },
          ),
      ),
  );
  return [...livres, ...doPlano];
}

export const DIAS_SEMANA_LONGOS = [
  'domingo',
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado',
];

export function textoFixo(fixo: { dia_semana: number; hora: string } | null): string {
  if (!fixo) return 'Sem dia fixo';
  const dia = DIAS_SEMANA_LONGOS[fixo.dia_semana];
  const fimDeSemana = fixo.dia_semana === 0 || fixo.dia_semana === 6;
  return `${fimDeSemana ? 'Todo' : 'Toda'} ${dia}${fimDeSemana ? '' : '-feira'} às ${fixo.hora}`;
}

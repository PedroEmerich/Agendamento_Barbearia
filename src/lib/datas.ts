// Datas trafegam como texto 'yyyy-MM-dd' e horas como 'HH:mm'.
// Tudo é calculado no fuso da barbearia, independente do fuso do aparelho.

export const FUSO = 'America/Sao_Paulo';

const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const DIAS_LONGOS = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];
const MESES = [
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

/** Data e minutos desde 00:00 no fuso da barbearia. */
export function agoraSP(instante: Date = new Date()): { data: string; minutos: number } {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instante);
  const p = (tipo: string) => partes.find((x) => x.type === tipo)?.value ?? '00';
  return {
    data: `${p('year')}-${p('month')}-${p('day')}`,
    minutos: Number(p('hour')) * 60 + Number(p('minute')),
  };
}

function comoUTC(data: string): Date {
  return new Date(`${data}T12:00:00Z`);
}

export function somarDias(data: string, n: number): string {
  const d = comoUTC(data);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = domingo … 6 = sábado. */
export function diaSemana(data: string): number {
  return comoUTC(data).getUTCDay();
}

export function hhmmParaMin(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

export function minParaHhmm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** 'qui, 12/11' */
export function formatarDataCurta(data: string): string {
  const [, mes, dia] = data.split('-');
  return `${DIAS_CURTOS[diaSemana(data)]}, ${dia}/${mes}`;
}

/** 'quinta-feira, 12 de novembro' */
export function formatarDataLonga(data: string): string {
  const [, mes, dia] = data.split('-');
  return `${DIAS_LONGOS[diaSemana(data)]}, ${Number(dia)} de ${MESES[Number(mes) - 1]}`;
}

export function nomeDiaCurto(data: string): string {
  return DIAS_CURTOS[diaSemana(data)];
}

export function formatarPreco(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarDuracao(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

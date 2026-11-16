// Cálculo de horários livres (função pura). Trabalha em minutos desde 00:00.
// É a mesma regra da seção 5.4 da especificação; na Fase 2 ela passa a viver em gas/02_logica.js.

export interface Intervalo {
  inicio: number;
  fim: number;
}

export interface EntradaSlots {
  /** Jornada do barbeiro no dia; null = não trabalha. */
  expediente: Intervalo | null;
  pausa?: Intervalo | null;
  /** Bloqueios e agendamentos não cancelados do dia. */
  ocupados: Intervalo[];
  duracaoMin: number;
  intervaloSlotMin: number;
  /** Menor início permitido (agora + antecedência), quando a data é hoje. */
  inicioMinimo?: number;
}

function subtrair(livres: Intervalo[], ocupado: Intervalo): Intervalo[] {
  const resultado: Intervalo[] = [];
  for (const livre of livres) {
    if (ocupado.fim <= livre.inicio || ocupado.inicio >= livre.fim) {
      resultado.push(livre);
      continue;
    }
    if (ocupado.inicio > livre.inicio) resultado.push({ inicio: livre.inicio, fim: ocupado.inicio });
    if (ocupado.fim < livre.fim) resultado.push({ inicio: ocupado.fim, fim: livre.fim });
  }
  return resultado;
}

export function calcularSlots(e: EntradaSlots): number[] {
  if (!e.expediente) return [];
  let livres: Intervalo[] = [e.expediente];
  const ocupados = e.pausa ? [e.pausa, ...e.ocupados] : e.ocupados;
  for (const o of ocupados) livres = subtrair(livres, o);

  const slots: number[] = [];
  for (const livre of livres) {
    for (let t = livre.inicio; t + e.duracaoMin <= livre.fim; t += e.intervaloSlotMin) {
      if (e.inicioMinimo === undefined || t >= e.inicioMinimo) slots.push(t);
    }
  }
  return slots.sort((a, b) => a - b);
}

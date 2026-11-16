// Gera a agenda de demonstração: ~6 meses de histórico + as próximas 3 semanas.
// É determinística (mesma data -> mesmos agendamentos), então recarregar a página não
// embaralha nada e as alterações de status podem ser guardadas só pelo id.

import type { AgendamentoPainel, StatusAgendamento } from '../types';
import { diaSemana, hhmmParaMin, minParaHhmm, somarDias } from './datas';

export interface Jornada {
  jornada: { inicio: number; fim: number };
  pausa: { inicio: number; fim: number };
}

export interface ServicoSemente {
  id: string;
  nome: string;
  duracao_min: number;
  preco: number;
  /** Peso relativo na sorte (serviços mais pedidos saem mais). */
  peso: number;
}

export interface RegistroSemente extends AgendamentoPainel {
  token: string;
}

const NOMES = [
  'João',
  'Lucas',
  'Rafael',
  'Bruno',
  'Matheus',
  'Gustavo',
  'Caio',
  'Pedro',
  'Thiago',
  'Felipe',
  'Gabriel',
  'Diego',
  'Vinícius',
  'Leandro',
  'André',
  'Rodrigo',
  'Henrique',
  'Igor',
  'Murilo',
  'Samuel',
  'Daniel',
  'Eduardo',
  'Fábio',
  'Marcelo',
  'Otávio',
  'Wesley',
  'Kauã',
  'Enzo',
  'Arthur',
  'Nicolas',
  'Renan',
  'Alex',
  'Cauê',
  'Davi',
  'Yuri',
  'Luan',
];
const INICIAIS = 'ABCDEFGHJLMNOPRSTV';
const OBSERVACOES = [
  'Manter o comprimento em cima',
  'Degradê bem baixo',
  'Primeira vez na barbearia',
  'Barba só alinhar',
  'Vai chegar 5 min antes',
];

/** PRNG pequeno e determinístico (mulberry32). */
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

function hash(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return h >>> 0;
}

function sortearPeso<T extends { peso: number }>(itens: T[], r: number): T {
  const total = itens.reduce((s, i) => s + i.peso, 0);
  let alvo = r * total;
  for (const item of itens) {
    alvo -= item.peso;
    if (alvo <= 0) return item;
  }
  return itens[itens.length - 1];
}

const diasEntre = (de: string, ate: string) =>
  Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);

/** Probabilidade de cada meia hora estar ocupada. */
function ocupacao(data: string, hoje: string, inicio: string, barbeiroIdx: number): number {
  const dias = diasEntre(hoje, data);
  const ds = diaSemana(data);
  const ajusteDia = ds === 6 ? 0.12 : ds === 5 ? 0.06 : ds === 2 ? -0.05 : 0;
  const ajusteBarbeiro = [0.05, 0, -0.04][barbeiroIdx] ?? 0;
  if (dias <= 0) {
    // Histórico: cresce de ~45% para ~72% ao longo do período, com ondulação.
    const t = diasEntre(inicio, data) / Math.max(1, diasEntre(inicio, hoje));
    const onda = Math.sin(t * 9) * 0.04;
    return 0.45 + 0.27 * t + onda + ajusteDia + ajusteBarbeiro;
  }
  // Esta semana bem cheia; depois vai esvaziando (ainda não foi agendado).
  if (dias <= 6) return 0.8 + ajusteDia / 2 + ajusteBarbeiro;
  return Math.max(0.12, 0.6 - (dias - 7) * 0.03) + ajusteBarbeiro;
}

export function gerarAgenda(opcoes: {
  hoje: string;
  agoraMin: number;
  barbeiroIds: string[];
  servicos: ServicoSemente[];
  expediente: Record<number, Jornada | undefined>;
  intervaloMin: number;
}): RegistroSemente[] {
  const { hoje, agoraMin, barbeiroIds, servicos, expediente, intervaloMin } = opcoes;
  // Começa no 1º dia do mês, 6 meses atrás, para os meses do gráfico ficarem completos.
  const [ano, mes] = hoje.split('-').map(Number);
  const m0 = new Date(Date.UTC(ano, mes - 1 - 6, 1));
  const inicio = m0.toISOString().slice(0, 10);
  const fim = somarDias(hoje, 21);

  const registros: RegistroSemente[] = [];
  for (let data = inicio; data <= fim; data = somarDias(data, 1)) {
    const dia = expediente[diaSemana(data)];
    if (!dia) continue;
    barbeiroIds.forEach((barbeiroId, bi) => {
      const rnd = gerador(hash(`${data}|${barbeiroId}`));
      const p = ocupacao(data, hoje, inicio, bi);
      const blocos = [
        { inicio: dia.jornada.inicio, fim: dia.pausa.inicio },
        { inicio: dia.pausa.fim, fim: dia.jornada.fim },
      ];
      for (const bloco of blocos) {
        let t = bloco.inicio;
        while (t + intervaloMin <= bloco.fim) {
          if (rnd() > p) {
            t += intervaloMin;
            continue;
          }
          const cabem = servicos.filter((s) => t + s.duracao_min <= bloco.fim);
          if (!cabem.length) break;
          const servico = sortearPeso(cabem, rnd());
          const horaInicio = minParaHhmm(t);
          const passado = data < hoje || (data === hoje && t + servico.duracao_min <= agoraMin);
          const r = rnd();
          let status: StatusAgendamento;
          if (passado) status = r < 0.86 ? 'CONCLUIDO' : r < 0.91 ? 'NAO_COMPARECEU' : 'CANCELADO';
          else {
            const perto = diasEntre(hoje, data) <= 1;
            status = r < 0.07 ? 'CANCELADO' : r < (perto ? 0.6 : 0.3) ? 'CONFIRMADO' : 'AGENDADO';
          }
          const nome = NOMES[Math.floor(rnd() * NOMES.length)];
          const inicial = INICIAIS[Math.floor(rnd() * INICIAIS.length)];
          const id = `s-${data}-${barbeiroId}-${horaInicio.replace(':', '')}`;
          const h = hash(id);
          registros.push({
            id,
            codigo: h
              .toString(36)
              .toUpperCase()
              .replace(/[01OI]/g, 'X')
              .padStart(6, 'K')
              .slice(-6),
            token: `demo${h.toString(36)}${hash(id + 't').toString(36)}${hash(id + 'u').toString(36)}`,
            barbeiro_id: barbeiroId,
            servico_nome: servico.nome,
            duracao_min: servico.duracao_min,
            preco: servico.preco,
            data,
            hora_inicio: horaInicio,
            hora_fim: minParaHhmm(t + servico.duracao_min),
            cliente_nome: `${nome} ${inicial}.`,
            cliente_telefone: `55119${String(10000000 + (h % 89999999)).padStart(8, '0')}`,
            observacao: rnd() < 0.08 ? OBSERVACOES[Math.floor(rnd() * OBSERVACOES.length)] : '',
            status,
            origem: rnd() < 0.15 ? 'OPERADOR' : 'CLIENTE',
          });
          t += servico.duracao_min;
        }
      }
    });
  }
  return registros;
}

export { hhmmParaMin };

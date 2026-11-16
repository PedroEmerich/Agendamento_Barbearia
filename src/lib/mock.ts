// Back-end simulado para o front demonstrativo: mesmas ações do contrato da API (seção 5.3),
// com os dados guardados no localStorage do navegador. Nada sai do aparelho.

import type {
  AgendamentoCliente,
  AgendamentoPainel,
  Barbeiro,
  CodigoErro,
  Assinatura,
  AssinaturaCliente,
  Cobranca,
  FormaPagamento,
  MetodoPagamento,
  Pagamento,
  AssinaturaPainel,
  ConfigPublica,
  Horario,
  Plano,
  Servico,
  StatusAgendamento,
  Usuario,
} from '../types';
import { calcularSlots, type Intervalo } from './disponibilidade';
import { agoraSP, diaSemana, hhmmParaMin, minParaHhmm, somarDias } from './datas';
import { normalizarTelefone } from './telefone';
import { normalizarCpf } from './cpf';
import { gerarAgenda, type RegistroSemente } from './semente';
import {
  ANTECEDENCIA_TROCA_MIN,
  cicloDoMes,
  encaixarNaAgenda,
  gerarHorariosDoPlano,
  horasFixasLivres,
  JANELA_ASSINANTE_DIAS,
  mesDe,
  usoNoMes,
} from './assinaturas';

export class ErroApi extends Error {
  constructor(
    public code: CodigoErro,
    message: string,
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------- dados fixos

const ANTECEDENCIA_AGENDAMENTO_MIN = 60;
const MAX_FUTUROS_POR_TELEFONE = 2;

export const CONFIG: ConfigPublica = {
  nome_barbearia: 'Underground Barbershop',
  slogan: 'A Barbearia de Todas as Tribos',
  endereco: 'Av. Manoel Alves, 305 — Vila Brás Cubas, Mogi das Cruzes — SP, 08740-260',
  telefone_contato: '551195102389',
  instagram_url: 'https://www.instagram.com/underground.barber.shop/',
  instagram_usuario: '@underground.barber.shop',
  maps_url:
    'https://www.google.com/maps/search/?api=1&query=Underground+Barbershop+Av.+Manoel+Alves+305+Mogi+das+Cruzes',
  logo_url: '',
  intervalo_slot_min: 30,
  janela_max_dias: 21,
  antecedencia_min_cancelamento_min: 120,
  funcionamento: [
    { dias: 'Terça a sexta', horario: '09:30 – 20:00' },
    { dias: 'Sábado', horario: '09:00 – 18:00' },
    { dias: 'Domingo e segunda', horario: 'Fechado' },
  ],
  horario_semana: [
    ...[2, 3, 4, 5].map((d) => ({
      dia_semana: d,
      abre: '09:30',
      fecha: '20:00',
      pausa_inicio: '12:30',
      pausa_fim: '13:30',
    })),
    { dia_semana: 6, abre: '09:00', fecha: '18:00', pausa_inicio: '12:00', pausa_fim: '13:00' },
  ],
};

const foto = (nome: string) => `${import.meta.env.BASE_URL}barbeiros/${nome}.webp`;

/** Na ordem em que aparecem no site. */
const BARBEIROS: Barbeiro[] = [
  { id: 'b1', nome: 'Davi', instagram: 'davi_undergroundbarbershop', foto_url: foto('davi') },
  { id: 'b2', nome: 'Renato', instagram: 'renatoneves.ug', foto_url: foto('renato') },
  { id: 'b3', nome: 'Renan', instagram: 'vlducorte', foto_url: foto('renan') },
];

const SERVICOS: Servico[] = [
  {
    id: 's1',
    nome: 'Corte',
    descricao: 'Tesoura, máquina ou degradê, finalizado do seu jeito.',
    duracao_min: 30,
    preco: 45,
    barbeiro_ids: [],
  },
  {
    id: 's2',
    nome: 'Barba',
    descricao: 'Modelagem na navalha com toalha quente.',
    duracao_min: 30,
    preco: 35,
    barbeiro_ids: [],
  },
  {
    id: 's3',
    nome: 'Corte + Barba',
    descricao: 'O combo completo, sem pressa.',
    duracao_min: 60,
    preco: 75,
    barbeiro_ids: [],
  },
  {
    id: 's4',
    nome: 'Pezinho e acabamento',
    descricao: 'Só o contorno para manter o corte em dia.',
    duracao_min: 30,
    preco: 20,
    barbeiro_ids: [],
  },
  {
    id: 's5',
    nome: 'Corte + Barba + Sobrancelha',
    descricao: 'Sai pronto para qualquer rolê.',
    duracao_min: 90,
    preco: 90,
    barbeiro_ids: [],
  },
];

/** Jornada por dia da semana (0 = domingo). Igual para os três barbeiros na demonstração. */
const EXPEDIENTE: Record<number, { jornada: Intervalo; pausa: Intervalo } | undefined> = {
  2: { jornada: { inicio: 570, fim: 1200 }, pausa: { inicio: 750, fim: 810 } },
  3: { jornada: { inicio: 570, fim: 1200 }, pausa: { inicio: 750, fim: 810 } },
  4: { jornada: { inicio: 570, fim: 1200 }, pausa: { inicio: 750, fim: 810 } },
  5: { jornada: { inicio: 570, fim: 1200 }, pausa: { inicio: 750, fim: 810 } },
  6: { jornada: { inicio: 540, fim: 1080 }, pausa: { inicio: 720, fim: 780 } },
};

const USUARIOS: (Usuario & { login: string; senha: string })[] = [
  {
    id: 'u1',
    nome: 'Administrador',
    login: 'admin',
    senha: 'demo',
    papel: 'ADMIN',
    barbeiro_id: null,
  },
  {
    id: 'u2',
    nome: 'Renato',
    login: 'renato',
    senha: 'demo',
    papel: 'BARBEIRO',
    barbeiro_id: 'b2',
  },
  { id: 'u3', nome: 'Davi', login: 'davi', senha: 'demo', papel: 'BARBEIRO', barbeiro_id: 'b1' },
  { id: 'u4', nome: 'Renan', login: 'renan', senha: 'demo', papel: 'BARBEIRO', barbeiro_id: 'b3' },
];

export const PLANOS: Plano[] = [
  {
    id: 'p1',
    nome: 'Plano Corte',
    descricao: '4 cortes por mês, com prioridade na agenda.',
    servico_id: 's1',
    creditos_mes: 4,
    preco_mensal: 150,
    preco_avulso_mes: 180,
  },
  {
    id: 'p2',
    nome: 'Plano Corte + Barba',
    descricao: '4 combos de corte e barba por mês.',
    servico_id: 's3',
    creditos_mes: 4,
    preco_mensal: 250,
    preco_avulso_mes: 300,
  },
  {
    id: 'p3',
    nome: 'Plano Barba',
    descricao: '4 barbas na navalha por mês.',
    servico_id: 's2',
    creditos_mes: 4,
    preco_mensal: 110,
    preco_avulso_mes: 140,
  },
];

/** Assinantes de exemplo; as datas são relativas a hoje para a demonstração não envelhecer. */
function assinaturasDeExemplo(hoje: string): Assinatura[] {
  const mesAtual = mesDe(hoje);
  const mesPassado = mesDe(somarDias(`${mesAtual}-01`, -1));
  const base = (
    id: string,
    nome: string,
    telefone: string,
    plano: string,
    barbeiro: string,
    fixo: [number, string] | null,
    diasAtras: number,
    extra: Partial<Assinatura> = {},
  ): Assinatura => ({
    id,
    token: `assinatura-${id}-demo`,
    cliente_nome: nome,
    cliente_telefone: telefone,
    plano_id: plano,
    barbeiro_id: barbeiro,
    fixo: fixo ? { dia_semana: fixo[0], hora: fixo[1] } : null,
    status: 'ATIVA',
    inicio: somarDias(hoje, -diasAtras),
    pago_ate: mesAtual,
    // Metade dos exemplos paga pelo Asaas (recorrente), o resto na barbearia.
    pagamento_forma: ['a1', 'a2', 'a5', 'a9'].includes(id) ? 'ONLINE' : 'NA_BARBEARIA',
    cobranca_pendente: null,
    ...extra,
  });
  return [
    base('a1', 'Marcos Vieira', '5511981112233', 'p1', 'b1', [4, '18:00'], 130),
    base('a2', 'Thiago Rocha', '5511982223344', 'p2', 'b2', [2, '19:00'], 120),
    base('a3', 'Felipe Andrade', '5511983334455', 'p1', 'b2', [6, '10:00'], 95),
    base('a4', 'Gustavo Lima', '5511984445566', 'p1', 'b3', [3, '18:30'], 80),
    base('a5', 'Rafael Mendes', '5511985556677', 'p2', 'b1', [5, '17:00'], 110),
    base('a6', 'Bruno Costa', '5511986667788', 'p1', 'b2', null, 70),
    base('a7', 'Leandro Prado', '5511987778899', 'p3', 'b3', [5, '11:00'], 60, {
      status: 'ATRASADA',
      pago_ate: mesPassado,
    }),
    base('a8', 'Eduardo Santos', '5511988889900', 'p1', 'b1', null, 100, { status: 'PAUSADA' }),
    base('a9', 'Samuel Teixeira', '5511989990011', 'p2', 'b2', [4, '10:00'], 50),
  ];
}

// ---------------------------------------------------------------- persistência

type Registro = RegistroSemente;

/**
 * A agenda de exemplo é gerada de novo a cada carregamento (é determinística). No
 * navegador ficam só os agendamentos criados pelo visitante e as mudanças de status.
 */
const CHAVE = 'ug_demo_v3';
interface Salvo {
  criados: Registro[];
  status: Record<string, StatusAgendamento>;
  /** Assinaturas cadastradas no painel. */
  assinaturas?: Assinatura[];
  /** Mudanças nas assinaturas de exemplo (status, pagamento, dia fixo). */
  alteracoesAssinatura?: Record<string, Partial<Assinatura>>;
  /** Cobranças simuladas (na demonstração não há gateway). */
  cobrancas?: Record<string, Cobranca & { referencia: string }>;
}
let memoria: Registro[] | null = null;
let salvo: Salvo = { criados: [], status: {} };
let assinaturasMem: Assinatura[] = [];

function aleatorio(tamanho: number, alfabeto: string): string {
  const bytes = new Uint8Array(tamanho);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('');
}

const novoCodigo = () => aleatorio(6, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
const novoToken = () => aleatorio(40, 'abcdefghijklmnopqrstuvwxyz0123456789');

const PESOS: Record<string, number> = { s1: 40, s2: 14, s3: 30, s4: 9, s5: 7 };

function carregar(): Registro[] {
  if (memoria) return memoria;
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) salvo = JSON.parse(bruto) as Salvo;
  } catch {
    // localStorage indisponível (aba anônima etc.): segue só em memória.
  }
  const agora = agoraSP();
  const semente = gerarAgenda({
    hoje: agora.data,
    agoraMin: agora.minutos,
    barbeiroIds: BARBEIROS.map((b) => b.id),
    servicos: SERVICOS.map((sv) => ({ ...sv, peso: PESOS[sv.id] ?? 10 })),
    expediente: EXPEDIENTE,
    intervaloMin: CONFIG.intervalo_slot_min,
  });
  assinaturasMem = [
    ...assinaturasDeExemplo(agora.data).map((a) => ({
      ...a,
      ...salvo.alteracoesAssinatura?.[a.id],
    })),
    ...(salvo.assinaturas ?? []),
  ];
  // Os horários dos planos entram primeiro: assinante tem prioridade na agenda.
  const doPlano = gerarHorariosDoPlano({
    assinaturas: assinaturasMem,
    planos: PLANOS,
    servicos: SERVICOS,
    expediente: EXPEDIENTE,
    hoje: agora.data,
    agoraMin: agora.minutos,
    simularUso: assinaturasDeExemplo(agora.data).map((a) => a.id),
    ocupadosExternos: salvo.criados.filter((r) => !r.assinatura_id && r.status !== 'CANCELADO'),
  });
  const agenda = encaixarNaAgenda(semente, doPlano);
  for (const r of agenda) {
    if (salvo.status[r.id]) r.status = salvo.status[r.id];
    if (!r.assinatura_id) r.pagamento = pagamentoDeExemplo(r);
  }
  memoria = [...agenda, ...salvo.criados];
  return memoria;
}

function salvar(): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(salvo));
  } catch {
    // idem
  }
}

/** ~30% dos horários de exemplo foram pagos online; o resto paga no balcão. */
function pagamentoDeExemplo(r: Registro): Pagamento {
  const h = hashTexto(r.id);
  const online = h % 100 < 30;
  const base: Pagamento = online
    ? {
        forma: 'ONLINE',
        status: 'PAGO',
        metodo: h % 3 === 0 ? 'CARTAO' : 'PIX',
        cobranca_id: `pay_demo_${h.toString(36)}`,
      }
    : { forma: 'NA_BARBEARIA', status: 'A_RECEBER' };
  return ajustarPagamento(base, r.status);
}

function hashTexto(t: string): number {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Concluir no balcão = recebido; cancelar algo pago online = estorno. */
function ajustarPagamento(pg: Pagamento, status: StatusAgendamento): Pagamento {
  if (status === 'CONCLUIDO' && pg.status === 'A_RECEBER') return { ...pg, status: 'PAGO' };
  if (status === 'CANCELADO' && pg.forma === 'ONLINE' && pg.status === 'PAGO')
    return { ...pg, status: 'ESTORNADO' };
  return pg;
}

function mudarStatus(r: Registro, status: StatusAgendamento) {
  r.status = status;
  if (r.pagamento) r.pagamento = ajustarPagamento(r.pagamento, status);
  if (r.id.startsWith('s-') || r.id.startsWith('p-')) salvo.status[r.id] = status;
  salvar();
}

// ---------------------------------------------------------------- regras

function barbeirosDoServico(servico: Servico): Barbeiro[] {
  return servico.barbeiro_ids.length
    ? BARBEIROS.filter((b) => servico.barbeiro_ids.includes(b.id))
    : BARBEIROS;
}

function buscarServico(id: unknown): Servico {
  const servico = SERVICOS.find((s) => s.id === id);
  if (!servico) throw new ErroApi('NAO_ENCONTRADO', 'Serviço não encontrado.');
  return servico;
}

function slotsDoBarbeiro(
  barbeiroId: string,
  data: string,
  duracaoMin: number,
  janela = CONFIG.janela_max_dias,
): number[] {
  const agora = agoraSP();
  if (data < agora.data || data > somarDias(agora.data, janela)) return [];
  const dia = EXPEDIENTE[diaSemana(data)];
  const ocupados = carregar()
    .filter((r) => r.barbeiro_id === barbeiroId && r.data === data && r.status !== 'CANCELADO')
    .map((r) => ({ inicio: hhmmParaMin(r.hora_inicio), fim: hhmmParaMin(r.hora_fim) }));
  return calcularSlots({
    expediente: dia?.jornada ?? null,
    pausa: dia?.pausa,
    ocupados,
    duracaoMin,
    intervaloSlotMin: CONFIG.intervalo_slot_min,
    inicioMinimo: data === agora.data ? agora.minutos + ANTECEDENCIA_AGENDAMENTO_MIN : undefined,
  });
}

function horariosDoDia(
  servico: Servico,
  barbeiroId: string,
  data: string,
  janela = CONFIG.janela_max_dias,
): Horario[] {
  const candidatos = barbeirosDoServico(servico).filter(
    (b) => barbeiroId === 'qualquer' || b.id === barbeiroId,
  );
  const mapa = new Map<number, string[]>();
  for (const b of candidatos) {
    for (const slot of slotsDoBarbeiro(b.id, data, servico.duracao_min, janela)) {
      mapa.set(slot, [...(mapa.get(slot) ?? []), b.id]);
    }
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => a - b)
    .map(([min, barbeiroIds]) => ({ hora: minParaHhmm(min), barbeiroIds }));
}

function minutosAte(r: Registro): number {
  const agora = agoraSP();
  const dias = Math.round(
    (Date.parse(`${r.data}T12:00:00Z`) - Date.parse(`${agora.data}T12:00:00Z`)) / 86_400_000,
  );
  return dias * 1440 + hhmmParaMin(r.hora_inicio) - agora.minutos;
}

function paraCliente(r: Registro): AgendamentoCliente {
  const ativo = r.status === 'AGENDADO' || r.status === 'CONFIRMADO';
  return {
    codigo: r.codigo,
    token: r.token,
    barbeiro_nome: BARBEIROS.find((b) => b.id === r.barbeiro_id)?.nome ?? '',
    barbeiro_foto: BARBEIROS.find((b) => b.id === r.barbeiro_id)?.foto_url,
    servico_nome: r.servico_nome,
    duracao_min: r.duracao_min,
    preco: r.preco,
    data: r.data,
    hora_inicio: r.hora_inicio,
    hora_fim: r.hora_fim,
    cliente_nome: r.cliente_nome,
    status: r.status,
    pode_cancelar: ativo && minutosAte(r) >= CONFIG.antecedencia_min_cancelamento_min,
    assinatura_token: r.assinatura_id
      ? assinaturasMem.find((a) => a.id === r.assinatura_id)?.token
      : undefined,
    pagamento: r.pagamento,
  };
}

function paraPainel(r: Registro): AgendamentoPainel {
  const copia: Partial<Registro> = { ...r };
  delete copia.token;
  return copia as AgendamentoPainel;
}

function autenticar(authToken: unknown): Usuario {
  const usuario = USUARIOS.find((u) => `demo.${u.id}` === authToken);
  if (!usuario) throw new ErroApi('NAO_AUTORIZADO', 'Sessão expirada. Entre novamente.');
  return {
    id: usuario.id,
    nome: usuario.nome,
    papel: usuario.papel,
    barbeiro_id: usuario.barbeiro_id,
  };
}

// ---------------------------------------------------------------- planos

/** Grava mudanças numa assinatura (cadastrada ou de exemplo) e regera os horários do plano. */
function alterarAssinatura(id: string, mudancas: Partial<Assinatura>) {
  const criada = salvo.assinaturas?.find((x) => x.id === id);
  if (criada) Object.assign(criada, mudancas);
  else
    salvo.alteracoesAssinatura = {
      ...salvo.alteracoesAssinatura,
      [id]: { ...salvo.alteracoesAssinatura?.[id], ...mudancas },
    };
  salvar();
  memoria = null;
  carregar();
}

/** Cobrança de demonstração: QR e "copia e cola" de mentira, nenhum dinheiro envolvido. */
function novaCobrancaSimulada(
  referencia: string,
  valor: number,
  descricao: string,
  metodo: MetodoPagamento,
  recorrente: boolean,
): Cobranca {
  const id = `pay_demo_${novoToken().slice(0, 14)}`;
  const c: Cobranca & { referencia: string } = {
    id,
    referencia,
    status: 'PENDENTE',
    valor,
    metodo,
    descricao,
    vencimento: agoraSP().data,
    recorrente,
    simulada: true,
    pix:
      metodo === 'PIX'
        ? {
            copia_e_cola: `00020126580014BR.GOV.BCB.PIX0136DEMONSTRACAO-${id}5204000053039865406${valor.toFixed(2)}5802BR6304DEMO`,
          }
        : undefined,
  };
  salvo.cobrancas = { ...salvo.cobrancas, [id]: c };
  salvar();
  return c;
}

function janelaPara(token: unknown): number {
  if (!token) return CONFIG.janela_max_dias;
  carregar();
  const a = assinaturasMem.find((x) => x.token === token);
  return a && a.status !== 'CANCELADA' ? JANELA_ASSINANTE_DIAS : CONFIG.janela_max_dias;
}

function assinaturaPorToken(token: unknown): Assinatura {
  carregar();
  const a = assinaturasMem.find((x) => x.token === token);
  if (!a) throw new ErroApi('NAO_ENCONTRADO', 'Assinatura não encontrada.');
  return a;
}

function exigirAtiva(a: Assinatura) {
  if (a.status === 'AGUARDANDO_PAGAMENTO')
    throw new ErroApi('PROIBIDO', 'Seu plano é ativado assim que o pagamento for confirmado.');
  if (a.status === 'PAUSADA')
    throw new ErroApi('PROIBIDO', 'Seu plano está pausado. Fale com a barbearia.');
  if (a.status === 'CANCELADA') throw new ErroApi('PROIBIDO', 'Este plano foi encerrado.');
}

const planoDe = (a: Assinatura) => PLANOS.find((x) => x.id === a.plano_id)!;

function horarioDoPlano(a: Assinatura, id: unknown): Registro {
  const r = carregar().find((x) => x.id === id && x.assinatura_id === a.id);
  if (!r) throw new ErroApi('NAO_ENCONTRADO', 'Horário não encontrado.');
  if (r.status !== 'AGENDADO' && r.status !== 'CONFIRMADO') {
    throw new ErroApi('VALIDACAO', 'Esse horário não pode mais ser alterado.');
  }
  return r;
}

/** Reserva um horário usando crédito do plano no mês da data escolhida. */
function reservarPeloPlano(
  a: Assinatura,
  data: string,
  hora: string,
  trocandoId?: string,
): Registro {
  const plano = planoDe(a);
  const servico = buscarServico(plano.servico_id);
  const slot = horariosDoDia(servico, a.barbeiro_id, data, JANELA_ASSINANTE_DIAS).find(
    (h) => h.hora === hora,
  );
  if (!slot) throw new ErroApi('SLOT_INDISPONIVEL', 'Esse horário acabou de ser ocupado.');
  const registros = carregar();
  // Numa troca, o horário antigo deixa de contar (ele será liberado).
  const uso = usoNoMes(registros, a.id, mesDe(data), plano.creditos_mes, trocandoId);
  if (uso.livres < 1) {
    throw new ErroApi(
      'LIMITE_AGENDAMENTOS',
      'Os créditos do plano nesse mês já estão todos usados ou marcados.',
    );
  }
  const novo: Registro = {
    id: `c${novoToken().slice(0, 12)}`,
    codigo: novoCodigo(),
    token: novoToken(),
    barbeiro_id: a.barbeiro_id,
    servico_nome: servico.nome,
    duracao_min: servico.duracao_min,
    preco: 0,
    data,
    hora_inicio: hora,
    hora_fim: minParaHhmm(hhmmParaMin(hora) + servico.duracao_min),
    cliente_nome: a.cliente_nome,
    cliente_telefone: a.cliente_telefone,
    observacao: trocandoId ? 'Remarcado pelo cliente' : '',
    status: 'AGENDADO',
    origem: 'CLIENTE',
    assinatura_id: a.id,
  };
  registros.push(novo);
  salvo.criados.push(novo);
  salvar();
  return novo;
}

function paraAssinaturaCliente(a: Assinatura): AssinaturaCliente {
  const plano = planoDe(a);
  const servico = buscarServico(plano.servico_id);
  const barbeiro = BARBEIROS.find((b) => b.id === a.barbeiro_id)!;
  const hoje = agoraSP().data;
  const registros = carregar();
  const proximos = registros
    .filter(
      (r) =>
        r.assinatura_id === a.id &&
        (r.status === 'AGENDADO' || r.status === 'CONFIRMADO') &&
        minutosAte(r) > 0,
    )
    .sort((x, y) => (x.data + x.hora_inicio).localeCompare(y.data + y.hora_inicio))
    .map((r) => ({
      ...paraCliente(r),
      id: r.id,
      pode_trocar: minutosAte(r) >= ANTECEDENCIA_TROCA_MIN,
    }));
  return {
    cliente_nome: a.cliente_nome,
    plano,
    servico_nome: servico.nome,
    barbeiro_id: barbeiro.id,
    barbeiro_nome: barbeiro.nome,
    barbeiro_foto: barbeiro.foto_url,
    fixo: a.fixo,
    status: a.status,
    pagamento_forma: a.pagamento_forma ?? 'NA_BARBEARIA',
    cobranca_pendente: a.cobranca_pendente ?? null,
    ciclo: cicloDoMes(hoje),
    creditos: usoNoMes(registros, a.id, mesDe(hoje), plano.creditos_mes),
    proximos,
    agenda_ate: somarDias(hoje, JANELA_ASSINANTE_DIAS),
    antecedencia_troca_min: ANTECEDENCIA_TROCA_MIN,
  };
}

function paraAssinaturaPainel(a: Assinatura): AssinaturaPainel {
  const plano = planoDe(a);
  const registros = carregar();
  const proximo = registros
    .filter(
      (r) =>
        r.assinatura_id === a.id &&
        (r.status === 'AGENDADO' || r.status === 'CONFIRMADO') &&
        minutosAte(r) > 0,
    )
    .sort((x, y) => (x.data + x.hora_inicio).localeCompare(y.data + y.hora_inicio))[0];
  const uso = usoNoMes(registros, a.id, mesDe(agoraSP().data), plano.creditos_mes);
  return {
    ...a,
    plano_nome: plano.nome,
    preco_mensal: plano.preco_mensal,
    creditos_mes: plano.creditos_mes,
    usados_mes: uso.usados + uso.agendados,
    proximo: proximo ? { data: proximo.data, hora: proximo.hora_inicio } : null,
  };
}

// ---------------------------------------------------------------- ações

type Payload = Record<string, unknown>;

const acoes: Record<string, (p: Payload, authToken?: string | null) => unknown> = {
  getConfigPublica: () => CONFIG,

  listarServicos: () => SERVICOS,

  listarBarbeiros: (p) =>
    p.servicoId ? barbeirosDoServico(buscarServico(p.servicoId)) : BARBEIROS,

  // Com `assinaturaToken`, a janela é a do assinante (mais longa que a do público).
  getDiasDisponiveis: (p) => {
    const servico = buscarServico(p.servicoId);
    const janela = janelaPara(p.assinaturaToken);
    const dias: string[] = [];
    for (let d = String(p.de); d <= String(p.ate); d = somarDias(d, 1)) {
      if (horariosDoDia(servico, String(p.barbeiroId), d, janela).length) dias.push(d);
    }
    return dias;
  },

  getHorarios: (p) =>
    horariosDoDia(
      buscarServico(p.servicoId),
      String(p.barbeiroId),
      String(p.data),
      janelaPara(p.assinaturaToken),
    ),

  listarPlanos: () => PLANOS,

  /** Horários que ainda podem ser dia fixo (para a tela de contratação). */
  horariosFixosLivres: (p) => {
    carregar();
    return horasFixasLivres({
      assinaturas: assinaturasMem,
      planos: PLANOS,
      servicos: SERVICOS,
      expediente: EXPEDIENTE,
      planoId: String(p.planoId),
      barbeiroId: String(p.barbeiroId),
      diaSemana: Number(p.diaSemana),
      intervaloMin: CONFIG.intervalo_slot_min,
    });
  },

  /** Contratação do plano pelo próprio cliente (página /assinar). Ativa após o pagamento. */
  contratarPlano: (p) => {
    const nome = String(p.clienteNome ?? '').trim();
    const telefone = normalizarTelefone(String(p.clienteTelefone ?? ''));
    if (p.honeypot) throw new ErroApi('VALIDACAO', 'Não foi possível concluir.');
    if (nome.length < 2 || nome.length > 60) throw new ErroApi('VALIDACAO', 'Informe seu nome.');
    if (!telefone) throw new ErroApi('VALIDACAO', 'Informe um WhatsApp válido, com DDD.');
    if (!PLANOS.some((x) => x.id === p.planoId)) throw new ErroApi('VALIDACAO', 'Plano inválido.');
    if (!BARBEIROS.some((x) => x.id === p.barbeiroId))
      throw new ErroApi('VALIDACAO', 'Escolha o barbeiro.');
    const fixo = (p.fixo as Assinatura['fixo']) ?? null;
    if (fixo) {
      const dia = EXPEDIENTE[fixo.dia_semana];
      const servico = buscarServico(PLANOS.find((x) => x.id === p.planoId)!.servico_id);
      const ini = hhmmParaMin(fixo.hora);
      const fim = ini + servico.duracao_min;
      if (!dia) throw new ErroApi('VALIDACAO', 'A barbearia não abre nesse dia.');
      if (
        ini < dia.jornada.inicio ||
        fim > dia.jornada.fim ||
        (ini < dia.pausa.fim && dia.pausa.inicio < fim)
      ) {
        throw new ErroApi('VALIDACAO', 'Esse horário fica fora do expediente.');
      }
      carregar();
      const livres = horasFixasLivres({
        assinaturas: assinaturasMem,
        planos: PLANOS,
        servicos: SERVICOS,
        expediente: EXPEDIENTE,
        planoId: String(p.planoId),
        barbeiroId: String(p.barbeiroId),
        diaSemana: fixo.dia_semana,
        intervaloMin: CONFIG.intervalo_slot_min,
      });
      if (!livres.includes(fixo.hora)) {
        throw new ErroApi(
          'SLOT_INDISPONIVEL',
          'Esse dia fixo já é de outro assinante. Escolha outro horário.',
        );
      }
    }
    const hoje = agoraSP().data;
    const forma: FormaPagamento = p.formaPagamento === 'ONLINE' ? 'ONLINE' : 'NA_BARBEARIA';
    const nova: Assinatura = {
      id: `n${novoToken().slice(0, 8)}`,
      token: novoToken(),
      cliente_nome: nome,
      cliente_telefone: telefone,
      plano_id: String(p.planoId),
      barbeiro_id: String(p.barbeiroId),
      fixo,
      status: 'AGUARDANDO_PAGAMENTO',
      inicio: hoje,
      pago_ate: '',
      pagamento_forma: forma,
      cobranca_pendente: null,
    };
    salvo.assinaturas = [...(salvo.assinaturas ?? []), nova];
    salvar();
    memoria = null;
    carregar();
    return { token: nova.token };
  },

  /**
   * Mesmo contrato do /api/pagamentos real (Asaas): o valor sai daqui, não do navegador.
   * Se já existe cobrança pendente para o mesmo item, devolve a mesma.
   */
  iniciarPagamento: (p) => {
    if (!normalizarCpf(String(p.cpf ?? '')))
      throw new ErroApi('VALIDACAO', 'Informe um CPF válido.');
    const metodo: MetodoPagamento = p.metodo === 'CARTAO' ? 'CARTAO' : 'PIX';
    if (p.tipo === 'assinatura') {
      const a = assinaturaPorToken(p.token);
      const existente = a.cobranca_pendente && salvo.cobrancas?.[a.cobranca_pendente];
      if (existente && existente.status === 'PENDENTE') return existente;
      const plano = planoDe(a);
      const c = novaCobrancaSimulada(
        `as:${a.id}`,
        plano.preco_mensal,
        `${plano.nome} (mensal)`,
        metodo,
        true,
      );
      alterarAssinatura(a.id, { cobranca_pendente: c.id, pagamento_forma: 'ONLINE' });
      return c;
    }
    const r = carregar().find((x) => x.token === p.token);
    if (!r || r.assinatura_id) throw new ErroApi('NAO_ENCONTRADO', 'Agendamento não encontrado.');
    if (r.pagamento?.status === 'PAGO')
      throw new ErroApi('VALIDACAO', 'Este horário já está pago.');
    const existente = r.pagamento?.cobranca_id && salvo.cobrancas?.[r.pagamento.cobranca_id];
    if (existente && existente.status === 'PENDENTE') return existente;
    const c = novaCobrancaSimulada(
      `ag:${r.id}`,
      r.preco,
      `${r.servico_nome} — ${r.data} ${r.hora_inicio}`,
      metodo,
      false,
    );
    r.pagamento = { forma: 'ONLINE', status: 'PENDENTE', metodo, cobranca_id: c.id };
    salvar();
    return c;
  },

  consultarPagamento: (p) => {
    const c = salvo.cobrancas?.[String(p.id)];
    if (!c) throw new ErroApi('NAO_ENCONTRADO', 'Cobrança não encontrada.');
    return c;
  },

  /** Só na demonstração: faz o papel do webhook do Asaas confirmando o pagamento. */
  simularPagamento: (p) => {
    const c = salvo.cobrancas?.[String(p.id)];
    if (!c) throw new ErroApi('NAO_ENCONTRADO', 'Cobrança não encontrada.');
    c.status = 'PAGO';
    const [tipo, id] = c.referencia.split(':');
    if (tipo === 'ag') {
      const r = carregar().find((x) => x.id === id);
      if (r?.pagamento) r.pagamento = { ...r.pagamento, status: 'PAGO' };
    } else {
      alterarAssinatura(id, {
        status: 'ATIVA',
        pago_ate: mesDe(agoraSP().data),
        cobranca_pendente: null,
      });
    }
    salvar();
    return c;
  },

  getAssinaturaPorToken: (p) => paraAssinaturaCliente(assinaturaPorToken(p.token)),

  /**
   * Troca um horário do plano por outro (mais cedo ou mais tarde). É uma operação só:
   * o novo horário é reservado e o antigo liberado juntos, então o crédito nunca se perde.
   */
  trocarHorarioAssinatura: (p) => {
    const a = assinaturaPorToken(p.token);
    exigirAtiva(a);
    const antigo = horarioDoPlano(a, p.agendamentoId);
    if (minutosAte(antigo) < ANTECEDENCIA_TROCA_MIN) {
      throw new ErroApi(
        'CANCELAMENTO_FORA_DO_PRAZO',
        `Trocas vão até ${ANTECEDENCIA_TROCA_MIN / 60}h antes do horário. Fale com a barbearia.`,
      );
    }
    const novo = reservarPeloPlano(a, String(p.data), String(p.hora), antigo.id);
    mudarStatus(antigo, 'CANCELADO');
    return paraCliente(novo);
  },

  /** "Não vou nesta semana": libera o horário e devolve o crédito. */
  cancelarHorarioAssinatura: (p) => {
    const a = assinaturaPorToken(p.token);
    const r = horarioDoPlano(a, p.agendamentoId);
    if (minutosAte(r) < ANTECEDENCIA_TROCA_MIN) {
      throw new ErroApi(
        'CANCELAMENTO_FORA_DO_PRAZO',
        'Faltam menos de 2h para o horário. Fale com a barbearia.',
      );
    }
    mudarStatus(r, 'CANCELADO');
    return paraAssinaturaCliente(a);
  },

  /** Usa um crédito livre do mês num horário escolhido pelo assinante. */
  agendarComCredito: (p) => {
    const a = assinaturaPorToken(p.token);
    exigirAtiva(a);
    return paraCliente(reservarPeloPlano(a, String(p.data), String(p.hora)));
  },

  listarAssinaturas: (_p, authToken) => {
    const usuario = autenticar(authToken);
    carregar();
    return assinaturasMem
      .filter((a) => usuario.papel === 'ADMIN' || a.barbeiro_id === usuario.barbeiro_id)
      .map(paraAssinaturaPainel);
  },

  /** Muda status, pagamento ou dia fixo de uma assinatura (admin). */
  atualizarAssinatura: (p, authToken) => {
    const usuario = autenticar(authToken);
    if (usuario.papel !== 'ADMIN')
      throw new ErroApi('PROIBIDO', 'Só o administrador altera planos.');
    carregar();
    const a = assinaturasMem.find((x) => x.id === p.id);
    if (!a) throw new ErroApi('NAO_ENCONTRADO', 'Assinatura não encontrada.');
    const mudancas: Partial<Assinatura> = {};
    if (p.status) mudancas.status = p.status as Assinatura['status'];
    if (p.pago_ate) mudancas.pago_ate = String(p.pago_ate);
    if (p.fixo !== undefined) mudancas.fixo = p.fixo as Assinatura['fixo'];
    alterarAssinatura(a.id, mudancas);
    return paraAssinaturaPainel(assinaturasMem.find((x) => x.id === a.id)!);
  },

  criarAssinatura: (p, authToken) => {
    const usuario = autenticar(authToken);
    if (usuario.papel !== 'ADMIN') throw new ErroApi('PROIBIDO', 'Só o administrador cria planos.');
    const nome = String(p.clienteNome ?? '').trim();
    const telefone = normalizarTelefone(String(p.clienteTelefone ?? ''));
    if (nome.length < 2) throw new ErroApi('VALIDACAO', 'Informe o nome do cliente.');
    if (!telefone) throw new ErroApi('VALIDACAO', 'Informe um WhatsApp válido, com DDD.');
    if (!PLANOS.some((x) => x.id === p.planoId))
      throw new ErroApi('VALIDACAO', 'Escolha um plano.');
    if (!BARBEIROS.some((x) => x.id === p.barbeiroId))
      throw new ErroApi('VALIDACAO', 'Escolha o barbeiro.');
    const hoje = agoraSP().data;
    const nova: Assinatura = {
      id: `n${novoToken().slice(0, 8)}`,
      token: novoToken(),
      cliente_nome: nome,
      cliente_telefone: telefone,
      plano_id: String(p.planoId),
      barbeiro_id: String(p.barbeiroId),
      fixo: (p.fixo as Assinatura['fixo']) ?? null,
      status: 'ATIVA',
      inicio: hoje,
      pago_ate: mesDe(hoje),
    };
    salvo.assinaturas = [...(salvo.assinaturas ?? []), nova];
    salvar();
    memoria = null;
    carregar();
    return paraAssinaturaPainel(assinaturasMem.find((x) => x.id === nova.id)!);
  },

  criarAgendamento: (p) => {
    if (p.honeypot) throw new ErroApi('VALIDACAO', 'Não foi possível concluir.');
    const nome = String(p.clienteNome ?? '').trim();
    const telefone = normalizarTelefone(String(p.clienteTelefone ?? ''));
    if (nome.length < 2 || nome.length > 60) throw new ErroApi('VALIDACAO', 'Informe seu nome.');
    if (!telefone) throw new ErroApi('VALIDACAO', 'Informe um WhatsApp válido, com DDD.');

    const servico = buscarServico(p.servicoId);
    const data = String(p.data);
    const hora = String(p.hora);
    const slot = horariosDoDia(servico, String(p.barbeiroId), data).find((h) => h.hora === hora);
    if (!slot) throw new ErroApi('SLOT_INDISPONIVEL', 'Esse horário acabou de ser ocupado.');

    const registros = carregar();
    const futuros = registros.filter(
      (r) =>
        r.cliente_telefone === telefone &&
        (r.status === 'AGENDADO' || r.status === 'CONFIRMADO') &&
        minutosAte(r) > 0,
    );
    if (futuros.length >= MAX_FUTUROS_POR_TELEFONE) {
      throw new ErroApi(
        'LIMITE_AGENDAMENTOS',
        `Você já tem ${MAX_FUTUROS_POR_TELEFONE} horários marcados. Cancele um deles para agendar outro.`,
      );
    }

    // "Qualquer barbeiro": o que tiver menos atendimentos no dia.
    const cargaNoDia = (id: string) =>
      registros.filter((r) => r.barbeiro_id === id && r.data === data && r.status !== 'CANCELADO')
        .length;
    const barbeiroId = [...slot.barbeiroIds].sort((a, b) => cargaNoDia(a) - cargaNoDia(b))[0];

    const registro: Registro = {
      id: novoToken().slice(0, 12),
      codigo: novoCodigo(),
      token: novoToken(),
      barbeiro_id: barbeiroId,
      servico_nome: servico.nome,
      duracao_min: servico.duracao_min,
      preco: servico.preco,
      data,
      hora_inicio: hora,
      hora_fim: minParaHhmm(hhmmParaMin(hora) + servico.duracao_min),
      cliente_nome: nome,
      cliente_telefone: telefone,
      observacao: String(p.observacao ?? '').slice(0, 200),
      status: 'AGENDADO',
      origem: 'CLIENTE',
      pagamento:
        p.formaPagamento === 'ONLINE'
          ? {
              forma: 'ONLINE',
              status: 'PENDENTE',
              metodo: p.metodoPagamento === 'CARTAO' ? 'CARTAO' : 'PIX',
            }
          : { forma: 'NA_BARBEARIA', status: 'A_RECEBER' },
    };
    registros.push(registro);
    salvo.criados.push(registro);
    salvar();
    return paraCliente(registro);
  },

  getAgendamentoPorToken: (p) => {
    const registro = carregar().find((r) => r.token === p.token);
    if (!registro) throw new ErroApi('NAO_ENCONTRADO', 'Agendamento não encontrado.');
    return paraCliente(registro);
  },

  cancelarPorToken: (p) => {
    const registro = carregar().find((r) => r.token === p.token);
    if (!registro) throw new ErroApi('NAO_ENCONTRADO', 'Agendamento não encontrado.');
    if (!paraCliente(registro).pode_cancelar) {
      throw new ErroApi(
        'CANCELAMENTO_FORA_DO_PRAZO',
        'Não dá mais para cancelar pelo site. Fale com a barbearia.',
      );
    }
    mudarStatus(registro, 'CANCELADO');
    return paraCliente(registro);
  },

  login: (p) => {
    const usuario = USUARIOS.find((u) => u.login === String(p.login).trim().toLowerCase());
    if (!usuario || usuario.senha !== p.senha) {
      throw new ErroApi('NAO_AUTORIZADO', 'Login ou senha incorretos.');
    }
    return { authToken: `demo.${usuario.id}`, usuario: autenticar(`demo.${usuario.id}`) };
  },

  me: (_p, authToken) => autenticar(authToken),

  listarAgendamentos: (p, authToken) => {
    const usuario = autenticar(authToken);
    return carregar()
      .filter((r) => r.data === p.data)
      .filter((r) => usuario.papel === 'ADMIN' || r.barbeiro_id === usuario.barbeiro_id)
      .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))
      .map(paraPainel);
  },

  /** Agendamentos de um intervalo de datas (dashboard e relatórios). */
  listarAgendamentosPeriodo: (p, authToken) => {
    const usuario = autenticar(authToken);
    const de = String(p.de);
    const ate = String(p.ate);
    const filtro =
      usuario.papel === 'ADMIN' ? (p.barbeiroId as string | undefined) : usuario.barbeiro_id;
    return carregar()
      .filter((r) => r.data >= de && r.data <= ate)
      .filter((r) => !filtro || r.barbeiro_id === filtro)
      .sort((a, b) => (a.data + a.hora_inicio).localeCompare(b.data + b.hora_inicio))
      .map(paraPainel);
  },

  atualizarStatus: (p, authToken) => {
    const usuario = autenticar(authToken);
    const registro = carregar().find((r) => r.id === p.id);
    if (!registro) throw new ErroApi('NAO_ENCONTRADO', 'Agendamento não encontrado.');
    if (usuario.papel !== 'ADMIN' && registro.barbeiro_id !== usuario.barbeiro_id) {
      throw new ErroApi('PROIBIDO', 'Esse agendamento é de outro barbeiro.');
    }
    mudarStatus(registro, p.status as StatusAgendamento);
    return paraPainel(registro);
  },
};

export async function chamarMock<T>(
  action: string,
  payload: Payload,
  authToken?: string | null,
): Promise<T> {
  // Simula a latência do Apps Script para os estados de carregamento aparecerem.
  await new Promise((r) => setTimeout(r, 350 + Math.random() * 350));
  const acao = acoes[action];
  if (!acao) throw new ErroApi('VALIDACAO', `Ação desconhecida: ${action}`);
  return structuredClone(acao(payload, authToken)) as T;
}

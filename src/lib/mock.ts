// Back-end simulado para o front demonstrativo: mesmas ações do contrato da API (seção 5.3),
// com os dados guardados no localStorage do navegador. Nada sai do aparelho.

import type {
  AgendamentoCliente,
  AgendamentoPainel,
  Barbeiro,
  CodigoErro,
  ConfigPublica,
  Horario,
  Servico,
  StatusAgendamento,
  Usuario,
} from '../types';
import { calcularSlots, type Intervalo } from './disponibilidade';
import { agoraSP, diaSemana, hhmmParaMin, minParaHhmm, somarDias } from './datas';
import { normalizarTelefone } from './telefone';

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
  janela_max_dias: 30,
  antecedencia_min_cancelamento_min: 120,
  funcionamento: [
    { dias: 'Terça a sexta', horario: '09:30 – 20:00' },
    { dias: 'Sábado', horario: '09:00 – 18:00' },
    { dias: 'Domingo e segunda', horario: 'Fechado' },
  ],
};

const BARBEIROS: Barbeiro[] = [
  { id: 'b1', nome: 'Renato', instagram: 'renatoneves.ug' },
  { id: 'b2', nome: 'VL', instagram: 'vlducorte' },
  { id: 'b3', nome: 'Davi', instagram: 'davi_undergroundbarbershop' },
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
  { id: 'u1', nome: 'Administrador', login: 'admin', senha: 'demo', papel: 'ADMIN', barbeiro_id: null },
  { id: 'u2', nome: 'Renato', login: 'renato', senha: 'demo', papel: 'BARBEIRO', barbeiro_id: 'b1' },
];

// ---------------------------------------------------------------- persistência

interface Registro extends AgendamentoPainel {
  token: string;
}

const CHAVE = 'ug_demo_v1';
let memoria: Registro[] | null = null;

function aleatorio(tamanho: number, alfabeto: string): string {
  const bytes = new Uint8Array(tamanho);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('');
}

const novoCodigo = () => aleatorio(6, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
const novoToken = () => aleatorio(40, 'abcdefghijklmnopqrstuvwxyz0123456789');

/** Agenda de exemplo para o painel não aparecer vazio. */
function semear(): Registro[] {
  const clientes = ['João P.', 'Lucas M.', 'Rafael S.', 'Bruno T.', 'Matheus R.', 'Gustavo A.', 'Caio F.'];
  const grade: [string, string, string, StatusAgendamento][] = [
    ['b1', '10:00', 's1', 'CONFIRMADO'],
    ['b1', '11:00', 's3', 'AGENDADO'],
    ['b1', '15:30', 's2', 'AGENDADO'],
    ['b2', '09:30', 's3', 'CONFIRMADO'],
    ['b2', '14:00', 's1', 'AGENDADO'],
    ['b2', '17:00', 's5', 'AGENDADO'],
    ['b3', '10:30', 's1', 'AGENDADO'],
    ['b3', '16:00', 's4', 'CONFIRMADO'],
  ];
  const registros: Registro[] = [];
  let data = agoraSP().data;
  let dias = 0;
  let n = 0;
  while (dias < 3) {
    if (EXPEDIENTE[diaSemana(data)]) {
      for (const [barbeiroId, hora, servicoId, status] of grade.filter((_, i) => (i + dias) % 3 !== 2)) {
        const servico = SERVICOS.find((s) => s.id === servicoId)!;
        registros.push({
          id: `seed-${n}`,
          codigo: novoCodigo(),
          token: novoToken(),
          barbeiro_id: barbeiroId,
          servico_nome: servico.nome,
          duracao_min: servico.duracao_min,
          preco: servico.preco,
          data,
          hora_inicio: hora,
          hora_fim: minParaHhmm(hhmmParaMin(hora) + servico.duracao_min),
          cliente_nome: clientes[n % clientes.length],
          cliente_telefone: `55119${String(80000000 + n * 1234567).slice(0, 8)}`,
          observacao: '',
          status,
          origem: 'CLIENTE',
        });
        n++;
      }
      dias++;
    }
    data = somarDias(data, 1);
  }
  return registros;
}

function carregar(): Registro[] {
  if (memoria) return memoria;
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) {
      const salvo = JSON.parse(bruto) as { semeadoEm: string; registros: Registro[] };
      // Resemeia a agenda de exemplo quando o dia vira, mantendo o que o visitante criou.
      if (salvo.semeadoEm === agoraSP().data) return (memoria = salvo.registros);
      memoria = [...semear(), ...salvo.registros.filter((r) => !r.id.startsWith('seed-'))];
      salvar();
      return memoria;
    }
  } catch {
    // localStorage indisponível (aba anônima etc.): segue só em memória.
  }
  memoria = semear();
  salvar();
  return memoria;
}

function salvar(): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ semeadoEm: agoraSP().data, registros: memoria }));
  } catch {
    // idem
  }
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

function slotsDoBarbeiro(barbeiroId: string, data: string, duracaoMin: number): number[] {
  const agora = agoraSP();
  if (data < agora.data || data > somarDias(agora.data, CONFIG.janela_max_dias)) return [];
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

function horariosDoDia(servico: Servico, barbeiroId: string, data: string): Horario[] {
  const candidatos = barbeirosDoServico(servico).filter(
    (b) => barbeiroId === 'qualquer' || b.id === barbeiroId,
  );
  const mapa = new Map<number, string[]>();
  for (const b of candidatos) {
    for (const slot of slotsDoBarbeiro(b.id, data, servico.duracao_min)) {
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
    servico_nome: r.servico_nome,
    duracao_min: r.duracao_min,
    preco: r.preco,
    data: r.data,
    hora_inicio: r.hora_inicio,
    hora_fim: r.hora_fim,
    cliente_nome: r.cliente_nome,
    status: r.status,
    pode_cancelar: ativo && minutosAte(r) >= CONFIG.antecedencia_min_cancelamento_min,
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
  return { id: usuario.id, nome: usuario.nome, papel: usuario.papel, barbeiro_id: usuario.barbeiro_id };
}

// ---------------------------------------------------------------- ações

type Payload = Record<string, unknown>;

const acoes: Record<string, (p: Payload, authToken?: string | null) => unknown> = {
  getConfigPublica: () => CONFIG,

  listarServicos: () => SERVICOS,

  listarBarbeiros: (p) => (p.servicoId ? barbeirosDoServico(buscarServico(p.servicoId)) : BARBEIROS),

  getDiasDisponiveis: (p) => {
    const servico = buscarServico(p.servicoId);
    const dias: string[] = [];
    for (let d = String(p.de); d <= String(p.ate); d = somarDias(d, 1)) {
      if (horariosDoDia(servico, String(p.barbeiroId), d).length) dias.push(d);
    }
    return dias;
  },

  getHorarios: (p) => horariosDoDia(buscarServico(p.servicoId), String(p.barbeiroId), String(p.data)),

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
      registros.filter((r) => r.barbeiro_id === id && r.data === data && r.status !== 'CANCELADO').length;
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
    };
    registros.push(registro);
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
    registro.status = 'CANCELADO';
    salvar();
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

  atualizarStatus: (p, authToken) => {
    const usuario = autenticar(authToken);
    const registro = carregar().find((r) => r.id === p.id);
    if (!registro) throw new ErroApi('NAO_ENCONTRADO', 'Agendamento não encontrado.');
    if (usuario.papel !== 'ADMIN' && registro.barbeiro_id !== usuario.barbeiro_id) {
      throw new ErroApi('PROIBIDO', 'Esse agendamento é de outro barbeiro.');
    }
    registro.status = p.status as StatusAgendamento;
    salvar();
    return paraPainel(registro);
  },
};

export async function chamarMock<T>(action: string, payload: Payload, authToken?: string | null): Promise<T> {
  // Simula a latência do Apps Script para os estados de carregamento aparecerem.
  await new Promise((r) => setTimeout(r, 350 + Math.random() * 350));
  const acao = acoes[action];
  if (!acao) throw new ErroApi('VALIDACAO', `Ação desconhecida: ${action}`);
  return structuredClone(acao(payload, authToken)) as T;
}

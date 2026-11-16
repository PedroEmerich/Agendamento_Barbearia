// Cliente tipado da API. Em modo demonstração (padrão) usa o back-end simulado de ./mock;
// com VITE_DEMO=false passa a chamar o proxy /api/gas (Fase 3).

import type {
  AgendamentoCliente,
  AssinaturaCliente,
  AssinaturaPainel,
  Cobranca,
  FormaPagamento,
  MetodoPagamento,
  HorarioFixo,
  Plano,
  StatusAssinatura,
  AgendamentoPainel,
  Barbeiro,
  ConfigPublica,
  Horario,
  Servico,
  StatusAgendamento,
  Usuario,
} from '../types';
import { chamarMock, ErroApi } from './mock';

export { ErroApi };

export const MODO_DEMO = import.meta.env.VITE_DEMO !== 'false';

const CHAVE_SESSAO = 'ug_auth';

export const sessao = {
  ler(): string | null {
    try {
      return sessionStorage.getItem(CHAVE_SESSAO);
    } catch {
      return null;
    }
  },
  gravar(token: string | null): void {
    try {
      if (token) sessionStorage.setItem(CHAVE_SESSAO, token);
      else sessionStorage.removeItem(CHAVE_SESSAO);
    } catch {
      // sem sessionStorage: a sessão dura só até recarregar
    }
  },
};

async function chamar<T>(
  action: string,
  payload: Record<string, unknown> = {},
  endpoint = '/api/gas',
): Promise<T> {
  const authToken = sessao.ler();
  if (MODO_DEMO) return chamarMock<T>(action, payload, authToken);

  let resposta: Response;
  try {
    resposta = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload, authToken }),
    });
  } catch {
    throw new ErroApi('ERRO_INTERNO', 'Sem conexão. Tente de novo.');
  }
  const corpo = await resposta.json().catch(() => null);
  if (!corpo?.ok) {
    throw new ErroApi(
      corpo?.error?.code ?? 'ERRO_INTERNO',
      corpo?.error?.message ?? 'Algo deu errado. Tente de novo.',
    );
  }
  return corpo.data as T;
}

export interface NovoAgendamento {
  servicoId: string;
  barbeiroId: string;
  data: string;
  hora: string;
  clienteNome: string;
  clienteTelefone: string;
  observacao?: string;
  honeypot: string;
  formaPagamento: FormaPagamento;
  metodoPagamento?: MetodoPagamento;
}

export interface DadosPagador {
  metodo: MetodoPagamento;
  cpf: string;
  email?: string;
}

export interface NovaAssinatura {
  planoId: string;
  barbeiroId: string;
  clienteNome: string;
  clienteTelefone: string;
  fixo: HorarioFixo | null;
  formaPagamento: FormaPagamento;
  honeypot: string;
}

export const api = {
  getConfigPublica: () => chamar<ConfigPublica>('getConfigPublica'),
  listarServicos: () => chamar<Servico[]>('listarServicos'),
  listarBarbeiros: (servicoId?: string) => chamar<Barbeiro[]>('listarBarbeiros', { servicoId }),
  getDiasDisponiveis: (
    servicoId: string,
    barbeiroId: string,
    de: string,
    ate: string,
    assinaturaToken?: string,
  ) => chamar<string[]>('getDiasDisponiveis', { servicoId, barbeiroId, de, ate, assinaturaToken }),
  getHorarios: (servicoId: string, barbeiroId: string, data: string, assinaturaToken?: string) =>
    chamar<Horario[]>('getHorarios', { servicoId, barbeiroId, data, assinaturaToken }),
  listarPlanos: () => chamar<Plano[]>('listarPlanos'),
  contratarPlano: (dados: NovaAssinatura) =>
    chamar<{ token: string }>('contratarPlano', { ...dados }),

  // Pagamento online: em produção vai para /api/pagamentos (Asaas, no servidor).
  iniciarPagamento: (tipo: 'agendamento' | 'assinatura', token: string, pagador: DadosPagador) =>
    chamar<Cobranca>('iniciarPagamento', { tipo, token, ...pagador }, '/api/pagamentos'),
  consultarPagamento: (id: string) =>
    chamar<Cobranca>('consultarPagamento', { id }, '/api/pagamentos'),
  /** Só existe na demonstração (faz o papel do webhook do Asaas). */
  simularPagamento: (id: string) => chamar<Cobranca>('simularPagamento', { id }),
  getAssinaturaPorToken: (token: string) =>
    chamar<AssinaturaCliente>('getAssinaturaPorToken', { token }),
  trocarHorarioAssinatura: (token: string, agendamentoId: string, data: string, hora: string) =>
    chamar<AgendamentoCliente>('trocarHorarioAssinatura', { token, agendamentoId, data, hora }),
  cancelarHorarioAssinatura: (token: string, agendamentoId: string) =>
    chamar<AssinaturaCliente>('cancelarHorarioAssinatura', { token, agendamentoId }),
  agendarComCredito: (token: string, data: string, hora: string) =>
    chamar<AgendamentoCliente>('agendarComCredito', { token, data, hora }),
  listarAssinaturas: () => chamar<AssinaturaPainel[]>('listarAssinaturas'),
  atualizarAssinatura: (
    id: string,
    mudancas: { status?: StatusAssinatura; pago_ate?: string; fixo?: HorarioFixo | null },
  ) => chamar<AssinaturaPainel>('atualizarAssinatura', { id, ...mudancas }),
  criarAssinatura: (dados: {
    clienteNome: string;
    clienteTelefone: string;
    planoId: string;
    barbeiroId: string;
    fixo: HorarioFixo | null;
  }) => chamar<AssinaturaPainel>('criarAssinatura', dados),
  criarAgendamento: (dados: NovoAgendamento) =>
    chamar<AgendamentoCliente>('criarAgendamento', { ...dados }),
  getAgendamentoPorToken: (token: string) =>
    chamar<AgendamentoCliente>('getAgendamentoPorToken', { token }),
  cancelarPorToken: (token: string) => chamar<AgendamentoCliente>('cancelarPorToken', { token }),

  login: (login: string, senha: string) =>
    chamar<{ authToken: string; usuario: Usuario }>('login', { login, senha }),
  me: () => chamar<Usuario>('me'),
  listarAgendamentos: (data: string) => chamar<AgendamentoPainel[]>('listarAgendamentos', { data }),
  listarAgendamentosPeriodo: (de: string, ate: string, barbeiroId?: string) =>
    chamar<AgendamentoPainel[]>('listarAgendamentosPeriodo', { de, ate, barbeiroId }),
  atualizarStatus: (id: string, status: StatusAgendamento) =>
    chamar<AgendamentoPainel>('atualizarStatus', { id, status }),
};

// Último agendamento feito neste aparelho, para o aviso na página inicial.
const CHAVE_ULTIMO = 'ug_ultimo_token';

export const ultimoAgendamento = {
  ler(): string | null {
    try {
      return localStorage.getItem(CHAVE_ULTIMO);
    } catch {
      return null;
    }
  },
  gravar(token: string | null): void {
    try {
      if (token) localStorage.setItem(CHAVE_ULTIMO, token);
      else localStorage.removeItem(CHAVE_ULTIMO);
    } catch {
      // ignora
    }
  },
};

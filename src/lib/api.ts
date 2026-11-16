// Cliente tipado da API. Em modo demonstração (padrão) usa o back-end simulado de ./mock;
// com VITE_DEMO=false passa a chamar o proxy /api/gas (Fase 3).

import type {
  AgendamentoCliente,
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

async function chamar<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const authToken = sessao.ler();
  if (MODO_DEMO) return chamarMock<T>(action, payload, authToken);

  let resposta: Response;
  try {
    resposta = await fetch('/api/gas', {
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
}

export const api = {
  getConfigPublica: () => chamar<ConfigPublica>('getConfigPublica'),
  listarServicos: () => chamar<Servico[]>('listarServicos'),
  listarBarbeiros: (servicoId?: string) => chamar<Barbeiro[]>('listarBarbeiros', { servicoId }),
  getDiasDisponiveis: (servicoId: string, barbeiroId: string, de: string, ate: string) =>
    chamar<string[]>('getDiasDisponiveis', { servicoId, barbeiroId, de, ate }),
  getHorarios: (servicoId: string, barbeiroId: string, data: string) =>
    chamar<Horario[]>('getHorarios', { servicoId, barbeiroId, data }),
  criarAgendamento: (dados: NovoAgendamento) =>
    chamar<AgendamentoCliente>('criarAgendamento', { ...dados }),
  getAgendamentoPorToken: (token: string) =>
    chamar<AgendamentoCliente>('getAgendamentoPorToken', { token }),
  cancelarPorToken: (token: string) => chamar<AgendamentoCliente>('cancelarPorToken', { token }),

  login: (login: string, senha: string) =>
    chamar<{ authToken: string; usuario: Usuario }>('login', { login, senha }),
  me: () => chamar<Usuario>('me'),
  listarAgendamentos: (data: string) => chamar<AgendamentoPainel[]>('listarAgendamentos', { data }),
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

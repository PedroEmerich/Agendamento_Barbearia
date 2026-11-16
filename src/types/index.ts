export type StatusAgendamento =
  'AGENDADO' | 'CONFIRMADO' | 'CANCELADO' | 'CONCLUIDO' | 'NAO_COMPARECEU';

export type Papel = 'ADMIN' | 'BARBEIRO';

export interface DiaFuncionamento {
  dias: string;
  horario: string;
}

export interface ConfigPublica {
  nome_barbearia: string;
  slogan: string;
  endereco: string;
  telefone_contato: string;
  instagram_url: string;
  instagram_usuario: string;
  maps_url: string;
  logo_url: string;
  intervalo_slot_min: number;
  janela_max_dias: number;
  antecedencia_min_cancelamento_min: number;
  funcionamento: DiaFuncionamento[];
  /** Horário de abertura por dia da semana (0 = domingo); dia ausente = fechado. */
  horario_semana: { dia_semana: number; abre: string; fecha: string }[];
}

export interface Servico {
  id: string;
  nome: string;
  descricao: string;
  duracao_min: number;
  preco: number;
  barbeiro_ids: string[];
}

export interface Barbeiro {
  id: string;
  nome: string;
  instagram?: string;
  foto_url?: string;
}

export interface Horario {
  hora: string;
  barbeiroIds: string[];
}

/** Visão do agendamento para o próprio cliente (via token). */
export interface AgendamentoCliente {
  codigo: string;
  token: string;
  barbeiro_nome: string;
  barbeiro_foto?: string;
  servico_nome: string;
  duracao_min: number;
  preco: number;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  cliente_nome: string;
  status: StatusAgendamento;
  pode_cancelar: boolean;
}

/** Visão do agendamento no painel. */
export interface AgendamentoPainel {
  id: string;
  codigo: string;
  barbeiro_id: string;
  servico_nome: string;
  duracao_min: number;
  preco: number;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  cliente_nome: string;
  cliente_telefone: string;
  observacao: string;
  status: StatusAgendamento;
  origem: 'CLIENTE' | 'OPERADOR';
}

export interface Usuario {
  id: string;
  nome: string;
  papel: Papel;
  barbeiro_id: string | null;
}

export type CodigoErro =
  | 'NAO_AUTORIZADO'
  | 'PROIBIDO'
  | 'VALIDACAO'
  | 'NAO_ENCONTRADO'
  | 'SLOT_INDISPONIVEL'
  | 'FORA_DA_JANELA'
  | 'LIMITE_AGENDAMENTOS'
  | 'CANCELAMENTO_FORA_DO_PRAZO'
  | 'ERRO_INTERNO';

export type StatusAgendamento =
  'AGENDADO' | 'CONFIRMADO' | 'CANCELADO' | 'CONCLUIDO' | 'NAO_COMPARECEU';

export type Papel = 'ADMIN' | 'BARBEIRO' | 'CLIENTE';

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
  horario_semana: {
    dia_semana: number;
    abre: string;
    fecha: string;
    pausa_inicio?: string;
    pausa_fim?: string;
  }[];
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
  /** Link pessoal da assinatura, quando o horário é de um plano. */
  assinatura_token?: string;
  /** Ausente nos horários de plano (já cobertos pela mensalidade). */
  pagamento?: Pagamento;
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
  /** Preenchido quando o horário usa um crédito de plano. */
  assinatura_id?: string | null;
  pagamento?: Pagamento;
  /** Conta do cliente que marcou (quando marcou logado). */
  cliente_id?: string | null;
}

export interface Usuario {
  id: string;
  nome: string;
  papel: Papel;
  barbeiro_id: string | null;
  email?: string;
  /** Só para clientes (WhatsApp, só dígitos com DDI). */
  telefone?: string;
}

/** Área do cliente: o que é dele (agendamentos e planos). */
export interface MinhaConta {
  usuario: Usuario;
  agendamentos: AgendamentoCliente[];
  assinaturas: { token: string; plano_nome: string; status: StatusAssinatura }[];
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

/* ------------------------------------------------------------- assinaturas */

export interface Plano {
  id: string;
  nome: string;
  descricao: string;
  /** Serviço que cada crédito cobre. */
  servico_id: string;
  creditos_mes: number;
  preco_mensal: number;
  /** Quanto custaria avulso (para mostrar a economia). */
  preco_avulso_mes: number;
}

export type StatusAssinatura =
  'AGUARDANDO_PAGAMENTO' | 'ATIVA' | 'PAUSADA' | 'ATRASADA' | 'CANCELADA';

/** Dia e hora fixos da semana; opcional. */
export interface HorarioFixo {
  dia_semana: number;
  hora: string;
}

export interface Assinatura {
  id: string;
  token: string;
  cliente_nome: string;
  cliente_telefone: string;
  plano_id: string;
  barbeiro_id: string;
  fixo: HorarioFixo | null;
  status: StatusAssinatura;
  inicio: string;
  /** Último mês pago, 'yyyy-MM'. */
  pago_ate: string;
  pagamento_forma?: FormaPagamento;
  /** Cobrança do mês aguardando pagamento online. */
  cobranca_pendente?: string | null;
  /** Conta do cliente dono do plano. */
  cliente_id?: string | null;
}

/** Assinatura com o uso de créditos do mês (painel). */
export interface AssinaturaPainel extends Assinatura {
  plano_nome: string;
  preco_mensal: number;
  creditos_mes: number;
  usados_mes: number;
  proximo: { data: string; hora: string } | null;
}

/** O que o assinante vê na página dele. */
export interface AssinaturaCliente {
  cliente_nome: string;
  plano: Plano;
  servico_nome: string;
  barbeiro_id: string;
  barbeiro_nome: string;
  barbeiro_foto?: string;
  fixo: HorarioFixo | null;
  status: StatusAssinatura;
  pagamento_forma: FormaPagamento;
  cobranca_pendente: string | null;
  ciclo: { de: string; ate: string };
  creditos: { total: number; usados: number; agendados: number; livres: number };
  /** Horários futuros do plano (deste ciclo e dos próximos). */
  proximos: (AgendamentoCliente & { id: string; pode_trocar: boolean })[];
  /** Até quando o assinante pode agendar (janela maior que a do público). */
  agenda_ate: string;
  antecedencia_troca_min: number;
}

/* --------------------------------------------------------------- pagamento */

/** Na barbearia (no balcão) ou online pelo gateway (Asaas). */
export type FormaPagamento = 'NA_BARBEARIA' | 'ONLINE';
export type MetodoPagamento = 'PIX' | 'CARTAO';
/**
 * A_RECEBER: vai pagar no balcão · PENDENTE: cobrança online aguardando ·
 * PAGO · ESTORNADO: pago online e depois cancelado.
 */
export type StatusPagamento = 'A_RECEBER' | 'PENDENTE' | 'PAGO' | 'ESTORNADO';

export interface Pagamento {
  forma: FormaPagamento;
  status: StatusPagamento;
  metodo?: MetodoPagamento;
  cobranca_id?: string;
}

/** Cobrança no gateway, no formato que o front usa (independente do Asaas). */
export interface Cobranca {
  id: string;
  status: 'PENDENTE' | 'PAGO' | 'VENCIDO' | 'ESTORNADO';
  valor: number;
  metodo: MetodoPagamento;
  descricao: string;
  vencimento: string;
  /** Página de pagamento do Asaas (cartão, ou Pix por lá). */
  fatura_url?: string;
  pix?: { imagem_base64?: string; copia_e_cola: string; expira_em?: string };
  /** Cobrança de demonstração (nenhum dinheiro envolvido). */
  simulada?: boolean;
  /** Assinatura: cobrança recorrente mensal. */
  recorrente?: boolean;
}

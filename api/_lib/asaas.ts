// Cliente mínimo da API v3 do Asaas. Roda SOMENTE no servidor: a chave vem da variável
// de ambiente ASAAS_API_KEY e nunca vai para o navegador nem para o repositório.
//
// ASAAS_AMBIENTE=producao usa api.asaas.com; qualquer outro valor usa a homologação
// (sandbox), que tem conta, chaves e dados separados. Chaves de sandbox começam com
// $aact_hmlg_ e as de produção com $aact_prod_.

import type { Cobranca, MetodoPagamento } from '../../src/types';

const URL_PRODUCAO = 'https://api.asaas.com/v3';
const URL_SANDBOX = 'https://api-sandbox.asaas.com/v3';

export class ErroAsaas extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function configuracao() {
  const chave = process.env.ASAAS_API_KEY;
  if (!chave) throw new ErroAsaas(500, 'ASAAS_API_KEY não configurada.');
  const producao = process.env.ASAAS_AMBIENTE === 'producao';
  // Evita misturar ambientes: chave de produção só com ASAAS_AMBIENTE=producao, e vice-versa.
  if (producao !== chave.startsWith('$aact_prod_')) {
    throw new ErroAsaas(500, 'ASAAS_AMBIENTE não combina com o tipo da ASAAS_API_KEY.');
  }
  return { chave, base: producao ? URL_PRODUCAO : URL_SANDBOX };
}

async function chamar<T>(metodo: 'GET' | 'POST', caminho: string, corpo?: unknown): Promise<T> {
  const { chave, base } = configuracao();
  const r = await fetch(`${base}${caminho}`, {
    method: metodo,
    headers: {
      access_token: chave,
      'Content-Type': 'application/json',
      'User-Agent': 'agendamento-barbearia',
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await r.text();
  const dados = texto ? JSON.parse(texto) : {};
  if (!r.ok) {
    const msg = (dados as { errors?: { description: string }[] }).errors?.[0]?.description;
    throw new ErroAsaas(r.status, msg ?? `Asaas respondeu ${r.status}.`);
  }
  return dados as T;
}

export interface PagamentoAsaas {
  id: string;
  status: string;
  value: number;
  billingType: string;
  dueDate: string;
  description?: string;
  invoiceUrl?: string;
  externalReference?: string;
  subscription?: string;
}

const TIPO: Record<MetodoPagamento, string> = { PIX: 'PIX', CARTAO: 'CREDIT_CARD' };

/** Reaproveita o cliente pelo CPF para não duplicar cadastros no Asaas. */
export async function obterOuCriarCliente(c: {
  nome: string;
  cpf: string;
  telefone: string;
  email?: string;
}): Promise<string> {
  const busca = await chamar<{ data: { id: string }[] }>(
    'GET',
    `/customers?cpfCnpj=${c.cpf}&limit=1`,
  );
  if (busca.data?.[0]) return busca.data[0].id;
  const novo = await chamar<{ id: string }>('POST', '/customers', {
    name: c.nome,
    cpfCnpj: c.cpf,
    // O Asaas espera o celular sem o 55.
    mobilePhone: c.telefone.replace(/^55/, ''),
    email: c.email || undefined,
    notificationDisabled: true,
  });
  return novo.id;
}

export function criarCobranca(p: {
  cliente: string;
  metodo: MetodoPagamento;
  valor: number;
  vencimento: string;
  descricao: string;
  referencia: string;
}) {
  return chamar<PagamentoAsaas>('POST', '/payments', {
    customer: p.cliente,
    billingType: TIPO[p.metodo],
    value: p.valor,
    dueDate: p.vencimento,
    description: p.descricao,
    externalReference: p.referencia,
  });
}

/** Assinatura mensal: o Asaas gera uma cobrança por mês automaticamente. */
export async function criarAssinatura(p: {
  cliente: string;
  metodo: MetodoPagamento;
  valor: number;
  primeiroVencimento: string;
  descricao: string;
  referencia: string;
}): Promise<{ assinaturaId: string; primeira: PagamentoAsaas }> {
  const assinatura = await chamar<{ id: string }>('POST', '/subscriptions', {
    customer: p.cliente,
    billingType: TIPO[p.metodo],
    value: p.valor,
    nextDueDate: p.primeiroVencimento,
    cycle: 'MONTHLY',
    description: p.descricao,
    externalReference: p.referencia,
  });
  const cobrancas = await chamar<{ data: PagamentoAsaas[] }>(
    'GET',
    `/subscriptions/${assinatura.id}/payments`,
  );
  const primeira = cobrancas.data?.[0];
  if (!primeira) throw new ErroAsaas(502, 'O Asaas não gerou a primeira cobrança da assinatura.');
  return { assinaturaId: assinatura.id, primeira };
}

export const consultarCobranca = (id: string) =>
  chamar<PagamentoAsaas>('GET', `/payments/${encodeURIComponent(id)}`);

export const qrCodePix = (id: string) =>
  chamar<{ encodedImage: string; payload: string; expirationDate?: string }>(
    'GET',
    `/payments/${encodeURIComponent(id)}/pixQrCode`,
  );

export const estornarCobranca = (id: string) =>
  chamar<PagamentoAsaas>('POST', `/payments/${encodeURIComponent(id)}/refund`, {});

/** Status do Asaas -> status do sistema. */
export function statusDoAsaas(s: string): Cobranca['status'] {
  if (['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(s)) return 'PAGO';
  if (s === 'OVERDUE') return 'VENCIDO';
  if (s.startsWith('REFUND') || s === 'CHARGEBACK_DONE') return 'ESTORNADO';
  return 'PENDENTE';
}

/** Converte a cobrança do Asaas para o formato do front, com o QR do Pix quando houver. */
export async function paraCobranca(p: PagamentoAsaas): Promise<Cobranca> {
  const status = statusDoAsaas(p.status);
  const metodo: MetodoPagamento = p.billingType === 'PIX' ? 'PIX' : 'CARTAO';
  const cobranca: Cobranca = {
    id: p.id,
    status,
    valor: p.value,
    metodo,
    descricao: p.description ?? '',
    vencimento: p.dueDate,
    fatura_url: p.invoiceUrl,
    recorrente: !!p.subscription,
  };
  if (metodo === 'PIX' && status === 'PENDENTE') {
    const qr = await qrCodePix(p.id);
    cobranca.pix = {
      imagem_base64: qr.encodedImage,
      copia_e_cola: qr.payload,
      expira_em: qr.expirationDate,
    };
  }
  return cobranca;
}

// Testes da integração com o Asaas sem rede: `fetch` é substituído e cada chamada é
// conferida (endereço, cabeçalhos, corpo). Nenhuma chave real é usada.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as pagamentos } from '../api/pagamentos';
import { POST as webhook } from '../api/asaas/webhook';
import { configuracao, statusDoAsaas } from '../api/_lib/asaas';

type Chamada = { url: string; init: RequestInit };
let chamadas: Chamada[] = [];
let respostas: ((c: Chamada) => unknown)[] = [];

function responder(...fns: ((c: Chamada) => unknown)[]) {
  respostas = fns;
}

beforeEach(() => {
  chamadas = [];
  process.env.ASAAS_API_KEY = '$aact_hmlg_chave_de_teste';
  process.env.ASAAS_AMBIENTE = 'sandbox';
  process.env.ASAAS_WEBHOOK_TOKEN = 'token-do-webhook-com-mais-de-32-caracteres';
  process.env.GAS_URL = 'https://script.google.com/macros/s/x/exec';
  process.env.GAS_API_SECRET = 'segredo';
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    const c = { url: String(url), init };
    chamadas.push(c);
    const fn = respostas.shift();
    if (!fn) throw new Error(`chamada inesperada: ${url}`);
    return new Response(JSON.stringify(fn(c)), { status: 200 });
  });
});
afterEach(() => vi.unstubAllGlobals());

const corpo = (c: Chamada) => JSON.parse(String(c.init.body));
const req = (action: string, payload: unknown) =>
  new Request('http://x/api/pagamentos', {
    method: 'POST',
    body: JSON.stringify({ action, payload }),
  });

describe('configuração', () => {
  it('usa a homologação por padrão e recusa chave de produção fora de produção', () => {
    expect(configuracao().base).toBe('https://api-sandbox.asaas.com/v3');
    process.env.ASAAS_API_KEY = '$aact_prod_xyz';
    expect(() => configuracao()).toThrow(/não combina/);
    process.env.ASAAS_AMBIENTE = 'producao';
    expect(configuracao().base).toBe('https://api.asaas.com/v3');
  });

  it('traduz os status do Asaas', () => {
    expect(statusDoAsaas('RECEIVED')).toBe('PAGO');
    expect(statusDoAsaas('CONFIRMED')).toBe('PAGO');
    expect(statusDoAsaas('OVERDUE')).toBe('VENCIDO');
    expect(statusDoAsaas('REFUNDED')).toBe('ESTORNADO');
    expect(statusDoAsaas('PENDING')).toBe('PENDENTE');
  });
});

describe('iniciarPagamento', () => {
  const pix = {
    id: 'pay_123',
    status: 'PENDING',
    value: 75,
    billingType: 'PIX',
    dueDate: '2026-11-17',
    description: 'Corte + Barba',
  };

  it('cobra o valor que vem do Apps Script (não do navegador) e devolve o QR do Pix', async () => {
    responder(
      () => ({
        ok: true,
        data: {
          referencia: 'ag:abc',
          valor: 75,
          descricao: 'Corte + Barba',
          cliente: { nome: 'Pedro', telefone: '5511987654321' },
        },
      }),
      () => ({ data: [] }), // busca de cliente pelo CPF
      () => ({ id: 'cus_1' }), // cria cliente
      () => pix, // cria cobrança
      () => ({ ok: true, data: null }), // registra no Apps Script
      () => ({ encodedImage: 'iVBOR', payload: '000201...', expirationDate: '2026-11-18' }),
    );
    const r = await pagamentos(
      req('iniciarPagamento', {
        tipo: 'agendamento',
        token: 'x'.repeat(40),
        metodo: 'PIX',
        cpf: '529.982.247-25',
        valor: 1,
      }),
    );
    const j = await r.json();
    expect(j.ok).toBe(true);
    expect(j.data).toMatchObject({
      id: 'pay_123',
      status: 'PENDENTE',
      valor: 75,
      pix: { copia_e_cola: '000201...' },
    });

    const [gas, busca, cliente, cobranca, registro] = chamadas;
    expect(corpo(gas)).toMatchObject({ secret: 'segredo', action: 'dadosParaCobranca' });
    expect(busca.url).toBe(
      'https://api-sandbox.asaas.com/v3/customers?cpfCnpj=52998224725&limit=1',
    );
    expect((busca.init.headers as Record<string, string>).access_token).toBe(
      '$aact_hmlg_chave_de_teste',
    );
    expect(corpo(cliente)).toMatchObject({
      name: 'Pedro',
      cpfCnpj: '52998224725',
      mobilePhone: '11987654321',
    });
    // O "valor: 1" enviado pelo navegador é ignorado.
    expect(corpo(cobranca)).toMatchObject({
      customer: 'cus_1',
      billingType: 'PIX',
      value: 75,
      externalReference: 'ag:abc',
    });
    expect(corpo(registro)).toMatchObject({
      action: 'registrarCobranca',
      payload: { referencia: 'ag:abc', cobrancaId: 'pay_123' },
    });
  });

  it('não cria outra cobrança se já existir uma para o mesmo agendamento', async () => {
    responder(
      () => ({
        ok: true,
        data: {
          referencia: 'ag:abc',
          valor: 75,
          descricao: 'x',
          cliente: { nome: 'P', telefone: '55' },
          cobranca_existente: 'pay_123',
        },
      }),
      () => ({ ...pix, status: 'RECEIVED' }),
    );
    const j = await (
      await pagamentos(
        req('iniciarPagamento', {
          tipo: 'agendamento',
          token: 'x'.repeat(40),
          metodo: 'PIX',
          cpf: '52998224725',
        }),
      )
    ).json();
    expect(j.data.status).toBe('PAGO');
    expect(chamadas).toHaveLength(2);
  });

  it('plano vira assinatura mensal no Asaas', async () => {
    responder(
      () => ({
        ok: true,
        data: {
          referencia: 'as:a1',
          valor: 250,
          descricao: 'Plano Corte + Barba',
          cliente: { nome: 'Thiago', telefone: '5511982223344' },
        },
      }),
      () => ({ data: [{ id: 'cus_9' }] }),
      () => ({ id: 'sub_1' }),
      () => ({
        data: [
          {
            id: 'pay_9',
            status: 'PENDING',
            value: 250,
            billingType: 'CREDIT_CARD',
            dueDate: '2026-11-16',
            invoiceUrl: 'https://www.asaas.com/i/9',
            subscription: 'sub_1',
          },
        ],
      }),
      () => ({ ok: true, data: null }),
    );
    const j = await (
      await pagamentos(
        req('iniciarPagamento', {
          tipo: 'assinatura',
          token: 'y'.repeat(40),
          metodo: 'CARTAO',
          cpf: '52998224725',
        }),
      )
    ).json();
    expect(corpo(chamadas[2])).toMatchObject({
      customer: 'cus_9',
      billingType: 'CREDIT_CARD',
      value: 250,
      cycle: 'MONTHLY',
    });
    expect(j.data).toMatchObject({
      id: 'pay_9',
      recorrente: true,
      fatura_url: 'https://www.asaas.com/i/9',
    });
    expect(corpo(chamadas[4]).payload.asaasAssinaturaId).toBe('sub_1');
  });

  it('valida CPF e forma de pagamento antes de chamar qualquer serviço', async () => {
    const r = await pagamentos(
      req('iniciarPagamento', {
        tipo: 'agendamento',
        token: 'x'.repeat(40),
        metodo: 'PIX',
        cpf: '111.111.111-11',
      }),
    );
    expect(r.status).toBe(422);
    expect(chamadas).toHaveLength(0);
  });
});

describe('webhook', () => {
  const evento = {
    id: 'evt_1',
    event: 'PAYMENT_RECEIVED',
    payment: { id: 'pay_123', status: 'RECEIVED', value: 75, externalReference: 'ag:abc' },
  };
  const enviar = (token: string | null, body: unknown = evento) =>
    webhook(
      new Request('http://x/api/asaas/webhook', {
        method: 'POST',
        headers: token ? { 'asaas-access-token': token } : {},
        body: JSON.stringify(body),
      }),
    );

  it('recusa sem o token certo', async () => {
    expect((await enviar(null)).status).toBe(401);
    expect((await enviar('errado')).status).toBe(401);
    expect(chamadas).toHaveLength(0);
  });

  it('repassa pagamento confirmado ao Apps Script', async () => {
    responder(() => ({ ok: true, data: null }));
    const r = await enviar('token-do-webhook-com-mais-de-32-caracteres');
    expect(r.status).toBe(200);
    expect(corpo(chamadas[0])).toMatchObject({
      action: 'processarPagamentoAsaas',
      payload: { eventoId: 'evt_1', cobrancaId: 'pay_123', status: 'PAGO', referencia: 'ag:abc' },
    });
  });

  it('responde 200 mesmo se o Apps Script falhar (o Asaas não fica reenviando)', async () => {
    responder(() => ({ ok: false, error: { code: 'ERRO_INTERNO', message: 'x' } }));
    expect((await enviar('token-do-webhook-com-mais-de-32-caracteres')).status).toBe(200);
  });
});

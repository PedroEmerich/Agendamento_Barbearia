// POST /api/asaas/webhook — o Asaas avisa aqui quando uma cobrança é paga, vence ou é estornada.
//
// O Asaas não assina o corpo: a única verificação é o token configurado no webhook, que
// chega no cabeçalho `asaas-access-token` e precisa ser igual a ASAAS_WEBHOOK_TOKEN.
// Com o token válido respondemos 200 sempre (mesmo se o Apps Script falhar), para o
// Asaas não pausar a fila de eventos; o Apps Script ignora eventos repetidos pelo id.

import { timingSafeEqual } from 'node:crypto';
import { statusDoAsaas, type PagamentoAsaas } from '../_lib/asaas';
import { chamarGas } from '../_lib/gas';

const EVENTOS = new Set([
  'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED',
  'PAYMENT_OVERDUE',
  'PAYMENT_REFUNDED',
  'PAYMENT_DELETED',
]);

function tokenValido(recebido: string | null): boolean {
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!esperado || !recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request): Promise<Response> {
  if (!tokenValido(request.headers.get('asaas-access-token'))) {
    return new Response('Não autorizado', { status: 401 });
  }
  let evento: { id?: string; event?: string; payment?: PagamentoAsaas };
  try {
    evento = await request.json();
  } catch {
    return new Response('Corpo inválido', { status: 400 });
  }
  if (evento.event && EVENTOS.has(evento.event) && evento.payment) {
    try {
      await chamarGas('processarPagamentoAsaas', {
        eventoId: evento.id ?? `${evento.event}:${evento.payment.id}`,
        evento: evento.event,
        cobrancaId: evento.payment.id,
        status:
          evento.event === 'PAYMENT_DELETED' ? 'CANCELADO' : statusDoAsaas(evento.payment.status),
        referencia: evento.payment.externalReference ?? null,
        asaasAssinaturaId: evento.payment.subscription ?? null,
        valor: evento.payment.value,
      });
    } catch (e) {
      console.error('Falha ao repassar evento do Asaas ao Apps Script', e);
    }
  }
  return new Response(JSON.stringify({ recebido: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

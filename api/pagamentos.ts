// POST /api/pagamentos — inicia e consulta pagamentos online (Asaas).
//
// O valor NUNCA vem do navegador: o servidor pergunta ao Apps Script quanto custa o
// agendamento/plano (ação interna `dadosParaCobranca`) e só então cria a cobrança.
// A confirmação definitiva chega pelo webhook (api/asaas/webhook.ts).

import { normalizarCpf } from '../src/lib/cpf';
import { agoraSP } from '../src/lib/datas';
import type { MetodoPagamento } from '../src/types';
import {
  consultarCobranca,
  criarAssinatura,
  criarCobranca,
  ErroAsaas,
  obterOuCriarCliente,
  paraCobranca,
} from './_lib/asaas';
import { chamarGas, ErroGas } from './_lib/gas';

interface DadosCobranca {
  /** 'ag:<id do agendamento>' ou 'as:<id da assinatura>' (vai como externalReference). */
  referencia: string;
  valor: number;
  descricao: string;
  cliente: { nome: string; telefone: string };
  /** Cobrança já criada antes para a mesma referência (evita cobrar duas vezes). */
  cobranca_existente?: string | null;
}

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
const erro = (code: string, message: string, status: number) =>
  json({ ok: false, error: { code, message } }, status);

export async function POST(request: Request): Promise<Response> {
  let corpo: { action?: string; payload?: Record<string, unknown> };
  try {
    corpo = await request.json();
  } catch {
    return erro('VALIDACAO', 'Corpo inválido.', 400);
  }
  const p = corpo.payload ?? {};
  try {
    if (corpo.action === 'iniciarPagamento') {
      const tipo = p.tipo;
      const metodo = p.metodo as MetodoPagamento;
      const cpf = normalizarCpf(String(p.cpf ?? ''));
      const email =
        typeof p.email === 'string' && p.email.includes('@') ? p.email.slice(0, 120) : undefined;
      if (tipo !== 'agendamento' && tipo !== 'assinatura')
        return erro('VALIDACAO', 'Tipo inválido.', 422);
      if (metodo !== 'PIX' && metodo !== 'CARTAO')
        return erro('VALIDACAO', 'Forma de pagamento inválida.', 422);
      if (!cpf) return erro('VALIDACAO', 'Informe um CPF válido.', 422);
      if (typeof p.token !== 'string' || p.token.length < 16)
        return erro('VALIDACAO', 'Link inválido.', 422);

      const dados = await chamarGas<DadosCobranca>('dadosParaCobranca', { tipo, token: p.token });
      if (dados.cobranca_existente) {
        return json({
          ok: true,
          data: await paraCobranca(await consultarCobranca(dados.cobranca_existente)),
        });
      }
      const cliente = await obterOuCriarCliente({
        nome: dados.cliente.nome,
        cpf,
        telefone: dados.cliente.telefone,
        email,
      });
      const hoje = agoraSP().data;
      let pagamento;
      let asaasAssinaturaId: string | undefined;
      if (tipo === 'agendamento') {
        pagamento = await criarCobranca({
          cliente,
          metodo,
          valor: dados.valor,
          vencimento: hoje,
          descricao: dados.descricao,
          referencia: dados.referencia,
        });
      } else {
        const r = await criarAssinatura({
          cliente,
          metodo,
          valor: dados.valor,
          primeiroVencimento: hoje,
          descricao: dados.descricao,
          referencia: dados.referencia,
        });
        pagamento = r.primeira;
        asaasAssinaturaId = r.assinaturaId;
      }
      await chamarGas('registrarCobranca', {
        referencia: dados.referencia,
        cobrancaId: pagamento.id,
        metodo,
        asaasAssinaturaId,
      });
      return json({ ok: true, data: await paraCobranca(pagamento) });
    }

    if (corpo.action === 'consultarPagamento') {
      if (typeof p.id !== 'string' || !/^[\w-]{6,64}$/.test(p.id))
        return erro('VALIDACAO', 'Cobrança inválida.', 422);
      return json({ ok: true, data: await paraCobranca(await consultarCobranca(p.id)) });
    }

    return erro('VALIDACAO', 'Ação desconhecida.', 400);
  } catch (e) {
    if (e instanceof ErroGas)
      return erro(e.code, e.message, e.code === 'NAO_ENCONTRADO' ? 404 : 400);
    if (e instanceof ErroAsaas) {
      console.error('Asaas', e.status, e.message);
      return erro(
        'PAGAMENTO',
        'Não foi possível gerar o pagamento agora. Tente de novo ou pague na barbearia.',
        502,
      );
    }
    console.error(e);
    return erro('ERRO_INTERNO', 'Algo deu errado.', 500);
  }
}

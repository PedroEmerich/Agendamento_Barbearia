// Chamada servidor-a-servidor ao Apps Script (o "banco" do sistema), com o segredo
// compartilhado no corpo, como define a especificação (seção 5.2).

export class ErroGas extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function chamarGas<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  const url = process.env.GAS_URL;
  const secret = process.env.GAS_API_SECRET;
  if (!url || !secret)
    throw new ErroGas('CONFIGURACAO', 'GAS_URL/GAS_API_SECRET não configurados.');
  const controle = new AbortController();
  const limite = setTimeout(() => controle.abort(), 25_000);
  try {
    const r = await fetch(url, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ secret, action, payload, authToken: null }),
      signal: controle.signal,
    });
    const corpo = (await r.json()) as {
      ok: boolean;
      data?: T;
      error?: { code: string; message: string };
    };
    if (!corpo.ok)
      throw new ErroGas(
        corpo.error?.code ?? 'ERRO_INTERNO',
        corpo.error?.message ?? 'Erro no Apps Script.',
      );
    return corpo.data as T;
  } finally {
    clearTimeout(limite);
  }
}

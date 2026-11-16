// Componentes de pagamento: escolha da forma, painel da cobrança (Pix/cartão) e selo de status.

import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { mascararCpf, normalizarCpf } from '../lib/cpf';
import { formatarPreco } from '../lib/datas';
import type { Cobranca, FormaPagamento, MetodoPagamento, Pagamento } from '../types';
import { IconeCheck } from './ui';

export interface EscolhaPagamentoValor {
  forma: FormaPagamento;
  metodo: MetodoPagamento;
  cpf: string;
  email: string;
}

export const ESCOLHA_INICIAL: EscolhaPagamentoValor = {
  forma: 'NA_BARBEARIA',
  metodo: 'PIX',
  cpf: '',
  email: '',
};

export function escolhaValida(v: EscolhaPagamentoValor): boolean {
  return v.forma === 'NA_BARBEARIA' || normalizarCpf(v.cpf) !== null;
}

function Cartao({
  ativo,
  onClick,
  titulo,
  texto,
}: {
  ativo: boolean;
  onClick: () => void;
  titulo: string;
  texto: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={ativo}
      onClick={onClick}
      className={`flex cursor-pointer items-start gap-2.5 rounded-2xl border p-3 text-left transition sm:gap-3 sm:p-4 ${
        ativo
          ? 'border-gold-400/70 bg-gold-400/[0.08]'
          : 'border-white/10 bg-white/[0.02] hover:border-white/25'
      }`}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          ativo ? 'border-gold-300 bg-gold-400 text-ink-950' : 'border-white/25'
        }`}
      >
        {ativo && <IconeCheck width={12} height={12} />}
      </span>
      <span>
        <span className="block font-semibold text-zinc-50">{titulo}</span>
        <span className="mt-0.5 block text-xs text-zinc-400 sm:text-sm">{texto}</span>
      </span>
    </button>
  );
}

/** Escolha entre pagar no balcão ou online (Pix/cartão pelo Asaas). */
export function EscolhaPagamento({
  valor,
  onMudar,
  recorrente = false,
}: {
  valor: EscolhaPagamentoValor;
  onMudar: (v: EscolhaPagamentoValor) => void;
  /** Plano: a cobrança online é mensal. */
  recorrente?: boolean;
}) {
  const cpfInvalido = valor.cpf.replace(/\D/g, '').length === 11 && !normalizarCpf(valor.cpf);
  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-sm font-medium text-zinc-200">Pagamento</legend>
      <div role="radiogroup" aria-label="Forma de pagamento" className="grid grid-cols-2 gap-2">
        <Cartao
          ativo={valor.forma === 'NA_BARBEARIA'}
          onClick={() => onMudar({ ...valor, forma: 'NA_BARBEARIA' })}
          titulo="Pagar na barbearia"
          texto={
            recorrente
              ? 'Paga a mensalidade no balcão; o plano ativa quando recebermos.'
              : 'Dinheiro, cartão ou Pix na hora.'
          }
        />
        <Cartao
          ativo={valor.forma === 'ONLINE'}
          onClick={() => onMudar({ ...valor, forma: 'ONLINE' })}
          titulo="Pagar agora"
          texto={
            recorrente
              ? 'Pix ou cartão, cobrado todo mês automaticamente.'
              : 'Pix ou cartão, já fica tudo certo.'
          }
        />
      </div>

      {valor.forma === 'ONLINE' && (
        <div className="animate-entrar space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div
            role="radiogroup"
            aria-label="Método"
            className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1"
          >
            {(['PIX', 'CARTAO'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={valor.metodo === m}
                onClick={() => onMudar({ ...valor, metodo: m })}
                className={`min-h-9 cursor-pointer rounded-full px-4 text-sm font-semibold transition ${
                  valor.metodo === m
                    ? 'bg-gold-400 text-ink-950'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                {m === 'PIX' ? 'Pix' : 'Cartão de crédito'}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1.5 block text-zinc-300">CPF</span>
              <input
                className="campo"
                inputMode="numeric"
                autoComplete="off"
                placeholder="000.000.000-00"
                value={valor.cpf}
                onChange={(e) => onMudar({ ...valor, cpf: mascararCpf(e.target.value) })}
                aria-invalid={cpfInvalido}
                aria-describedby="cpf-ajuda"
              />
              <span
                id="cpf-ajuda"
                className={`mt-1.5 block text-xs ${cpfInvalido ? 'text-amber-300' : 'text-zinc-500'}`}
              >
                {cpfInvalido ? 'CPF inválido.' : 'Exigido pelo banco para emitir a cobrança.'}
              </span>
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block text-zinc-300">
                E-mail <span className="text-zinc-500">(opcional, para o recibo)</span>
              </span>
              <input
                className="campo"
                type="email"
                autoComplete="email"
                value={valor.email}
                onChange={(e) => onMudar({ ...valor, email: e.target.value })}
              />
            </label>
          </div>
          <p className="text-xs text-zinc-500">
            Pagamento processado pelo Asaas.{' '}
            {valor.metodo === 'CARTAO'
              ? 'Os dados do cartão são digitados na página segura do Asaas, não aqui.'
              : 'O QR Code aparece na próxima tela.'}
          </p>
        </div>
      )}
    </fieldset>
  );
}

/* ------------------------------------------------------------- painel da cobrança */

/** QR "de mentira" para a demonstração (parece um QR, mas não é pagável). */
function QrSimulado({ texto }: { texto: string }) {
  const n = 25;
  const celulas = useMemo(() => {
    let h = 2166136261;
    const bits: boolean[] = [];
    for (let i = 0; i < n * n; i++) {
      h = Math.imul(h ^ texto.charCodeAt(i % texto.length), 16777619) >>> 0;
      bits.push((h & 7) < 3);
    }
    return bits;
  }, [texto]);
  const localizador = (x: number, y: number) => (r: number, c: number) =>
    r >= y && r < y + 7 && c >= x && c < x + 7;
  const finders = [localizador(0, 0), localizador(n - 7, 0), localizador(0, n - 7)];
  return (
    <svg
      viewBox={`-2 -2 ${n + 4} ${n + 4}`}
      className="h-full w-full"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <rect x="-2" y="-2" width={n + 4} height={n + 4} fill="#fff" />
      {celulas.map((on, i) => {
        const r = Math.floor(i / n);
        const c = i % n;
        if (finders.some((f) => f(r, c))) return null;
        return on ? <rect key={i} x={c} y={r} width="1" height="1" fill="#111" /> : null;
      })}
      {[
        [0, 0],
        [n - 7, 0],
        [0, n - 7],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width="7" height="7" fill="#111" />
          <rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" />
          <rect x={x + 2} y={y + 2} width="3" height="3" fill="#111" />
        </g>
      ))}
    </svg>
  );
}

/**
 * Mostra a cobrança e acompanha o status sozinho (a cada 4 s) até ser paga.
 * Pix: QR + copia e cola. Cartão: botão para a página segura do Asaas.
 */
export function PainelPagamento({
  cobranca: inicial,
  onPago,
}: {
  cobranca: Cobranca;
  onPago?: () => void;
}) {
  const [c, setC] = useState(inicial);
  const [copiado, setCopiado] = useState(false);
  const [simulando, setSimulando] = useState(false);

  useEffect(() => setC(inicial), [inicial]);

  useEffect(() => {
    if (c.status !== 'PENDENTE') return;
    const id = setInterval(async () => {
      if (document.hidden) return;
      try {
        const nova = await api.consultarPagamento(c.id);
        setC(nova);
        if (nova.status === 'PAGO') onPago?.();
      } catch {
        // tenta de novo no próximo ciclo
      }
    }, 4000);
    return () => clearInterval(id);
  }, [c.id, c.status, onPago]);

  async function copiar() {
    if (!c.pix) return;
    try {
      await navigator.clipboard.writeText(c.pix.copia_e_cola);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      window.prompt('Copie o código Pix:', c.pix.copia_e_cola);
    }
  }

  async function simular() {
    setSimulando(true);
    try {
      setC(await api.simularPagamento(c.id));
      onPago?.();
    } finally {
      setSimulando(false);
    }
  }

  if (c.status === 'PAGO') {
    return (
      <div
        role="status"
        className="flex animate-entrar items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-left"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-ink-950">
          <IconeCheck width={20} height={20} />
        </span>
        <span>
          <span className="block font-semibold text-emerald-100">Pagamento confirmado</span>
          <span className="text-sm text-emerald-200/80">
            {formatarPreco(c.valor)} via {c.metodo === 'PIX' ? 'Pix' : 'cartão'}
            {c.recorrente && ' · próximas cobranças todo mês'}
          </span>
        </span>
      </div>
    );
  }

  return (
    <div className="card p-5 text-left">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-zinc-50">
            {c.metodo === 'PIX' ? 'Pague com Pix' : 'Pague com cartão'}
          </p>
          <p className="text-sm text-zinc-400">{c.descricao}</p>
        </div>
        <p className="font-display text-2xl font-bold text-gold-200">{formatarPreco(c.valor)}</p>
      </div>

      {c.status === 'VENCIDO' && (
        <p className="mt-3 rounded-xl bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
          Esta cobrança venceu. Fale com a barbearia ou pague no balcão.
        </p>
      )}

      {c.metodo === 'PIX' && c.pix && (
        <div className="mt-4 grid items-center gap-4 sm:grid-cols-[10rem_1fr]">
          <div className="mx-auto h-40 w-40 overflow-hidden rounded-2xl bg-white p-1.5">
            {c.pix.imagem_base64 ? (
              <img
                src={`data:image/png;base64,${c.pix.imagem_base64}`}
                alt="QR Code do Pix"
                className="h-full w-full"
              />
            ) : (
              <QrSimulado texto={c.pix.copia_e_cola} />
            )}
          </div>
          <div className="min-w-0 space-y-2">
            <p className="text-sm text-zinc-400">
              Abra o app do banco, escolha Pix e leia o QR Code, ou copie o código:
            </p>
            <p className="truncate rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-xs text-zinc-400">
              {c.pix.copia_e_cola}
            </p>
            <button type="button" className="btn-gold w-full" onClick={copiar}>
              {copiado ? 'Código copiado!' : 'Copiar código Pix'}
            </button>
          </div>
        </div>
      )}

      {c.metodo === 'CARTAO' && (
        <div className="mt-4 space-y-2">
          {c.fatura_url ? (
            <a href={c.fatura_url} target="_blank" rel="noreferrer" className="btn-gold w-full">
              Pagar com cartão (página segura do Asaas)
            </a>
          ) : (
            <p className="text-sm text-zinc-400">
              Na versão real, este botão abre a página segura do Asaas para digitar o cartão.
            </p>
          )}
          {c.recorrente && (
            <p className="text-xs text-zinc-500">
              As próximas mensalidades são cobradas automaticamente.
            </p>
          )}
        </div>
      )}

      <p className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
        <span className="h-2 w-2 animate-pulse rounded-full bg-gold-300" /> Aguardando a confirmação
        do pagamento…
      </p>

      {c.simulada && (
        <div className="mt-4 rounded-2xl border border-dashed border-gold-400/40 p-3 text-center">
          <p className="text-xs text-gold-200/80">
            Demonstração: nenhum valor é cobrado. Simule a confirmação do Asaas:
          </p>
          <button type="button" className="btn-ghost mt-2" onClick={simular} disabled={simulando}>
            {simulando ? 'Confirmando…' : 'Simular pagamento aprovado'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- selo */

const ROTULO: Record<Pagamento['status'], string> = {
  A_RECEBER: 'Pagar no local',
  PENDENTE: 'Aguardando pagamento',
  PAGO: 'Pago',
  ESTORNADO: 'Estornado',
};
const CLASSE: Record<Pagamento['status'], string> = {
  A_RECEBER: 'border-white/15 bg-white/[0.04] text-zinc-300',
  PENDENTE: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  PAGO: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  ESTORNADO: 'border-red-400/40 bg-red-400/10 text-red-200',
};

export function SeloPagamento({ pagamento }: { pagamento?: Pagamento }) {
  if (!pagamento) return null;
  const metodo =
    pagamento.status === 'PAGO' && pagamento.forma === 'ONLINE'
      ? pagamento.metodo === 'CARTAO'
        ? ' · cartão'
        : ' · Pix'
      : '';
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold whitespace-nowrap ${CLASSE[pagamento.status]}`}
    >
      {ROTULO[pagamento.status]}
      {metodo}
    </span>
  );
}

export function rotuloPagamento(p?: Pagamento): string {
  if (!p) return 'Plano';
  return `${ROTULO[p.status]}${p.forma === 'ONLINE' && p.metodo ? ` (${p.metodo === 'PIX' ? 'Pix' : 'cartão'})` : ''}`;
}

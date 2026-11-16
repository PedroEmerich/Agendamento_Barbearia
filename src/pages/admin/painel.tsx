// Estrutura do painel: verifica a sessão, carrega o usuário e mostra a navegação
// (barra lateral no computador, barra inferior no celular).

import { useEffect, useState, type ReactNode, type SVGProps } from 'react';
import { Navigate, NavLink, Outlet, useNavigate, useOutletContext } from 'react-router-dom';
import { FotoBarbeiro, IconeCheck, IconeWhatsapp, SeloStatus } from '../../components/ui';
import { SeloPagamento } from '../../components/Pagamento';
import { api, MODO_DEMO, sessao } from '../../lib/api';
import { sair as sairDaConta } from '../../lib/conta';
import { agoraSP, diaSemana, formatarPreco, somarDias } from '../../lib/datas';
import { formatarTelefone } from '../../lib/telefone';
import { useConsulta } from '../../lib/useConsulta';
import type {
  AgendamentoPainel,
  Barbeiro,
  ConfigPublica,
  StatusAgendamento,
  Usuario,
} from '../../types';

export interface ContextoPainel {
  usuario: Usuario;
  barbeiros: Barbeiro[];
  config: ConfigPublica;
  /** O barbeiro logado (null para o administrador). */
  eu: Barbeiro | null;
  ehAdmin: boolean;
  nomeBarbeiro: (id: string) => string;
  /** Hoje, ou o próximo dia de funcionamento se hoje a barbearia não abre. */
  proximoDiaAberto: (aPartir: string) => string;
  diaAberto: (data: string) => boolean;
}

export const usePainel = () => useOutletContext<ContextoPainel>();

/* ------------------------------------------------------------------ ícones */

function Svg({ children, ...p }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...p}
    >
      {children}
    </svg>
  );
}
export const IconeInicio = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z" />
  </Svg>
);
export const IconeAgenda = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M8 3v4M16 3v4M3.5 10h17M8 14h3M8 17h6" />
  </Svg>
);
export const IconeRelatorio = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Svg>
);
export const IconeSair = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3" />
  </Svg>
);
export const IconeCoroa = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5Z" />
  </Svg>
);
export const IconeDownload = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M12 3v12M7 10l5 5 5-5M4 21h16" />
  </Svg>
);

const NAV = [
  { para: '/admin', rotulo: 'Início', Icone: IconeInicio, fim: true },
  { para: '/admin/agenda', rotulo: 'Agenda', Icone: IconeAgenda, fim: false },
  { para: '/admin/assinantes', rotulo: 'Assinantes', Icone: IconeCoroa, fim: false },
  { para: '/admin/relatorios', rotulo: 'Relatórios', Icone: IconeRelatorio, fim: false },
];

/* ---------------------------------------------------------- cartão de horário */

const ACOES: { status: StatusAgendamento; rotulo: string; de: StatusAgendamento[] }[] = [
  { status: 'CONFIRMADO', rotulo: 'Confirmar', de: ['AGENDADO'] },
  { status: 'CONCLUIDO', rotulo: 'Concluir', de: ['AGENDADO', 'CONFIRMADO'] },
  { status: 'NAO_COMPARECEU', rotulo: 'Não veio', de: ['AGENDADO', 'CONFIRMADO'] },
  { status: 'CANCELADO', rotulo: 'Cancelar', de: ['AGENDADO', 'CONFIRMADO'] },
];

export const COR_STATUS: Record<StatusAgendamento, string> = {
  AGENDADO: 'bg-sky-400',
  CONFIRMADO: 'bg-emerald-400',
  CANCELADO: 'bg-red-400',
  CONCLUIDO: 'bg-zinc-500',
  NAO_COMPARECEU: 'bg-amber-400',
};

export function CartaoAgendamento({
  a,
  onMudar,
  ocupado,
  barbeiro,
  destaque,
}: {
  a: AgendamentoPainel;
  onMudar: (status: StatusAgendamento) => void;
  ocupado: boolean;
  /** Mostra o barbeiro no cartão (visão do administrador com um barbeiro só). */
  barbeiro?: Barbeiro;
  destaque?: string;
}) {
  const acoes = ACOES.filter((x) => x.de.includes(a.status));
  return (
    <li
      className={`card relative overflow-hidden p-4 pl-5 transition hover:border-white/15 ${
        a.status === 'CANCELADO' ? 'opacity-50' : ''
      } ${destaque ? '!border-gold-400/50 shadow-[0_0_40px_-15px_#d4a94e]' : ''}`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-3 left-0 w-1 rounded-r-full ${COR_STATUS[a.status]}`}
      />
      {destaque && (
        <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-gold-400/15 px-2.5 py-0.5 text-[0.65rem] font-semibold tracking-wider text-gold-200 uppercase">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold-300" /> {destaque}
        </span>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-lg font-bold text-gold-300">
            {a.hora_inicio}{' '}
            <span className="text-sm font-medium text-zinc-500">– {a.hora_fim}</span>
          </p>
          <p className="truncate font-semibold text-zinc-50">{a.cliente_nome}</p>
          <p className="text-sm text-zinc-400">
            {a.servico_nome} · {a.assinatura_id ? 'Plano' : formatarPreco(a.preco)}
            {barbeiro && <> · {barbeiro.nome}</>}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <SeloStatus status={a.status} />
          {a.assinatura_id ? <SeloPlano /> : <SeloPagamento pagamento={a.pagamento} />}
        </div>
      </div>
      {a.observacao && <p className="mt-2 text-sm text-zinc-400 italic">“{a.observacao}”</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {acoes.map((x) => (
          <button
            key={x.status}
            disabled={ocupado}
            onClick={() => onMudar(x.status)}
            className={`min-h-9 cursor-pointer rounded-full border px-3 text-xs font-semibold transition disabled:opacity-40 ${
              x.status === 'CANCELADO'
                ? 'border-red-500/40 text-red-300 hover:bg-red-500/10'
                : x.status === 'CONCLUIDO'
                  ? 'border-gold-400/40 bg-gold-400/10 text-gold-100 hover:bg-gold-400/20'
                  : 'border-white/10 bg-white/[0.03] text-zinc-200 hover:border-gold-400 hover:text-gold-300'
            }`}
          >
            {x.status === 'CONCLUIDO' && (
              <IconeCheck width={12} height={12} className="mr-1 inline" />
            )}
            {x.rotulo}
          </button>
        ))}
        <a
          href={`https://wa.me/${a.cliente_telefone}`}
          target="_blank"
          rel="noreferrer"
          aria-label={`Abrir conversa com ${a.cliente_nome} — ${formatarTelefone(a.cliente_telefone)}`}
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-emerald-300 hover:border-emerald-400"
        >
          <IconeWhatsapp width={18} height={18} />
        </a>
      </div>
    </li>
  );
}

/** Selo de assinante (coroa + "Plano"). */
export function SeloPlano() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-gold-400/50 bg-gold-400/15 px-2 py-0.5 text-[0.7rem] font-semibold text-gold-100">
      <IconeCoroa width={12} height={12} /> Plano
    </span>
  );
}

/* ------------------------------------------------------- controle segmentado */

export function Segmentado<T extends string>({
  opcoes,
  valor,
  onMudar,
  rotulo,
}: {
  opcoes: { valor: T; rotulo: ReactNode }[];
  valor: T;
  onMudar: (v: T) => void;
  rotulo: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={rotulo}
      className="sem-barra inline-flex max-w-full overflow-x-auto rounded-full border border-white/10 bg-white/[0.03] p-1"
    >
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={valor === o.valor}
          onClick={() => onMudar(o.valor)}
          className={`min-h-9 shrink-0 cursor-pointer rounded-full px-3.5 text-xs font-semibold whitespace-nowrap transition sm:text-sm ${
            valor === o.valor
              ? 'bg-gold-400 text-ink-950 shadow'
              : 'text-zinc-400 hover:text-zinc-100'
          }`}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

/** Chips de barbeiro para o administrador filtrar (Todos + cada barbeiro). */
export function FiltroBarbeiro({
  valor,
  onMudar,
}: {
  valor: string;
  onMudar: (v: string) => void;
}) {
  const { barbeiros, ehAdmin } = usePainel();
  if (!ehAdmin) return null;
  return (
    <div
      className="sem-barra -mx-4 flex gap-2 overflow-x-auto px-4"
      role="radiogroup"
      aria-label="Barbeiro"
    >
      {[{ id: '', nome: 'Todos', foto_url: undefined as string | undefined }, ...barbeiros].map(
        (b) => (
          <button
            key={b.id || 'todos'}
            type="button"
            role="radio"
            aria-checked={valor === b.id}
            onClick={() => onMudar(b.id)}
            className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-full border py-1 pr-4 pl-1 text-sm font-semibold transition ${
              valor === b.id
                ? 'border-gold-400/70 bg-gold-400/15 text-gold-100'
                : 'border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/25'
            } ${b.id ? '' : 'pl-4'}`}
          >
            {b.id && <FotoBarbeiro nome={b.nome} foto={b.foto_url} tamanho="h-7 w-7" />}
            {b.nome}
          </button>
        ),
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ layout */

export function saudacao(): string {
  const h = Math.floor(agoraSP().minutos / 60);
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

export default function LayoutPainel() {
  const navegar = useNavigate();
  const autenticado = sessao.ler() !== null;
  const usuario = useConsulta(autenticado ? api.me : null, []);
  const barbeiros = useConsulta(autenticado ? () => api.listarBarbeiros() : null, []);
  const config = useConsulta(autenticado ? api.getConfigPublica : null, []);
  const [, forcar] = useState(0);

  // Atualiza a saudação/horários ao virar a hora.
  useEffect(() => {
    const id = setInterval(() => forcar((v) => v + 1), 5 * 60_000);
    return () => clearInterval(id);
  }, []);

  if (!autenticado || usuario.erro) {
    sairDaConta();
    return <Navigate to="/entrar?voltar=/admin" replace />;
  }
  // Cliente logado não entra no painel: vai para a área dele.
  if (usuario.dados?.papel === 'CLIENTE') return <Navigate to="/minha-conta" replace />;

  const sair = () => {
    sairDaConta();
    navegar('/entrar');
  };

  const pronto = usuario.dados && barbeiros.dados && config.dados;
  let contexto: ContextoPainel | null = null;
  if (pronto) {
    const u = usuario.dados!;
    const bs = barbeiros.dados!;
    const c = config.dados!;
    const diaAberto = (d: string) => c.horario_semana.some((h) => h.dia_semana === diaSemana(d));
    contexto = {
      usuario: u,
      barbeiros: bs,
      config: c,
      eu: bs.find((b) => b.id === u.barbeiro_id) ?? null,
      ehAdmin: u.papel === 'ADMIN',
      nomeBarbeiro: (id) => bs.find((b) => b.id === id)?.nome ?? '—',
      diaAberto,
      proximoDiaAberto: (de) => {
        for (let i = 0; i < 8; i++) if (diaAberto(somarDias(de, i))) return somarDias(de, i);
        return de;
      },
    };
  }
  const eu = contexto?.eu;

  const linkClasse = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
      isActive
        ? 'bg-gold-400/15 text-gold-100 shadow-[inset_0_0_0_1px_rgb(212_169_78/0.35)]'
        : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100'
    }`;

  const cartaoUsuario = usuario.dados && (
    <div className="flex items-center gap-3">
      {eu ? (
        <FotoBarbeiro nome={eu.nome} foto={eu.foto_url} tamanho="h-10 w-10" />
      ) : (
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-gold-400/40 bg-ink-800">
          <img src={`${import.meta.env.BASE_URL}marca/leao.webp`} alt="" className="h-7 w-auto" />
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-zinc-50">
          {usuario.dados.nome}
        </span>
        <span className="block text-xs text-zinc-500">{eu ? 'Barbeiro' : 'Administrador'}</span>
      </span>
    </div>
  );

  return (
    <div className="grao relative min-h-dvh lg:pl-72">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -top-40 left-1/2 h-96 w-[60rem] -translate-x-1/2 rounded-full bg-gold-500/10 blur-[120px]"
      />

      {/* Barra lateral (computador) */}
      <aside className="vidro fixed inset-y-3 left-3 z-30 hidden w-66 flex-col rounded-3xl !bg-ink-950/60 p-5 lg:flex">
        <img
          src={`${import.meta.env.BASE_URL}marca/logo.webp`}
          alt="Underground Barbershop"
          className="mx-auto mt-2 w-36"
        />
        <p className="mt-3 text-center text-[0.65rem] tracking-[0.3em] text-zinc-500 uppercase">
          Painel
        </p>
        <nav aria-label="Painel" className="mt-8 flex flex-col gap-1">
          {NAV.map(({ para, rotulo, Icone, fim }) => (
            <NavLink key={para} to={para} end={fim} className={linkClasse}>
              <Icone /> {rotulo}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-4 border-t border-white/[0.07] pt-5">
          {cartaoUsuario}
          <button onClick={sair} className="btn-ghost w-full">
            <IconeSair width={16} height={16} /> Sair
          </button>
        </div>
      </aside>

      {/* Topo (celular) */}
      <header className="vidro sticky top-0 z-30 flex items-center justify-between border-x-0 border-t-0 !bg-ink-950/70 px-4 py-2.5 lg:hidden">
        {cartaoUsuario}
        <button onClick={sair} className="btn-ghost h-10 w-10 px-0" aria-label="Sair">
          <IconeSair width={18} height={18} />
        </button>
      </header>

      {MODO_DEMO && (
        <p className="relative mx-4 mt-4 rounded-full border border-gold-400/20 bg-gold-400/10 px-4 py-1.5 text-center text-[0.7rem] font-medium text-gold-200 lg:mx-8">
          Painel demonstrativo · dados simulados, guardados só neste aparelho.
        </p>
      )}

      <main className="relative mx-auto max-w-6xl px-4 pt-6 pb-28 lg:px-8 lg:pb-12">
        {contexto ? (
          <Outlet context={contexto} />
        ) : (
          <div className="space-y-4" aria-busy="true">
            <div className="skeleton h-10 w-64" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-28" />
              ))}
            </div>
            <div className="skeleton h-80" />
          </div>
        )}
      </main>

      {/* Navegação inferior (celular) */}
      <nav
        aria-label="Painel"
        className="vidro fixed inset-x-3 bottom-3 z-30 grid grid-cols-4 rounded-3xl !bg-ink-950/75 p-1.5 lg:hidden"
      >
        {NAV.map(({ para, rotulo, Icone, fim }) => (
          <NavLink
            key={para}
            to={para}
            end={fim}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 rounded-2xl py-2 text-[0.7rem] font-semibold transition ${
                isActive ? 'bg-gold-400/15 text-gold-200' : 'text-zinc-500'
              }`
            }
          >
            <Icone width={20} height={20} />
            {rotulo}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

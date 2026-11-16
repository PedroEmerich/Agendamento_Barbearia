import { useEffect, useMemo, useRef, useState } from 'react';
import { ErroCaixa, FotoBarbeiro, Skeletons } from '../../components/ui';
import { api } from '../../lib/api';
import {
  agoraSP,
  formatarDataLonga,
  formatarPreco,
  hhmmParaMin,
  nomeDiaCurto,
  somarDias,
} from '../../lib/datas';
import { resumir } from '../../lib/relatorios';
import { useConsulta } from '../../lib/useConsulta';
import type { AgendamentoPainel, StatusAgendamento } from '../../types';
import { CartaoAgendamento, FiltroBarbeiro, usePainel } from './painel';

/** Quantos dias à frente o calendário deixa escolher. */
const DIAS_A_FRENTE = 60;
const DIAS_NA_FAIXA = 14;

export default function Agenda() {
  const { eu, ehAdmin, barbeiros, diaAberto, proximoDiaAberto } = usePainel();
  const hoje = agoraSP().data;
  const limite = somarDias(hoje, DIAS_A_FRENTE);
  // Se hoje a barbearia não abre, começa no próximo dia de trabalho.
  const [data, setData] = useState(() => proximoDiaAberto(hoje));
  const [filtro, setFiltro] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const faixa = useRef<HTMLDivElement>(null);

  // Uma consulta cobre a faixa de dias; outra, o dia escolhido (pode estar além da faixa).
  const fimFaixa = somarDias(hoje, DIAS_NA_FAIXA - 1);
  const periodo = useConsulta(
    () => api.listarAgendamentosPeriodo(hoje, fimFaixa),
    [hoje, fimFaixa],
  );
  const dia = useConsulta(() => api.listarAgendamentos(data), [data]);

  const { recarregar } = dia;
  const recarregarPeriodo = periodo.recarregar;
  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden) return;
      recarregar();
      recarregarPeriodo();
    }, 60_000);
    return () => clearInterval(id);
  }, [recarregar, recarregarPeriodo]);

  // Mantém o dia escolhido visível na faixa.
  useEffect(() => {
    const el = faixa.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (el && faixa.current) {
      faixa.current.scrollTo({
        left: el.offsetLeft - faixa.current.clientWidth / 2 + el.offsetWidth / 2,
        behavior: 'smooth',
      });
    }
  }, [data]);

  const contagem = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of periodo.dados ?? []) {
      if (a.status === 'CANCELADO' || (filtro && a.barbeiro_id !== filtro)) continue;
      m.set(a.data, (m.get(a.data) ?? 0) + 1);
    }
    return m;
  }, [periodo.dados, filtro]);

  function irPara(d: string) {
    if (d < hoje) d = hoje;
    if (d > limite) d = limite;
    setData(d);
  }

  async function mudar(id: string, status: StatusAgendamento) {
    setOcupado(id);
    setErroAcao(null);
    try {
      await api.atualizarStatus(id, status);
      recarregar();
      recarregarPeriodo();
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Não foi possível atualizar.');
    } finally {
      setOcupado(null);
    }
  }

  const itens = (dia.dados ?? []).filter((a) => !filtro || a.barbeiro_id === filtro);
  const r = resumir(itens);
  const confirmados = itens.filter((a) => a.status === 'CONFIRMADO').length;
  const agora = agoraSP();
  // O próximo cliente do dia recebe destaque (só faz sentido hoje).
  const proximoId =
    data === hoje
      ? itens.find(
          (a) =>
            (a.status === 'AGENDADO' || a.status === 'CONFIRMADO') &&
            hhmmParaMin(a.hora_fim) > agora.minutos,
        )?.id
      : undefined;

  const colunas = ehAdmin && !filtro ? barbeiros : null;
  const lista = (xs: AgendamentoPainel[], mostrarBarbeiro: boolean) =>
    xs.length === 0 ? (
      <p className="card py-10 text-center text-sm text-zinc-500">
        {diaAberto(data) ? 'Nenhum horário marcado.' : 'A barbearia não abre neste dia.'}
      </p>
    ) : (
      <ul className="space-y-3">
        {xs.map((a) => (
          <CartaoAgendamento
            key={a.id}
            a={a}
            ocupado={ocupado === a.id}
            onMudar={(s) => mudar(a.id, s)}
            barbeiro={mostrarBarbeiro ? barbeiros.find((b) => b.id === a.barbeiro_id) : undefined}
            destaque={a.id === proximoId ? 'Próximo cliente' : undefined}
          />
        ))}
      </ul>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{eu ? 'Minha agenda' : 'Agenda da barbearia'}</p>
          <h1 className="titulo mt-3 first-letter:uppercase">{formatarDataLonga(data)}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-ghost h-11 w-11 px-0"
            onClick={() => irPara(somarDias(data, -1))}
            disabled={data <= hoje}
            aria-label="Dia anterior"
          >
            ‹
          </button>
          <input
            type="date"
            className="campo w-auto [color-scheme:dark]"
            value={data}
            min={hoje}
            max={limite}
            onChange={(e) => e.target.value && irPara(e.target.value)}
            aria-label="Escolher data"
          />
          <button
            className="btn-ghost h-11 w-11 px-0"
            onClick={() => irPara(somarDias(data, 1))}
            disabled={data >= limite}
            aria-label="Próximo dia"
          >
            ›
          </button>
        </div>
      </div>

      {/* Faixa dos próximos dias com a quantidade de horários */}
      <div ref={faixa} className="sem-barra -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {Array.from({ length: DIAS_NA_FAIXA }, (_, i) => somarDias(hoje, i)).map((d) => {
          const aberto = diaAberto(d);
          const n = contagem.get(d) ?? 0;
          const sel = d === data;
          return (
            <button
              key={d}
              type="button"
              aria-pressed={sel}
              onClick={() => irPara(d)}
              className={`flex w-16 shrink-0 cursor-pointer flex-col items-center rounded-2xl border py-2.5 transition ${
                sel
                  ? 'border-gold-300 bg-gradient-to-b from-gold-300 to-gold-500 text-ink-950'
                  : aberto
                    ? 'border-white/10 bg-white/[0.03] text-zinc-100 hover:border-gold-400/50'
                    : 'border-transparent text-zinc-600'
              }`}
            >
              <span className="text-[0.65rem] font-semibold uppercase">
                {d === hoje ? 'hoje' : nomeDiaCurto(d)}
              </span>
              <span className="font-display text-xl font-bold">{d.slice(8)}</span>
              <span className={`text-[0.65rem] ${sel ? 'text-ink-950/70' : 'text-zinc-500'}`}>
                {!aberto ? 'folga' : periodo.dados ? `${n} hor.` : '·'}
              </span>
            </button>
          );
        })}
      </div>

      {ehAdmin && <FiltroBarbeiro valor={filtro} onMudar={setFiltro} />}

      {/* Resumo do dia */}
      {dia.dados && itens.length > 0 && (
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
            <strong className="text-zinc-50">{r.total}</strong>{' '}
            <span className="text-zinc-400">atendimentos</span>
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
            <strong className="text-zinc-50">{confirmados}</strong>{' '}
            <span className="text-zinc-400">confirmados</span>
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
            <span className="text-zinc-400">Previsto</span>{' '}
            <strong className="text-gold-200">
              {formatarPreco(r.faturamentoPrevisto + r.faturamento)}
            </strong>
          </span>
        </div>
      )}

      {erroAcao && (
        <p role="alert" className="text-sm text-red-300">
          {erroAcao}
        </p>
      )}
      {dia.erro && <ErroCaixa mensagem={dia.erro} onTentar={dia.recarregar} />}

      {!dia.dados && dia.carregando ? (
        <div className="grid gap-3 lg:grid-cols-3">
          <Skeletons n={3} className="h-40" />
        </div>
      ) : colunas ? (
        <div className="grid gap-6 lg:grid-cols-3">
          {colunas.map((b) => {
            const doBarbeiro = itens.filter((a) => a.barbeiro_id === b.id);
            return (
              <section key={b.id} aria-label={`Agenda de ${b.nome}`} className="min-w-0 space-y-3">
                <h2 className="card flex items-center gap-3 rounded-full p-1.5 pr-4 font-semibold text-zinc-50">
                  <FotoBarbeiro nome={b.nome} foto={b.foto_url} tamanho="h-10 w-10" />
                  <span className="flex-1">{b.nome}</span>
                  <span className="text-xs font-normal text-zinc-500">
                    {doBarbeiro.filter((a) => a.status !== 'CANCELADO').length} atend.
                  </span>
                </h2>
                {lista(doBarbeiro, false)}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="max-w-2xl">{lista(itens, false)}</div>
      )}
    </div>
  );
}

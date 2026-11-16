import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  ErroCaixa,
  FotoBarbeiro,
  IconeWhatsapp,
  Marca,
  SeloStatus,
  Skeletons,
} from '../../components/ui';
import { api, MODO_DEMO, sessao } from '../../lib/api';
import { agoraSP, formatarDataLonga, formatarPreco, somarDias } from '../../lib/datas';
import { formatarTelefone } from '../../lib/telefone';
import { useConsulta } from '../../lib/useConsulta';
import type { AgendamentoPainel, StatusAgendamento } from '../../types';

const ACOES: { status: StatusAgendamento; rotulo: string; de: StatusAgendamento[] }[] = [
  { status: 'CONFIRMADO', rotulo: 'Confirmar', de: ['AGENDADO'] },
  { status: 'CONCLUIDO', rotulo: 'Concluir', de: ['AGENDADO', 'CONFIRMADO'] },
  { status: 'NAO_COMPARECEU', rotulo: 'Não veio', de: ['AGENDADO', 'CONFIRMADO'] },
  { status: 'CANCELADO', rotulo: 'Cancelar', de: ['AGENDADO', 'CONFIRMADO'] },
];

function Cartao({
  a,
  onMudar,
  ocupado,
}: {
  a: AgendamentoPainel;
  onMudar: (status: StatusAgendamento) => void;
  ocupado: boolean;
}) {
  const acoes = ACOES.filter((x) => x.de.includes(a.status));
  return (
    <li
      className={`card relative overflow-hidden p-4 pl-5 transition hover:border-white/15 ${a.status === 'CANCELADO' ? 'opacity-50' : ''}`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-3 left-0 w-1 rounded-r-full ${
          {
            AGENDADO: 'bg-sky-400',
            CONFIRMADO: 'bg-emerald-400',
            CANCELADO: 'bg-red-400',
            CONCLUIDO: 'bg-zinc-500',
            NAO_COMPARECEU: 'bg-amber-400',
          }[a.status]
        }`}
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-bold text-gold-300">
            {a.hora_inicio}{' '}
            <span className="text-sm font-medium text-zinc-500">– {a.hora_fim}</span>
          </p>
          <p className="font-semibold text-zinc-50">{a.cliente_nome}</p>
          <p className="text-sm text-zinc-400">
            {a.servico_nome} · {formatarPreco(a.preco)}
          </p>
        </div>
        <SeloStatus status={a.status} />
      </div>
      {a.observacao && <p className="mt-2 text-sm text-zinc-400 italic">“{a.observacao}”</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {acoes.map((x) => (
          <button
            key={x.status}
            disabled={ocupado}
            onClick={() => onMudar(x.status)}
            className={`min-h-9 cursor-pointer rounded-full border px-3 text-xs font-semibold transition disabled:opacity-40 ${x.status === 'CANCELADO' ? 'border-red-500/40 text-red-300 hover:bg-red-500/10' : 'border-white/10 bg-white/[0.03] text-zinc-200 hover:border-gold-400 hover:text-gold-300'}`}
          >
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

export default function Agenda() {
  const navegar = useNavigate();
  const [data, setData] = useState(() => agoraSP().data);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const autenticado = sessao.ler() !== null;

  const usuario = useConsulta(autenticado ? api.me : null, []);
  const barbeiros = useConsulta(autenticado ? () => api.listarBarbeiros() : null, []);
  const agenda = useConsulta(autenticado ? () => api.listarAgendamentos(data) : null, [data]);

  // Mantém a agenda fresca enquanto a aba estiver visível.
  const { recarregar } = agenda;
  useEffect(() => {
    const id = setInterval(() => !document.hidden && recarregar(), 60_000);
    return () => clearInterval(id);
  }, [recarregar]);

  if (!autenticado || usuario.erro) {
    sessao.gravar(null);
    return <Navigate to="/admin/login" replace />;
  }

  async function mudar(id: string, status: StatusAgendamento) {
    setOcupado(id);
    setErroAcao(null);
    try {
      await api.atualizarStatus(id, status);
      recarregar();
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Não foi possível atualizar.');
    } finally {
      setOcupado(null);
    }
  }

  const colunas = (barbeiros.dados ?? []).filter(
    (b) => usuario.dados?.papel === 'ADMIN' || b.id === usuario.dados?.barbeiro_id,
  );
  const hoje = agoraSP().data;
  const ativos = (agenda.dados ?? []).filter((a) => a.status !== 'CANCELADO');

  return (
    <div className="grao relative min-h-dvh">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -top-40 left-1/2 h-96 w-[60rem] -translate-x-1/2 rounded-full bg-gold-500/10 blur-[120px]"
      />
      {MODO_DEMO && (
        <p className="relative border-b border-gold-400/20 bg-gold-400/10 px-4 py-1.5 text-center text-[0.7rem] font-medium text-gold-200">
          Painel demonstrativo · dados de exemplo, guardados só neste aparelho.
        </p>
      )}
      <header className="vidro sticky top-0 z-20 border-x-0 border-t-0 !bg-ink-950/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Marca />
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-zinc-400 sm:inline">{usuario.dados?.nome}</span>
            <button
              className="btn-ghost px-4"
              onClick={() => {
                sessao.gravar(null);
                navegar('/admin/login');
              }}
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="titulo">Agenda do dia</h1>
            <p className="mt-1 text-sm text-zinc-400 first-letter:uppercase">
              {formatarDataLonga(data)}
              {agenda.dados && ` · ${ativos.length} atendimento(s)`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn-ghost h-11 w-11 px-0"
              onClick={() => setData(somarDias(data, -1))}
              aria-label="Dia anterior"
            >
              ‹
            </button>
            <input
              type="date"
              className="campo w-auto [color-scheme:dark]"
              value={data}
              onChange={(e) => e.target.value && setData(e.target.value)}
              aria-label="Data da agenda"
            />
            <button
              className="btn-ghost h-11 w-11 px-0"
              onClick={() => setData(somarDias(data, 1))}
              aria-label="Próximo dia"
            >
              ›
            </button>
            {data !== hoje && (
              <button className="btn-ghost px-4" onClick={() => setData(hoje)}>
                Hoje
              </button>
            )}
          </div>
        </div>

        {erroAcao && (
          <p role="alert" className="mt-4 text-sm text-red-300">
            {erroAcao}
          </p>
        )}
        {agenda.erro && (
          <div className="mt-6">
            <ErroCaixa mensagem={agenda.erro} onTentar={agenda.recarregar} />
          </div>
        )}

        <div className={`mt-6 grid gap-6 ${colunas.length > 1 ? 'lg:grid-cols-3' : 'max-w-md'}`}>
          {!agenda.dados && agenda.carregando && <Skeletons n={3} className="h-72" />}
          {agenda.dados &&
            colunas.map((b) => {
              const itens = agenda.dados!.filter((a) => a.barbeiro_id === b.id);
              return (
                <section key={b.id} aria-label={`Agenda de ${b.nome}`}>
                  <h2 className="card flex items-center gap-3 rounded-full p-1.5 pr-4 font-semibold text-zinc-50">
                    <FotoBarbeiro nome={b.nome} foto={b.foto_url} tamanho="h-10 w-10" />
                    <span className="flex-1">{b.nome}</span>
                    <span className="text-xs font-normal text-zinc-500">
                      {itens.filter((a) => a.status !== 'CANCELADO').length} atend.
                    </span>
                  </h2>
                  {itens.length === 0 ? (
                    <p className="py-8 text-center text-sm text-zinc-500">
                      Nenhum horário marcado.
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-3">
                      {itens.map((a) => (
                        <Cartao
                          key={a.id}
                          a={a}
                          ocupado={ocupado === a.id}
                          onMudar={(status) => mudar(a.id, status)}
                        />
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
        </div>
      </main>
    </div>
  );
}

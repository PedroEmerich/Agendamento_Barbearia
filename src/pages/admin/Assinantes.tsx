import { useState, type FormEvent } from 'react';
import { ErroCaixa, FotoBarbeiro, IconeWhatsapp, Skeletons } from '../../components/ui';
import { api } from '../../lib/api';
import { DIAS_SEMANA_LONGOS, JANELA_ASSINANTE_DIAS, textoFixo } from '../../lib/assinaturas';
import { agoraSP, formatarDataCurta, formatarPreco, minParaHhmm } from '../../lib/datas';
import { mascararTelefone } from '../../lib/telefone';
import { useConsulta } from '../../lib/useConsulta';
import type { AssinaturaPainel, StatusAssinatura } from '../../types';
import { FiltroBarbeiro, IconeCoroa, usePainel } from './painel';

const STATUS: Record<StatusAssinatura, { rotulo: string; classe: string }> = {
  ATIVA: { rotulo: 'Ativa', classe: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' },
  ATRASADA: {
    rotulo: 'Pagamento em aberto',
    classe: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  },
  PAUSADA: { rotulo: 'Pausada', classe: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300' },
  CANCELADA: { rotulo: 'Cancelada', classe: 'border-red-400/40 bg-red-400/10 text-red-200' },
};

const linkCliente = (token: string) =>
  `${window.location.origin}${import.meta.env.BASE_URL}assinatura/${token}`;

function NovaAssinatura({ onFechar, onCriada }: { onFechar: () => void; onCriada: () => void }) {
  const { barbeiros, config } = usePainel();
  const planos = useConsulta(api.listarPlanos, []);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [planoId, setPlanoId] = useState('p1');
  const [barbeiroId, setBarbeiroId] = useState(barbeiros[0]?.id ?? '');
  const [dia, setDia] = useState<string>('');
  const [hora, setHora] = useState('18:00');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const diasAbertos = config.horario_semana.map((h) => h.dia_semana);
  const horas = Array.from({ length: 22 }, (_, i) => minParaHhmm(540 + i * 30));

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      await api.criarAssinatura({
        clienteNome: nome,
        clienteTelefone: telefone,
        planoId,
        barbeiroId,
        fixo: dia === '' ? null : { dia_semana: Number(dia), hora },
      });
      onCriada();
    } catch (er) {
      setErro(er instanceof Error ? er.message : 'Não foi possível salvar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/70 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onFechar}
    >
      <form
        onSubmit={salvar}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="t-nova"
        className="vidro max-h-[92dvh] w-full max-w-lg animate-entrar space-y-4 overflow-y-auto rounded-t-3xl !bg-ink-900/95 p-6 sm:rounded-3xl"
      >
        <h2 id="t-nova" className="text-lg font-semibold text-zinc-50">
          Novo assinante
        </h2>
        <label className="block text-sm">
          <span className="mb-1.5 block text-zinc-300">Nome</span>
          <input
            className="campo"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block text-zinc-300">WhatsApp</span>
          <input
            className="campo"
            inputMode="numeric"
            placeholder="(11) 98765-4321"
            value={telefone}
            onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
            required
          />
        </label>
        <fieldset>
          <legend className="mb-1.5 text-sm text-zinc-300">Plano</legend>
          <div className="grid gap-2">
            {planos.dados?.map((p) => (
              <label
                key={p.id}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border p-3 text-sm ${planoId === p.id ? 'border-gold-400/70 bg-gold-400/10' : 'border-white/10'}`}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="plano"
                    className="accent-gold-400"
                    checked={planoId === p.id}
                    onChange={() => setPlanoId(p.id)}
                  />
                  <span>
                    <span className="block font-semibold text-zinc-100">{p.nome}</span>
                    <span className="text-xs text-zinc-500">{p.creditos_mes} por mês</span>
                  </span>
                </span>
                <span className="font-semibold text-gold-200">{formatarPreco(p.preco_mensal)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm">
          <span className="mb-1.5 block text-zinc-300">Barbeiro</span>
          <select
            className="campo"
            value={barbeiroId}
            onChange={(e) => setBarbeiroId(e.target.value)}
          >
            {barbeiros.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nome}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <label className="block">
            <span className="mb-1.5 block text-zinc-300">Dia fixo</span>
            <select className="campo" value={dia} onChange={(e) => setDia(e.target.value)}>
              <option value="">Sem dia fixo</option>
              {diasAbertos.map((d) => (
                <option key={d} value={d}>
                  {DIAS_SEMANA_LONGOS[d]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-zinc-300">Horário</span>
            <select
              className="campo"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              disabled={dia === ''}
            >
              {horas.map((h) => (
                <option key={h}>{h}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-xs text-zinc-500">
          Com dia fixo, o sistema já reserva as próximas semanas. O cliente troca ou adianta pelo
          link dele.
        </p>
        {erro && (
          <p role="alert" className="text-sm text-red-300">
            {erro}
          </p>
        )}
        <div className="flex gap-2 pt-2">
          <button type="button" className="btn-ghost flex-1" onClick={onFechar}>
            Cancelar
          </button>
          <button className="btn-gold flex-1" disabled={enviando}>
            {enviando ? 'Salvando…' : 'Criar plano'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function Assinantes() {
  const { ehAdmin, eu, barbeiros, nomeBarbeiro, config } = usePainel();
  const consulta = useConsulta(api.listarAssinaturas, []);
  const [filtro, setFiltro] = useState('');
  const [nova, setNova] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const hoje = agoraSP().data;
  const mesAtual = hoje.slice(0, 7);

  const lista = (consulta.dados ?? []).filter((a) => !filtro || a.barbeiro_id === filtro);
  const ativas = lista.filter((a) => a.status === 'ATIVA' || a.status === 'ATRASADA');
  const receita = ativas.reduce((s, a) => s + a.preco_mensal, 0);
  const atrasadas = lista.filter((a) => a.status === 'ATRASADA').length;
  const ordem: StatusAssinatura[] = ['ATRASADA', 'ATIVA', 'PAUSADA', 'CANCELADA'];
  const ordenada = [...lista].sort(
    (a, b) =>
      ordem.indexOf(a.status) - ordem.indexOf(b.status) ||
      a.cliente_nome.localeCompare(b.cliente_nome),
  );

  async function atualizar(
    a: AssinaturaPainel,
    mudancas: Parameters<typeof api.atualizarAssinatura>[1],
  ) {
    setOcupado(a.id);
    try {
      await api.atualizarAssinatura(a.id, mudancas);
      consulta.recarregar();
    } finally {
      setOcupado(null);
    }
  }

  async function copiar(a: AssinaturaPainel) {
    try {
      await navigator.clipboard.writeText(linkCliente(a.token));
      setCopiado(a.id);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      window.prompt('Copie o link:', linkCliente(a.token));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Planos</p>
          <h1 className="titulo mt-3">{eu ? 'Meus assinantes' : 'Assinantes'}</h1>
        </div>
        {ehAdmin && (
          <button className="btn-gold" onClick={() => setNova(true)}>
            <IconeCoroa width={16} height={16} /> Novo assinante
          </button>
        )}
      </div>

      {ehAdmin && <FiltroBarbeiro valor={filtro} onMudar={setFiltro} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Ativos', String(ativas.length), `${lista.length} no total`],
          ['Receita mensal', formatarPreco(receita), 'planos ativos'],
          [
            'Pagamento em aberto',
            String(atrasadas),
            atrasadas ? 'precisa de atenção' : 'tudo em dia',
          ],
          [
            'Créditos usados',
            `${ativas.reduce((s, a) => s + a.usados_mes, 0)}/${ativas.reduce((s, a) => s + a.creditos_mes, 0)}`,
            'neste mês (inclui marcados)',
          ],
        ].map(([rotulo, valor, sub]) =>
          consulta.dados ? (
            <div key={rotulo} className="card p-4">
              <p className="text-[0.7rem] font-semibold tracking-[0.12em] text-zinc-500 uppercase">
                {rotulo}
              </p>
              <p className="mt-1.5 font-display text-2xl font-bold whitespace-nowrap text-zinc-50 tabular-nums">
                {valor}
              </p>
              <p className="mt-1 text-xs text-zinc-500">{sub}</p>
            </div>
          ) : (
            <div key={rotulo} className="skeleton h-24" />
          ),
        )}
      </div>

      {consulta.erro && <ErroCaixa mensagem={consulta.erro} onTentar={consulta.recarregar} />}

      <ul className="grid gap-3 lg:grid-cols-2">
        {!consulta.dados && <Skeletons n={4} className="h-44" />}
        {ordenada.map((a) => {
          const barb = barbeiros.find((b) => b.id === a.barbeiro_id);
          const s = STATUS[a.status];
          const msg = encodeURIComponent(
            `Olá, ${a.cliente_nome.split(' ')[0]}! Este é o link do seu plano na Underground: ${linkCliente(a.token)}`,
          );
          return (
            <li
              key={a.id}
              className={`card p-5 ${a.status === 'PAUSADA' || a.status === 'CANCELADA' ? 'opacity-70' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-zinc-50">{a.cliente_nome}</p>
                  <p className="text-sm text-zinc-400">
                    {a.plano_nome} · {formatarPreco(a.preco_mensal)}/mês
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.classe}`}
                >
                  {s.rotulo}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-300">
                {(ehAdmin || !eu) && (
                  <span className="flex items-center gap-2">
                    <FotoBarbeiro
                      nome={barb?.nome ?? '?'}
                      foto={barb?.foto_url}
                      tamanho="h-6 w-6"
                    />
                    {nomeBarbeiro(a.barbeiro_id)}
                  </span>
                )}
                <span>{textoFixo(a.fixo)}</span>
              </div>

              <div className="mt-4">
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>Créditos do mês</span>
                  <span className="tabular-nums">
                    {a.usados_mes}/{a.creditos_mes}
                  </span>
                </div>
                <div className="mt-1.5 flex gap-1" aria-hidden="true">
                  {Array.from({ length: a.creditos_mes }, (_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 flex-1 rounded-full ${i < a.usados_mes ? 'bg-[#b8892f]' : 'bg-white/[0.07]'}`}
                    />
                  ))}
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  Próximo:{' '}
                  {a.proximo ? (
                    <span className="text-zinc-300">
                      {a.proximo.data === hoje ? 'hoje' : formatarDataCurta(a.proximo.data)} às{' '}
                      {a.proximo.hora}
                    </span>
                  ) : (
                    'nenhum marcado'
                  )}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
                <a
                  href={linkCliente(a.token)}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-9 rounded-full border border-gold-400/40 bg-gold-400/10 px-3 py-2 text-xs font-semibold text-gold-100 hover:bg-gold-400/20"
                >
                  Página do cliente
                </a>
                <button
                  onClick={() => copiar(a)}
                  className="min-h-9 cursor-pointer rounded-full border border-white/10 px-3 text-xs font-semibold text-zinc-200 hover:border-gold-400/60"
                >
                  {copiado === a.id ? 'Copiado!' : 'Copiar link'}
                </button>
                <a
                  href={`https://wa.me/${a.cliente_telefone}?text=${msg}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Enviar o link para ${a.cliente_nome} no WhatsApp`}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-emerald-300 hover:border-emerald-400"
                >
                  <IconeWhatsapp width={16} height={16} />
                </a>
                {ehAdmin && (
                  <span className="ml-auto flex flex-wrap gap-2">
                    {a.status === 'ATRASADA' && (
                      <button
                        disabled={ocupado === a.id}
                        onClick={() => atualizar(a, { status: 'ATIVA', pago_ate: mesAtual })}
                        className="min-h-9 cursor-pointer rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 text-xs font-semibold text-emerald-100 disabled:opacity-40"
                      >
                        Marcar mês pago
                      </button>
                    )}
                    {a.status === 'PAUSADA' ? (
                      <button
                        disabled={ocupado === a.id}
                        onClick={() => atualizar(a, { status: 'ATIVA' })}
                        className="min-h-9 cursor-pointer rounded-full border border-white/10 px-3 text-xs font-semibold text-zinc-200 disabled:opacity-40"
                      >
                        Reativar
                      </button>
                    ) : (
                      a.status !== 'CANCELADA' && (
                        <button
                          disabled={ocupado === a.id}
                          onClick={() => atualizar(a, { status: 'PAUSADA' })}
                          className="min-h-9 cursor-pointer rounded-full border border-white/10 px-3 text-xs font-semibold text-zinc-400 hover:text-zinc-100 disabled:opacity-40"
                        >
                          Pausar
                        </button>
                      )
                    )}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {consulta.dados && lista.length === 0 && (
        <p className="card p-8 text-center text-sm text-zinc-500">Nenhum assinante ainda.</p>
      )}

      <p className="text-xs text-zinc-500">
        Regras provisórias da demonstração: ciclo pelo mês do calendário, créditos não acumulam,
        trocas até 2h antes, assinante agenda até {JANELA_ASSINANTE_DIAS} dias à frente (público:{' '}
        {config.janela_max_dias}).
      </p>

      {nova && (
        <NovaAssinatura
          onFechar={() => setNova(false)}
          onCriada={() => {
            setNova(false);
            consulta.recarregar();
          }}
        />
      )}
    </div>
  );
}

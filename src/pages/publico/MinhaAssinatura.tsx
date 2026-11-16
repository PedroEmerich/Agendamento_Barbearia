// Página pessoal do assinante (link enviado pelo WhatsApp, sem login).
// Aqui ele vê os créditos do mês e troca, adianta ou libera horários sozinho.

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ErroCaixa,
  FotoBarbeiro,
  IconeCheck,
  IconeRelogio,
  IconeSeta,
  Skeletons,
} from '../../components/ui';
import { api, ErroApi } from '../../lib/api';
import { textoFixo } from '../../lib/assinaturas';
import {
  agoraSP,
  diaSemana,
  formatarDataCurta,
  formatarDataLonga,
  formatarPreco,
  hhmmParaMin,
  somarDias,
} from '../../lib/datas';
import { useConsulta } from '../../lib/useConsulta';
import type { AssinaturaCliente, Cobranca } from '../../types';
import {
  ESCOLHA_INICIAL,
  EscolhaPagamento,
  escolhaValida,
  PainelPagamento,
  type EscolhaPagamentoValor,
} from '../../components/Pagamento';
import { CarrosselDias, GradeHorarios } from './Agendar';

type Proximo = AssinaturaCliente['proximos'][number];

/** Bolinhas de crédito: usado (cheio), marcado (contorno com ✓) e livre (vazio). */
function Creditos({ c }: { c: AssinaturaCliente['creditos'] }) {
  const itens = [
    ...Array(c.usados).fill('usado'),
    ...Array(c.agendados).fill('marcado'),
    ...Array(c.livres).fill('livre'),
  ] as ('usado' | 'marcado' | 'livre')[];
  return (
    <div>
      <div className="flex gap-2" aria-hidden="true">
        {itens.map((t, i) => (
          <span
            key={i}
            className={`flex h-11 flex-1 items-center justify-center rounded-2xl border text-xs font-semibold ${
              t === 'usado'
                ? 'border-gold-400 bg-gradient-to-b from-gold-300 to-gold-500 text-ink-950'
                : t === 'marcado'
                  ? 'border-gold-400/70 bg-gold-400/10 text-gold-200'
                  : 'border-dashed border-white/20 text-zinc-500'
            }`}
          >
            {t === 'usado' ? (
              <IconeCheck width={16} height={16} />
            ) : t === 'marcado' ? (
              'marcado'
            ) : (
              'livre'
            )}
          </span>
        ))}
      </div>
      <p className="mt-3 text-sm text-zinc-400">
        <strong className="text-zinc-100">{c.usados}</strong> usado{c.usados === 1 ? '' : 's'} ·{' '}
        <strong className="text-zinc-100">{c.agendados}</strong> marcado
        {c.agendados === 1 ? '' : 's'} · <strong className="text-gold-200">{c.livres}</strong> livre
        {c.livres === 1 ? '' : 's'}
      </p>
    </div>
  );
}

/* --------------------------------------------- escolher novo horário (troca/crédito) */

function EscolherHorario({
  token,
  dados,
  trocando,
  onFechar,
  onFeito,
}: {
  token: string;
  dados: AssinaturaCliente;
  /** Horário que está sendo trocado; sem ele, é para usar um crédito livre. */
  trocando: Proximo | null;
  onFechar: () => void;
  onFeito: (msg: string) => void;
}) {
  const hoje = agoraSP().data;
  const servicoId = dados.plano.servico_id;
  const janela = Math.round((Date.parse(dados.agenda_ate) - Date.parse(hoje)) / 86_400_000);
  const [data, setData] = useState<string | null>(null);
  const [escolha, setEscolha] = useState<{ data: string; hora: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Atalho "adiantar": os primeiros horários livres antes do atual (ou os primeiros do calendário).
  const rapidos = useConsulta(async () => {
    const limite = trocando?.data ?? dados.agenda_ate;
    const dias = await api.getDiasDisponiveis(servicoId, dados.barbeiro_id, hoje, limite, token);
    const lista: { data: string; hora: string }[] = [];
    for (const d of dias.slice(0, 4)) {
      const hs = await api.getHorarios(servicoId, dados.barbeiro_id, d, token);
      for (const h of hs) {
        const antes =
          !trocando ||
          d < trocando.data ||
          (d === trocando.data && hhmmParaMin(h.hora) < hhmmParaMin(trocando.hora_inicio));
        if (antes) lista.push({ data: d, hora: h.hora });
      }
      if (lista.length >= 6) break;
    }
    return lista.slice(0, 6);
  }, []);
  const dias = useConsulta(
    () => api.getDiasDisponiveis(servicoId, dados.barbeiro_id, hoje, dados.agenda_ate, token),
    [],
  );
  const horarios = useConsulta(
    data ? () => api.getHorarios(servicoId, dados.barbeiro_id, data, token) : null,
    [data],
  );

  // Fecha com Esc.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    addEventListener('keydown', tecla);
    return () => removeEventListener('keydown', tecla);
  }, [onFechar]);

  const rotulo = (d: string) => (d === hoje ? 'hoje' : formatarDataCurta(d));

  async function confirmar() {
    if (!escolha) return;
    setEnviando(true);
    setErro(null);
    try {
      if (trocando)
        await api.trocarHorarioAssinatura(token, trocando.id, escolha.data, escolha.hora);
      else await api.agendarComCredito(token, escolha.data, escolha.hora);
      onFeito(`Pronto! Seu horário agora é ${rotulo(escolha.data)} às ${escolha.hora}.`);
    } catch (e) {
      setErro(
        e instanceof ErroApi || e instanceof Error ? e.message : 'Não foi possível concluir.',
      );
      if (e instanceof ErroApi && e.code === 'SLOT_INDISPONIVEL') {
        setEscolha(null);
        horarios.recarregar();
        rapidos.recarregar();
      }
    } finally {
      setEnviando(false);
    }
  }

  const chip = (sel: boolean) =>
    `min-h-11 cursor-pointer rounded-2xl border px-3 text-sm font-semibold tabular-nums transition ${
      sel
        ? 'border-gold-300 bg-gradient-to-b from-gold-300 to-gold-500 text-ink-950'
        : 'border-white/10 bg-white/[0.04] text-zinc-100 hover:border-gold-400/60'
    }`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/70 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onFechar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-troca"
        onClick={(e) => e.stopPropagation()}
        className="vidro flex max-h-[92dvh] w-full max-w-2xl animate-entrar flex-col rounded-t-3xl !bg-ink-900/95 sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] p-5">
          <div>
            <h2 id="titulo-troca" className="text-lg font-semibold text-zinc-50">
              {trocando ? 'Trocar horário' : 'Usar um crédito'}
            </h2>
            {trocando && (
              <p className="mt-0.5 text-sm text-zinc-400">
                Atual: {rotulo(trocando.data)} às {trocando.hora_inicio}. Ele só é liberado quando
                você confirmar o novo.
              </p>
            )}
          </div>
          <button
            onClick={onFechar}
            className="btn-ghost h-10 w-10 shrink-0 px-0"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="space-y-7 overflow-y-auto p-5">
          <section>
            <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-gold-400 uppercase">
              {trocando ? 'Adiantar: livres antes do seu' : 'Primeiros horários livres'}
            </p>
            {rapidos.carregando ? (
              <div className="flex gap-2">
                <Skeletons n={4} className="h-11 w-24" />
              </div>
            ) : rapidos.dados?.length ? (
              <div className="flex flex-wrap gap-2">
                {rapidos.dados.map((h) => {
                  const sel = escolha?.data === h.data && escolha.hora === h.hora;
                  return (
                    <button
                      key={h.data + h.hora}
                      type="button"
                      aria-pressed={sel}
                      onClick={() => setEscolha(h)}
                      className={chip(sel)}
                    >
                      <span className="mr-1.5 text-xs font-normal opacity-70">
                        {rotulo(h.data)}
                      </span>
                      {h.hora}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">
                Nenhum horário livre antes do seu. Escolha outro dia abaixo.
              </p>
            )}
          </section>

          <section>
            <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-gold-400 uppercase">
              Escolher outro dia
            </p>
            {dias.carregando ? (
              <div className="flex gap-2 overflow-hidden">
                <Skeletons n={6} className="h-24 w-[4.25rem] shrink-0" />
              </div>
            ) : (
              <CarrosselDias
                hoje={hoje}
                janela={janela}
                livres={dias.dados ?? []}
                selecionado={data}
                onEscolher={(d) => {
                  setData(d);
                  setEscolha(null);
                }}
              />
            )}
            {data && (
              <div className="mt-5">
                {horarios.carregando ? (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    <Skeletons n={8} className="h-12" />
                  </div>
                ) : (
                  <GradeHorarios
                    horarios={horarios.dados ?? []}
                    selecionada={escolha?.data === data ? escolha.hora : null}
                    onEscolher={(h) => setEscolha({ data, hora: h })}
                  />
                )}
              </div>
            )}
          </section>
        </div>

        <div className="border-t border-white/[0.07] p-4">
          {erro && (
            <p role="alert" className="mb-3 text-sm text-amber-200">
              {erro}
            </p>
          )}
          <button
            className="btn-gold w-full py-3.5"
            disabled={!escolha || enviando}
            onClick={confirmar}
          >
            {enviando
              ? 'Confirmando…'
              : escolha
                ? `${trocando ? 'Trocar para' : 'Marcar'} ${rotulo(escolha.data)} às ${escolha.hora}`
                : 'Escolha um horário'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- mensalidade em aberto */

function PagarPlano({
  token,
  dados,
  onPago,
}: {
  token: string;
  dados: AssinaturaCliente;
  onPago: () => void;
}) {
  const pendente = dados.cobranca_pendente;
  const existente = useConsulta(pendente ? () => api.consultarPagamento(pendente) : null, [
    pendente,
  ]);
  const [aberto, setAberto] = useState(dados.pagamento_forma === 'ONLINE');
  const [escolha, setEscolha] = useState<EscolhaPagamentoValor>({
    ...ESCOLHA_INICIAL,
    forma: 'ONLINE',
  });
  const [cobranca, setCobranca] = useState<Cobranca | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const atual = cobranca ?? existente.dados;
  if (atual) return <PainelPagamento cobranca={atual} onPago={onPago} />;
  if (existente.carregando) return <div className="skeleton h-40" />;
  if (!aberto) {
    return (
      <button className="btn-ghost w-full" onClick={() => setAberto(true)}>
        Prefere pagar agora? Pix ou cartão
      </button>
    );
  }

  async function gerar() {
    setGerando(true);
    setErro(null);
    try {
      setCobranca(
        await api.iniciarPagamento('assinatura', token, {
          metodo: escolha.metodo,
          cpf: escolha.cpf,
          email: escolha.email || undefined,
        }),
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível gerar o pagamento.');
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="card space-y-4 p-5">
      <EscolhaPagamento
        valor={escolha}
        onMudar={(v) => setEscolha({ ...v, forma: 'ONLINE' })}
        recorrente
      />
      {erro && (
        <p role="alert" className="text-sm text-amber-200">
          {erro}
        </p>
      )}
      <button
        className="btn-gold w-full"
        disabled={!escolhaValida(escolha) || gerando}
        onClick={gerar}
      >
        {gerando ? 'Gerando…' : `Pagar ${formatarPreco(dados.plano.preco_mensal)}`}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ página */

export default function MinhaAssinatura() {
  const { token = '' } = useParams();
  const consulta = useConsulta(() => api.getAssinaturaPorToken(token), [token]);
  const [modal, setModal] = useState<{ trocando: Proximo | null } | null>(null);
  const [liberando, setLiberando] = useState<string | null>(null);
  const [confirmarLiberar, setConfirmarLiberar] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const hoje = agoraSP().data;

  const a = consulta.dados;

  async function liberar(p: Proximo) {
    setLiberando(p.id);
    setErro(null);
    try {
      await api.cancelarHorarioAssinatura(token, p.id);
      setAviso(`Horário de ${formatarDataCurta(p.data)} liberado. O crédito voltou para você.`);
      setConfirmarLiberar(null);
      consulta.recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível liberar.');
    } finally {
      setLiberando(null);
    }
  }

  if (consulta.erro) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <ErroCaixa mensagem={consulta.erro} onTentar={consulta.recarregar} />
      </div>
    );
  }
  if (!a) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-10">
        <Skeletons n={3} className="h-40" />
      </div>
    );
  }

  const ativa = a.status === 'ATIVA' || a.status === 'ATRASADA';
  const economia = a.plano.preco_avulso_mes - a.plano.preco_mensal;
  const ehFixo = (p: Proximo) =>
    !!a.fixo && diaSemana(p.data) === a.fixo.dia_semana && p.hora_inicio === a.fixo.hora;
  const fimCiclo = formatarDataCurta(a.ciclo.ate);

  return (
    <div className="relative mx-auto max-w-2xl px-4 pt-4 pb-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-gold-500/15 blur-[100px]"
      />

      <p className="eyebrow">Minha assinatura</p>
      <h1 className="titulo mt-3">
        Olá, <span className="texto-ouro">{a.cliente_nome.split(' ')[0]}</span>
      </h1>

      {aviso && (
        <p
          role="status"
          className="mt-5 flex animate-entrar items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100"
        >
          <IconeCheck width={16} height={16} /> {aviso}
        </p>
      )}
      {erro && (
        <p
          role="alert"
          className="mt-5 rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-100"
        >
          {erro}
        </p>
      )}
      {a.status === 'AGUARDANDO_PAGAMENTO' && (
        <p className="mt-5 rounded-2xl border border-gold-400/30 bg-gold-400/10 px-4 py-3 text-sm text-gold-100">
          {a.pagamento_forma === 'ONLINE'
            ? 'Seu plano é ativado assim que o pagamento da primeira mensalidade for confirmado.'
            : 'Pague a primeira mensalidade na barbearia para ativar o plano. Seus horários fixos já estão reservados.'}
        </p>
      )}
      {a.status === 'ATRASADA' && (
        <p className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          A mensalidade deste mês está em aberto. Pague abaixo ou na barbearia para manter sua
          prioridade.
        </p>
      )}
      {(a.status === 'AGUARDANDO_PAGAMENTO' || a.status === 'ATRASADA') && (
        <div className="mt-4">
          <PagarPlano token={token} dados={a} onPago={() => consulta.recarregar()} />
        </div>
      )}
      {a.status === 'PAUSADA' && (
        <p className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-300">
          Seu plano está pausado. Para voltar, é só falar com a barbearia.
        </p>
      )}

      {/* Plano e créditos */}
      <section className="card mt-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-zinc-50">{a.plano.nome}</p>
            <p className="text-sm text-zinc-400">
              {formatarPreco(a.plano.preco_mensal)}/mês
              {economia > 0 && (
                <span className="text-emerald-300"> · economia de {formatarPreco(economia)}</span>
              )}
            </p>
          </div>
          <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] py-1 pr-3 pl-1 text-sm">
            <FotoBarbeiro nome={a.barbeiro_nome} foto={a.barbeiro_foto} tamanho="h-7 w-7" />
            {a.barbeiro_nome}
          </span>
        </div>
        <div className="mt-6">
          <p className="mb-3 flex justify-between text-xs font-semibold tracking-[0.15em] text-zinc-500 uppercase">
            <span>Créditos deste mês</span>
            <span className="tracking-normal normal-case">
              renova em {formatarDataCurta(somarDias(a.ciclo.ate, 1))}
            </span>
          </p>
          <Creditos c={a.creditos} />
        </div>
        <p className="mt-5 flex items-center gap-2 border-t border-white/[0.07] pt-4 text-sm text-zinc-300">
          <IconeRelogio width={16} height={16} className="shrink-0 text-gold-400" />
          <span>
            {textoFixo(a.fixo)}
            {a.fixo && (
              <span className="block text-xs text-zinc-500">
                Reservado automaticamente nas próximas semanas
              </span>
            )}
          </span>
        </p>
      </section>

      {/* Crédito livre */}
      {ativa && a.creditos.livres > 0 && (
        <button
          onClick={() => setModal({ trocando: null })}
          className="card group mt-4 flex w-full cursor-pointer items-center gap-4 p-5 text-left transition hover:border-gold-400/50"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold-400/15 font-display text-lg font-bold text-gold-200">
            {a.creditos.livres}
          </span>
          <span className="flex-1">
            <span className="block font-semibold text-zinc-50">
              Você tem {a.creditos.livres} crédito{a.creditos.livres === 1 ? '' : 's'} livre
              {a.creditos.livres === 1 ? '' : 's'} este mês
            </span>
            <span className="text-sm text-zinc-400">
              Use até {fimCiclo}: créditos não passam para o mês seguinte.
            </span>
          </span>
          <IconeSeta className="text-gold-300 transition group-hover:translate-x-1" />
        </button>
      )}

      {/* Próximos horários */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-50">Próximos horários</h2>
        {a.proximos.length === 0 && (
          <p className="mt-3 text-sm text-zinc-500">Nenhum horário marcado.</p>
        )}
        <ul className="mt-4 space-y-3">
          {a.proximos.map((p) => (
            <li key={p.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-zinc-400 first-letter:uppercase">
                    {p.data === hoje ? 'Hoje' : formatarDataLonga(p.data)}
                  </p>
                  <p className="font-display text-2xl font-bold text-gold-200">
                    {p.hora_inicio}{' '}
                    <span className="text-sm font-medium text-zinc-500">– {p.hora_fim}</span>
                  </p>
                  <p className="text-sm text-zinc-400">
                    {p.servico_nome} · {p.barbeiro_nome}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                    ehFixo(p)
                      ? 'border-gold-400/40 bg-gold-400/10 text-gold-200'
                      : 'border-sky-400/40 bg-sky-400/10 text-sky-200'
                  }`}
                >
                  {ehFixo(p) ? 'Dia fixo' : 'Remarcado'}
                </span>
              </div>
              {ativa &&
                (p.pode_trocar ? (
                  confirmarLiberar === p.id ? (
                    <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm">
                      <p className="text-zinc-200">
                        Liberar este horário? O crédito volta e você pode usar em outro dia do mês.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          className="btn-ghost flex-1"
                          onClick={() => setConfirmarLiberar(null)}
                        >
                          Manter
                        </button>
                        <button
                          className="btn-danger flex-1"
                          onClick={() => liberar(p)}
                          disabled={liberando === p.id}
                        >
                          {liberando === p.id ? 'Liberando…' : 'Liberar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        className="btn-gold px-3 whitespace-nowrap"
                        onClick={() => setModal({ trocando: p })}
                      >
                        Trocar / adiantar
                      </button>
                      <button className="btn-ghost" onClick={() => setConfirmarLiberar(p.id)}>
                        Não vou
                      </button>
                    </div>
                  )
                ) : (
                  <p className="mt-3 text-xs text-zinc-500">
                    Faltam menos de {a.antecedencia_troca_min / 60}h: para mudar, fale com a
                    barbearia.
                  </p>
                ))}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 rounded-3xl border border-white/[0.06] p-5 text-sm text-zinc-400">
        <p className="font-semibold text-zinc-200">Como funciona</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Seu dia fixo já fica reservado nas próximas semanas, antes de abrir para o público.
          </li>
          <li>
            Trocar ou adiantar é na hora: o horário antigo só é liberado quando o novo é confirmado.
          </li>
          <li>
            Trocas e liberações vão até {a.antecedencia_troca_min / 60}h antes. Falta conta como
            crédito usado.
          </li>
          <li>
            Você agenda com até{' '}
            {Math.round((Date.parse(a.agenda_ate) - Date.parse(hoje)) / 86_400_000)} dias de
            antecedência.
          </li>
        </ul>
      </section>

      <p className="mt-6 text-center text-xs text-zinc-500">
        Guarde este link: é por ele que você gerencia seu plano.{' '}
        <Link to="/" className="underline">
          Underground Barbershop
        </Link>
      </p>

      {modal && (
        <EscolherHorario
          token={token}
          dados={a}
          trocando={modal.trocando}
          onFechar={() => setModal(null)}
          onFeito={(msg) => {
            setModal(null);
            setAviso(msg);
            consulta.recarregar();
          }}
        />
      )}
    </div>
  );
}

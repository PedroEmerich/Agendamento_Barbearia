import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ErroCaixa,
  IconeCalendario,
  IconeCheck,
  IconeRelogio,
  IconeUsuario,
  IconeVoltar,
  Skeletons,
} from '../../components/ui';
import { api, ErroApi, ultimoAgendamento } from '../../lib/api';
import {
  agoraSP,
  formatarDataLonga,
  formatarDuracao,
  formatarPreco,
  nomeDiaCurto,
  somarDias,
} from '../../lib/datas';
import { baixarIcs } from '../../lib/ics';
import { mascararTelefone, normalizarTelefone } from '../../lib/telefone';
import { useConsulta } from '../../lib/useConsulta';
import type { AgendamentoCliente, Barbeiro, Servico } from '../../types';

const PASSOS = ['Serviço', 'Barbeiro', 'Dia', 'Horário', 'Seus dados'];

function Opcao({
  selecionado,
  onClick,
  children,
}: {
  selecionado: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selecionado}
      className={`card flex w-full cursor-pointer items-center gap-4 p-4 text-left transition hover:border-gold-400/60 ${selecionado ? 'border-gold-400 bg-gold-400/10' : ''}`}
    >
      {children}
    </button>
  );
}

function Confirmacao({ agendamento }: { agendamento: AgendamentoCliente }) {
  const config = useConsulta(api.getConfigPublica, []);
  const [copiado, setCopiado] = useState(false);
  const link = `${window.location.origin}/meu-agendamento/${agendamento.token}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt('Copie o link:', link);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
        <IconeCheck width={28} height={28} />
      </span>
      <h1 className="titulo mt-4">Horário marcado!</h1>
      <p className="mt-2 text-zinc-400">
        Você receberá um lembrete no WhatsApp cerca de 2 horas antes.
      </p>

      <div className="card mt-8 p-6 text-left">
        <p className="text-xs tracking-widest text-zinc-500 uppercase">Código</p>
        <p className="font-display text-3xl font-bold tracking-[0.2em] text-gold-300">
          {agendamento.codigo}
        </p>
        <dl className="mt-5 space-y-2 text-sm">
          {[
            ['Serviço', agendamento.servico_nome],
            ['Barbeiro', agendamento.barbeiro_nome],
            ['Dia', formatarDataLonga(agendamento.data)],
            ['Horário', `${agendamento.hora_inicio} – ${agendamento.hora_fim}`],
            ['Valor', formatarPreco(agendamento.preco)],
          ].map(([rotulo, valor]) => (
            <div key={rotulo} className="flex justify-between gap-4">
              <dt className="text-zinc-400">{rotulo}</dt>
              <dd className="text-right font-medium text-zinc-100">{valor}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <button
          className="btn-gold"
          disabled={!config.dados}
          onClick={() => config.dados && baixarIcs(agendamento, config.dados)}
        >
          <IconeCalendario /> Adicionar ao calendário
        </button>
        <button className="btn-ghost" onClick={copiar}>
          {copiado ? 'Link copiado!' : 'Copiar link do agendamento'}
        </button>
        <Link to={`/meu-agendamento/${agendamento.token}`} className="btn-ghost">
          Ver ou cancelar
        </Link>
      </div>
      <p className="mt-4 text-xs text-zinc-500">
        Guarde o link: é por ele que você consulta ou cancela o horário.
      </p>
    </div>
  );
}

export default function Agendar() {
  const [params] = useSearchParams();
  const [passo, setPasso] = useState(0);
  const [servico, setServico] = useState<Servico | null>(null);
  const [barbeiroId, setBarbeiroId] = useState<string | null>(null);
  const [data, setData] = useState<string | null>(null);
  const [hora, setHora] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [observacao, setObservacao] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [aceite, setAceite] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [resultado, setResultado] = useState<AgendamentoCliente | null>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);

  const hoje = useMemo(() => agoraSP().data, []);
  const config = useConsulta(api.getConfigPublica, []);
  const servicos = useConsulta(api.listarServicos, []);
  const barbeiros = useConsulta(
    servico ? () => api.listarBarbeiros(servico.id) : null,
    [servico?.id],
  );
  const janela = config.dados?.janela_max_dias ?? 30;
  const dias = useConsulta(
    servico && barbeiroId && passo >= 2
      ? () => api.getDiasDisponiveis(servico.id, barbeiroId, hoje, somarDias(hoje, janela))
      : null,
    [servico?.id, barbeiroId, passo >= 2, janela],
  );
  const horarios = useConsulta(
    servico && barbeiroId && data && passo >= 3
      ? () => api.getHorarios(servico.id, barbeiroId, data)
      : null,
    [servico?.id, barbeiroId, data, passo >= 3],
  );

  // Serviço pré-selecionado quando o cliente vem da lista da página inicial.
  const servicoInicial = params.get('servico');
  useEffect(() => {
    if (!servicoInicial || servico || !servicos.dados) return;
    const achado = servicos.dados.find((s) => s.id === servicoInicial);
    if (achado) {
      setServico(achado);
      setPasso(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicos.dados]);

  useEffect(() => {
    tituloRef.current?.focus();
    window.scrollTo(0, 0);
  }, [passo]);

  if (resultado) return <Confirmacao agendamento={resultado} />;

  const nomeBarbeiro =
    barbeiroId === 'qualquer'
      ? 'Qualquer barbeiro'
      : (barbeiros.dados?.find((b) => b.id === barbeiroId)?.nome ?? '');
  const telefoneValido = normalizarTelefone(telefone) !== null;
  const podeEnviar = nome.trim().length >= 2 && telefoneValido && aceite && !enviando;

  function escolherServico(s: Servico) {
    if (s.id !== servico?.id) {
      setBarbeiroId(null);
      setData(null);
      setHora(null);
    }
    setServico(s);
    setPasso(1);
  }

  function escolherBarbeiro(id: string) {
    if (id !== barbeiroId) {
      setData(null);
      setHora(null);
    }
    setBarbeiroId(id);
    setPasso(2);
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!servico || !barbeiroId || !data || !hora || !podeEnviar) return;
    setEnviando(true);
    setAviso(null);
    try {
      const criado = await api.criarAgendamento({
        servicoId: servico.id,
        barbeiroId,
        data,
        hora,
        clienteNome: nome.trim(),
        clienteTelefone: telefone,
        observacao: observacao.trim(),
        honeypot,
      });
      ultimoAgendamento.gravar(criado.token);
      setResultado(criado);
    } catch (erro) {
      if (erro instanceof ErroApi && erro.code === 'SLOT_INDISPONIVEL') {
        setHora(null);
        setPasso(3);
        horarios.recarregar();
        setAviso('Esse horário acabou de ser ocupado. Escolha outro, por favor.');
      } else {
        setAviso(erro instanceof Error ? erro.message : 'Algo deu errado. Tente de novo.');
      }
    } finally {
      setEnviando(false);
    }
  }

  const titulos = [
    'Qual serviço?',
    'Com quem?',
    'Que dia?',
    'Que horas?',
    'Para finalizar, seus dados',
  ];

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <div className="flex items-center gap-3">
        {passo > 0 ? (
          <button
            className="btn-ghost h-11 w-11 shrink-0 px-0"
            onClick={() => setPasso(passo - 1)}
            aria-label="Voltar ao passo anterior"
          >
            <IconeVoltar />
          </button>
        ) : (
          <Link to="/" className="btn-ghost h-11 w-11 shrink-0 px-0" aria-label="Voltar ao início">
            <IconeVoltar />
          </Link>
        )}
        <div className="flex-1">
          <p className="text-xs text-zinc-500">
            Passo {passo + 1} de {PASSOS.length} · {PASSOS[passo]}
          </p>
          <div
            className="mt-1.5 flex gap-1"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={PASSOS.length}
            aria-valuenow={passo + 1}
          >
            {PASSOS.map((p, i) => (
              <span
                key={p}
                className={`h-1 flex-1 rounded-full ${i <= passo ? 'bg-gold-400' : 'bg-ink-700'}`}
              />
            ))}
          </div>
        </div>
      </div>

      <h1 ref={tituloRef} tabIndex={-1} className="titulo mt-6 outline-none">
        {titulos[passo]}
      </h1>

      {passo > 0 && servico && (
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-zinc-400">
          <span>{servico.nome}</span>
          {passo > 1 && <span>· {nomeBarbeiro}</span>}
          {passo > 2 && data && <span>· {formatarDataLonga(data)}</span>}
          {passo > 3 && hora && <span>· {hora}</span>}
        </p>
      )}

      {aviso && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"
        >
          {aviso}
        </p>
      )}

      <div className="mt-6">
        {passo === 0 && (
          <div className="space-y-3">
            {servicos.erro && <ErroCaixa mensagem={servicos.erro} onTentar={servicos.recarregar} />}
            {servicos.carregando && <Skeletons n={4} className="h-20" />}
            {servicos.dados?.map((s) => (
              <Opcao key={s.id} selecionado={servico?.id === s.id} onClick={() => escolherServico(s)}>
                <span className="flex-1">
                  <span className="block font-semibold text-zinc-50">{s.nome}</span>
                  <span className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-zinc-400">
                    <IconeRelogio width={14} height={14} /> {formatarDuracao(s.duracao_min)}
                  </span>
                </span>
                <span className="font-display text-lg font-bold text-gold-300">
                  {formatarPreco(s.preco)}
                </span>
              </Opcao>
            ))}
          </div>
        )}

        {passo === 1 && (
          <div className="space-y-3">
            {barbeiros.erro && <ErroCaixa mensagem={barbeiros.erro} onTentar={barbeiros.recarregar} />}
            {barbeiros.carregando && <Skeletons n={4} className="h-20" />}
            {barbeiros.dados && (
              <>
                <Opcao
                  selecionado={barbeiroId === 'qualquer'}
                  onClick={() => escolherBarbeiro('qualquer')}
                >
                  <Avatar />
                  <span>
                    <span className="block font-semibold text-zinc-50">Qualquer barbeiro</span>
                    <span className="text-xs text-zinc-400">Mais horários disponíveis</span>
                  </span>
                </Opcao>
                {barbeiros.dados.map((b) => (
                  <Opcao
                    key={b.id}
                    selecionado={barbeiroId === b.id}
                    onClick={() => escolherBarbeiro(b.id)}
                  >
                    <Avatar barbeiro={b} />
                    <span className="font-semibold text-zinc-50">{b.nome}</span>
                  </Opcao>
                ))}
              </>
            )}
          </div>
        )}

        {passo === 2 && (
          <>
            {dias.erro && <ErroCaixa mensagem={dias.erro} onTentar={dias.recarregar} />}
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {dias.carregando && <Skeletons n={12} className="h-20" />}
              {dias.dados &&
                Array.from({ length: janela + 1 }, (_, i) => somarDias(hoje, i)).map((d) => {
                  const livre = dias.dados!.includes(d);
                  const [, mes, dia] = d.split('-');
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={!livre}
                      aria-pressed={data === d}
                      aria-label={`${formatarDataLonga(d)}${livre ? '' : ' — sem horários'}`}
                      onClick={() => {
                        if (d !== data) setHora(null);
                        setData(d);
                        setPasso(3);
                      }}
                      className={`flex min-h-20 cursor-pointer flex-col items-center justify-center rounded-xl border text-sm transition disabled:cursor-not-allowed disabled:border-ink-800 disabled:text-zinc-600 ${data === d ? 'border-gold-400 bg-gold-400/10' : 'border-ink-700 bg-ink-900 enabled:hover:border-gold-400/60'}`}
                    >
                      <span className="text-xs uppercase">{d === hoje ? 'hoje' : nomeDiaCurto(d)}</span>
                      <span className="font-display text-xl font-bold">{dia}</span>
                      <span className="text-[0.65rem] opacity-70">/{mes}</span>
                    </button>
                  );
                })}
            </div>
            {dias.dados?.length === 0 && (
              <p className="mt-4 text-sm text-zinc-400">
                Sem horários nos próximos {janela} dias para essa escolha. Tente outro barbeiro.
              </p>
            )}
          </>
        )}

        {passo === 3 && (
          <>
            {horarios.erro && <ErroCaixa mensagem={horarios.erro} onTentar={horarios.recarregar} />}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {horarios.carregando && <Skeletons n={12} className="h-12" />}
              {!horarios.carregando &&
                horarios.dados?.map((h) => (
                  <button
                    key={h.hora}
                    type="button"
                    aria-pressed={hora === h.hora}
                    onClick={() => {
                      setHora(h.hora);
                      setAviso(null);
                      setPasso(4);
                    }}
                    className={`min-h-12 cursor-pointer rounded-xl border font-semibold transition hover:border-gold-400/60 ${hora === h.hora ? 'border-gold-400 bg-gold-400/10 text-gold-200' : 'border-ink-700 bg-ink-900'}`}
                  >
                    {h.hora}
                  </button>
                ))}
            </div>
            {!horarios.carregando && horarios.dados?.length === 0 && (
              <div className="text-sm text-zinc-400">
                <p>Os horários desse dia acabaram.</p>
                <button className="btn-ghost mt-4" onClick={() => setPasso(2)}>
                  Escolher outro dia
                </button>
              </div>
            )}
          </>
        )}

        {passo === 4 && (
          <form onSubmit={enviar} className="space-y-4" noValidate>
            <div>
              <label htmlFor="nome" className="mb-1.5 block text-sm font-medium">
                Seu nome
              </label>
              <input
                id="nome"
                className="campo"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                maxLength={60}
                autoComplete="name"
                required
              />
            </div>
            <div>
              <label htmlFor="telefone" className="mb-1.5 block text-sm font-medium">
                WhatsApp
              </label>
              <input
                id="telefone"
                className="campo"
                type="tel"
                inputMode="numeric"
                placeholder="(11) 98765-4321"
                value={telefone}
                onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
                autoComplete="tel-national"
                aria-describedby="telefone-ajuda"
                required
              />
              <p id="telefone-ajuda" className="mt-1.5 text-xs text-zinc-500">
                {telefone && !telefoneValido
                  ? 'Digite o número completo, com DDD.'
                  : 'É para onde enviamos o lembrete.'}
              </p>
            </div>
            <div>
              <label htmlFor="obs" className="mb-1.5 block text-sm font-medium">
                Observação <span className="font-normal text-zinc-500">(opcional)</span>
              </label>
              <textarea
                id="obs"
                className="campo"
                rows={2}
                maxLength={200}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            </div>
            {/* Honeypot: invisível para pessoas, preenchido por robôs. */}
            <div className="hidden" aria-hidden="true">
              <label>
                Site
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </label>
            </div>
            <label className="flex cursor-pointer items-start gap-3 text-sm text-zinc-300">
              <input
                type="checkbox"
                className="mt-0.5 h-5 w-5 shrink-0 accent-gold-400"
                checked={aceite}
                onChange={(e) => setAceite(e.target.checked)}
              />
              <span>
                Aceito receber o lembrete pelo WhatsApp.{' '}
                <Link to="/privacidade" target="_blank" className="text-gold-300 underline">
                  Privacidade
                </Link>
              </span>
            </label>

            {servico && data && hora && (
              <div className="card flex items-center justify-between gap-4 p-4 text-sm">
                <span>
                  <span className="block font-semibold text-zinc-50">{servico.nome}</span>
                  <span className="text-zinc-400">
                    {formatarDataLonga(data)} às {hora} · {nomeBarbeiro}
                  </span>
                </span>
                <span className="font-display text-lg font-bold text-gold-300">
                  {formatarPreco(servico.preco)}
                </span>
              </div>
            )}

            <button type="submit" className="btn-gold w-full py-3 text-base" disabled={!podeEnviar}>
              {enviando ? 'Confirmando…' : 'Confirmar agendamento'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Avatar({ barbeiro }: { barbeiro?: Barbeiro }) {
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gold-400/40 bg-ink-800 font-display text-lg font-bold text-gold-300">
      {barbeiro ? barbeiro.nome[0] : <IconeUsuario />}
    </span>
  );
}

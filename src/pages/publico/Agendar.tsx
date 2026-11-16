import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Inclinar } from '../../components/efeitos';
import {
  ErroCaixa,
  FotoBarbeiro,
  IconeCalendario,
  IconeCheck,
  IconeRelogio,
  IconeSeta,
  IconeVoltar,
  Skeletons,
} from '../../components/ui';
import { api, ErroApi, ultimoAgendamento } from '../../lib/api';
import {
  agoraSP,
  formatarDataLonga,
  formatarDuracao,
  formatarPreco,
  hhmmParaMin,
  nomeDiaCurto,
  somarDias,
} from '../../lib/datas';
import { baixarIcs } from '../../lib/ics';
import { mascararTelefone, normalizarTelefone } from '../../lib/telefone';
import { useConsulta } from '../../lib/useConsulta';
import type { AgendamentoCliente, Barbeiro, Horario, Servico } from '../../types';

const PASSOS = ['Serviço', 'Barbeiro', 'Dia', 'Horário', 'Seus dados'];
const TITULOS = ['Qual serviço?', 'Com quem?', 'Que dia?', 'Que horas?', 'Quase lá'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/* ---------------------------------------------------------------- peças */

function Opcao({
  selecionado,
  onClick,
  children,
  className = '',
}: {
  selecionado: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Inclinar
      graus={3}
      className={`card group ${selecionado ? '!border-gold-400/70 !bg-gold-400/[0.08]' : ''}`}
    >
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selecionado}
        className={`flex w-full cursor-pointer items-center gap-4 p-4 text-left sm:p-5 ${className}`}
      >
        {children}
        <span
          aria-hidden="true"
          className={`ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
            selecionado
              ? 'border-gold-300 bg-gold-400 text-ink-950'
              : 'border-white/15 text-transparent group-hover:border-gold-400/60'
          }`}
        >
          <IconeCheck width={14} height={14} />
        </span>
      </button>
    </Inclinar>
  );
}

function Resumo({
  servico,
  barbeiro,
  data,
  hora,
  passo,
  irPara,
}: {
  servico: Servico | null;
  barbeiro: { nome: string; foto?: string } | null;
  data: string | null;
  hora: string | null;
  passo: number;
  irPara: (p: number) => void;
}) {
  const linhas: [number, string, ReactNode | null][] = [
    [0, 'Serviço', servico?.nome ?? null],
    [
      1,
      'Barbeiro',
      barbeiro ? (
        <span className="flex items-center gap-2">
          {barbeiro.foto && (
            <FotoBarbeiro nome={barbeiro.nome} foto={barbeiro.foto} tamanho="h-6 w-6" />
          )}
          {barbeiro.nome}
        </span>
      ) : null,
    ],
    [2, 'Dia', data ? formatarDataLonga(data) : null],
    [3, 'Horário', hora && servico ? `${hora} – ${minFim(hora, servico.duracao_min)}` : null],
  ];
  return (
    <div className="card p-6">
      <p className="eyebrow">Seu horário</p>
      <dl className="mt-5 space-y-1">
        {linhas.map(([p, rotulo, valor]) => (
          <div key={rotulo}>
            <button
              type="button"
              disabled={!valor || p >= passo}
              onClick={() => irPara(p)}
              className="group flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition enabled:cursor-pointer enabled:hover:bg-white/[0.05]"
            >
              <dt className="text-sm text-zinc-500">{rotulo}</dt>
              <dd
                className={`text-right text-sm font-medium ${valor ? 'text-zinc-100' : 'text-zinc-600'}`}
              >
                {valor ?? '—'}
              </dd>
            </button>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex items-end justify-between border-t border-white/[0.07] pt-4">
        <span className="text-sm text-zinc-500">
          Total
          {servico && <span className="block text-xs">{formatarDuracao(servico.duracao_min)}</span>}
        </span>
        <span className="font-display text-3xl font-bold text-gold-200">
          {servico ? formatarPreco(servico.preco) : '—'}
        </span>
      </div>
    </div>
  );
}

function minFim(hora: string, duracao: number) {
  const m = hhmmParaMin(hora) + duracao;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/* ------------------------------------------------------------- confirmação */

function Confirmacao({ agendamento: a }: { agendamento: AgendamentoCliente }) {
  const config = useConsulta(api.getConfigPublica, []);
  const [copiado, setCopiado] = useState(false);
  const link = `${window.location.origin}${import.meta.env.BASE_URL}meu-agendamento/${a.token}`;

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
    <div className="relative mx-auto max-w-md px-4 py-10 text-center">
      <div
        aria-hidden="true"
        className="absolute top-0 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-400/10 blur-[90px]"
      />
      <span className="relative mx-auto flex h-16 w-16 animate-entrar items-center justify-center rounded-full bg-gradient-to-b from-emerald-300 to-emerald-500 text-ink-950 shadow-[0_0_50px_-5px_rgb(52_211_153/0.6)]">
        <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/30 [animation-iteration-count:2]" />
        <IconeCheck width={30} height={30} />
      </span>
      <h1 className="titulo mt-6 animate-entrar [animation-delay:120ms]">Horário marcado!</h1>
      <p className="mt-3 animate-entrar text-zinc-400 [animation-delay:200ms]">
        Você recebe um lembrete no WhatsApp cerca de 2 horas antes.
      </p>

      {/* Ticket */}
      <div className="mt-8 animate-entrar text-left [animation-delay:300ms]">
        <div className="card relative overflow-hidden rounded-b-none border-b-0 p-6">
          <div className="flex items-center gap-4">
            <FotoBarbeiro nome={a.barbeiro_nome} foto={a.barbeiro_foto} tamanho="h-14 w-14" />
            <div>
              <p className="text-lg font-semibold text-zinc-50">{a.servico_nome}</p>
              <p className="text-sm text-zinc-400">com {a.barbeiro_nome}</p>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs tracking-widest text-zinc-500 uppercase">Dia</p>
              <p className="mt-1 font-medium text-zinc-100 first-letter:uppercase">
                {formatarDataLonga(a.data)}
              </p>
            </div>
            <div>
              <p className="text-xs tracking-widest text-zinc-500 uppercase">Horário</p>
              <p className="mt-1 font-medium text-zinc-100">
                {a.hora_inicio} – {a.hora_fim}
              </p>
            </div>
          </div>
        </div>
        <div
          aria-hidden="true"
          className="relative h-6 border-x border-white/[0.08] bg-white/[0.03]"
        >
          <span className="absolute top-1/2 -left-3 h-6 w-6 -translate-y-1/2 rounded-full bg-ink-950" />
          <span className="absolute top-1/2 -right-3 h-6 w-6 -translate-y-1/2 rounded-full bg-ink-950" />
          <span className="absolute inset-x-5 top-1/2 border-t border-dashed border-white/15" />
        </div>
        <div className="card flex flex-wrap items-end justify-between gap-x-4 gap-y-2 rounded-t-none border-t-0 p-6">
          <div>
            <p className="text-xs tracking-widest text-zinc-500 uppercase">Código</p>
            <p className="texto-ouro font-display text-2xl font-black tracking-[0.15em] sm:text-3xl sm:tracking-[0.2em]">
              {a.codigo}
            </p>
          </div>
          <p className="font-display text-2xl font-bold text-zinc-100">{formatarPreco(a.preco)}</p>
        </div>
      </div>

      <div className="mt-6 flex animate-entrar flex-col gap-3 [animation-delay:420ms]">
        <button
          className="btn-gold py-3.5"
          disabled={!config.dados}
          onClick={() => config.dados && baixarIcs(a, config.dados)}
        >
          <IconeCalendario /> Adicionar ao calendário
        </button>
        <div className="grid grid-cols-2 gap-3">
          <button className="btn-ghost px-3 whitespace-nowrap" onClick={copiar}>
            {copiado ? 'Copiado!' : 'Copiar link'}
          </button>
          <Link to={`/meu-agendamento/${a.token}`} className="btn-ghost px-3 whitespace-nowrap">
            Ver ou cancelar
          </Link>
        </div>
      </div>
      <p className="mt-5 text-xs text-zinc-500">
        Guarde o link: é por ele que você consulta ou cancela o horário.
      </p>
    </div>
  );
}

/* -------------------------------------------------------- carrossel de dias */

function CarrosselDias({
  hoje,
  janela,
  livres,
  selecionado,
  onEscolher,
}: {
  hoje: string;
  janela: number;
  livres: string[];
  selecionado: string | null;
  onEscolher: (d: string) => void;
}) {
  const trilho = useRef<HTMLDivElement>(null);
  const dias = Array.from({ length: janela + 1 }, (_, i) => somarDias(hoje, i));
  const rolar = (dir: number) => trilho.current?.scrollBy({ left: dir * 320, behavior: 'smooth' });

  return (
    <div className="relative">
      <div className="mb-3 hidden justify-end gap-2 sm:flex">
        <button
          type="button"
          className="btn-ghost h-10 w-10 px-0"
          onClick={() => rolar(-1)}
          aria-label="Dias anteriores"
        >
          <IconeVoltar width={16} height={16} />
        </button>
        <button
          type="button"
          className="btn-ghost h-10 w-10 px-0"
          onClick={() => rolar(1)}
          aria-label="Próximos dias"
        >
          <IconeSeta width={16} height={16} />
        </button>
      </div>
      <div
        ref={trilho}
        className="sem-barra -mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-2 [mask-image:linear-gradient(90deg,transparent,#000_16px,#000_calc(100%-32px),transparent)]"
        onWheel={(e) => {
          if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && trilho.current)
            trilho.current.scrollLeft += e.deltaY;
        }}
      >
        {dias.map((d, i) => {
          const livre = livres.includes(d);
          const [, mes, dia] = d.split('-');
          const novoMes = i === 0 || dia === '01';
          return (
            <div key={d} className="flex shrink-0 snap-start items-end gap-2">
              {novoMes && (
                <span className="self-stretch py-2 pr-1 text-[0.65rem] font-semibold tracking-[0.25em] text-gold-400 uppercase [writing-mode:vertical-rl] rotate-180">
                  {MESES[Number(mes) - 1]}
                </span>
              )}
              <button
                type="button"
                disabled={!livre}
                aria-pressed={selecionado === d}
                aria-label={`${formatarDataLonga(d)}${livre ? '' : ' — sem horários'}`}
                onClick={() => onEscolher(d)}
                className={`relative flex h-24 w-[4.25rem] cursor-pointer flex-col items-center justify-center rounded-2xl border transition duration-300 disabled:cursor-not-allowed ${
                  selecionado === d
                    ? 'border-gold-300 bg-gradient-to-b from-gold-300 to-gold-500 text-ink-950 shadow-[0_10px_30px_-10px_#d4a94e]'
                    : livre
                      ? 'border-white/10 bg-white/[0.04] text-zinc-100 backdrop-blur hover:-translate-y-1 hover:border-gold-400/60'
                      : 'border-transparent text-zinc-600'
                }`}
              >
                <span className="text-[0.7rem] font-semibold uppercase">
                  {d === hoje ? 'hoje' : nomeDiaCurto(d)}
                </span>
                <span className="font-display text-2xl font-bold">{dia}</span>
                {livre && selecionado !== d && (
                  <span className="absolute bottom-2 h-1 w-1 rounded-full bg-emerald-400" />
                )}
              </button>
            </div>
          );
        })}
      </div>
      <p className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Dias com horário livre
      </p>
    </div>
  );
}

/* ---------------------------------------------------------- grade de horas */

function GradeHorarios({
  horarios,
  selecionada,
  onEscolher,
}: {
  horarios: Horario[];
  selecionada: string | null;
  onEscolher: (h: string) => void;
}) {
  const grupos: [string, Horario[]][] = [
    ['Manhã', horarios.filter((h) => hhmmParaMin(h.hora) < 720)],
    ['Tarde', horarios.filter((h) => hhmmParaMin(h.hora) >= 720 && hhmmParaMin(h.hora) < 1080)],
    ['Noite', horarios.filter((h) => hhmmParaMin(h.hora) >= 1080)],
  ];
  let indice = 0;
  return (
    <div className="space-y-7">
      {grupos
        .filter(([, lista]) => lista.length)
        .map(([rotulo, lista]) => (
          <div key={rotulo}>
            <p className="mb-3 flex items-center gap-3 text-xs font-semibold tracking-[0.25em] text-zinc-500 uppercase">
              {rotulo}
              <span className="h-px flex-1 bg-white/[0.06]" />
              <span className="tracking-normal normal-case">{lista.length} livres</span>
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {lista.map((h) => (
                <button
                  key={h.hora}
                  type="button"
                  aria-pressed={selecionada === h.hora}
                  onClick={() => onEscolher(h.hora)}
                  style={{ animationDelay: `${Math.min(indice++, 16) * 25}ms` }}
                  className={`min-h-12 animate-entrar cursor-pointer rounded-2xl border font-semibold tabular-nums transition duration-300 ${
                    selecionada === h.hora
                      ? 'border-gold-300 bg-gradient-to-b from-gold-300 to-gold-500 text-ink-950'
                      : 'border-white/10 bg-white/[0.04] text-zinc-100 backdrop-blur hover:-translate-y-0.5 hover:border-gold-400/60 hover:text-gold-200'
                  }`}
                >
                  {h.hora}
                </button>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}

/* ---------------------------------------------------------------- página */

export default function Agendar() {
  const [params] = useSearchParams();
  const [passo, setPasso] = useState(0);
  const [servico, setServico] = useState<Servico | null>(null);
  const [barbeiroId, setBarbeiroId] = useState<string | null>(params.get('barbeiro'));
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
  const primeiraVez = useRef(true);
  const etapasRef = useRef<HTMLElement>(null);

  const hoje = useMemo(() => agoraSP().data, []);
  const config = useConsulta(api.getConfigPublica, []);
  const servicos = useConsulta(api.listarServicos, []);
  const todosBarbeiros = useConsulta(() => api.listarBarbeiros(), []);
  const barbeiros = useConsulta(servico ? () => api.listarBarbeiros(servico.id) : null, [
    servico?.id,
  ]);
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

  // Pré-seleção vinda da página inicial (?servico= e/ou ?barbeiro=).
  const servicoInicial = params.get('servico');
  useEffect(() => {
    if (!servicoInicial || servico || !servicos.dados) return;
    const achado = servicos.dados.find((s) => s.id === servicoInicial);
    if (achado) {
      setServico(achado);
      setPasso(barbeiroId ? 2 : 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicos.dados]);

  // O barbeiro pré-escolhido precisa fazer o serviço escolhido.
  useEffect(() => {
    if (
      barbeiroId &&
      barbeiroId !== 'qualquer' &&
      barbeiros.dados &&
      !barbeiros.dados.some((b) => b.id === barbeiroId)
    ) {
      setBarbeiroId(null);
      if (passo > 1) setPasso(1);
    }
  }, [barbeiros.dados, barbeiroId, passo]);

  // No celular as etapas não cabem: mantém a etapa atual visível.
  useEffect(() => {
    const trilho = etapasRef.current;
    const atual = trilho?.querySelector<HTMLElement>('[aria-current]');
    if (trilho && atual) {
      trilho.scrollTo({
        left: atual.offsetLeft - trilho.clientWidth / 2 + atual.offsetWidth / 2,
        behavior: 'smooth',
      });
    }
  }, [passo]);

  useEffect(() => {
    if (primeiraVez.current) {
      primeiraVez.current = false;
      return;
    }
    tituloRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [passo]);

  if (resultado) return <Confirmacao agendamento={resultado} />;

  const achado = todosBarbeiros.dados?.find((b) => b.id === barbeiroId);
  const barbeiroEscolhido =
    barbeiroId === 'qualquer'
      ? { nome: 'Qualquer barbeiro' }
      : achado
        ? { nome: achado.nome, foto: achado.foto_url }
        : null;
  const telefoneValido = normalizarTelefone(telefone) !== null;
  const podeEnviar = nome.trim().length >= 2 && telefoneValido && aceite && !enviando;

  function escolherServico(s: Servico) {
    if (s.id !== servico?.id) {
      setData(null);
      setHora(null);
    }
    setServico(s);
    // Se o cliente veio pelo cartão de um barbeiro, pula direto para o dia.
    setPasso(barbeiroId ? 2 : 1);
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

  return (
    <div className="relative mx-auto max-w-6xl px-4 pt-4 pb-32 lg:pb-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 right-0 -z-10 h-80 w-80 rounded-full bg-gold-500/10 blur-[100px]"
      />

      {/* Etapas */}
      <nav
        ref={etapasRef}
        aria-label="Etapas do agendamento"
        className="sem-barra -mx-4 overflow-x-auto px-4"
      >
        <ol className="flex min-w-max items-center gap-2">
          {PASSOS.map((p, i) => (
            <li key={p} className="flex items-center gap-2">
              <button
                type="button"
                disabled={i >= passo}
                onClick={() => setPasso(i)}
                aria-current={i === passo ? 'step' : undefined}
                className={`flex items-center gap-2 rounded-full border py-1.5 pr-3.5 pl-1.5 text-xs font-semibold transition enabled:cursor-pointer ${
                  i === passo
                    ? 'border-gold-400/60 bg-gold-400/10 text-gold-100'
                    : i < passo
                      ? 'border-white/10 bg-white/[0.04] text-zinc-300 hover:border-gold-400/40'
                      : 'border-white/[0.06] text-zinc-600'
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[0.7rem] ${
                    i < passo
                      ? 'bg-gold-400 text-ink-950'
                      : i === passo
                        ? 'bg-gold-300 text-ink-950'
                        : 'bg-white/[0.06]'
                  }`}
                >
                  {i < passo ? <IconeCheck width={12} height={12} /> : i + 1}
                </span>
                {p}
              </button>
              {i < PASSOS.length - 1 && (
                <span
                  className={`h-px w-4 sm:w-8 ${i < passo ? 'bg-gold-400/60' : 'bg-white/10'}`}
                />
              )}
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem] lg:gap-12">
        <div className="min-w-0">
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
              <Link
                to="/"
                className="btn-ghost h-11 w-11 shrink-0 px-0"
                aria-label="Voltar ao início"
              >
                <IconeVoltar />
              </Link>
            )}
            <div>
              <p className="text-xs tracking-[0.25em] text-gold-400 uppercase">
                Passo {passo + 1} de {PASSOS.length}
              </p>
              <h1
                ref={tituloRef}
                tabIndex={-1}
                key={passo}
                className="titulo animate-entrar outline-none"
              >
                {TITULOS[passo]}
              </h1>
            </div>
          </div>

          {aviso && (
            <p
              role="alert"
              className="mt-6 animate-entrar rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100 backdrop-blur"
            >
              {aviso}
            </p>
          )}

          <div key={passo} className="mt-8 animate-entrar">
            {passo === 0 && (
              <div className="space-y-3">
                {servicos.erro && (
                  <ErroCaixa mensagem={servicos.erro} onTentar={servicos.recarregar} />
                )}
                {servicos.carregando && <Skeletons n={5} className="h-24" />}
                {servicos.dados?.map((s) => (
                  <Opcao
                    key={s.id}
                    selecionado={servico?.id === s.id}
                    onClick={() => escolherServico(s)}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-zinc-50">{s.nome}</span>
                      <span className="mt-0.5 line-clamp-2 text-sm text-zinc-400 sm:line-clamp-1">
                        {s.descricao}
                      </span>
                      <span className="mt-2 inline-flex items-center gap-1.5 text-xs text-zinc-500">
                        <IconeRelogio width={13} height={13} /> {formatarDuracao(s.duracao_min)}
                        <span className="ml-2 font-display text-base font-bold text-gold-200 sm:hidden">
                          {formatarPreco(s.preco)}
                        </span>
                      </span>
                    </span>
                    <span className="hidden font-display text-xl font-bold text-gold-200 sm:block">
                      {formatarPreco(s.preco)}
                    </span>
                  </Opcao>
                ))}
              </div>
            )}

            {passo === 1 && (
              <>
                {barbeiros.erro && (
                  <ErroCaixa mensagem={barbeiros.erro} onTentar={barbeiros.recarregar} />
                )}
                <div className="grid gap-3 sm:grid-cols-3">
                  {barbeiros.carregando && <Skeletons n={3} className="h-60" />}
                  {barbeiros.dados?.map((b) => (
                    <CartaoBarbeiro
                      key={b.id}
                      barbeiro={b}
                      selecionado={barbeiroId === b.id}
                      onClick={() => escolherBarbeiro(b.id)}
                    />
                  ))}
                </div>
                {barbeiros.dados && (
                  <div className="mt-3">
                    <Opcao
                      selecionado={barbeiroId === 'qualquer'}
                      onClick={() => escolherBarbeiro('qualquer')}
                    >
                      <span className="flex -space-x-3">
                        {barbeiros.dados.map((b) => (
                          <FotoBarbeiro
                            key={b.id}
                            nome={b.nome}
                            foto={b.foto_url}
                            tamanho="h-9 w-9 sm:h-11 sm:w-11"
                            className="ring-2 ring-ink-950"
                          />
                        ))}
                      </span>
                      <span>
                        <span className="block font-semibold text-zinc-50">Qualquer barbeiro</span>
                        <span className="text-sm text-zinc-400">
                          <span className="sm:hidden">Mais horários livres</span>
                          <span className="hidden sm:inline">
                            Mais horários: a gente encaixa com quem estiver livre
                          </span>
                        </span>
                      </span>
                    </Opcao>
                  </div>
                )}
              </>
            )}

            {passo === 2 && (
              <>
                {dias.erro && <ErroCaixa mensagem={dias.erro} onTentar={dias.recarregar} />}
                {dias.carregando && (
                  <div className="flex gap-2 overflow-hidden">
                    <Skeletons n={8} className="h-24 w-[4.25rem] shrink-0" />
                  </div>
                )}
                {dias.dados && (
                  <CarrosselDias
                    hoje={hoje}
                    janela={janela}
                    livres={dias.dados}
                    selecionado={data}
                    onEscolher={(d) => {
                      if (d !== data) setHora(null);
                      setData(d);
                      setPasso(3);
                    }}
                  />
                )}
                {dias.dados?.length === 0 && (
                  <p className="mt-4 text-sm text-zinc-400">
                    Sem horários nos próximos {janela} dias para essa escolha. Tente outro barbeiro.
                  </p>
                )}
              </>
            )}

            {passo === 3 && (
              <>
                {data && (
                  <p className="-mt-4 mb-6 text-zinc-400 first-letter:uppercase">
                    {formatarDataLonga(data)}
                  </p>
                )}
                {horarios.erro && (
                  <ErroCaixa mensagem={horarios.erro} onTentar={horarios.recarregar} />
                )}
                {horarios.carregando && (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    <Skeletons n={12} className="h-12" />
                  </div>
                )}
                {!horarios.carregando && horarios.dados && horarios.dados.length > 0 && (
                  <GradeHorarios
                    horarios={horarios.dados}
                    selecionada={hora}
                    onEscolher={(h) => {
                      setHora(h);
                      setAviso(null);
                      setPasso(4);
                    }}
                  />
                )}
                {!horarios.carregando && horarios.dados?.length === 0 && (
                  <div className="card p-6 text-sm text-zinc-400">
                    <p>Os horários desse dia acabaram.</p>
                    <button className="btn-ghost mt-4" onClick={() => setPasso(2)}>
                      Escolher outro dia
                    </button>
                  </div>
                )}
              </>
            )}

            {passo === 4 && (
              <form onSubmit={enviar} className="card space-y-5 p-5 sm:p-8" noValidate>
                <div>
                  <label htmlFor="nome" className="mb-2 block text-sm font-medium text-zinc-200">
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
                  <label
                    htmlFor="telefone"
                    className="mb-2 block text-sm font-medium text-zinc-200"
                  >
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
                  <p
                    id="telefone-ajuda"
                    className={`mt-2 text-xs ${telefone && !telefoneValido ? 'text-amber-300' : 'text-zinc-500'}`}
                  >
                    {telefone && !telefoneValido
                      ? 'Digite o número completo, com DDD.'
                      : 'É para onde enviamos o lembrete.'}
                  </p>
                </div>
                <div>
                  <label htmlFor="obs" className="mb-2 block text-sm font-medium text-zinc-200">
                    Observação <span className="font-normal text-zinc-500">(opcional)</span>
                  </label>
                  <textarea
                    id="obs"
                    className="campo resize-none"
                    rows={2}
                    maxLength={200}
                    placeholder="Ex.: quero manter o comprimento em cima"
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
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-zinc-300">
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
                <button
                  type="submit"
                  className="btn-gold w-full py-4 text-sm whitespace-nowrap sm:text-base"
                  disabled={!podeEnviar}
                >
                  {enviando ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-950/30 border-t-ink-950" />
                      Confirmando…
                    </>
                  ) : (
                    <>
                      Confirmar agendamento <IconeSeta />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Resumo: lateral fixa no desktop */}
        <aside className="hidden lg:block">
          <div className="sticky top-28">
            <Resumo
              servico={servico}
              barbeiro={barbeiroEscolhido}
              data={data}
              hora={hora}
              passo={passo}
              irPara={setPasso}
            />
          </div>
        </aside>
      </div>

      {/* Resumo: barra inferior no celular */}
      {servico && (
        <div className="vidro fixed inset-x-3 bottom-3 z-30 flex items-center gap-3 rounded-full !bg-ink-950/70 py-2 pr-2 pl-5 lg:hidden">
          <span className="min-w-0 flex-1 text-sm">
            <span className="block truncate font-semibold text-zinc-50">{servico.nome}</span>
            <span className="block truncate text-xs text-zinc-400">
              {[
                barbeiroEscolhido?.nome,
                data && formatarDataLonga(data).split(',')[1]?.trim(),
                hora,
              ]
                .filter(Boolean)
                .join(' · ') || formatarDuracao(servico.duracao_min)}
            </span>
          </span>
          <span className="rounded-full bg-gold-400/15 px-4 py-2 font-display font-bold text-gold-200">
            {formatarPreco(servico.preco)}
          </span>
        </div>
      )}
    </div>
  );
}

function CartaoBarbeiro({
  barbeiro: b,
  selecionado,
  onClick,
}: {
  barbeiro: Barbeiro;
  selecionado: boolean;
  onClick: () => void;
}) {
  return (
    <Inclinar
      className={`card group ${selecionado ? '!border-gold-400/70 !bg-gold-400/[0.08]' : ''}`}
    >
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selecionado}
        data-cursor="Escolher"
        className="flex w-full cursor-pointer items-center gap-4 p-4 text-left sm:flex-col sm:px-4 sm:pt-7 sm:pb-6 sm:text-center"
      >
        <span className="relative">
          <FotoBarbeiro
            nome={b.nome}
            foto={b.foto_url}
            tamanho="h-16 w-16 sm:h-28 sm:w-28"
            className="transition duration-500 group-hover:scale-105"
          />
          {selecionado && (
            <span className="absolute -right-1 -bottom-1 flex h-7 w-7 animate-entrar items-center justify-center rounded-full border-2 border-ink-950 bg-gold-400 text-ink-950">
              <IconeCheck width={14} height={14} />
            </span>
          )}
        </span>
        <span>
          <span className="block font-display text-xl font-bold text-zinc-50 sm:text-2xl">
            {b.nome}
          </span>
          {b.instagram && (
            <span className="mt-0.5 block truncate text-xs text-zinc-500">@{b.instagram}</span>
          )}
        </span>
      </button>
    </Inclinar>
  );
}

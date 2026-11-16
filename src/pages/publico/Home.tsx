import { useRef, type MouseEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Contador,
  Inclinar,
  Letreiro,
  Magnetico,
  Revelar,
  useProgressoScroll,
  useScrollY,
} from '../../components/efeitos';
import {
  ErroCaixa,
  FotoBarbeiro,
  IconeEstrela,
  IconeInstagram,
  IconePin,
  IconeRelogio,
  IconeSeta,
  IconeWhatsapp,
  Marca,
  SeloGiratorio,
  Skeletons,
} from '../../components/ui';
import { api, ultimoAgendamento } from '../../lib/api';
import {
  agoraSP,
  diaSemana,
  formatarDataCurta,
  formatarDuracao,
  formatarPreco,
  hhmmParaMin,
  somarDias,
} from '../../lib/datas';
import { formatarTelefone } from '../../lib/telefone';
import { useConsulta } from '../../lib/useConsulta';
import type { ConfigPublica } from '../../types';

/* ---------------------------------------------------------------- peças */

function Cabeca({
  eyebrow,
  titulo,
  children,
  centro = false,
}: {
  eyebrow: string;
  titulo: ReactNode;
  children?: ReactNode;
  centro?: boolean;
}) {
  return (
    <div className={centro ? 'mx-auto max-w-2xl text-center' : 'max-w-xl'}>
      <Revelar>
        <p className="eyebrow">{eyebrow}</p>
      </Revelar>
      <Revelar atraso={80}>
        <h2 className="titulo mt-4 text-4xl sm:text-5xl">{titulo}</h2>
      </Revelar>
      {children && (
        <Revelar atraso={160}>
          <p className="mt-5 text-base leading-relaxed text-zinc-400">{children}</p>
        </Revelar>
      )}
    </div>
  );
}

function AvisoHorarioMarcado() {
  const token = ultimoAgendamento.ler();
  const { dados } = useConsulta(token ? () => api.getAgendamentoPorToken(token) : null, [token]);
  if (!dados || (dados.status !== 'AGENDADO' && dados.status !== 'CONFIRMADO')) return null;
  return (
    <Link
      to={`/meu-agendamento/${dados.token}`}
      className="vidro mx-auto mt-8 flex max-w-md animate-entrar items-center gap-3 rounded-full py-2 pr-3 pl-2 text-left text-sm transition hover:border-gold-400/50"
    >
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-400/15 text-gold-300">
        <span className="absolute inset-0 animate-ping rounded-full bg-gold-400/20" />
        <IconeRelogio width={18} height={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-gold-100">Você tem um horário marcado</span>
        <span className="block truncate text-zinc-400">
          {dados.servico_nome} · {formatarDataCurta(dados.data)} às {dados.hora_inicio}
        </span>
      </span>
      <IconeSeta className="shrink-0 text-gold-300" />
    </Link>
  );
}

/** Busca o primeiro horário livre de um corte nos próximos dias. */
function ProximoHorario() {
  const hoje = agoraSP().data;
  const { dados, carregando } = useConsulta(async () => {
    const dias = await api.getDiasDisponiveis('s1', 'qualquer', hoje, somarDias(hoje, 7));
    if (!dias.length) return null;
    const [primeiro] = await api.getHorarios('s1', 'qualquer', dias[0]);
    return primeiro ? { data: dias[0], hora: primeiro.hora } : null;
  }, []);

  return (
    <Link
      to="/agendar?servico=s1"
      data-cursor="Agendar"
      className="vidro group flex items-center gap-4 rounded-3xl p-4 pr-5 transition hover:border-gold-400/40"
    >
      <span className="relative flex h-3 w-3 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
      </span>
      <span className="min-w-0">
        <span className="block text-[0.65rem] tracking-[0.25em] text-zinc-500 uppercase">
          Próximo horário livre
        </span>
        {carregando ? (
          <span className="skeleton mt-1 block h-5 w-36" />
        ) : (
          <span className="block font-semibold text-zinc-50">
            {dados
              ? `${dados.data === hoje ? 'Hoje' : formatarDataCurta(dados.data)} às ${dados.hora}`
              : 'Ver agenda'}
          </span>
        )}
      </span>
      <IconeSeta className="ml-auto text-gold-300 transition group-hover:translate-x-1" />
    </Link>
  );
}

/* ----------------------------------------------------------------- hero */

const LETRAS = 'UNDERGROUND'.split('');
// Cabe numa linha só: a palavra ocupa ~8,7em em Cinzel Black.
const LETREIRO =
  'font-display text-[clamp(2rem,10.2vw,8.25rem)] leading-[0.95] font-black tracking-tight whitespace-nowrap';

function Hero() {
  const y = useScrollY();
  const titulo = useRef<HTMLDivElement>(null);

  // O brilho do letreiro acompanha o cursor.
  function mover(e: MouseEvent<HTMLElement>) {
    const el = titulo.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--tx', `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty('--ty', `${((e.clientY - r.top) / r.height) * 100}%`);
  }

  const sumir = Math.min(1, y / 600);
  return (
    <section
      onMouseMove={mover}
      className="relative isolate flex min-h-[100svh] items-center overflow-hidden px-4 pt-28 pb-24"
    >
      {/* Fundo: grade, orbes e vinheta */}
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="grade-fundo absolute inset-0" />
        <div
          className="absolute top-[-10%] left-1/2 h-[70vh] w-[70vh] -translate-x-1/2 rounded-full bg-gold-500/25 blur-[120px]"
          style={{ transform: `translate(-50%, ${y * 0.25}px)` }}
        />
        <div className="absolute top-[30%] left-[8%] h-64 w-64 animate-flutuar rounded-full bg-gold-300/10 blur-[90px]" />
        <div className="absolute right-[6%] bottom-[10%] h-80 w-80 animate-flutuar rounded-full bg-amber-700/20 blur-[100px] [animation-delay:-6s]" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-ink-950 to-transparent" />
      </div>

      <div
        className="mx-auto w-full max-w-6xl text-center"
        style={{ transform: `translate3d(0, ${y * 0.35}px, 0)`, opacity: 1 - sumir * 0.9 }}
      >
        <p className="eyebrow animate-entrar justify-center before:hidden">Mogi das Cruzes · SP</p>

        <div ref={titulo} className="relative mt-6 select-none" aria-hidden="true">
          <p className={`${LETREIRO} relative`}>
            {LETRAS.map((l, i) => (
              <span
                key={i}
                className="texto-ouro inline-block animate-entrar"
                style={{ animationDelay: `${120 + i * 45}ms` }}
              >
                {l}
              </span>
            ))}
            {/* Camada de brilho: mesmas letras, mascaradas pela posição do cursor (só com mouse). */}
            <span
              className="pointer-events-none absolute inset-0 hidden text-gold-100 [@media(hover:hover)]:block"
              style={{
                WebkitMaskImage:
                  'radial-gradient(circle 180px at var(--tx, -50%) var(--ty, 50%), #000, transparent)',
                maskImage:
                  'radial-gradient(circle 180px at var(--tx, -50%) var(--ty, 50%), #000, transparent)',
              }}
            >
              {LETRAS.map((l, i) => (
                <span key={i} className="inline-block">
                  {l}
                </span>
              ))}
            </span>
          </p>
          <p className="mt-3 animate-entrar text-[clamp(0.7rem,2.4vw,1.15rem)] font-medium tracking-[1em] text-gold-400/80 [animation-delay:700ms]">
            BARBERSHOP
          </p>
        </div>
        <h1 className="sr-only">Underground Barbershop — agendamento online</h1>

        <p className="mx-auto mt-8 max-w-lg animate-entrar text-lg leading-relaxed text-zinc-300 [animation-delay:850ms] sm:text-xl">
          A barbearia de <span className="texto-brilho font-semibold">todas as tribos</span>. Marque
          seu horário em menos de um minuto.
        </p>

        <div className="mt-10 flex animate-entrar flex-col items-center justify-center gap-3 [animation-delay:1000ms] sm:flex-row">
          <Magnetico>
            <Link to="/agendar" className="btn-gold px-9 py-4 text-base" data-cursor="Bora">
              Agendar horário <IconeSeta />
            </Link>
          </Magnetico>
          <Magnetico forca={0.2}>
            <a href="#servicos" className="btn-ghost px-7 py-4 text-base">
              Ver serviços
            </a>
          </Magnetico>
        </div>

        <div className="mt-10 flex animate-entrar flex-wrap items-center justify-center gap-3 [animation-delay:1150ms]">
          <span className="vidro inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm">
            <span className="flex text-gold-400" aria-hidden="true">
              {Array.from({ length: 5 }, (_, i) => (
                <IconeEstrela key={i} width={14} height={14} />
              ))}
            </span>
            <strong className="text-zinc-50">5,0</strong>
            <span className="text-zinc-400">· 59 avaliações no Google</span>
          </span>
        </div>

        <AvisoHorarioMarcado />
      </div>

      {/* Cartões flutuantes (desktop) */}
      <div
        className="absolute bottom-10 left-6 hidden w-72 animate-entrar [animation-delay:1300ms] lg:block"
        style={{ transform: `translate3d(0, ${-y * 0.15}px, 0)` }}
      >
        <ProximoHorario />
      </div>
      <SeloGiratorio
        texto="Agende online ✦ Sem cadastro ✦ "
        className="absolute right-8 bottom-10 hidden h-32 w-32 lg:flex"
      />

      <a
        href="#servicos"
        aria-label="Rolar para os serviços"
        className="absolute bottom-6 left-1/2 flex h-12 w-7 -translate-x-1/2 justify-center rounded-full border border-white/20 pt-2 lg:bottom-10"
        style={{ opacity: 1 - sumir * 2 }}
      >
        <span className="h-2 w-1 animate-bounce rounded-full bg-gold-300" />
      </a>
    </section>
  );
}

/* ------------------------------------------------------------ serviços */

function Servicos() {
  const servicos = useConsulta(api.listarServicos, []);
  return (
    <section id="servicos" className="relative mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:py-32">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.5fr] lg:gap-16">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <Cabeca
            eyebrow="Serviços"
            titulo={
              <>
                Escolha o seu <span className="texto-ouro">estilo</span>
              </>
            }
          >
            Do clássico ao degradê navalhado. Preço fechado, tempo certo e zero espera: o horário é
            seu.
          </Cabeca>
          <Revelar atraso={240} className="mt-8 hidden lg:block">
            <Link to="/agendar" className="btn-ghost">
              Ver horários livres <IconeSeta />
            </Link>
          </Revelar>
        </div>

        <ul className="space-y-3">
          {servicos.erro && <ErroCaixa mensagem={servicos.erro} onTentar={servicos.recarregar} />}
          {servicos.carregando && <Skeletons n={5} className="h-28" />}
          {servicos.dados?.map((s, i) => (
            <Revelar como="li" key={s.id} atraso={i * 70}>
              <Inclinar graus={4} className="card group">
                <Link
                  to={`/agendar?servico=${s.id}`}
                  data-cursor="Agendar"
                  className="flex items-center gap-4 p-5 sm:gap-6 sm:p-6"
                >
                  <span className="texto-contorno hidden font-display text-4xl font-black sm:block">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-semibold text-zinc-50">{s.nome}</span>
                    <span className="mt-1 block text-sm text-zinc-400">{s.descricao}</span>
                    <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-300">
                      <IconeRelogio width={13} height={13} /> {formatarDuracao(s.duracao_min)}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-2">
                    <span className="font-display text-2xl font-bold text-gold-200">
                      {formatarPreco(s.preco)}
                    </span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-gold-300 transition duration-500 group-hover:rotate-[-45deg] group-hover:border-gold-400 group-hover:bg-gold-400 group-hover:text-ink-950">
                      <IconeSeta width={16} height={16} />
                    </span>
                  </span>
                </Link>
              </Inclinar>
            </Revelar>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- equipe */

function Equipe() {
  const barbeiros = useConsulta(() => api.listarBarbeiros(), []);
  return (
    <section id="equipe" className="relative scroll-mt-20 overflow-hidden py-24 sm:py-32">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-1/3 -z-10 h-96 bg-gold-500/10 blur-[140px]"
      />
      <div className="mx-auto max-w-6xl px-4">
        <Cabeca
          centro
          eyebrow="Equipe"
          titulo={
            <>
              Quem cuida do <span className="texto-ouro">seu visual</span>
            </>
          }
        >
          Três estilos, a mesma régua. Escolha quem vai te atender ou deixe que a gente encaixe no
          primeiro horário livre.
        </Cabeca>

        <ul className="mt-16 grid gap-5 sm:grid-cols-3 sm:gap-6">
          {barbeiros.carregando && <Skeletons n={3} className="h-96" />}
          {barbeiros.dados?.map((b, i) => (
            <Revelar
              como="li"
              key={b.id}
              atraso={i * 120}
              className={i === 1 ? 'sm:translate-y-10' : ''}
            >
              <Inclinar className="card group h-full">
                <Link
                  to={`/agendar?barbeiro=${b.id}`}
                  data-cursor={`Com ${b.nome}`}
                  className="flex h-full flex-col items-center px-6 pt-10 pb-8 text-center"
                >
                  <span className="relative">
                    <span
                      aria-hidden="true"
                      className="absolute -inset-3 rounded-full border border-dashed border-gold-400/30 transition duration-700 group-hover:rotate-180 group-hover:border-gold-300/70"
                    />
                    <FotoBarbeiro
                      nome={b.nome}
                      foto={b.foto_url}
                      tamanho="h-40 w-40 sm:h-36 sm:w-36 lg:h-44 lg:w-44"
                      className="transition duration-700 group-hover:scale-[1.04]"
                    />
                  </span>
                  <span className="mt-8 font-display text-3xl font-bold text-zinc-50">
                    {b.nome}
                  </span>
                  <span className="mt-1 text-xs tracking-[0.3em] text-gold-400 uppercase">
                    Barbeiro
                  </span>
                  {b.instagram && (
                    <span className="mt-3 inline-flex max-w-full items-center gap-1.5 truncate text-sm text-zinc-400">
                      <IconeInstagram width={15} height={15} /> @{b.instagram}
                    </span>
                  )}
                  <span className="btn-ghost mt-6 w-full group-hover:border-gold-400/60 group-hover:text-gold-200">
                    Agendar com {b.nome}
                  </span>
                </Link>
              </Inclinar>
            </Revelar>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- números */

function Numeros() {
  const itens: [ReactNode, string][] = [
    [<Contador key="n" ate={5} casas={1} />, 'nota no Google'],
    [<Contador key="a" ate={59} />, 'avaliações'],
    [<Contador key="b" ate={3} />, 'barbeiros'],
    [
      <>
        <Contador key="d" ate={30} /> dias
      </>,
      'de agenda aberta',
    ],
  ];
  return (
    <section aria-label="Números" className="mx-auto max-w-6xl px-4 pt-8 pb-20">
      <Revelar
        tipo="zoom"
        className="card grid grid-cols-2 divide-white/[0.06] sm:grid-cols-4 sm:divide-x"
      >
        {itens.map(([valor, rotulo]) => (
          <div key={rotulo} className="px-4 py-8 text-center">
            <p className="texto-ouro font-display text-4xl font-black sm:text-5xl">{valor}</p>
            <p className="mt-2 text-xs tracking-[0.2em] text-zinc-500 uppercase">{rotulo}</p>
          </div>
        ))}
      </Revelar>
    </section>
  );
}

/* --------------------------------------------------------------- espaço */

function Espaco() {
  return (
    <section id="espaco" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:py-32">
      <Cabeca
        eyebrow="O espaço"
        titulo={
          <>
            Mais que um <span className="texto-ouro">corte</span>
          </>
        }
      >
        Chegou cedo? Tem mesa de sinuca, cerveja gelada e um som rolando. Aqui ninguém fica olhando
        para o relógio.
      </Cabeca>

      <div className="mt-14 grid auto-rows-[minmax(13rem,auto)] gap-4 md:grid-cols-6">
        <Revelar className="md:col-span-4">
          <Inclinar graus={3} className="card group relative h-full overflow-hidden p-8">
            <span
              aria-hidden="true"
              className="absolute -right-10 -bottom-10 flex h-56 w-56 items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#3a3a41,#070708_70%)] shadow-[0_30px_60px_-20px_#000] transition duration-700 group-hover:rotate-12"
            >
              <span className="flex h-24 w-24 items-center justify-center rounded-full bg-zinc-100 font-display text-5xl font-black text-ink-950">
                8
              </span>
            </span>
            <p className="eyebrow">Enquanto espera</p>
            <p className="mt-4 font-display text-5xl font-black text-zinc-50 sm:text-6xl">Sinuca</p>
            <p className="mt-3 max-w-xs text-zinc-400">
              Mesa liberada para quem chega. Desafie o barbeiro — se tiver coragem.
            </p>
          </Inclinar>
        </Revelar>
        <Revelar className="md:col-span-2" atraso={100}>
          <Inclinar graus={5} className="card relative h-full overflow-hidden p-8">
            <span
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-amber-500/20 to-transparent"
            />
            <span aria-hidden="true" className="absolute right-6 bottom-6 flex gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="h-2 w-2 animate-bounce rounded-full bg-gold-200/60"
                  style={{ animationDelay: `${i * 180}ms`, animationDuration: `${1.4 + i * 0.3}s` }}
                />
              ))}
            </span>
            <p className="eyebrow">Por conta da casa</p>
            <p className="mt-4 font-display text-4xl font-black text-zinc-50">
              Cerveja <span className="texto-ouro">gelada</span>
            </p>
          </Inclinar>
        </Revelar>
        <Revelar className="md:col-span-3" atraso={150}>
          <Inclinar graus={4} className="card h-full overflow-hidden p-8">
            <p className="eyebrow">Sem rótulo</p>
            <p className="mt-4 font-display text-4xl font-black text-zinc-50">Todas as tribos</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {['Social', 'Degradê', 'Navalhado', 'Clássico', 'Freestyle', 'Barba de respeito'].map(
                (t) => (
                  <span
                    key={t}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm text-zinc-300 transition hover:border-gold-400/50 hover:text-gold-200"
                  >
                    {t}
                  </span>
                ),
              )}
            </div>
          </Inclinar>
        </Revelar>
        <Revelar className="md:col-span-3" atraso={200}>
          <Inclinar
            graus={4}
            className="card flex h-full flex-col justify-between overflow-hidden p-8"
          >
            <div>
              <p className="eyebrow">Sem ligação</p>
              <p className="mt-4 font-display text-4xl font-black text-zinc-50">
                Agenda <span className="texto-ouro">24h</span>
              </p>
              <p className="mt-3 text-zinc-400">E lembrete no WhatsApp duas horas antes.</p>
            </div>
            <Link to="/agendar" className="btn-gold mt-6 self-start">
              Marcar agora <IconeSeta />
            </Link>
          </Inclinar>
        </Revelar>
      </div>
    </section>
  );
}

/* -------------------------------------------------------- como funciona */

const PASSOS = [
  { titulo: 'Escolha', texto: 'Serviço, barbeiro, dia e horário. Sem cadastro, sem senha.' },
  { titulo: 'Receba o lembrete', texto: 'Cerca de 2 horas antes chega um aviso no seu WhatsApp.' },
  { titulo: 'Confirme com um toque', texto: 'Imprevisto? Cancele pelo link e libere o horário.' },
];

function ComoFunciona() {
  const [ref, p] = useProgressoScroll<HTMLDivElement>();
  // A linha começa a encher quando a seção entra e termina antes de sair.
  const enchimento = Math.min(1, Math.max(0, (p - 0.25) / 0.4));
  return (
    <section className="relative overflow-hidden border-y border-white/[0.06] bg-white/[0.015] py-24 sm:py-32">
      <div className="mx-auto grid max-w-6xl gap-14 px-4 lg:grid-cols-2">
        <div>
          <Cabeca
            eyebrow="Agendamento online"
            titulo={
              <>
                Marque em <span className="texto-ouro">três passos</span>
              </>
            }
          >
            Sem fila no direct, sem esperar resposta. O horário que aparece livre é seu.
          </Cabeca>
          <Revelar atraso={240} className="mt-8">
            <Magnetico>
              <Link to="/agendar" className="btn-gold px-8 py-3.5" data-cursor="Bora">
                Agendar agora <IconeSeta />
              </Link>
            </Magnetico>
          </Revelar>
        </div>

        <div ref={ref} className="relative pl-12">
          <span
            aria-hidden="true"
            className="absolute top-2 bottom-2 left-[1.15rem] w-px bg-white/10"
          />
          <span
            aria-hidden="true"
            className="absolute top-2 left-[1.15rem] w-px origin-top bg-gradient-to-b from-gold-200 to-gold-500 shadow-[0_0_12px_#d4a94e]"
            style={{ height: 'calc(100% - 1rem)', transform: `scaleY(${enchimento})` }}
          />
          <ol className="space-y-12">
            {PASSOS.map((passo, i) => {
              const aceso = enchimento >= i / (PASSOS.length - 1) - 0.02;
              return (
                <li key={passo.titulo} className="relative">
                  <span
                    className={`absolute top-0 -left-12 flex h-10 w-10 items-center justify-center rounded-full border font-display font-bold transition duration-500 ${
                      aceso
                        ? 'border-gold-300 bg-gold-400 text-ink-950 shadow-[0_0_30px_-4px_#d4a94e]'
                        : 'border-white/15 bg-ink-900 text-zinc-500'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div
                    className={`card p-6 transition duration-500 ${aceso ? 'opacity-100' : 'opacity-40'}`}
                  >
                    <p className="text-lg font-semibold text-zinc-50">{passo.titulo}</p>
                    <p className="mt-1 text-zinc-400">{passo.texto}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- local */

function statusAgora(c: ConfigPublica): { aberto: boolean; texto: string } {
  const agora = agoraSP();
  const hoje = c.horario_semana.find((h) => h.dia_semana === diaSemana(agora.data));
  if (hoje && agora.minutos >= hhmmParaMin(hoje.abre) && agora.minutos < hhmmParaMin(hoje.fecha)) {
    return { aberto: true, texto: `Aberto agora · fecha às ${hoje.fecha}` };
  }
  for (let i = 0; i < 8; i++) {
    const d = somarDias(agora.data, i);
    const h = c.horario_semana.find((x) => x.dia_semana === diaSemana(d));
    if (h && (i > 0 || agora.minutos < hhmmParaMin(h.abre))) {
      const quando = i === 0 ? 'hoje' : i === 1 ? 'amanhã' : formatarDataCurta(d).split(',')[0];
      return { aberto: false, texto: `Fechado · abre ${quando} às ${h.abre}` };
    }
  }
  return { aberto: false, texto: 'Fechado' };
}

function Local() {
  const config = useConsulta(api.getConfigPublica, []);
  const c = config.dados;
  const status = c ? statusAgora(c) : null;
  return (
    <section id="local" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:py-32">
      <Cabeca
        eyebrow="Onde estamos"
        titulo={
          <>
            Cola na <span className="texto-ouro">Underground</span>
          </>
        }
      />
      {config.erro && <ErroCaixa mensagem={config.erro} onTentar={config.recarregar} />}
      {c && status && (
        <div className="mt-12 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <Revelar tipo="esquerda" className="card space-y-7 p-7">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                status.aberto
                  ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
                  : 'border-white/10 bg-white/[0.04] text-zinc-300'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${status.aberto ? 'bg-emerald-400' : 'bg-zinc-500'}`}
              />
              {status.texto}
            </span>
            <div className="flex gap-3">
              <IconePin className="mt-0.5 shrink-0 text-gold-400" />
              <div>
                <p className="text-zinc-100">{c.endereco}</p>
                <a
                  href={c.maps_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-gold-300 hover:underline"
                >
                  Traçar rota <IconeSeta width={14} height={14} />
                </a>
              </div>
            </div>
            <div className="flex gap-3">
              <IconeRelogio className="mt-0.5 shrink-0 text-gold-400" />
              <dl className="flex-1 space-y-2 text-sm">
                {c.funcionamento.map((f) => (
                  <div
                    key={f.dias}
                    className="flex justify-between gap-4 border-b border-white/[0.05] pb-2 last:border-0"
                  >
                    <dt className="text-zinc-400">{f.dias}</dt>
                    <dd
                      className={`font-medium ${f.horario === 'Fechado' ? 'text-zinc-500' : 'text-zinc-100'}`}
                    >
                      {f.horario}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href={`https://wa.me/${c.telefone_contato}`}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost"
              >
                <IconeWhatsapp /> WhatsApp
              </a>
              <a href={c.instagram_url} target="_blank" rel="noreferrer" className="btn-ghost">
                <IconeInstagram /> Instagram
              </a>
            </div>
          </Revelar>
          <Revelar atraso={120} className="card relative min-h-80 overflow-hidden p-1.5">
            <iframe
              title="Mapa — Underground Barbershop"
              src="https://www.google.com/maps?q=Av.+Manoel+Alves,+305,+Mogi+das+Cruzes,+SP&output=embed"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-full min-h-80 w-full rounded-[1.25rem] [filter:invert(0.92)_hue-rotate(180deg)_saturate(0.6)_brightness(0.95)]"
            />
          </Revelar>
        </div>
      )}
    </section>
  );
}

/* ---------------------------------------------------------- chamada final */

function ChamadaFinal() {
  return (
    <section className="relative isolate overflow-hidden px-4 py-28 text-center sm:py-40">
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-1/2 h-[50vh] w-[80vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-500/15 blur-[120px]" />
      </div>
      <Revelar tipo="zoom">
        <p className="font-display text-[clamp(2.4rem,8vw,6rem)] leading-[0.95] font-black text-zinc-50">
          Bora dar um <br />
          <span className="texto-brilho">tapa no visual?</span>
        </p>
      </Revelar>
      <Revelar atraso={150} className="mt-12">
        <Magnetico forca={0.4}>
          <Link to="/agendar" className="btn-gold px-12 py-5 text-lg" data-cursor="Bora">
            Agendar meu horário <IconeSeta />
          </Link>
        </Magnetico>
      </Revelar>
    </section>
  );
}

/* ---------------------------------------------------------------- página */

export default function Home() {
  const config = useConsulta(api.getConfigPublica, []);
  const c = config.dados;
  return (
    <>
      <Hero />
      <div className="-rotate-2 scale-105 border-y border-gold-400/20 bg-gold-400/[0.06] py-5 font-display text-2xl font-bold tracking-wide text-zinc-100 backdrop-blur sm:text-4xl">
        <Letreiro
          itens={['Corte', 'Barba', 'Sinuca', 'Cerveja gelada', 'Degradê', 'Todas as tribos']}
        />
      </div>
      <Servicos />
      <Equipe />
      <Numeros />
      <Espaco />
      <ComoFunciona />
      <Local />
      <ChamadaFinal />

      <footer className="relative z-10 border-t border-white/[0.06] px-4 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 text-sm text-zinc-500 sm:flex-row">
          <Marca />
          {c && (
            <p className="text-center">
              {c.instagram_usuario} · {formatarTelefone(c.telefone_contato)}
            </p>
          )}
          <p className="flex gap-5">
            <Link to="/privacidade" className="hover:text-gold-300">
              Privacidade
            </Link>
            <Link to="/admin/login" className="hover:text-gold-300">
              Área do barbeiro
            </Link>
          </p>
        </div>
      </footer>
    </>
  );
}

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ErroCaixa,
  IconeEstrela,
  IconeInstagram,
  IconePin,
  IconeRelogio,
  IconeSeta,
  IconeWhatsapp,
  Marca,
  Skeletons,
} from '../../components/ui';
import { api, ultimoAgendamento } from '../../lib/api';
import { formatarDataCurta, formatarDuracao, formatarPreco } from '../../lib/datas';
import { formatarTelefone } from '../../lib/telefone';
import { useConsulta } from '../../lib/useConsulta';

function Secao({
  id,
  eyebrow,
  titulo,
  children,
}: {
  id: string;
  eyebrow: string;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mx-auto max-w-5xl scroll-mt-20 px-4 py-14 sm:py-20">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="titulo mt-2">{titulo}</h2>
      <div className="mt-8">{children}</div>
    </section>
  );
}

function AvisoHorarioMarcado() {
  const token = ultimoAgendamento.ler();
  const { dados } = useConsulta(token ? () => api.getAgendamentoPorToken(token) : null, [token]);
  if (!dados || (dados.status !== 'AGENDADO' && dados.status !== 'CONFIRMADO')) return null;
  return (
    <Link
      to={`/meu-agendamento/${dados.token}`}
      className="mx-auto mt-8 flex max-w-md items-center justify-between gap-3 rounded-2xl border border-gold-400/40 bg-gold-400/10 px-4 py-3 text-left text-sm hover:bg-gold-400/15"
    >
      <span>
        <span className="block font-semibold text-gold-200">Você tem um horário marcado</span>
        <span className="text-zinc-300">
          {dados.servico_nome} · {formatarDataCurta(dados.data)} às {dados.hora_inicio}
        </span>
      </span>
      <IconeSeta className="shrink-0 text-gold-300" />
    </Link>
  );
}

const DIFERENCIAIS = [
  { titulo: 'Sinuca', texto: 'Mesa liberada enquanto você espera a sua vez.' },
  { titulo: 'Cerveja gelada', texto: 'Para chegar, sentar e relaxar.' },
  { titulo: 'Todas as tribos', texto: 'Do clássico ao degradê, do skate ao social.' },
];

const PASSOS = [
  { titulo: 'Escolha', texto: 'Serviço, barbeiro, dia e horário. Sem cadastro, sem senha.' },
  { titulo: 'Receba o lembrete', texto: 'Cerca de 2 horas antes chega um aviso no seu WhatsApp.' },
  { titulo: 'Confirme com um toque', texto: 'Imprevisto? Cancele pelo link e libere o horário.' },
];

export default function Home() {
  const config = useConsulta(api.getConfigPublica, []);
  const servicos = useConsulta(api.listarServicos, []);
  const barbeiros = useConsulta(() => api.listarBarbeiros(), []);
  const c = config.dados;

  return (
    <>
      <section className="fundo-hero border-b border-ink-700 px-4 pt-16 pb-14 text-center sm:pt-24 sm:pb-20">
        <h1>
          <Marca tamanho="lg" />
          <span className="sr-only"> — agendamento online</span>
        </h1>
        <p className="mx-auto mt-6 max-w-md text-lg text-zinc-300">A Barbearia de Todas as Tribos.</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/agendar" className="btn-gold w-full max-w-xs px-8 py-3 text-base sm:w-auto">
            Agendar horário <IconeSeta />
          </Link>
          <a href="#servicos" className="btn-ghost w-full max-w-xs sm:w-auto">
            Ver serviços
          </a>
        </div>
        <p className="mt-8 inline-flex items-center gap-2 text-sm text-zinc-400">
          <span className="flex text-gold-400" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => (
              <IconeEstrela key={i} width={16} height={16} />
            ))}
          </span>
          <span>
            <strong className="text-zinc-200">5,0</strong> no Google · 59 avaliações
          </span>
        </p>
        <AvisoHorarioMarcado />
      </section>

      <Secao id="servicos" eyebrow="Serviços" titulo="Escolha o seu">
        {servicos.erro && <ErroCaixa mensagem={servicos.erro} onTentar={servicos.recarregar} />}
        <ul className="grid gap-3 sm:grid-cols-2">
          {servicos.carregando && <Skeletons n={4} className="h-24" />}
          {servicos.dados?.map((s) => (
            <li key={s.id}>
              <Link
                to={`/agendar?servico=${s.id}`}
                className="card group flex h-full items-center justify-between gap-4 p-5 transition hover:border-gold-400/60"
              >
                <span>
                  <span className="block font-semibold text-zinc-50">{s.nome}</span>
                  <span className="mt-1 block text-sm text-zinc-400">{s.descricao}</span>
                  <span className="mt-2 inline-flex items-center gap-1.5 text-xs text-zinc-500">
                    <IconeRelogio width={14} height={14} /> {formatarDuracao(s.duracao_min)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-display text-xl font-bold text-gold-300">
                    {formatarPreco(s.preco)}
                  </span>
                  <span className="text-xs font-semibold text-zinc-500 group-hover:text-gold-300">
                    Agendar →
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Secao>

      <div className="border-y border-ink-700 bg-ink-900/60">
        <Secao id="equipe" eyebrow="Equipe" titulo="Quem cuida do seu visual">
          <ul className="grid grid-cols-3 gap-3 sm:gap-6">
            {barbeiros.carregando && <Skeletons n={3} className="h-40" />}
            {barbeiros.dados?.map((b) => (
              <li key={b.id} className="card flex flex-col items-center px-2 py-6 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full border border-gold-400/50 bg-ink-800 font-display text-2xl font-bold text-gold-300 sm:h-20 sm:w-20">
                  {b.nome[0]}
                </span>
                <span className="mt-3 font-semibold text-zinc-50">{b.nome}</span>
                <span className="text-xs text-zinc-500">Barbeiro</span>
                {b.instagram && (
                  <a
                    href={`https://www.instagram.com/${b.instagram}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 max-w-full truncate text-xs text-gold-400 hover:underline"
                  >
                    @{b.instagram}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </Secao>
      </div>

      <Secao id="espaco" eyebrow="O espaço" titulo="Mais que um corte">
        <ul className="grid gap-3 sm:grid-cols-3">
          {DIFERENCIAIS.map((d) => (
            <li key={d.titulo} className="card p-5">
              <span className="font-display text-lg font-bold text-gold-300">{d.titulo}</span>
              <p className="mt-1 text-sm text-zinc-400">{d.texto}</p>
            </li>
          ))}
        </ul>
      </Secao>

      <div className="border-y border-ink-700 bg-ink-900/60">
        <Secao id="como-funciona" eyebrow="Agendamento online" titulo="Marque em menos de um minuto">
          <ol className="grid gap-6 sm:grid-cols-3">
            {PASSOS.map((p, i) => (
              <li key={p.titulo} className="flex gap-4 sm:block">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold-400/60 font-display font-bold text-gold-300">
                  {i + 1}
                </span>
                <span className="sm:mt-4 sm:block">
                  <span className="block font-semibold text-zinc-50">{p.titulo}</span>
                  <span className="mt-1 block text-sm text-zinc-400">{p.texto}</span>
                </span>
              </li>
            ))}
          </ol>
          <Link to="/agendar" className="btn-gold mt-10">
            Agendar agora <IconeSeta />
          </Link>
        </Secao>
      </div>

      <Secao id="local" eyebrow="Onde estamos" titulo="Cola na Underground">
        {config.erro && <ErroCaixa mensagem={config.erro} onTentar={config.recarregar} />}
        {c && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="card space-y-6 p-6">
              <div className="flex gap-3">
                <IconePin className="mt-0.5 shrink-0 text-gold-400" />
                <div>
                  <p className="text-zinc-200">{c.endereco}</p>
                  <a
                    href={c.maps_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-sm font-semibold text-gold-300 hover:underline"
                  >
                    Abrir no Google Maps →
                  </a>
                </div>
              </div>
              <div className="flex gap-3">
                <IconeRelogio className="mt-0.5 shrink-0 text-gold-400" />
                <dl className="flex-1 space-y-1 text-sm">
                  {c.funcionamento.map((f) => (
                    <div key={f.dias} className="flex justify-between gap-4">
                      <dt className="text-zinc-400">{f.dias}</dt>
                      <dd className="font-medium text-zinc-200">{f.horario}</dd>
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
            </div>
            <iframe
              title="Mapa — Underground Barbershop"
              src="https://www.google.com/maps?q=Av.+Manoel+Alves,+305,+Mogi+das+Cruzes,+SP&output=embed"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="card h-72 w-full md:h-full"
            />
          </div>
        )}
      </Secao>

      <footer className="border-t border-ink-700 px-4 py-10 text-center text-sm text-zinc-500">
        <Marca />
        {c && (
          <p className="mt-4">
            {c.instagram_usuario} · {formatarTelefone(c.telefone_contato)}
          </p>
        )}
        <p className="mt-3 flex justify-center gap-5">
          <Link to="/privacidade" className="underline hover:text-gold-300">
            Privacidade
          </Link>
          <Link to="/admin/login" className="underline hover:text-gold-300">
            Área do barbeiro
          </Link>
        </p>
      </footer>
    </>
  );
}

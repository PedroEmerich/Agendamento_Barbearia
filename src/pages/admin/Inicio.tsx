import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import GraficoBarras from '../../components/GraficoBarras';
import { ErroCaixa, FotoBarbeiro, IconeSeta } from '../../components/ui';
import { api } from '../../lib/api';
import {
  agoraSP,
  formatarDataCurta,
  formatarDataLonga,
  formatarPreco,
  hhmmParaMin,
  somarDias,
} from '../../lib/datas';
import {
  agruparPorPeriodo,
  inicioMes,
  inicioSemana,
  porServico,
  resumir,
  variacao,
  type Agrupamento,
} from '../../lib/relatorios';
import { useConsulta } from '../../lib/useConsulta';
import { COR_STATUS, FiltroBarbeiro, saudacao, Segmentado, usePainel } from './painel';

type Metrica = 'agendamentos' | 'faturamento';

const pct = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;
const reais = (v: number) => formatarPreco(v).replace(',00', '');
const reaisCurto = (v: number) =>
  v >= 1000
    ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
    : reais(v);

function Variacao({ valor, contra }: { valor: number | null; contra: string }) {
  if (valor === null) return <span className="text-xs text-zinc-500">sem base de comparação</span>;
  const sobe = valor >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${sobe ? 'bg-emerald-400/10 text-emerald-300' : 'bg-red-400/10 text-red-300'}`}
    >
      <span aria-hidden="true">{sobe ? '▲' : '▼'}</span>
      {pct(valor)} <span className="font-normal text-zinc-400">{contra}</span>
    </span>
  );
}

function Indicador({
  rotulo,
  valor,
  rodape,
}: {
  rotulo: string;
  valor: ReactNode;
  rodape?: ReactNode;
}) {
  return (
    <div className="card p-5">
      <p className="text-xs font-semibold tracking-[0.15em] text-zinc-500 uppercase">{rotulo}</p>
      <p className="mt-2 font-display text-2xl font-bold whitespace-nowrap text-zinc-50 tabular-nums sm:text-3xl">
        {valor}
      </p>
      {rodape && <div className="mt-2">{rodape}</div>}
    </div>
  );
}

export default function Inicio() {
  const { usuario, eu, ehAdmin, barbeiros, diaAberto, proximoDiaAberto, nomeBarbeiro } =
    usePainel();
  const [filtro, setFiltro] = useState('');
  const [agrupamento, setAgrupamento] = useState<Agrupamento>('semana');
  const [metrica, setMetrica] = useState<Metrica>('agendamentos');

  const agora = agoraSP();
  const hoje = agora.data;
  // Cobre 12 semanas e 6 meses para trás e as próximas 3 semanas.
  const de = [
    somarDias(inicioSemana(hoje), -7 * 11),
    inicioMes(somarDias(inicioMes(hoje), -150)),
  ].sort()[0];
  const ate = somarDias(hoje, 21);
  const consulta = useConsulta(() => api.listarAgendamentosPeriodo(de, ate), [de, ate]);

  const dados = useMemo(
    () => (consulta.dados ?? []).filter((a) => !filtro || a.barbeiro_id === filtro),
    [consulta.dados, filtro],
  );

  const periodos = useMemo(
    () => agruparPorPeriodo(dados, agrupamento, hoje, agrupamento === 'semana' ? 12 : 6),
    [dados, agrupamento, hoje],
  );

  if (consulta.erro) return <ErroCaixa mensagem={consulta.erro} onTentar={consulta.recarregar} />;

  const nome = eu?.nome ?? usuario.nome.split(' ')[0];
  const semanaAtual = resumir(
    dados.filter((a) => a.data >= inicioSemana(hoje) && a.data <= somarDias(inicioSemana(hoje), 6)),
  );
  const semanaPassada = resumir(
    dados.filter(
      (a) =>
        a.data >= somarDias(inicioSemana(hoje), -7) && a.data <= somarDias(inicioSemana(hoje), -1),
    ),
  );
  const mes = resumir(dados.filter((a) => a.data >= inicioMes(hoje) && a.data <= hoje));
  const ultimos30 = resumir(dados.filter((a) => a.data > somarDias(hoje, -30) && a.data <= hoje));

  // Compara os dois últimos períodos fechados (o atual ainda está em andamento).
  const fechados = periodos.filter((p) => !p.emAndamento);
  const valorDe = (p: (typeof periodos)[number]) =>
    metrica === 'agendamentos' ? p.total : p.faturamento;
  // Tendência: soma dos últimos N períodos fechados contra os N anteriores (menos sensível
  // a uma semana atípica do que comparar só uma contra a outra).
  const n = agrupamento === 'semana' ? 4 : 2;
  const soma = (ps: typeof periodos) => ps.reduce((s, p) => s + valorDe(p), 0);
  const recentes = fechados.slice(-n);
  const anteriores = fechados.slice(-2 * n, -n);
  const ultimoFechado = recentes.length === n && anteriores.length === n;
  const delta = ultimoFechado ? variacao(soma(recentes), soma(anteriores)) : null;
  const tendencia =
    delta === null ? null : delta > 0.03 ? 'mais' : delta < -0.03 ? 'menos' : 'estável';

  const diaFoco = proximoDiaAberto(hoje);
  const proximos = dados
    .filter(
      (a) =>
        (a.status === 'AGENDADO' || a.status === 'CONFIRMADO') &&
        (a.data > hoje || (a.data === hoje && hhmmParaMin(a.hora_fim) > agora.minutos)),
    )
    .slice(0, 6);
  const servicos = porServico(
    dados.filter((a) => a.data > somarDias(hoje, -30) && a.data <= hoje),
  ).slice(0, 5);
  const maxServico = Math.max(1, ...servicos.map((s) => s.quantidade));
  const quemFiltrado = filtro ? barbeiros.find((b) => b.id === filtro) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          {eu && (
            <FotoBarbeiro
              nome={eu.nome}
              foto={eu.foto_url}
              tamanho="h-14 w-14"
              className="hidden sm:inline-flex"
            />
          )}
          <div>
            <p className="text-sm text-zinc-400 first-letter:uppercase">
              {formatarDataLonga(hoje)}
            </p>
            <h1 className="titulo mt-1">
              {saudacao()}, <span className="texto-ouro">{nome}</span>
            </h1>
          </div>
        </div>
        {!diaAberto(hoje) && (
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300">
            Hoje é dia de folga · volta {formatarDataCurta(diaFoco)}
          </span>
        )}
      </div>

      {ehAdmin && <FiltroBarbeiro valor={filtro} onMudar={setFiltro} />}

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {consulta.carregando && !consulta.dados ? (
          [0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-32" />)
        ) : (
          <>
            <Indicador
              rotulo="Esta semana"
              valor={semanaAtual.total}
              rodape={
                <Variacao
                  valor={variacao(semanaAtual.total, semanaPassada.total)}
                  contra="vs. anterior"
                />
              }
            />
            <Indicador
              rotulo="Faturamento no mês"
              valor={reaisCurto(mes.faturamento)}
              rodape={
                <span className="text-xs text-zinc-500">
                  {mes.concluidos} atendimentos concluídos
                </span>
              }
            />
            <Indicador
              rotulo="Comparecimento"
              valor={
                ultimos30.comparecimento === null
                  ? '—'
                  : `${Math.round(ultimos30.comparecimento * 100)}%`
              }
              rodape={
                <span className="text-xs text-zinc-500">{ultimos30.faltas} faltas em 30 dias</span>
              }
            />
            <Indicador
              rotulo="Ticket médio"
              valor={reais(Math.round(ultimos30.ticketMedio))}
              rodape={<span className="text-xs text-zinc-500">últimos 30 dias</span>}
            />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem] lg:gap-6">
        {/* Gráfico de tendência */}
        <section className="card min-w-0 self-start p-5 sm:p-6" aria-labelledby="titulo-grafico">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 id="titulo-grafico" className="text-lg font-semibold text-zinc-50">
                {metrica === 'agendamentos' ? 'Agendamentos' : 'Faturamento'} por{' '}
                {agrupamento === 'semana' ? 'semana' : 'mês'}
                {quemFiltrado && <span className="text-zinc-400"> · {quemFiltrado.nome}</span>}
              </h2>
              {tendencia && ultimoFechado && (
                <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
                  {tendencia === 'mais' && (
                    <>
                      Você está com <strong className="text-emerald-300">mais</strong> movimento
                    </>
                  )}
                  {tendencia === 'menos' && (
                    <>
                      Você está com <strong className="text-red-300">menos</strong> movimento
                    </>
                  )}
                  {tendencia === 'estável' && (
                    <>
                      Movimento <strong className="text-zinc-200">estável</strong>
                    </>
                  )}
                  <Variacao
                    valor={delta}
                    contra={
                      agrupamento === 'semana'
                        ? 'últimas 4 semanas vs. 4 anteriores'
                        : 'últimos 2 meses vs. 2 anteriores'
                    }
                  />
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Segmentado
                rotulo="Agrupar por"
                valor={agrupamento}
                onMudar={setAgrupamento}
                opcoes={[
                  { valor: 'semana', rotulo: 'Por semana' },
                  { valor: 'mes', rotulo: 'Por mês' },
                ]}
              />
              <Segmentado
                rotulo="Métrica"
                valor={metrica}
                onMudar={setMetrica}
                opcoes={[
                  { valor: 'agendamentos', rotulo: 'Agendamentos' },
                  { valor: 'faturamento', rotulo: 'R$' },
                ]}
              />
            </div>
          </div>
          <div className="mt-6">
            {consulta.carregando && !consulta.dados ? (
              <div className="skeleton h-64" />
            ) : (
              <GraficoBarras
                titulo={`${metrica === 'agendamentos' ? 'Agendamentos' : 'Faturamento'} por ${agrupamento}`}
                dados={periodos.map((p) => ({
                  rotulo: p.rotulo,
                  rotuloLongo: p.rotuloLongo,
                  valor: valorDe(p),
                  parcial: p.emAndamento,
                  detalhe:
                    metrica === 'agendamentos'
                      ? `${p.concluidos} concluídos · ${p.pendentes} a realizar · ${p.cancelados} cancelados`
                      : `${p.concluidos} atendimentos concluídos`,
                }))}
                formatar={
                  metrica === 'agendamentos'
                    ? (v) => `${v} agendamento${v === 1 ? '' : 's'}`
                    : (v) => formatarPreco(v)
                }
                formatarEixo={metrica === 'agendamentos' ? (v) => String(v) : reaisCurto}
              />
            )}
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
            <span
              aria-hidden="true"
              className="h-3 w-3 rounded-sm bg-[repeating-linear-gradient(45deg,#b8892f_0_2px,rgb(184_137_47/0.35)_2px_5px)]"
            />
            {agrupamento === 'semana' ? 'Semana' : 'Mês'} em andamento (inclui os horários já
            marcados)
          </p>
        </section>

        {/* Lateral: próximos e serviços */}
        <div className="space-y-4">
          <section className="card p-5" aria-labelledby="titulo-proximos">
            <div className="flex items-center justify-between">
              <h2 id="titulo-proximos" className="font-semibold text-zinc-50">
                Próximos clientes
              </h2>
              <Link
                to="/admin/agenda"
                className="inline-flex items-center gap-1 text-xs font-semibold text-gold-300 hover:underline"
              >
                Agenda <IconeSeta width={13} height={13} />
              </Link>
            </div>
            <ul className="mt-4 space-y-1">
              {consulta.carregando &&
                !consulta.dados &&
                [0, 1, 2].map((i) => <li key={i} className="skeleton h-12" />)}
              {consulta.dados && proximos.length === 0 && (
                <li className="py-4 text-sm text-zinc-500">Nenhum horário marcado.</li>
              )}
              {proximos.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-white/[0.03]"
                >
                  <span className="w-12 shrink-0 text-center">
                    <span className="block font-display text-sm font-bold text-gold-300">
                      {a.hora_inicio}
                    </span>
                    <span className="block text-[0.65rem] text-zinc-500 uppercase">
                      {a.data === hoje ? 'hoje' : formatarDataCurta(a.data).split(',')[0]}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`h-8 w-1 shrink-0 rounded-full ${COR_STATUS[a.status]}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-zinc-100">
                      {a.cliente_nome}
                    </span>
                    <span className="block truncate text-xs text-zinc-500">
                      {a.servico_nome}
                      {ehAdmin && !filtro && <> · {nomeBarbeiro(a.barbeiro_id)}</>}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-5" aria-labelledby="titulo-servicos">
            <h2 id="titulo-servicos" className="font-semibold text-zinc-50">
              Mais pedidos <span className="text-xs font-normal text-zinc-500">· 30 dias</span>
            </h2>
            <ul className="mt-4 space-y-3">
              {servicos.map((s) => (
                <li key={s.chave}>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="truncate text-zinc-300">{s.chave}</span>
                    <span className="font-semibold text-zinc-100 tabular-nums">{s.quantidade}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.05]">
                    <div
                      className="h-full rounded-full bg-[#b8892f]"
                      style={{ width: `${(s.quantidade / maxServico) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <Link to="/admin/relatorios" className="btn-ghost mt-5 w-full">
              Ver relatórios
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}

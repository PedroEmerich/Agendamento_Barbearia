import { useMemo, useState } from 'react';
import { ErroCaixa, FotoBarbeiro, SeloStatus } from '../../components/ui';
import { api } from '../../lib/api';
import { agoraSP, formatarDataCurta, formatarPreco, somarDias } from '../../lib/datas';
import type { DadosRelatorio } from '../../lib/exportar';
import {
  DIAS_SEMANA,
  fimMes,
  inicioMes,
  inicioSemana,
  porBarbeiro,
  porDiaSemana,
  porServico,
  resumir,
} from '../../lib/relatorios';
import { useConsulta } from '../../lib/useConsulta';
import { FiltroBarbeiro, IconeDownload, SeloPlano, Segmentado, usePainel } from './painel';

type Preset = 'semana' | 'mes' | 'mes-passado' | 'tres-meses' | 'personalizado';

const PRESETS: { valor: Preset; rotulo: string }[] = [
  { valor: 'semana', rotulo: 'Esta semana' },
  { valor: 'mes', rotulo: 'Este mês' },
  { valor: 'mes-passado', rotulo: 'Mês passado' },
  { valor: 'tres-meses', rotulo: 'Últimos 3 meses' },
  { valor: 'personalizado', rotulo: 'Personalizado' },
];

function intervalo(preset: Preset, hoje: string): [string, string] {
  switch (preset) {
    case 'semana':
      return [inicioSemana(hoje), somarDias(inicioSemana(hoje), 6)];
    case 'mes':
      return [inicioMes(hoje), fimMes(hoje)];
    case 'mes-passado': {
      const anterior = somarDias(inicioMes(hoje), -1);
      return [inicioMes(anterior), anterior];
    }
    default:
      return [inicioMes(somarDias(inicioMes(hoje), -60)), hoje];
  }
}

const POR_PAGINA = 40;

export default function Relatorios() {
  const { eu, ehAdmin, barbeiros, nomeBarbeiro } = usePainel();
  const hoje = agoraSP().data;
  const [preset, setPreset] = useState<Preset>('mes');
  const [personalizado, setPersonalizado] = useState<[string, string]>([inicioMes(hoje), hoje]);
  const [filtro, setFiltro] = useState('');
  const [mostrar, setMostrar] = useState(POR_PAGINA);
  const [exportando, setExportando] = useState<'pdf' | 'xlsx' | null>(null);
  const [erroExport, setErroExport] = useState<string | null>(null);

  const [de, ate] = preset === 'personalizado' ? personalizado : intervalo(preset, hoje);
  const consulta = useConsulta(() => api.listarAgendamentosPeriodo(de, ate), [de, ate]);

  const dados = useMemo(
    () => (consulta.dados ?? []).filter((a) => !filtro || a.barbeiro_id === filtro),
    [consulta.dados, filtro],
  );
  const r = useMemo(() => resumir(dados), [dados]);
  const servicos = useMemo(() => porServico(dados), [dados]);
  const dias = useMemo(() => porDiaSemana(dados), [dados]);
  const porBarb = useMemo(
    () => (ehAdmin && !filtro ? porBarbeiro(dados) : null),
    [dados, ehAdmin, filtro],
  );
  const maxDia = Math.max(1, ...dias.map((d) => d.quantidade));

  const quem = eu ? eu.nome : filtro ? nomeBarbeiro(filtro) : 'Todos os barbeiros';
  const periodoTexto = PRESETS.find((p) => p.valor === preset)!.rotulo;

  async function exportar(tipo: 'pdf' | 'xlsx') {
    setExportando(tipo);
    setErroExport(null);
    const conteudo: DadosRelatorio = {
      periodoTexto,
      de,
      ate,
      quem,
      resumo: r,
      servicos,
      barbeiros: porBarb,
      diasSemana: dias,
      agendamentos: dados,
      nomeBarbeiro,
    };
    try {
      const m = await import('../../lib/exportar');
      await (tipo === 'pdf' ? m.exportarPdf(conteudo) : m.exportarExcel(conteudo));
    } catch {
      setErroExport('Não foi possível gerar o arquivo. Tente de novo.');
    } finally {
      setExportando(null);
    }
  }

  const tiles: [string, string, string?][] = [
    ['Agendamentos', String(r.total), `${r.pendentes} a realizar`],
    ['Concluídos', String(r.concluidos), `${r.doPlano} de plano`],
    [
      'Faturamento',
      formatarPreco(r.faturamento),
      `+ ${formatarPreco(r.faturamentoPrevisto)} previsto`,
    ],
    ['Ticket médio', formatarPreco(r.ticketMedio)],
    ['Cancelados', String(r.cancelados)],
    [
      'Comparecimento',
      r.comparecimento === null ? '—' : `${Math.round(r.comparecimento * 100)}%`,
      `${r.faltas} faltas`,
    ],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Relatórios</p>
          <h1 className="titulo mt-3">{eu ? 'Meus números' : 'Números da barbearia'}</h1>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-ghost"
            onClick={() => exportar('pdf')}
            disabled={!!exportando || !consulta.dados}
          >
            <IconeDownload width={16} height={16} /> {exportando === 'pdf' ? 'Gerando…' : 'PDF'}
          </button>
          <button
            className="btn-gold"
            onClick={() => exportar('xlsx')}
            disabled={!!exportando || !consulta.dados}
          >
            <IconeDownload width={16} height={16} /> {exportando === 'xlsx' ? 'Gerando…' : 'Excel'}
          </button>
        </div>
      </div>
      {erroExport && (
        <p role="alert" className="text-sm text-red-300">
          {erroExport}
        </p>
      )}

      {/* Filtros numa linha só, acima de tudo */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Segmentado
            rotulo="Período"
            valor={preset}
            onMudar={(v) => {
              setPreset(v);
              setMostrar(POR_PAGINA);
            }}
            opcoes={PRESETS}
          />
          {preset === 'personalizado' && (
            <div className="flex items-center gap-2 text-sm">
              <input
                type="date"
                aria-label="Data inicial"
                className="campo min-h-10 w-auto py-1.5 [color-scheme:dark]"
                value={personalizado[0]}
                max={personalizado[1]}
                onChange={(e) =>
                  e.target.value && setPersonalizado([e.target.value, personalizado[1]])
                }
              />
              <span className="text-zinc-500">até</span>
              <input
                type="date"
                aria-label="Data final"
                className="campo min-h-10 w-auto py-1.5 [color-scheme:dark]"
                value={personalizado[1]}
                min={personalizado[0]}
                max={somarDias(hoje, 21)}
                onChange={(e) =>
                  e.target.value && setPersonalizado([personalizado[0], e.target.value])
                }
              />
            </div>
          )}
        </div>
        {ehAdmin && <FiltroBarbeiro valor={filtro} onMudar={setFiltro} />}
        <p className="text-sm text-zinc-500">
          {formatarDataCurta(de)} a {formatarDataCurta(ate)} · {quem}
        </p>
      </div>

      {consulta.erro && <ErroCaixa mensagem={consulta.erro} onTentar={consulta.recarregar} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map(([rotulo, valor, sub]) =>
          consulta.dados ? (
            <div key={rotulo} className="card p-4">
              <p className="text-[0.7rem] font-semibold tracking-[0.12em] text-zinc-500 uppercase">
                {rotulo}
              </p>
              <p className="mt-1.5 font-display text-2xl font-bold text-zinc-50 tabular-nums">
                {valor}
              </p>
              {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
            </div>
          ) : (
            <div key={rotulo} className="skeleton h-24" />
          ),
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card overflow-hidden" aria-labelledby="t-servicos">
          <h2 id="t-servicos" className="px-5 pt-5 font-semibold text-zinc-50">
            Por serviço
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-zinc-500 uppercase">
                <tr className="border-b border-white/[0.06]">
                  <th className="px-5 py-2 font-semibold">Serviço</th>
                  <th className="px-3 py-2 text-right font-semibold">Qtd.</th>
                  <th className="px-3 py-2 text-right font-semibold">%</th>
                  <th className="px-5 py-2 text-right font-semibold">Faturamento</th>
                </tr>
              </thead>
              <tbody>
                {servicos.map((s) => (
                  <tr key={s.chave} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-5 py-2.5 text-zinc-200">{s.chave}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{s.quantidade}</td>
                    <td className="px-3 py-2.5 text-right text-zinc-400 tabular-nums">
                      {Math.round((s.quantidade / Math.max(1, r.total)) * 100)}%
                    </td>
                    <td className="px-5 py-2.5 text-right text-zinc-100 tabular-nums">
                      {formatarPreco(s.faturamento)}
                    </td>
                  </tr>
                ))}
                {consulta.dados && servicos.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-6 text-center text-zinc-500">
                      Sem atendimentos no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card p-5" aria-labelledby="t-dias">
          <h2 id="t-dias" className="font-semibold text-zinc-50">
            Movimento por dia da semana
          </h2>
          <ul className="mt-4 space-y-2.5">
            {dias.map((d) => (
              <li
                key={d.chave}
                className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-3 text-sm"
              >
                <span className="text-zinc-400">{DIAS_SEMANA[Number(d.chave)]}</span>
                <span className="h-2.5 rounded-full bg-white/[0.05]">
                  <span
                    className="block h-full rounded-full bg-[#b8892f]"
                    style={{ width: `${(d.quantidade / maxDia) * 100}%` }}
                  />
                </span>
                <span className="text-right text-zinc-100 tabular-nums">{d.quantidade}</span>
              </li>
            ))}
          </ul>
        </section>

        {porBarb && (
          <section className="card p-5 lg:col-span-2" aria-labelledby="t-barbeiros">
            <h2 id="t-barbeiros" className="font-semibold text-zinc-50">
              Por barbeiro
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-3">
              {porBarb.map((b) => {
                const barb = barbeiros.find((x) => x.id === b.chave);
                return (
                  <li
                    key={b.chave}
                    className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3"
                  >
                    <FotoBarbeiro
                      nome={barb?.nome ?? '?'}
                      foto={barb?.foto_url}
                      tamanho="h-11 w-11"
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold text-zinc-50">{barb?.nome}</span>
                      <span className="block text-sm text-zinc-400">
                        {b.quantidade} atend. · {formatarPreco(b.faturamento)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      {/* Lista detalhada */}
      <section className="card overflow-hidden" aria-labelledby="t-lista">
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 id="t-lista" className="font-semibold text-zinc-50">
            Agendamentos <span className="font-normal text-zinc-500">({dados.length})</span>
          </h2>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="text-left text-xs text-zinc-500 uppercase">
              <tr className="border-b border-white/[0.06]">
                <th className="px-5 py-2 font-semibold">Data</th>
                <th className="px-3 py-2 font-semibold">Cliente</th>
                <th className="px-3 py-2 font-semibold">Serviço</th>
                {ehAdmin && !filtro && <th className="px-3 py-2 font-semibold">Barbeiro</th>}
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-5 py-2 text-right font-semibold">Valor</th>
              </tr>
            </thead>
            <tbody>
              {[...dados]
                .reverse()
                .slice(0, mostrar)
                .map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="px-5 py-2.5 whitespace-nowrap text-zinc-300">
                      {formatarDataCurta(a.data)}{' '}
                      <span className="text-zinc-500">{a.hora_inicio}</span>
                    </td>
                    <td className="px-3 py-2.5 text-zinc-100">{a.cliente_nome}</td>
                    <td className="px-3 py-2.5 text-zinc-300">{a.servico_nome}</td>
                    {ehAdmin && !filtro && (
                      <td className="px-3 py-2.5 text-zinc-300">{nomeBarbeiro(a.barbeiro_id)}</td>
                    )}
                    <td className="px-3 py-2.5">
                      <SeloStatus status={a.status} />
                    </td>
                    <td className="px-5 py-2.5 text-right text-zinc-100 tabular-nums">
                      {a.assinatura_id ? <SeloPlano /> : formatarPreco(a.preco)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {dados.length > mostrar && (
          <div className="border-t border-white/[0.06] p-4 text-center">
            <button className="btn-ghost" onClick={() => setMostrar((m) => m + POR_PAGINA * 2)}>
              Mostrar mais ({dados.length - mostrar} restantes)
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

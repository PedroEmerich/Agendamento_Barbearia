import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErroCaixa, FotoBarbeiro, SeloStatus, Skeletons } from '../../components/ui';
import { api, ultimoAgendamento } from '../../lib/api';
import { formatarDataLonga, formatarPreco } from '../../lib/datas';
import { useConsulta } from '../../lib/useConsulta';
import type { AgendamentoCliente, Cobranca } from '../../types';
import {
  ESCOLHA_INICIAL,
  EscolhaPagamento,
  escolhaValida,
  PainelPagamento,
  SeloPagamento,
  type EscolhaPagamentoValor,
} from '../../components/Pagamento';

/** Cobrança pendente, ou a opção de pagar online quem ia pagar no balcão. */
function PagarAgora({
  agendamento: a,
  onPago,
}: {
  agendamento: AgendamentoCliente;
  onPago: () => void;
}) {
  const pendenteId = a.pagamento?.status === 'PENDENTE' ? a.pagamento.cobranca_id : undefined;
  const existente = useConsulta(pendenteId ? () => api.consultarPagamento(pendenteId) : null, [
    pendenteId,
  ]);
  const [aberto, setAberto] = useState(a.pagamento?.status === 'PENDENTE');
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
        await api.iniciarPagamento('agendamento', a.token, {
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
      <EscolhaPagamento valor={escolha} onMudar={(v) => setEscolha({ ...v, forma: 'ONLINE' })} />
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
        {gerando ? 'Gerando…' : `Pagar ${formatarPreco(a.preco)}`}
      </button>
    </div>
  );
}

export default function MeuAgendamento() {
  const { token = '' } = useParams();
  const consulta = useConsulta(() => api.getAgendamentoPorToken(token), [token]);
  const config = useConsulta(api.getConfigPublica, []);
  const [atualizado, setAtualizado] = useState<AgendamentoCliente | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const a = atualizado ?? consulta.dados;
  const ativo = a?.status === 'AGENDADO' || a?.status === 'CONFIRMADO';
  const horasPrazo = (config.dados?.antecedencia_min_cancelamento_min ?? 120) / 60;

  async function cancelar() {
    setCancelando(true);
    setErro(null);
    try {
      setAtualizado(await api.cancelarPorToken(token));
      ultimoAgendamento.gravar(null);
      setConfirmando(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível cancelar.');
    } finally {
      setCancelando(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <p className="eyebrow">Seu horário</p>
      <h1 className="titulo mt-3">Meu agendamento</h1>

      <div className="mt-6">
        {consulta.carregando && <Skeletons n={1} className="h-64" />}
        {consulta.erro && (
          <>
            <ErroCaixa mensagem={consulta.erro} onTentar={consulta.recarregar} />
            <Link to="/agendar" className="btn-gold mt-6 w-full">
              Fazer um novo agendamento
            </Link>
          </>
        )}

        {a && (
          <>
            <div className="card animate-entrar p-6">
              <div className="mb-6 flex items-center gap-4">
                <FotoBarbeiro nome={a.barbeiro_nome} foto={a.barbeiro_foto} tamanho="h-14 w-14" />
                <div>
                  <p className="text-lg font-semibold text-zinc-50">{a.servico_nome}</p>
                  <p className="text-sm text-zinc-400">com {a.barbeiro_nome}</p>
                </div>
              </div>
              <div className="flex items-start justify-between gap-4 border-t border-white/[0.07] pt-5">
                <div>
                  <p className="text-xs tracking-widest text-zinc-500 uppercase">Código</p>
                  <p className="texto-ouro font-display text-2xl font-black tracking-[0.15em] sm:text-3xl sm:tracking-[0.2em]">
                    {a.codigo}
                  </p>
                </div>
                <SeloStatus status={a.status} />
              </div>
              <dl className="mt-5 space-y-2 text-sm">
                {[
                  ['Cliente', a.cliente_nome],
                  ['Serviço', a.servico_nome],
                  ['Barbeiro', a.barbeiro_nome],
                  ['Dia', formatarDataLonga(a.data)],
                  ['Horário', `${a.hora_inicio} – ${a.hora_fim}`],
                  ['Valor', a.assinatura_token ? 'Coberto pelo plano' : formatarPreco(a.preco)],
                ].map(([rotulo, valor]) => (
                  <div key={rotulo} className="flex justify-between gap-4">
                    <dt className="text-zinc-400">{rotulo}</dt>
                    <dd className="text-right font-medium text-zinc-100">{valor}</dd>
                  </div>
                ))}
              </dl>
              {a.pagamento && (
                <div className="mt-4 flex items-center justify-between border-t border-white/[0.07] pt-4 text-sm">
                  <span className="text-zinc-400">Pagamento</span>
                  <SeloPagamento pagamento={a.pagamento} />
                </div>
              )}
            </div>

            {ativo &&
              a.pagamento &&
              a.pagamento.status !== 'PAGO' &&
              a.pagamento.status !== 'ESTORNADO' && (
                <div className="mt-4">
                  <PagarAgora agendamento={a} onPago={() => consulta.recarregar()} />
                </div>
              )}

            {erro && (
              <p role="alert" className="mt-4 text-sm text-red-300">
                {erro}
              </p>
            )}

            {/* Ações lado a lado; avisos e confirmação ocupam a linha toda. */}
            <div className="mt-6 grid grid-cols-2 gap-3">
              {ativo && !confirmando && (
                <>
                  <button
                    className="btn-danger"
                    disabled={!a.pode_cancelar}
                    onClick={() => setConfirmando(true)}
                    aria-describedby={a.pode_cancelar ? undefined : 'prazo'}
                  >
                    Cancelar horário
                  </button>
                  {!a.pode_cancelar && (
                    <p id="prazo" className="col-span-2 text-center text-xs text-zinc-400">
                      O cancelamento pelo site vai até {horasPrazo}h antes do horário.{' '}
                      {config.dados && (
                        <a
                          href={`https://wa.me/${config.dados.telefone_contato}`}
                          className="text-gold-300 underline"
                        >
                          Fale com a barbearia
                        </a>
                      )}
                    </p>
                  )}
                </>
              )}
              {confirmando && (
                <div className="card col-span-2 !border-red-500/30 p-5 text-center">
                  <p className="text-sm">
                    Cancelar mesmo? O horário volta a ficar livre para outros clientes.
                  </p>
                  <div className="mt-4 flex gap-3">
                    <button
                      className="btn-ghost flex-1"
                      onClick={() => setConfirmando(false)}
                      disabled={cancelando}
                    >
                      Manter
                    </button>
                    <button className="btn-danger flex-1" onClick={cancelar} disabled={cancelando}>
                      {cancelando ? 'Cancelando…' : 'Sim, cancelar'}
                    </button>
                  </div>
                </div>
              )}
              {a.assinatura_token && (
                <Link to={`/assinatura/${a.assinatura_token}`} className="btn-gold">
                  Ver meu plano
                </Link>
              )}
              <Link to="/agendar" className={ativo ? 'btn-ghost' : 'btn-gold'}>
                {ativo ? 'Marcar outro horário' : 'Agendar de novo'}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Contratação do plano pelo cliente: plano, barbeiro, dia fixo (opcional), dados e pagamento.

import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ESCOLHA_INICIAL,
  EscolhaPagamento,
  escolhaValida,
  PainelPagamento,
  type EscolhaPagamentoValor,
} from '../../components/Pagamento';
import { ErroCaixa, FotoBarbeiro, IconeCheck, IconeSeta, Skeletons } from '../../components/ui';
import { api } from '../../lib/api';
import { DIAS_SEMANA_LONGOS } from '../../lib/assinaturas';
import { formatarPreco } from '../../lib/datas';
import { useConta } from '../../lib/conta';
import {
  BlocoConta,
  CONTA_INICIAL,
  contaPronta,
  garantirConta,
  type DadosConta,
} from '../../components/Conta';
import { useConsulta } from '../../lib/useConsulta';
import type { Cobranca } from '../../types';

export default function Assinar() {
  const { planoId: inicial = 'p1' } = useParams();
  const planos = useConsulta(api.listarPlanos, []);
  const barbeiros = useConsulta(() => api.listarBarbeiros(), []);
  const config = useConsulta(api.getConfigPublica, []);

  const [planoId, setPlanoId] = useState(inicial);
  const [barbeiroId, setBarbeiroId] = useState<string | null>(null);
  const [dia, setDia] = useState<number | null>(null);
  const [hora, setHora] = useState<string | null>(null);
  const [conta, setConta] = useState<DadosConta>(CONTA_INICIAL);
  const { usuario } = useConta();
  const [honeypot, setHoneypot] = useState('');
  const [pagamento, setPagamento] = useState<EscolhaPagamentoValor>({
    ...ESCOLHA_INICIAL,
    forma: 'ONLINE',
  });
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<{
    token: string;
    cobranca: Cobranca | null;
    erroPagamento: string | null;
  } | null>(null);
  const [pago, setPago] = useState(false);

  const plano = planos.dados?.find((p) => p.id === planoId);

  // Horários que ainda podem ser dia fixo: o servidor tira expediente, pausa e os dias
  // fixos que já são de outros assinantes desse barbeiro.
  const horas = useConsulta(
    plano && barbeiroId && dia !== null
      ? () => api.horariosFixosLivres(plano.id, barbeiroId, dia)
      : null,
    [plano?.id, barbeiroId, dia],
  );

  const podeEnviar =
    !!plano &&
    !!barbeiroId &&
    (dia === null || !!hora) &&
    contaPronta(conta, usuario) &&
    escolhaValida(pagamento) &&
    !enviando;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!podeEnviar || !plano || !barbeiroId) return;
    setEnviando(true);
    setErro(null);
    try {
      // O plano fica na conta do cliente: cria a conta (ou entra) antes.
      await garantirConta(conta, usuario);
      const { token } = await api.contratarPlano({
        planoId: plano.id,
        barbeiroId,
        fixo: dia === null || !hora ? null : { dia_semana: dia, hora },
        formaPagamento: pagamento.forma,
        honeypot,
      });
      let cobranca: Cobranca | null = null;
      let erroPagamento: string | null = null;
      if (pagamento.forma === 'ONLINE') {
        try {
          cobranca = await api.iniciarPagamento('assinatura', token, {
            metodo: pagamento.metodo,
            cpf: pagamento.cpf,
            email: pagamento.email || undefined,
          });
        } catch (er) {
          erroPagamento = er instanceof Error ? er.message : 'Não foi possível gerar o pagamento.';
        }
      }
      setFeito({ token, cobranca, erroPagamento });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (er) {
      setErro(er instanceof Error ? er.message : 'Não foi possível concluir.');
    } finally {
      setEnviando(false);
    }
  }

  if (feito) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center">
        <span className="mx-auto flex h-16 w-16 animate-entrar items-center justify-center rounded-full bg-gradient-to-b from-gold-300 to-gold-500 text-ink-950">
          <IconeCheck width={30} height={30} />
        </span>
        <h1 className="titulo mt-6">{pago ? 'Plano ativo!' : 'Quase lá!'}</h1>
        <p className="mt-3 text-zinc-400">
          {pago
            ? 'Bem-vindo à Underground. Seus horários já estão reservados.'
            : feito.cobranca
              ? 'Pague a primeira mensalidade para ativar o plano.'
              : 'Pague a primeira mensalidade na barbearia para ativar o plano. Seus horários fixos já ficam reservados.'}
        </p>
        {feito.cobranca && (
          <div className="mt-6">
            <PainelPagamento cobranca={feito.cobranca} onPago={() => setPago(true)} />
          </div>
        )}
        {feito.erroPagamento && (
          <p
            role="alert"
            className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-left text-sm text-amber-100"
          >
            {feito.erroPagamento} Você pode tentar de novo pela página do seu plano ou pagar na
            barbearia.
          </p>
        )}
        <Link to="/minha-conta" className="btn-gold mt-6 w-full py-3.5">
          Ir para minha conta <IconeSeta />
        </Link>
        <p className="mt-4 text-xs text-zinc-500">
          Seu plano fica na sua conta: é só tocar em <strong>Entrar</strong> no site, de qualquer
          aparelho.
        </p>
      </div>
    );
  }

  const passoTitulo = (n: number, t: string) => (
    <h2 className="flex items-center gap-3 text-lg font-semibold text-zinc-50">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold-400/15 text-sm text-gold-200">
        {n}
      </span>
      {t}
    </h2>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 pt-4 pb-16">
      <p className="eyebrow">Assinatura</p>
      <h1 className="titulo mt-3">Assine seu plano</h1>
      {(planos.erro || barbeiros.erro) && (
        <div className="mt-6">
          <ErroCaixa mensagem={planos.erro ?? barbeiros.erro ?? ''} onTentar={planos.recarregar} />
        </div>
      )}

      <form onSubmit={enviar} className="mt-8 space-y-10" noValidate>
        <section className="space-y-4">
          {passoTitulo(1, 'Plano')}
          <div role="radiogroup" aria-label="Plano" className="grid gap-3 sm:grid-cols-3">
            {planos.carregando && <Skeletons n={3} className="h-28" />}
            {planos.dados?.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={planoId === p.id}
                onClick={() => {
                  setPlanoId(p.id);
                  setHora(null);
                }}
                className={`card cursor-pointer p-4 text-left transition ${planoId === p.id ? '!border-gold-400/70 !bg-gold-400/[0.08]' : 'hover:border-white/20'}`}
              >
                <span className="block font-semibold text-zinc-50">
                  {p.nome.replace('Plano ', '')}
                </span>
                <span className="mt-1 block font-display text-2xl font-bold text-gold-200">
                  {formatarPreco(p.preco_mensal)}
                </span>
                <span className="text-xs text-zinc-500">
                  {p.creditos_mes} por mês · economia de{' '}
                  {formatarPreco(p.preco_avulso_mes - p.preco_mensal)}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          {passoTitulo(2, 'Barbeiro')}
          <div role="radiogroup" aria-label="Barbeiro" className="grid grid-cols-3 gap-3">
            {barbeiros.carregando && <Skeletons n={3} className="h-32" />}
            {barbeiros.dados?.map((b) => (
              <button
                key={b.id}
                type="button"
                role="radio"
                aria-checked={barbeiroId === b.id}
                onClick={() => {
                  setBarbeiroId(b.id);
                  setHora(null);
                }}
                className={`card flex cursor-pointer flex-col items-center gap-2 p-4 transition ${barbeiroId === b.id ? '!border-gold-400/70 !bg-gold-400/[0.08]' : 'hover:border-white/20'}`}
              >
                <FotoBarbeiro nome={b.nome} foto={b.foto_url} tamanho="h-16 w-16 sm:h-20 sm:w-20" />
                <span className="font-semibold text-zinc-50">{b.nome}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          {passoTitulo(3, 'Dia fixo (opcional)')}
          <p className="text-sm text-zinc-400">
            Com dia fixo, seu horário fica reservado toda semana. Dá para trocar ou adiantar
            qualquer semana pelo celular.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={dia === null}
              onClick={() => {
                setDia(null);
                setHora(null);
              }}
              className={`min-h-11 cursor-pointer rounded-full border px-4 text-sm font-semibold ${dia === null ? 'border-gold-300 bg-gold-400 text-ink-950' : 'border-white/10 text-zinc-300'}`}
            >
              Sem dia fixo
            </button>
            {config.dados?.horario_semana.map((h) => (
              <button
                key={h.dia_semana}
                type="button"
                aria-pressed={dia === h.dia_semana}
                onClick={() => {
                  setDia(h.dia_semana);
                  setHora(null);
                }}
                className={`min-h-11 cursor-pointer rounded-full border px-4 text-sm font-semibold capitalize ${dia === h.dia_semana ? 'border-gold-300 bg-gold-400 text-ink-950' : 'border-white/10 text-zinc-300'}`}
              >
                {DIAS_SEMANA_LONGOS[h.dia_semana]}
              </button>
            ))}
          </div>
          {dia !== null && !barbeiroId && (
            <p className="text-sm text-amber-200">
              Escolha o barbeiro acima para ver os horários livres.
            </p>
          )}
          {dia !== null && barbeiroId && (
            <div className="animate-entrar">
              {horas.carregando ? (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  <Skeletons n={8} className="h-11" />
                </div>
              ) : horas.dados?.length ? (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {horas.dados.map((h) => (
                    <button
                      key={h}
                      type="button"
                      aria-pressed={hora === h}
                      onClick={() => setHora(h)}
                      className={`min-h-11 cursor-pointer rounded-2xl border text-sm font-semibold tabular-nums ${hora === h ? 'border-gold-300 bg-gold-400 text-ink-950' : 'border-white/10 bg-white/[0.03] text-zinc-100 hover:border-gold-400/50'}`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-400">
                  Esse barbeiro não tem mais horário fixo livre nesse dia. Tente outro dia ou siga
                  sem dia fixo.
                </p>
              )}
              <p className="mt-2 text-xs text-zinc-500">
                Só aparecem os horários que ainda não são de outro assinante.
              </p>
            </div>
          )}
        </section>

        <section className="space-y-4">
          {passoTitulo(4, 'Seus dados e pagamento')}
          <div className="card space-y-5 p-5 sm:p-6">
            <BlocoConta valor={conta} onMudar={setConta} />
            <div className="hidden" aria-hidden="true">
              <input
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>
            <EscolhaPagamento valor={pagamento} onMudar={setPagamento} recorrente />
          </div>
        </section>

        {erro && (
          <p
            role="alert"
            className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"
          >
            {erro}
          </p>
        )}

        <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-sm text-zinc-400">{plano?.nome ?? 'Escolha um plano'}</p>
            <p className="font-display text-3xl font-bold text-gold-200">
              {plano ? formatarPreco(plano.preco_mensal) : '—'}
              <span className="text-base font-normal text-zinc-500">/mês</span>
            </p>
          </div>
          <button
            type="submit"
            className="btn-gold px-8 py-3.5 whitespace-nowrap"
            disabled={!podeEnviar}
          >
            {enviando ? 'Enviando…' : pagamento.forma === 'ONLINE' ? 'Assinar e pagar' : 'Assinar'}
          </button>
        </div>
        <p className="text-center text-xs text-zinc-500">
          Dúvidas sobre o plano? Fale com a barbearia pelo WhatsApp.{' '}
          <Link to="/privacidade" className="underline">
            Privacidade
          </Link>
        </p>
      </form>
    </div>
  );
}

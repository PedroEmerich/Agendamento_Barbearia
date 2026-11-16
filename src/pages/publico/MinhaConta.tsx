// Área do cliente: plano (se for assinante), próximos horários, histórico e dados da conta.

import { Link, Navigate } from 'react-router-dom';
import { SeloPagamento } from '../../components/Pagamento';
import { ErroCaixa, FotoBarbeiro, IconeSeta, SeloStatus, Skeletons } from '../../components/ui';
import { api } from '../../lib/api';
import { sair, useConta } from '../../lib/conta';
import {
  agoraSP,
  formatarDataCurta,
  formatarDataLonga,
  formatarPreco,
  minParaHhmm,
} from '../../lib/datas';
import { formatarTelefone } from '../../lib/telefone';
import { useConsulta } from '../../lib/useConsulta';
import type { AgendamentoCliente } from '../../types';
import { PainelAssinatura } from './MinhaAssinatura';

function CartaoHorario({ a }: { a: AgendamentoCliente }) {
  return (
    <li>
      <Link
        to={`/meu-agendamento/${a.token}`}
        className="card group flex items-center gap-4 p-4 transition hover:border-gold-400/40"
      >
        <FotoBarbeiro nome={a.barbeiro_nome} foto={a.barbeiro_foto} tamanho="h-12 w-12" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-zinc-400 first-letter:uppercase">
            {formatarDataLonga(a.data)}
          </span>
          <span className="block font-semibold text-zinc-50">
            {a.hora_inicio} · {a.servico_nome}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            com {a.barbeiro_nome} · {formatarPreco(a.preco)}
            <SeloPagamento pagamento={a.pagamento} />
          </span>
        </span>
        <IconeSeta className="shrink-0 text-gold-300 transition group-hover:translate-x-1" />
      </Link>
    </li>
  );
}

export default function MinhaConta() {
  const { usuario, carregando } = useConta();
  const cliente = usuario?.papel === 'CLIENTE';
  const conta = useConsulta(cliente ? api.minhaConta : null, [usuario?.id]);

  if (carregando) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10">
        <Skeletons n={3} className="h-32" />
      </div>
    );
  }
  if (!usuario) return <Navigate to="/entrar?voltar=/minha-conta" replace />;
  if (!cliente) return <Navigate to="/admin" replace />;

  const agora = agoraSP();
  const ativo = (a: AgendamentoCliente) => a.status === 'AGENDADO' || a.status === 'CONFIRMADO';
  const futuro = (a: AgendamentoCliente) =>
    a.data > agora.data || (a.data === agora.data && a.hora_inicio >= minParaHhmm(agora.minutos));
  const lista = conta.dados?.agendamentos ?? [];
  const proximos = lista.filter((a) => ativo(a) && futuro(a)).reverse();
  const historico = lista.filter((a) => !(ativo(a) && futuro(a))).slice(0, 10);
  const assinaturas = conta.dados?.assinaturas ?? [];

  return (
    <div className="relative mx-auto max-w-3xl px-4 pt-4 pb-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-gold-500/15 blur-[100px]"
      />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Minha conta</p>
          <h1 className="titulo mt-3">
            Olá, <span className="texto-ouro">{usuario.nome.split(' ')[0]}</span>
          </h1>
        </div>
        <Link to="/agendar" className="btn-gold">
          Agendar horário <IconeSeta />
        </Link>
      </div>

      {conta.erro && (
        <div className="mt-6">
          <ErroCaixa mensagem={conta.erro} onTentar={conta.recarregar} />
        </div>
      )}
      {conta.carregando && !conta.dados && (
        <div className="mt-8 space-y-4">
          <Skeletons n={3} className="h-28" />
        </div>
      )}

      {conta.dados && (
        <>
          {/* Plano */}
          {assinaturas.length > 0 ? (
            assinaturas.map((s) => (
              <section key={s.token} className="mt-8" aria-label={`Plano ${s.plano_nome}`}>
                <h2 className="mb-1 text-lg font-semibold text-zinc-50">Meu plano</h2>
                <PainelAssinatura token={s.token} incorporado />
              </section>
            ))
          ) : (
            <Link
              to="/#planos"
              className="card group mt-8 flex items-center gap-4 p-5 transition hover:border-gold-400/50"
            >
              <span className="flex-1">
                <span className="block font-semibold text-zinc-50">
                  Vem sempre? Conheça os planos
                </span>
                <span className="text-sm text-zinc-400">
                  Cortes do mês com desconto, dia fixo reservado e prioridade na agenda.
                </span>
              </span>
              <IconeSeta className="text-gold-300 transition group-hover:translate-x-1" />
            </Link>
          )}

          {/* Avulsos */}
          <section className="mt-10">
            <h2 className="text-lg font-semibold text-zinc-50">
              {assinaturas.length ? 'Outros horários marcados' : 'Próximos horários'}
            </h2>
            {proximos.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">Nenhum horário marcado.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {proximos.map((a) => (
                  <CartaoHorario key={a.token} a={a} />
                ))}
              </ul>
            )}
          </section>

          {historico.length > 0 && (
            <section className="mt-10">
              <h2 className="text-lg font-semibold text-zinc-50">Histórico</h2>
              <ul className="mt-4 divide-y divide-white/[0.06] rounded-3xl border border-white/[0.06]">
                {historico.map((a) => (
                  <li
                    key={a.token}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="block text-zinc-200">
                        {formatarDataCurta(a.data)} · {a.servico_nome}
                      </span>
                      <span className="text-xs text-zinc-500">com {a.barbeiro_nome}</span>
                    </span>
                    <SeloStatus status={a.status} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-10 rounded-3xl border border-white/[0.06] p-5 text-sm">
            <h2 className="font-semibold text-zinc-50">Meus dados</h2>
            <dl className="mt-3 space-y-1.5 text-zinc-400">
              <div className="flex justify-between gap-4">
                <dt>Nome</dt>
                <dd className="text-zinc-200">{usuario.nome}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>E-mail</dt>
                <dd className="truncate text-zinc-200">{usuario.email}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>WhatsApp</dt>
                <dd className="text-zinc-200">
                  {usuario.telefone && formatarTelefone(usuario.telefone)}
                </dd>
              </div>
            </dl>
            <button onClick={sair} className="btn-ghost mt-5 w-full">
              Sair da conta
            </button>
          </section>
        </>
      )}
    </div>
  );
}

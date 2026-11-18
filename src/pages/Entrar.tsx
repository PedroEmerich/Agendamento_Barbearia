// Login único com um card que gira: frente = entrar, verso = criar conta.
// Equipe vai para o painel; cliente, para "Minha conta" (ou volta para onde estava).

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { BlocoConta, CONTA_INICIAL, contaPronta, type DadosConta } from '../components/Conta';
import { Marca } from '../components/ui';
import { api, MODO_DEMO } from '../lib/api';
import { entrar, inicioDe, useConta } from '../lib/conta';

type Lado = DadosConta['modo'];

function Face({
  lado,
  ativo,
  titulo,
  subtitulo,
  dados,
  onMudar,
  onVirar,
  rodape,
}: {
  lado: Lado;
  ativo: boolean;
  titulo: string;
  subtitulo: string;
  dados: DadosConta;
  onMudar: (d: DadosConta) => void;
  onVirar: () => void;
  rodape?: React.ReactNode;
}) {
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const voltar = params.get('voltar');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const r =
        lado === 'entrar'
          ? await api.login(dados.email.trim(), dados.senha)
          : await api.cadastrarCliente({
              nome: dados.nome.trim(),
              email: dados.email.trim(),
              telefone: dados.telefone,
              senha: dados.senha,
            });
      entrar(r.authToken, r.usuario, dados.lembrar);
      navegar(r.usuario.papel === 'CLIENTE' && voltar ? voltar : inicioDe(r.usuario), {
        replace: true,
      });
    } catch (er) {
      setErro(er instanceof Error ? er.message : 'Não foi possível entrar.');
      setEnviando(false);
    }
  }

  // No login o campo aceita também o login curto da equipe (ex.: "davi").
  const pronto =
    lado === 'entrar'
      ? dados.email.trim().length > 1 && dados.senha.length > 0
      : contaPronta(dados, null);

  return (
    <form
      onSubmit={enviar}
      noValidate
      // A face de trás não recebe foco nem cliques.
      inert={!ativo}
      aria-hidden={!ativo}
      className={`virar-face space-y-5 rounded-3xl border border-white/10 bg-[linear-gradient(160deg,#1a1a1d,#0f0f11)] p-6 shadow-[0_30px_80px_-30px_#000,inset_0_1px_0_rgb(255_255_255/0.06)] sm:p-8 ${
        lado === 'cadastro' ? 'virar-verso' : ''
      }`}
    >
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold text-zinc-50">{titulo}</h1>
        <p className="mt-1 text-sm text-zinc-400">{subtitulo}</p>
      </div>
      <BlocoConta
        valor={{ ...dados, modo: lado }}
        onMudar={onMudar}
        onAlternar={onVirar}
        prefixo={lado === 'cadastro' ? 'cad-' : ''}
        empilhado={lado === 'entrar'}
        alternar={false}
      />
      {erro && (
        <p role="alert" className="text-sm text-red-300">
          {erro}
        </p>
      )}
      <button type="submit" className="btn-gold w-full py-3" disabled={!pronto || enviando}>
        {enviando ? 'Aguarde…' : lado === 'entrar' ? 'Entrar' : 'Criar conta e entrar'}
      </button>
      <p className="text-center text-sm text-zinc-400">
        {lado === 'entrar' ? 'Ainda não tem conta?' : 'Já tem conta?'}{' '}
        <button
          type="button"
          onClick={onVirar}
          className="cursor-pointer font-semibold text-gold-300 underline-offset-4 hover:underline"
        >
          {lado === 'entrar' ? 'Criar conta' : 'Entrar'}
        </button>
      </p>
      {rodape}
    </form>
  );
}

export default function Entrar() {
  const [params, setParams] = useSearchParams();
  const voltar = params.get('voltar');
  const { usuario, carregando } = useConta();
  const [lado, setLado] = useState<Lado>(params.get('modo') === 'cadastro' ? 'cadastro' : 'entrar');
  const [girando, setGirando] = useState(false);
  const [dados, setDados] = useState<DadosConta>(CONTA_INICIAL);
  const [alturas, setAlturas] = useState<Record<Lado, number>>({ entrar: 0, cadastro: 0 });
  const miolo = useRef<HTMLDivElement>(null);

  // A altura do card acompanha a face que está de frente.
  useLayoutEffect(() => {
    const el = miolo.current;
    if (!el) return;
    const [frente, verso] = Array.from(el.children) as HTMLElement[];
    const medir = () => setAlturas({ entrar: frente.offsetHeight, cadastro: verso.offsetHeight });
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(frente);
    obs.observe(verso);
    return () => obs.disconnect();
  }, [carregando, usuario]);

  // Depois de girar, o foco vai para o primeiro campo da face nova.
  useEffect(() => {
    const id = setTimeout(() => {
      setGirando(false);
      miolo.current
        ?.querySelector<HTMLInputElement>(`form:not([inert]) input:not([type=checkbox])`)
        ?.focus({ preventScroll: true });
    }, 900);
    return () => clearTimeout(id);
  }, [lado]);

  if (!carregando && usuario) return <Navigate to={voltar ?? inicioDe(usuario)} replace />;

  function virar() {
    const novo: Lado = lado === 'entrar' ? 'cadastro' : 'entrar';
    setGirando(true);
    setLado(novo);
    const p = new URLSearchParams(params);
    if (novo === 'cadastro') p.set('modo', 'cadastro');
    else p.delete('modo');
    setParams(p, { replace: true });
  }

  const altura = alturas[lado];

  return (
    <main className="grao relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="grade-fundo absolute inset-0" />
        <div className="absolute top-1/4 left-1/4 h-72 w-72 animate-flutuar rounded-full bg-gold-500/20 blur-[100px]" />
        <div className="absolute right-1/4 bottom-1/4 h-72 w-72 animate-flutuar rounded-full bg-amber-700/20 blur-[100px] [animation-delay:-7s]" />
      </div>

      <Link to="/" aria-label="Voltar ao site" className="mb-6 animate-entrar">
        <Marca variante="completa" />
      </Link>

      <div className="virar-cena w-full max-w-md animate-entrar [animation-delay:120ms]">
        <div
          ref={miolo}
          className={`virar-miolo ${lado === 'cadastro' ? 'virado' : ''} ${girando ? 'girando' : ''}`}
          style={altura ? { height: altura } : undefined}
        >
          <Face
            lado="entrar"
            ativo={lado === 'entrar'}
            titulo="Bem-vindo de volta"
            subtitulo={
              voltar?.startsWith('/agendar')
                ? 'Entre (ou crie sua conta) para agendar seu horário.'
                : voltar?.startsWith('/assinar')
                  ? 'Entre (ou crie sua conta) para assinar o plano.'
                  : 'Entre para ver seus horários e seu plano.'
            }
            dados={dados}
            onMudar={setDados}
            onVirar={virar}
            rodape={
              MODO_DEMO && (
                <div className="rounded-2xl border border-gold-400/20 bg-gold-400/10 px-4 py-3 text-xs leading-relaxed text-gold-200">
                  <p className="font-semibold">Contas de demonstração (senha: demo)</p>
                  <p className="mt-1">
                    Cliente assinante: <strong>marcos@cliente.demo</strong>
                    <br />
                    Barbeiros: <strong>davi@</strong>, <strong>renato@</strong> ou{' '}
                    <strong>renan@underground.demo</strong>
                    <br />
                    Dono: <strong>admin@underground.demo</strong>
                  </p>
                </div>
              )
            }
          />
          <Face
            lado="cadastro"
            ativo={lado === 'cadastro'}
            titulo="Criar conta"
            subtitulo="Leva menos de um minuto."
            dados={dados}
            onMudar={setDados}
            onVirar={virar}
          />
        </div>
      </div>

      <Link to="/" className="mt-6 text-xs text-zinc-500 underline">
        Voltar ao site
      </Link>
    </main>
  );
}

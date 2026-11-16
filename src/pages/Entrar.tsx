// Login único: e-mail e senha. Equipe vai para o painel; cliente, para "Minha conta".
// Também permite criar conta de cliente.

import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { BlocoConta, CONTA_INICIAL, contaPronta, type DadosConta } from '../components/Conta';
import { Marca } from '../components/ui';
import { api, MODO_DEMO } from '../lib/api';
import { entrar, inicioDe, useConta } from '../lib/conta';

export default function Entrar() {
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const voltar = params.get('voltar');
  const { usuario, carregando } = useConta();
  const [dados, setDados] = useState<DadosConta>({
    ...CONTA_INICIAL,
    modo: params.get('modo') === 'cadastro' ? 'cadastro' : 'entrar',
  });
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => setErro(null), [dados.modo]);

  // Já logado (por exemplo, com "manter conectado"): vai direto.
  if (!carregando && usuario) return <Navigate to={voltar ?? inicioDe(usuario)} replace />;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const r =
        dados.modo === 'entrar'
          ? await api.login(dados.email.trim(), dados.senha)
          : await api.cadastrarCliente({
              nome: dados.nome.trim(),
              email: dados.email.trim(),
              telefone: dados.telefone,
              senha: dados.senha,
            });
      entrar(r.authToken, r.usuario, dados.lembrar);
      // Cliente volta para onde estava (ex.: agendamento); equipe vai para o painel.
      navegar(r.usuario.papel === 'CLIENTE' && voltar ? voltar : inicioDe(r.usuario), {
        replace: true,
      });
    } catch (er) {
      setErro(er instanceof Error ? er.message : 'Não foi possível entrar.');
      setEnviando(false);
    }
  }

  // Na tela de login o campo aceita também o login curto da equipe (ex.: "davi").
  const pronto =
    dados.modo === 'entrar'
      ? dados.email.trim().length > 1 && dados.senha.length > 0
      : contaPronta(dados, null);

  return (
    <main className="grao relative isolate flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="grade-fundo absolute inset-0" />
        <div className="absolute top-1/4 left-1/4 h-72 w-72 animate-flutuar rounded-full bg-gold-500/20 blur-[100px]" />
        <div className="absolute right-1/4 bottom-1/4 h-72 w-72 animate-flutuar rounded-full bg-amber-700/20 blur-[100px] [animation-delay:-7s]" />
      </div>
      <form
        onSubmit={enviar}
        className="card w-full max-w-md animate-entrar space-y-5 p-6 sm:p-8"
        noValidate
      >
        <div className="text-center">
          <Link to="/" aria-label="Voltar ao site">
            <Marca variante="completa" />
          </Link>
          <h1 className="mt-4 text-lg font-semibold text-zinc-50">
            {dados.modo === 'entrar' ? 'Entrar na sua conta' : 'Criar conta'}
          </h1>
        </div>

        <BlocoConta valor={dados} onMudar={setDados} />

        {erro && (
          <p role="alert" className="text-sm text-red-300">
            {erro}
          </p>
        )}
        <button type="submit" className="btn-gold w-full py-3" disabled={!pronto || enviando}>
          {enviando ? 'Aguarde…' : dados.modo === 'entrar' ? 'Entrar' : 'Criar conta e entrar'}
        </button>

        {MODO_DEMO && (
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
        )}
        <Link to="/" className="block text-center text-xs text-zinc-500 underline">
          Voltar ao site
        </Link>
      </form>
    </main>
  );
}

import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Marca } from '../../components/ui';
import { api, MODO_DEMO, sessao } from '../../lib/api';

export default function Login() {
  const navegar = useNavigate();
  const [login, setLogin] = useState(MODO_DEMO ? 'admin' : '');
  const [senha, setSenha] = useState(MODO_DEMO ? 'demo' : '');
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setEntrando(true);
    setErro(null);
    try {
      const { authToken } = await api.login(login, senha);
      sessao.gravar(authToken);
      navegar('/admin');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível entrar.');
      setEntrando(false);
    }
  }

  return (
    <main className="fundo-hero flex min-h-dvh items-center justify-center px-4">
      <form onSubmit={entrar} className="card w-full max-w-sm space-y-4 p-6">
        <div className="text-center">
          <Marca />
          <h1 className="mt-4 text-lg font-semibold text-zinc-50">Área do barbeiro</h1>
        </div>
        {MODO_DEMO && (
          <p className="rounded-xl bg-gold-400/10 px-3 py-2 text-xs text-gold-200">
            Demonstração: <strong>admin / demo</strong> vê todos os barbeiros;{' '}
            <strong>renato / demo</strong> vê só a própria agenda.
          </p>
        )}
        <div>
          <label htmlFor="login" className="mb-1.5 block text-sm font-medium">
            Login
          </label>
          <input
            id="login"
            className="campo"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            required
          />
        </div>
        <div>
          <label htmlFor="senha" className="mb-1.5 block text-sm font-medium">
            Senha
          </label>
          <input
            id="senha"
            type="password"
            className="campo"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        {erro && (
          <p role="alert" className="text-sm text-red-300">
            {erro}
          </p>
        )}
        <button className="btn-gold w-full" disabled={entrando}>
          {entrando ? 'Entrando…' : 'Entrar'}
        </button>
        <Link to="/" className="block text-center text-xs text-zinc-500 underline">
          Voltar ao site
        </Link>
      </form>
    </main>
  );
}

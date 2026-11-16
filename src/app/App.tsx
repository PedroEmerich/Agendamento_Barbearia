import { useEffect } from 'react';
import { BrowserRouter, Link, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Cursor, LuzAmbiente, useScrollY } from '../components/efeitos';
import { Marca } from '../components/ui';
import { MODO_DEMO } from '../lib/api';
import Home from '../pages/publico/Home';
import Agendar from '../pages/publico/Agendar';
import MeuAgendamento from '../pages/publico/MeuAgendamento';
import Privacidade from '../pages/publico/Privacidade';
import Login from '../pages/admin/Login';
import Agenda from '../pages/admin/Agenda';

function RolarParaOTopo() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      // Espera a página montar para achar a seção (ex.: /#servicos vindo de outra rota).
      const id = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView(), 60);
      return () => clearTimeout(id);
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

function FaixaDemo() {
  if (!MODO_DEMO) return null;
  return (
    <p className="relative z-50 border-b border-gold-400/20 bg-gold-400/10 px-4 py-1.5 text-center text-[0.7rem] font-medium text-gold-200 backdrop-blur">
      Versão demonstrativa · os agendamentos ficam só neste aparelho e nenhuma mensagem é enviada.
    </p>
  );
}

const SECOES = [
  ['servicos', 'Serviços'],
  ['equipe', 'Equipe'],
  ['espaco', 'O espaço'],
  ['local', 'Onde estamos'],
] as const;

function BarraProgresso() {
  const y = useScrollY();
  const total =
    typeof document === 'undefined' ? 1 : document.documentElement.scrollHeight - innerHeight;
  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 z-[65] h-0.5 origin-left bg-gradient-to-r from-gold-600 via-gold-300 to-gold-100"
      style={{ width: '100%', transform: `scaleX(${total > 0 ? Math.min(1, y / total) : 0})` }}
    />
  );
}

function Cabecalho() {
  const rolou = useScrollY() > 40;
  const naHome = useLocation().pathname === '/';
  return (
    // Altura zero: o cabeçalho flutua sobre o conteúdo sem empurrá-lo.
    <div className="sticky top-0 z-40 h-0">
      <header
        className={`mx-auto flex items-center justify-between gap-4 transition-all duration-500 ease-(--ease-suave) ${
          rolou
            ? 'vidro mt-3 h-14 w-[calc(100%-1.5rem)] max-w-5xl rounded-full !bg-ink-950/60 px-3 pl-5'
            : 'mt-0 h-20 w-full max-w-6xl border border-transparent px-4 sm:px-6'
        }`}
      >
        <Link to="/" aria-label="Underground Barbershop — início" className="shrink-0">
          <Marca />
        </Link>
        <nav aria-label="Seções" className="hidden items-center gap-1 md:flex">
          {SECOES.map(([id, rotulo]) => (
            <NavLink
              key={id}
              to={naHome ? `#${id}` : `/#${id}`}
              className="rounded-full px-4 py-2 text-sm text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-50"
            >
              {rotulo}
            </NavLink>
          ))}
        </nav>
        <Link to="/agendar" className={`btn-gold ${rolou ? 'min-h-10 px-5' : 'px-6'}`}>
          Agendar
        </Link>
      </header>
    </div>
  );
}

function LayoutPublico() {
  const naHome = useLocation().pathname === '/';
  return (
    <div className="grao relative flex min-h-dvh flex-col">
      <LuzAmbiente />
      <BarraProgresso />
      <FaixaDemo />
      <Cabecalho />
      <main className={`relative z-10 flex-1 ${naHome ? '' : 'pt-24'}`}>
        <Outlet />
      </main>
      {!naHome && (
        <footer className="relative z-10 border-t border-white/[0.06] px-4 py-6 text-center text-xs text-zinc-500">
          <Link to="/privacidade" className="underline hover:text-gold-300">
            Privacidade
          </Link>
        </footer>
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <RolarParaOTopo />
      <Cursor />
      <Routes>
        <Route element={<LayoutPublico />}>
          <Route path="/" element={<Home />} />
          <Route path="/agendar" element={<Agendar />} />
          <Route path="/meu-agendamento/:token" element={<MeuAgendamento />} />
          <Route path="/privacidade" element={<Privacidade />} />
          <Route
            path="*"
            element={
              <div className="mx-auto max-w-md px-4 py-24 text-center">
                <p className="texto-contorno font-display text-8xl font-black">404</p>
                <h1 className="titulo mt-4">Página não encontrada</h1>
                <Link to="/" className="btn-gold mt-8">
                  Voltar ao início
                </Link>
              </div>
            }
          />
        </Route>
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin" element={<Agenda />} />
      </Routes>
    </BrowserRouter>
  );
}

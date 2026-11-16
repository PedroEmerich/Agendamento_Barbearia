import { useEffect } from 'react';
import { BrowserRouter, Link, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Marca } from '../components/ui';
import { MODO_DEMO } from '../lib/api';
import Home from '../pages/publico/Home';
import Agendar from '../pages/publico/Agendar';
import MeuAgendamento from '../pages/publico/MeuAgendamento';
import Privacidade from '../pages/publico/Privacidade';
import Login from '../pages/admin/Login';
import Agenda from '../pages/admin/Agenda';

function RolarParaOTopo() {
  const { pathname } = useLocation();
  useEffect(() => {
    // Com chaves: em navegadores novos scrollTo devolve uma Promise, que não pode virar cleanup.
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function FaixaDemo() {
  if (!MODO_DEMO) return null;
  return (
    <p className="bg-gold-500 px-4 py-1.5 text-center text-xs font-semibold text-ink-950">
      Versão demonstrativa — os agendamentos ficam só neste aparelho e nenhuma mensagem é enviada.
    </p>
  );
}

function LayoutPublico() {
  const naHome = useLocation().pathname === '/';
  return (
    <div className="flex min-h-dvh flex-col">
      <FaixaDemo />
      <header className="sticky top-0 z-20 border-b border-ink-700/70 bg-ink-950/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link to="/" aria-label="Underground Barbershop — início">
            <Marca />
          </Link>
          <Link to="/agendar" className="btn-gold px-5">
            Agendar
          </Link>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      {!naHome && (
        <footer className="border-t border-ink-700 px-4 py-6 text-center text-xs text-zinc-500">
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
                <h1 className="titulo">Página não encontrada</h1>
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

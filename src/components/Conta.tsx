// Bloco "quem é você": criar conta ou entrar sem sair do agendamento/contratação.
// Logado como cliente, só mostra os dados (já preenchidos).

import { api } from '../lib/api';
import { entrar, sair, useConta } from '../lib/conta';
import { mascararTelefone, normalizarTelefone, formatarTelefone } from '../lib/telefone';
import type { Usuario } from '../types';

export interface DadosConta {
  modo: 'cadastro' | 'entrar';
  nome: string;
  telefone: string;
  email: string;
  senha: string;
  lembrar: boolean;
}

export const CONTA_INICIAL: DadosConta = {
  modo: 'cadastro',
  nome: '',
  telefone: '',
  email: '',
  senha: '',
  lembrar: true,
};

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

export function contaPronta(d: DadosConta, usuario: Usuario | null): boolean {
  if (usuario?.papel === 'CLIENTE') return true;
  if (d.modo === 'entrar') return emailOk(d.email) && d.senha.length > 0;
  return (
    d.nome.trim().length >= 2 &&
    normalizarTelefone(d.telefone) !== null &&
    emailOk(d.email) &&
    d.senha.length >= 6
  );
}

/** Cria a conta ou entra, e deixa o cliente logado. Devolve o usuário. */
export async function garantirConta(d: DadosConta, usuario: Usuario | null): Promise<Usuario> {
  if (usuario?.papel === 'CLIENTE') return usuario;
  const r =
    d.modo === 'entrar'
      ? await api.login(d.email.trim(), d.senha)
      : await api.cadastrarCliente({
          nome: d.nome.trim(),
          email: d.email.trim(),
          telefone: d.telefone,
          senha: d.senha,
        });
  if (r.usuario.papel !== 'CLIENTE') {
    throw new Error('Essa é uma conta da equipe. Use uma conta de cliente para agendar.');
  }
  entrar(r.authToken, r.usuario, d.lembrar);
  return r.usuario;
}

export function BlocoConta({
  valor,
  onMudar,
}: {
  valor: DadosConta;
  onMudar: (d: DadosConta) => void;
}) {
  const { usuario, carregando } = useConta();
  const set = (parcial: Partial<DadosConta>) => onMudar({ ...valor, ...parcial });

  if (carregando) return <div className="skeleton h-24" />;

  if (usuario?.papel === 'CLIENTE') {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold-400/15 font-display text-lg font-bold text-gold-200">
          {usuario.nome[0]}
        </span>
        <span className="min-w-0 flex-1 text-sm">
          <span className="block font-semibold text-zinc-50">{usuario.nome}</span>
          <span className="block truncate text-zinc-400">
            {usuario.telefone && formatarTelefone(usuario.telefone)} · {usuario.email}
          </span>
        </span>
        <button
          type="button"
          onClick={sair}
          className="shrink-0 text-xs text-zinc-400 underline hover:text-gold-300"
        >
          Não é você?
        </button>
      </div>
    );
  }

  const aba = (m: DadosConta['modo'], rotulo: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={valor.modo === m}
      onClick={() => set({ modo: m })}
      className={`min-h-10 flex-1 cursor-pointer rounded-full text-sm font-semibold transition ${
        valor.modo === m ? 'bg-gold-400 text-ink-950' : 'text-zinc-400 hover:text-zinc-100'
      }`}
    >
      {rotulo}
    </button>
  );

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Conta"
        className="flex rounded-full border border-white/10 bg-white/[0.03] p-1"
      >
        {aba('cadastro', 'Criar conta')}
        {aba('entrar', 'Já tenho conta')}
      </div>
      <p className="text-xs text-zinc-500">
        {valor.modo === 'cadastro'
          ? 'Com a conta você vê seus horários, troca, cancela e paga depois, de qualquer aparelho.'
          : 'Entre para usar os dados que você já cadastrou.'}
      </p>

      {valor.modo === 'cadastro' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1.5 block text-zinc-300">Seu nome</span>
            <input
              id="nome"
              className="campo"
              value={valor.nome}
              onChange={(e) => set({ nome: e.target.value })}
              maxLength={60}
              autoComplete="name"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-zinc-300">WhatsApp</span>
            <input
              id="telefone"
              className="campo"
              type="tel"
              inputMode="numeric"
              placeholder="(11) 98765-4321"
              value={valor.telefone}
              onChange={(e) => set({ telefone: mascararTelefone(e.target.value) })}
              autoComplete="tel-national"
            />
          </label>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1.5 block text-zinc-300">E-mail</span>
          <input
            id="email"
            className="campo"
            type="email"
            value={valor.email}
            onChange={(e) => set({ email: e.target.value })}
            autoComplete="email"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block text-zinc-300">Senha</span>
          <input
            id="senha"
            className="campo"
            type="password"
            value={valor.senha}
            onChange={(e) => set({ senha: e.target.value })}
            autoComplete={valor.modo === 'cadastro' ? 'new-password' : 'current-password'}
            aria-describedby="senha-ajuda"
          />
          {valor.modo === 'cadastro' && (
            <span id="senha-ajuda" className="mt-1.5 block text-xs text-zinc-500">
              Mínimo de 6 caracteres.
            </span>
          )}
        </label>
      </div>
      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-zinc-300">
        <input
          type="checkbox"
          className="h-4 w-4 accent-gold-400"
          checked={valor.lembrar}
          onChange={(e) => set({ lembrar: e.target.checked })}
        />
        Manter conectado neste aparelho
      </label>
      {valor.modo === 'entrar' && (
        <p className="text-xs text-zinc-500">
          Esqueceu a senha? Fale com a barbearia pelo WhatsApp.
        </p>
      )}
    </div>
  );
}

// Quem está logado (cliente, barbeiro ou admin), compartilhado por todas as telas.

import { useSyncExternalStore } from 'react';
import type { Usuario } from '../types';
import { api, sessao } from './api';

type Estado = { usuario: Usuario | null; carregando: boolean };

let estado: Estado = { usuario: null, carregando: sessao.ler() !== null };
const ouvintes = new Set<() => void>();
let verificado = false;

function mudar(novo: Estado) {
  estado = novo;
  ouvintes.forEach((f) => f());
}

/** Na primeira vez, confirma o token salvo com o servidor ("lembrar de mim"). */
function verificar() {
  if (verificado) return;
  verificado = true;
  if (!sessao.ler()) return mudar({ usuario: null, carregando: false });
  api
    .me()
    .then((usuario) => mudar({ usuario, carregando: false }))
    .catch(() => {
      sessao.gravar(null);
      mudar({ usuario: null, carregando: false });
    });
}

export function useConta(): Estado {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      verificar();
      return () => ouvintes.delete(f);
    },
    () => estado,
  );
}

export function entrar(authToken: string, usuario: Usuario, lembrar: boolean) {
  sessao.gravar(authToken, lembrar);
  verificado = true;
  mudar({ usuario, carregando: false });
}

export function sair() {
  sessao.gravar(null);
  mudar({ usuario: null, carregando: false });
}

/** Para onde cada papel vai depois de entrar. */
export const inicioDe = (u: Usuario) => (u.papel === 'CLIENTE' ? '/minha-conta' : '/admin');

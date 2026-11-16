import { useCallback, useEffect, useState } from 'react';

interface Consulta<T> {
  dados: T | null;
  erro: string | null;
  carregando: boolean;
  recarregar: () => void;
}

/** Busca dados ao montar e sempre que `deps` mudar. Passe `null` como função para pausar. */
export function useConsulta<T>(buscar: (() => Promise<T>) | null, deps: unknown[]): Consulta<T> {
  const [estado, setEstado] = useState<{
    dados: T | null;
    erro: string | null;
    carregando: boolean;
  }>({
    dados: null,
    erro: null,
    carregando: buscar !== null,
  });
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (!buscar) return;
    let ativo = true;
    setEstado((e) => ({ ...e, erro: null, carregando: true }));
    buscar()
      .then((dados) => ativo && setEstado({ dados, erro: null, carregando: false }))
      .catch(
        (e: Error) =>
          ativo &&
          setEstado({ dados: null, erro: e.message || 'Algo deu errado.', carregando: false }),
      );
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, versao]);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  return { ...estado, recarregar };
}

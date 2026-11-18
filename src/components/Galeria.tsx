// Fotos do espaço: lista compartilhada e visualizador em tela cheia
// (setas, teclado, deslizar no celular e Esc para fechar).

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { IconeSeta, IconeVoltar } from './ui';

const base = `${import.meta.env.BASE_URL}fotos/`;

export interface Foto {
  src: string;
  alt: string;
  largura: number;
  altura: number;
}

export const FOTOS: Record<'salao' | 'bar' | 'balcao' | 'barbeiro' | 'toalha', Foto> = {
  salao: {
    src: `${base}salao.webp`,
    alt: 'Salão da Underground com as cadeiras, a mesa de sinuca e o letreiro com o leão',
    largura: 1009,
    altura: 854,
  },
  bar: {
    src: `${base}bar.webp`,
    alt: 'Bar com TV passando futebol, prateleiras de bebidas e geladeira',
    largura: 1007,
    altura: 860,
  },
  balcao: {
    src: `${base}balcao.webp`,
    alt: 'Balcão de madeira com banquetas, violão e camisas de time penduradas',
    largura: 967,
    altura: 485,
  },
  barbeiro: {
    src: `${base}barbeiro.webp`,
    alt: 'Barbeiro sorrindo enquanto faz um degradê',
    largura: 1011,
    altura: 656,
  },
  toalha: {
    src: `${base}toalha.webp`,
    alt: 'Barba sendo feita na máquina, com toalha quente no rosto',
    largura: 645,
    altura: 361,
  },
};

export const TODAS_AS_FOTOS: Foto[] = [
  FOTOS.salao,
  FOTOS.barbeiro,
  FOTOS.bar,
  FOTOS.balcao,
  FOTOS.toalha,
];

export function VisualizadorFotos({
  fotos,
  indice,
  onMudar,
  onFechar,
}: {
  fotos: Foto[];
  indice: number;
  onMudar: (i: number) => void;
  onFechar: () => void;
}) {
  const toqueX = useRef<number | null>(null);
  const fechar = useRef<HTMLButtonElement>(null);
  const anterior = () => onMudar((indice - 1 + fotos.length) % fotos.length);
  const proxima = () => onMudar((indice + 1) % fotos.length);

  // Ao abrir: foco no fechar e rolagem da página travada.
  useEffect(() => {
    fechar.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
      if (e.key === 'ArrowLeft') anterior();
      if (e.key === 'ArrowRight') proxima();
    };
    addEventListener('keydown', tecla);
    return () => removeEventListener('keydown', tecla);
  });

  const foto = fotos[indice];
  // Desenhado direto no <body>: assim fica acima do menu fixo e de qualquer outra camada.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Fotos da Underground"
      className="fixed inset-0 z-[80] flex animate-entrar flex-col bg-ink-950/95 backdrop-blur-md"
      onClick={onFechar}
      onTouchStart={(e) => (toqueX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (toqueX.current === null) return;
        const dx = e.changedTouches[0].clientX - toqueX.current;
        if (Math.abs(dx) > 50) (dx > 0 ? anterior : proxima)();
        toqueX.current = null;
      }}
    >
      <div className="flex items-center justify-between p-4 text-sm text-zinc-400">
        <span className="tabular-nums">
          {indice + 1} / {fotos.length}
        </span>
        <button
          ref={fechar}
          type="button"
          onClick={onFechar}
          className="btn-ghost h-11 w-11 px-0"
          aria-label="Fechar"
        >
          ✕
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 sm:px-20">
        <img
          key={foto.src}
          src={foto.src}
          alt={foto.alt}
          width={foto.largura}
          height={foto.altura}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full animate-entrar rounded-2xl object-contain shadow-2xl"
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            anterior();
          }}
          className="btn-ghost absolute left-4 hidden h-12 w-12 px-0 sm:flex"
          aria-label="Foto anterior"
        >
          <IconeVoltar />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            proxima();
          }}
          className="btn-ghost absolute right-4 hidden h-12 w-12 px-0 sm:flex"
          aria-label="Próxima foto"
        >
          <IconeSeta />
        </button>
      </div>
      <p
        className="px-4 py-4 text-center text-sm text-zinc-400"
        onClick={(e) => e.stopPropagation()}
      >
        {foto.alt}
      </p>
      <div className="flex justify-center gap-2 pb-6" onClick={(e) => e.stopPropagation()}>
        {fotos.map((f, i) => (
          <button
            key={f.src}
            type="button"
            onClick={() => onMudar(i)}
            aria-label={`Ver foto ${i + 1}`}
            aria-current={i === indice}
            className={`h-12 w-16 cursor-pointer overflow-hidden rounded-lg border-2 transition ${
              i === indice ? 'border-gold-300' : 'border-transparent opacity-50 hover:opacity-100'
            }`}
          >
            <img src={f.src} alt="" className="h-full w-full object-cover" loading="lazy" />
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}

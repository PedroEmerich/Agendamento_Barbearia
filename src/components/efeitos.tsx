// Efeitos de interação: cursor, revelação no scroll, inclinação 3D, botão magnético, contador.
// Tudo respeita prefers-reduced-motion e só usa o cursor em dispositivos com mouse.

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type MouseEvent,
  type ReactNode,
} from 'react';

const semMovimento = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const temMouse = () =>
  typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ------------------------------------------------------------ revelação */

let observador: IntersectionObserver | null = null;
function observar(el: Element) {
  if (!('IntersectionObserver' in window) || semMovimento()) {
    el.classList.add('visivel');
    return () => {};
  }
  observador ??= new IntersectionObserver(
    (entradas) =>
      entradas.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('visivel');
          observador?.unobserve(e.target);
        }
      }),
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
  );
  observador.observe(el);
  return () => observador?.unobserve(el);
}

export function Revelar({
  children,
  como: Tag = 'div',
  atraso = 0,
  tipo = '',
  className,
  ...resto
}: {
  children: ReactNode;
  como?: ElementType;
  atraso?: number;
  tipo?: '' | 'esquerda' | 'zoom';
  className?: string;
  [k: string]: unknown;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => (ref.current ? observar(ref.current) : undefined), []);
  return (
    <Tag
      ref={ref}
      data-revelar={tipo}
      className={className}
      style={{ '--atraso': `${atraso}ms` } as CSSProperties}
      {...resto}
    >
      {children}
    </Tag>
  );
}

/* --------------------------------------------------------------- cursor */

/** Anel dourado que segue o mouse e cresce sobre elementos clicáveis. */
export function Cursor() {
  const anel = useRef<HTMLDivElement>(null);
  const ponto = useRef<HTMLDivElement>(null);
  const rotulo = useRef<HTMLSpanElement>(null);
  const [ativo] = useState(() => temMouse() && !semMovimento());

  useEffect(() => {
    if (!ativo) return;
    const alvo = { x: innerWidth / 2, y: innerHeight / 2 };
    const atual = { ...alvo };
    let escala = 1;
    let escalaAlvo = 1;
    let visivel = false;
    let quadro = 0;

    const mover = (e: PointerEvent) => {
      alvo.x = e.clientX;
      alvo.y = e.clientY;
      if (!visivel) {
        visivel = true;
        atual.x = alvo.x;
        atual.y = alvo.y;
        anel.current?.style.setProperty('opacity', '1');
        ponto.current?.style.setProperty('opacity', '1');
      }
      const el = (e.target as Element).closest<HTMLElement>(
        'a, button, [data-cursor], label, input, textarea, select',
      );
      const texto = el?.dataset.cursor ?? '';
      escalaAlvo = texto ? 3.4 : el ? (el.matches('input, textarea, select') ? 0.6 : 1.9) : 1;
      if (rotulo.current) rotulo.current.textContent = texto;
      anel.current?.classList.toggle('com-rotulo', !!texto);
    };
    const sair = () => {
      visivel = false;
      anel.current?.style.setProperty('opacity', '0');
      ponto.current?.style.setProperty('opacity', '0');
    };
    const laco = () => {
      atual.x += (alvo.x - atual.x) * 0.18;
      atual.y += (alvo.y - atual.y) * 0.18;
      escala += (escalaAlvo - escala) * 0.18;
      if (anel.current)
        anel.current.style.transform = `translate3d(${atual.x}px, ${atual.y}px, 0) translate(-50%, -50%) scale(${escala})`;
      if (ponto.current)
        ponto.current.style.transform = `translate3d(${alvo.x}px, ${alvo.y}px, 0) translate(-50%, -50%)`;
      quadro = requestAnimationFrame(laco);
    };

    addEventListener('pointermove', mover, { passive: true });
    document.documentElement.addEventListener('pointerleave', sair);
    quadro = requestAnimationFrame(laco);
    return () => {
      removeEventListener('pointermove', mover);
      document.documentElement.removeEventListener('pointerleave', sair);
      cancelAnimationFrame(quadro);
    };
  }, [ativo]);

  if (!ativo) return null;
  return (
    <>
      <div
        ref={anel}
        aria-hidden="true"
        className="group pointer-events-none fixed top-0 left-0 z-[70] flex h-9 w-9 items-center justify-center rounded-full border border-gold-300/70 opacity-0 backdrop-invert-[0.06] transition-[opacity,background-color,border-color] duration-300 [&.com-rotulo]:border-transparent [&.com-rotulo]:bg-gold-300/95"
      >
        <span
          ref={rotulo}
          className="text-[0.22rem] font-bold tracking-wider whitespace-nowrap text-ink-950 uppercase"
        />
      </div>
      <div
        ref={ponto}
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 z-[70] h-1.5 w-1.5 rounded-full bg-gold-200 opacity-0"
      />
    </>
  );
}

/** Brilho grande e difuso atrás do conteúdo, acompanhando o mouse. */
export function LuzAmbiente() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!temMouse() || semMovimento()) return;
    let quadro = 0;
    const mover = (e: PointerEvent) => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        ref.current?.style.setProperty('--lx', `${e.clientX}px`);
        ref.current?.style.setProperty('--ly', `${e.clientY}px`);
      });
    };
    addEventListener('pointermove', mover, { passive: true });
    return () => removeEventListener('pointermove', mover);
  }, []);
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(600px_circle_at_var(--lx,50%)_var(--ly,-20%),rgb(212_169_78/0.07),transparent_60%)]"
    />
  );
}

/* --------------------------------------------- holofote e inclinação 3D */

function posicionarLuz(e: MouseEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  return r;
}

/** Cartão com luz que segue o cursor e leve inclinação 3D. */
export function Inclinar({
  children,
  className = '',
  graus = 7,
  como: Tag = 'div',
  ...resto
}: {
  children: ReactNode;
  className?: string;
  graus?: number;
  como?: ElementType;
  [k: string]: unknown;
}) {
  const ref = useRef<HTMLElement>(null);
  const pode = temMouse() && !semMovimento();

  function mover(e: MouseEvent<HTMLElement>) {
    const r = posicionarLuz(e);
    if (!pode) return;
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    e.currentTarget.style.transform = `perspective(900px) rotateX(${-py * graus}deg) rotateY(${px * graus}deg) translateZ(0)`;
  }
  function sair(e: MouseEvent<HTMLElement>) {
    e.currentTarget.style.transform = '';
  }

  return (
    <Tag
      ref={ref}
      onMouseMove={mover}
      onMouseLeave={sair}
      className={`holofote transition-transform duration-500 ease-(--ease-suave) will-change-transform ${className}`}
      {...resto}
    >
      {children}
    </Tag>
  );
}

/** Envolve um botão/link e o puxa levemente em direção ao cursor. */
export function Magnetico({ children, forca = 0.3 }: { children: ReactNode; forca?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const pode = temMouse() && !semMovimento();
  return (
    <span
      ref={ref}
      className="inline-block transition-transform duration-500 ease-(--ease-suave)"
      onMouseMove={(e) => {
        if (!pode || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * forca;
        const y = (e.clientY - r.top - r.height / 2) * forca;
        ref.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }}
      onMouseLeave={() => ref.current && (ref.current.style.transform = '')}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------- scroll */

/** Progresso (0 → 1) de um elemento atravessando a tela. Atualiza via rAF. */
export function useProgressoScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [progresso, setProgresso] = useState(0);
  useEffect(() => {
    let quadro = 0;
    const calcular = () => {
      quadro = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const p = (innerHeight - r.top) / (innerHeight + r.height);
      setProgresso(Math.min(1, Math.max(0, p)));
    };
    const agendar = () => {
      if (!quadro) quadro = requestAnimationFrame(calcular);
    };
    calcular();
    addEventListener('scroll', agendar, { passive: true });
    addEventListener('resize', agendar);
    return () => {
      removeEventListener('scroll', agendar);
      removeEventListener('resize', agendar);
      cancelAnimationFrame(quadro);
    };
  }, []);
  return [ref, progresso] as const;
}

/** Posição vertical da página, com throttle por quadro. */
export function useScrollY() {
  const [y, setY] = useState(0);
  useEffect(() => {
    let quadro = 0;
    const ler = () => {
      if (quadro) return;
      quadro = requestAnimationFrame(() => {
        quadro = 0;
        setY(scrollY);
      });
    };
    ler();
    addEventListener('scroll', ler, { passive: true });
    return () => {
      removeEventListener('scroll', ler);
      cancelAnimationFrame(quadro);
    };
  }, []);
  return y;
}

/* ------------------------------------------------------------ contador */

export function Contador({
  ate,
  casas = 0,
  duracao = 1600,
}: {
  ate: number;
  casas?: number;
  duracao?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [valor, setValor] = useState(semMovimento() ? ate : 0);
  useEffect(() => {
    const el = ref.current;
    if (!el || semMovimento()) return;
    let quadro = 0;
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      const inicio = performance.now();
      const passo = (t: number) => {
        const p = Math.min(1, (t - inicio) / duracao);
        setValor(ate * (1 - Math.pow(1 - p, 4)));
        if (p < 1) quadro = requestAnimationFrame(passo);
      };
      quadro = requestAnimationFrame(passo);
    });
    obs.observe(el);
    return () => {
      obs.disconnect();
      cancelAnimationFrame(quadro);
    };
  }, [ate, duracao]);
  return (
    <span ref={ref} className="tabular-nums">
      {valor.toLocaleString('pt-BR', {
        minimumFractionDigits: casas,
        maximumFractionDigits: casas,
      })}
    </span>
  );
}

/* ------------------------------------------------------------- letreiro */

export function Letreiro({ itens, invertido = false }: { itens: string[]; invertido?: boolean }) {
  const linha = (
    <span className="flex shrink-0 items-center">
      {itens.map((t) => (
        <span key={t} className="flex items-center">
          <span className="px-6 sm:px-10">{t}</span>
          <span className="text-gold-400" aria-hidden="true">
            ✦
          </span>
        </span>
      ))}
    </span>
  );
  return (
    <div className="flex overflow-hidden" aria-hidden="true">
      <div
        className="flex animate-marquee"
        style={invertido ? { animationDirection: 'reverse' } : undefined}
      >
        {linha}
        {linha}
      </div>
    </div>
  );
}

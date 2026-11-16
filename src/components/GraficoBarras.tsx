// Gráfico de barras de uma série (SVG próprio, sem biblioteca).
// Barras finas ancoradas na base com topo arredondado, grade discreta, dica ao passar o
// mouse/tocar e navegação por teclado. O período em andamento leva textura listrada,
// para não ser confundido com um período fechado.

import { useEffect, useId, useRef, useState } from 'react';

export interface PontoGrafico {
  rotulo: string;
  rotuloLongo: string;
  valor: number;
  /** Período ainda em andamento: barra com textura. */
  parcial?: boolean;
  detalhe?: string;
}

/** Cor validada contra o fundo escuro do painel (faixa de luminosidade e contraste ≥ 3:1). */
const COR = '#b8892f';
const COR_ATIVA = '#d9b25e';

function passoBonito(max: number, divisoes: number): number {
  const bruto = max / divisoes;
  const potencia = 10 ** Math.floor(Math.log10(bruto || 1));
  const n = bruto / potencia;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * potencia;
}

export default function GraficoBarras({
  dados,
  formatar,
  formatarEixo = formatar,
  altura = 260,
  titulo,
}: {
  dados: PontoGrafico[];
  formatar: (v: number) => string;
  formatarEixo?: (v: number) => string;
  altura?: number;
  titulo: string;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(640);
  const [ativo, setAtivo] = useState<number | null>(null);
  const idTextura = useId().replace(/:/g, '');

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setLargura(Math.max(260, e.contentRect.width)));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const margem = { topo: 24, direita: 8, base: 28, esquerda: 44 };
  const w = largura - margem.esquerda - margem.direita;
  const h = altura - margem.topo - margem.base;
  const maxValor = Math.max(1, ...dados.map((d) => d.valor));
  const passo = passoBonito(maxValor, 4);
  const topo = Math.ceil(maxValor / passo) * passo;
  const marcas = Array.from({ length: Math.round(topo / passo) + 1 }, (_, i) => i * passo);
  const faixa = w / Math.max(1, dados.length);
  const larguraBarra = Math.min(36, Math.max(8, faixa * 0.55));
  const y = (v: number) => margem.topo + h - (v / topo) * h;
  // Em telas estreitas, mostra rótulo do eixo X alternado (contando do último, que sempre aparece).
  const pularRotulo = faixa < 34 ? 2 : 1;

  function barra(x: number, valor: number): string {
    const topoY = y(valor);
    const base = margem.topo + h;
    const r = Math.min(4, (base - topoY) / 2, larguraBarra / 2);
    if (base - topoY < 0.5) return '';
    return `M${x},${base} L${x},${topoY + r} Q${x},${topoY} ${x + r},${topoY} L${x + larguraBarra - r},${topoY} Q${x + larguraBarra},${topoY} ${x + larguraBarra},${topoY + r} L${x + larguraBarra},${base} Z`;
  }

  const ultimo = dados.length - 1;
  const ponto = ativo !== null ? dados[ativo] : null;
  const xAtivo = ativo !== null ? margem.esquerda + faixa * ativo + faixa / 2 : 0;

  return (
    <div ref={caixa} className="relative select-none" onMouseLeave={() => setAtivo(null)}>
      <svg
        width={largura}
        height={altura}
        role="img"
        aria-label={`${titulo}. ${dados.map((d) => `${d.rotuloLongo}: ${formatar(d.valor)}`).join('; ')}`}
        className="block overflow-visible"
      >
        <defs>
          <pattern
            id={idTextura}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="6" height="6" fill={COR} fillOpacity="0.35" />
            <rect width="2.5" height="6" fill={COR} />
          </pattern>
        </defs>

        {/* Grade e eixo Y, discretos */}
        {marcas.map((m) => (
          <g key={m}>
            <line
              x1={margem.esquerda}
              x2={margem.esquerda + w}
              y1={y(m)}
              y2={y(m)}
              stroke="rgb(255 255 255 / 0.07)"
              strokeDasharray={m === 0 ? undefined : '2 4'}
            />
            <text
              x={margem.esquerda - 8}
              y={y(m)}
              dy="0.32em"
              textAnchor="end"
              className="fill-zinc-500 text-[11px] tabular-nums"
            >
              {formatarEixo(m)}
            </text>
          </g>
        ))}

        {dados.map((d, i) => {
          const x = margem.esquerda + faixa * i + (faixa - larguraBarra) / 2;
          const destaque = ativo === i;
          return (
            <g key={d.rotuloLongo}>
              <path
                d={barra(x, d.valor)}
                fill={d.parcial ? `url(#${idTextura})` : destaque ? COR_ATIVA : COR}
                className="transition-[fill] duration-200"
              />
              {(ultimo - i) % pularRotulo === 0 && (
                <text
                  x={x + larguraBarra / 2}
                  y={margem.topo + h + 18}
                  textAnchor="middle"
                  className={`text-[11px] ${destaque ? 'fill-zinc-100' : 'fill-zinc-500'}`}
                >
                  {d.rotulo}
                </text>
              )}
              {/* Rótulo direto só no último período, para não poluir */}
              {i === ultimo && d.valor > 0 && (
                <text
                  x={x + larguraBarra / 2}
                  y={y(d.valor) - 8}
                  textAnchor="middle"
                  className="fill-zinc-200 text-[11px] font-semibold tabular-nums"
                >
                  {formatarEixo(d.valor)}
                </text>
              )}
              {/* Área de toque maior que a barra */}
              <rect
                x={margem.esquerda + faixa * i}
                y={margem.topo}
                width={faixa}
                height={h + margem.base}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`${d.rotuloLongo}: ${formatar(d.valor)}${d.parcial ? ', em andamento' : ''}`}
                className="cursor-pointer outline-none"
                onMouseEnter={() => setAtivo(i)}
                onFocus={() => setAtivo(i)}
                onBlur={() => setAtivo(null)}
                onClick={() => setAtivo(i)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight') setAtivo(Math.min(ultimo, i + 1));
                  if (e.key === 'ArrowLeft') setAtivo(Math.max(0, i - 1));
                }}
              />
            </g>
          );
        })}

        {ponto && (
          <line
            x1={xAtivo}
            x2={xAtivo}
            y1={margem.topo}
            y2={margem.topo + h}
            stroke="rgb(255 255 255 / 0.12)"
            pointerEvents="none"
          />
        )}
      </svg>

      {ponto && (
        <div
          role="status"
          className="vidro pointer-events-none absolute top-0 z-10 min-w-36 -translate-x-1/2 rounded-2xl !bg-ink-950/90 px-3.5 py-2.5 text-left shadow-xl"
          style={{ left: Math.min(Math.max(xAtivo, 80), largura - 80) }}
        >
          <p className="text-xs text-zinc-400">{ponto.rotuloLongo}</p>
          <p className="mt-0.5 text-base font-semibold text-zinc-50 tabular-nums">
            {formatar(ponto.valor)}
          </p>
          {ponto.detalhe && <p className="text-xs text-zinc-400">{ponto.detalhe}</p>}
          {ponto.parcial && <p className="mt-1 text-[0.7rem] text-gold-300">Em andamento</p>}
        </div>
      )}
    </div>
  );
}

import type { ReactNode, SVGProps } from 'react';
import type { StatusAgendamento } from '../types';

type IconeProps = SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: IconeProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconeTesoura = (p: IconeProps) => (
  <Svg {...p}>
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12" />
  </Svg>
);
export const IconeRelogio = (p: IconeProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);
export const IconePin = (p: IconeProps) => (
  <Svg {...p}>
    <path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </Svg>
);
export const IconeInstagram = (p: IconeProps) => (
  <Svg {...p}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
  </Svg>
);
export const IconeWhatsapp = (p: IconeProps) => (
  <Svg {...p}>
    <path d="M3.5 20.5 5 16a8.5 8.5 0 1 1 3.2 3.1Z" />
    <path d="M9 8.5c0 3 2.5 6 6 6.5l1-1.6-2-1-.8.8c-1-.4-1.9-1.3-2.3-2.300l.8-.8-1-2Z" />
  </Svg>
);
export const IconeSeta = (p: IconeProps) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);
export const IconeVoltar = (p: IconeProps) => (
  <Svg {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Svg>
);
export const IconeCheck = (p: IconeProps) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);
export const IconeEstrela = (p: IconeProps) => (
  <Svg {...p} fill="currentColor" stroke="none">
    <path d="m12 2.5 2.9 6.1 6.6.8-4.9 4.6 1.3 6.600L12 17.300l-5.9 3.3 1.3-6.600L2.5 9.400l6.6-.8Z" />
  </Svg>
);
export const IconeUsuario = (p: IconeProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
  </Svg>
);
export const IconeCalendario = (p: IconeProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M8 3v4M16 3v4M3.5 10h17" />
  </Svg>
);

export function Marca({ tamanho = 'md' }: { tamanho?: 'md' | 'lg' }) {
  const grande = tamanho === 'lg';
  return (
    <span className="inline-flex flex-col items-center leading-none">
      <span
        className={`texto-ouro font-display font-black tracking-wider ${grande ? 'text-[clamp(2rem,9.5vw,5.5rem)]' : 'text-lg'}`}
      >
        UNDERGROUND
      </span>
      <span
        className={`font-medium text-gold-400/80 ${grande ? 'mt-2 text-[clamp(0.65rem,2.6vw,1rem)] tracking-[0.9em] pl-[0.9em]' : 'mt-0.5 text-[0.5rem] tracking-[0.55em] pl-[0.55em]'}`}
      >
        BARBERSHOP
      </span>
    </span>
  );
}

export function ErroCaixa({ mensagem, onTentar }: { mensagem: string; onTentar?: () => void }) {
  return (
    <div role="alert" className="card border-red-500/30 p-5 text-center">
      <p className="text-sm text-red-200">{mensagem}</p>
      {onTentar && (
        <button className="btn-ghost mt-4" onClick={onTentar}>
          Tentar de novo
        </button>
      )}
    </div>
  );
}

export function Skeletons({ n, className }: { n: number; className: string }) {
  return (
    <div aria-busy="true" aria-label="Carregando" className="contents">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className={`skeleton ${className}`} />
      ))}
    </div>
  );
}

const STATUS: Record<StatusAgendamento, { rotulo: string; classe: string }> = {
  AGENDADO: { rotulo: 'Agendado', classe: 'border-sky-400/40 bg-sky-400/10 text-sky-200' },
  CONFIRMADO: {
    rotulo: 'Confirmado',
    classe: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  },
  CANCELADO: { rotulo: 'Cancelado', classe: 'border-red-400/40 bg-red-400/10 text-red-200' },
  CONCLUIDO: { rotulo: 'Concluído', classe: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300' },
  NAO_COMPARECEU: {
    rotulo: 'Não compareceu',
    classe: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  },
};

export function SeloStatus({ status }: { status: StatusAgendamento }) {
  const s = STATUS[status];
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.classe}`}>
      {s.rotulo}
    </span>
  );
}

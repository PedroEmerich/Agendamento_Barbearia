import type { AgendamentoCliente, ConfigPublica } from '../types';

function escapar(texto: string): string {
  return texto.replace(/([\\;,])/g, '\\$1').replace(/\n/g, '\\n');
}

export function gerarIcs(a: AgendamentoCliente, config: ConfigPublica): string {
  const dt = (hora: string) => `${a.data.replace(/-/g, '')}T${hora.replace(':', '')}00`;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Underground Barbershop//Agendamento//PT',
    'BEGIN:VEVENT',
    `UID:${a.codigo}-${a.data}@agendamento`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART;TZID=America/Sao_Paulo:${dt(a.hora_inicio)}`,
    `DTEND;TZID=America/Sao_Paulo:${dt(a.hora_fim)}`,
    `SUMMARY:${escapar(`${a.servico_nome} — ${config.nome_barbearia}`)}`,
    `DESCRIPTION:${escapar(`Com ${a.barbeiro_nome}. Código: ${a.codigo}`)}`,
    `LOCATION:${escapar(config.endereco)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function baixarIcs(a: AgendamentoCliente, config: ConfigPublica): void {
  const url = URL.createObjectURL(new Blob([gerarIcs(a, config)], { type: 'text/calendar' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `barbearia-${a.codigo}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}

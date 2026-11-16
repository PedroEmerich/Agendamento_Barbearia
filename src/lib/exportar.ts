// Exportação dos relatórios. As bibliotecas (jsPDF e ExcelJS) são carregadas só quando
// o usuário clica em exportar, para não pesar o carregamento do site.

import type { AgendamentoPainel } from '../types';
import { formatarPreco } from './datas';
import { DIAS_SEMANA, ROTULO_STATUS, type Linha, type Resumo } from './relatorios';

export interface DadosRelatorio {
  periodoTexto: string;
  de: string;
  ate: string;
  /** "Todos os barbeiros" ou o nome do barbeiro. */
  quem: string;
  resumo: Resumo;
  servicos: Linha[];
  barbeiros: Linha[] | null;
  diasSemana: Linha[];
  agendamentos: AgendamentoPainel[];
  nomeBarbeiro: (id: string) => string;
}

const dataBR = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);
const nomeArquivo = (d: DadosRelatorio, ext: string) =>
  `relatorio-underground_${d.de}_a_${d.ate}.${ext}`;

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function indicadores(r: Resumo): [string, string][] {
  return [
    ['Agendamentos', String(r.total)],
    ['Concluídos', String(r.concluidos)],
    ['A realizar', String(r.pendentes)],
    ['Cancelados', String(r.cancelados)],
    ['Faltas', String(r.faltas)],
    ['Comparecimento', pct(r.comparecimento)],
    ['Faturamento', formatarPreco(r.faturamento)],
    ['Previsto (a realizar)', formatarPreco(r.faturamentoPrevisto)],
    ['Ticket médio', formatarPreco(r.ticketMedio)],
  ];
}

/** Converte o leão (webp) em JPEG para o PDF. */
async function leaoPng(): Promise<string | null> {
  try {
    const img = new Image();
    img.src = `${import.meta.env.BASE_URL}marca/leao.webp`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d')!;
    // Fundo igual ao do cabeçalho do PDF e JPEG: arquivo bem menor que PNG com transparência.
    ctx.fillStyle = '#0f0f11';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0);
    return c.toDataURL('image/jpeg', 0.85);
  } catch {
    return null;
  }
}

/* --------------------------------------------------------------------- PDF */

export async function exportarPdf(d: DadosRelatorio): Promise<void> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const L = doc.internal.pageSize.getWidth();
  const OURO: [number, number, number] = [184, 137, 47];
  const TINTA: [number, number, number] = [24, 24, 27];

  // Cabeçalho escuro com o leão
  doc.setFillColor(15, 15, 17);
  doc.rect(0, 0, L, 34, 'F');
  const leao = await leaoPng();
  if (leao) doc.addImage(leao, 'JPEG', 12, 6, 20, 22);
  doc.setTextColor(230, 199, 122);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('UNDERGROUND BARBERSHOP', 38, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(200, 200, 205);
  doc.text(`Relatório de atendimentos · ${d.quem}`, 38, 21.5);
  doc.text(`${d.periodoTexto} (${dataBR(d.de)} a ${dataBR(d.ate)})`, 38, 27);

  // Indicadores em grade 3x3
  doc.setTextColor(...TINTA);
  const caixas = indicadores(d.resumo);
  const largura = (L - 24 - 8) / 3;
  caixas.forEach(([rotulo, valor], i) => {
    const x = 12 + (i % 3) * (largura + 4);
    const y = 42 + Math.floor(i / 3) * 18;
    doc.setDrawColor(225, 225, 230);
    doc.setFillColor(250, 249, 246);
    doc.roundedRect(x, y, largura, 15, 2, 2, 'FD');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 128);
    doc.text(rotulo.toUpperCase(), x + 4, y + 5.5);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...TINTA);
    doc.text(valor, x + 4, y + 11.5);
    doc.setFont('helvetica', 'normal');
  });

  const estiloTabela = {
    theme: 'grid' as const,
    headStyles: {
      fillColor: TINTA,
      textColor: [230, 199, 122] as [number, number, number],
      fontStyle: 'bold' as const,
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 2,
      lineColor: [230, 230, 234] as [number, number, number],
      lineWidth: 0.1,
    },
    alternateRowStyles: { fillColor: [250, 249, 246] as [number, number, number] },
    margin: { left: 12, right: 12 },
  };
  const titulo = (texto: string, y: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...OURO);
    doc.text(texto, 12, y);
    doc.setFont('helvetica', 'normal');
  };
  const ultimoY = () =>
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  const totalAtivos = Math.max(1, d.resumo.total);

  titulo('Por serviço', 104);
  autoTable(doc, {
    ...estiloTabela,
    startY: 107,
    head: [['Serviço', 'Qtd.', '% do total', 'Faturamento']],
    body: d.servicos.map((s) => [
      s.chave,
      s.quantidade,
      `${Math.round((s.quantidade / totalAtivos) * 100)}%`,
      formatarPreco(s.faturamento),
    ]),
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
  });

  if (d.barbeiros) {
    titulo('Por barbeiro', ultimoY() + 9);
    autoTable(doc, {
      ...estiloTabela,
      startY: ultimoY() + 12,
      head: [['Barbeiro', 'Qtd.', 'Faturamento']],
      body: d.barbeiros.map((b) => [
        d.nomeBarbeiro(b.chave),
        b.quantidade,
        formatarPreco(b.faturamento),
      ]),
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
    });
  }

  titulo('Por dia da semana', ultimoY() + 9);
  autoTable(doc, {
    ...estiloTabela,
    startY: ultimoY() + 12,
    head: [d.diasSemana.map((x) => DIAS_SEMANA[Number(x.chave)])],
    body: [d.diasSemana.map((x) => x.quantidade)],
    styles: { ...estiloTabela.styles, halign: 'center' },
  });

  titulo(`Agendamentos (${d.agendamentos.length})`, ultimoY() + 9);
  autoTable(doc, {
    ...estiloTabela,
    startY: ultimoY() + 12,
    head: [
      [
        'Data',
        'Hora',
        'Cliente',
        'Serviço',
        ...(d.barbeiros ? ['Barbeiro'] : []),
        'Status',
        'Valor',
      ],
    ],
    body: d.agendamentos.map((a) => [
      dataBR(a.data),
      a.hora_inicio,
      a.cliente_nome,
      a.servico_nome,
      ...(d.barbeiros ? [d.nomeBarbeiro(a.barbeiro_id)] : []),
      ROTULO_STATUS[a.status],
      formatarPreco(a.preco),
    ]),
    columnStyles: { [d.barbeiros ? 6 : 5]: { halign: 'right' } },
  });

  // Rodapé com numeração
  const paginas = doc.getNumberOfPages();
  const gerado = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 148);
    doc.text(`Gerado em ${gerado}`, 12, 290);
    doc.text(`Página ${i} de ${paginas}`, L - 12, 290, { align: 'right' });
  }

  baixar(doc.output('blob'), nomeArquivo(d, 'pdf'));
}

/* ------------------------------------------------------------------- Excel */

export async function exportarExcel(d: DadosRelatorio): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Underground Barbershop';
  wb.created = new Date();

  const OURO = 'FFE6C77A';
  const TINTA = 'FF18181B';
  const MOEDA = '"R$" #,##0.00';
  const cabecalho = (linha: import('exceljs').Row) => {
    linha.eachCell((c) => {
      c.font = { bold: true, color: { argb: OURO } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TINTA } };
      c.alignment = { vertical: 'middle' };
    });
    linha.height = 20;
  };

  // Resumo
  const resumo = wb.addWorksheet('Resumo', { views: [{ showGridLines: false }] });
  resumo.columns = [{ width: 28 }, { width: 22 }, { width: 14 }, { width: 18 }];
  resumo.addRow(['Underground Barbershop — Relatório de atendimentos']).font = {
    bold: true,
    size: 14,
  };
  resumo.addRow([`${d.periodoTexto}: ${dataBR(d.de)} a ${dataBR(d.ate)}`]);
  resumo.addRow([d.quem]);
  resumo.addRow([]);
  cabecalho(resumo.addRow(['Indicador', 'Valor']));
  const r = d.resumo;
  const linhasResumo: [string, number | string, string?][] = [
    ['Agendamentos', r.total],
    ['Concluídos', r.concluidos],
    ['A realizar', r.pendentes],
    ['Cancelados', r.cancelados],
    ['Faltas', r.faltas],
    ['Comparecimento', r.comparecimento ?? '—', '0%'],
    ['Faturamento', r.faturamento, MOEDA],
    ['Previsto (a realizar)', r.faturamentoPrevisto, MOEDA],
    ['Ticket médio', r.ticketMedio, MOEDA],
  ];
  for (const [rot, val, fmt] of linhasResumo) {
    const linha = resumo.addRow([rot, val]);
    if (fmt) linha.getCell(2).numFmt = fmt;
  }

  resumo.addRow([]);
  cabecalho(resumo.addRow(['Serviço', 'Quantidade', '% do total', 'Faturamento']));
  for (const s of d.servicos) {
    const linha = resumo.addRow([
      s.chave,
      s.quantidade,
      s.quantidade / Math.max(1, r.total),
      s.faturamento,
    ]);
    linha.getCell(3).numFmt = '0%';
    linha.getCell(4).numFmt = MOEDA;
  }
  if (d.barbeiros) {
    resumo.addRow([]);
    cabecalho(resumo.addRow(['Barbeiro', 'Quantidade', '', 'Faturamento']));
    for (const b of d.barbeiros)
      resumo.addRow([d.nomeBarbeiro(b.chave), b.quantidade, '', b.faturamento]).getCell(4).numFmt =
        MOEDA;
  }
  resumo.addRow([]);
  cabecalho(resumo.addRow(['Dia da semana', 'Quantidade']));
  for (const x of d.diasSemana) resumo.addRow([DIAS_SEMANA[Number(x.chave)], x.quantidade]);

  // Agendamentos (planilha "de verdade": filtro, painel congelado e datas como data)
  const ags = wb.addWorksheet('Agendamentos', { views: [{ state: 'frozen', ySplit: 1 }] });
  const colunas = [
    { header: 'Data', key: 'data', width: 12 },
    { header: 'Hora', key: 'hora', width: 8 },
    { header: 'Fim', key: 'fim', width: 8 },
    { header: 'Código', key: 'codigo', width: 10 },
    { header: 'Cliente', key: 'cliente', width: 22 },
    { header: 'Telefone', key: 'telefone', width: 16 },
    { header: 'Serviço', key: 'servico', width: 28 },
    ...(d.barbeiros ? [{ header: 'Barbeiro', key: 'barbeiro', width: 12 }] : []),
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Origem', key: 'origem', width: 11 },
    { header: 'Valor', key: 'valor', width: 12 },
  ];
  ags.columns = colunas;
  cabecalho(ags.getRow(1));
  for (const a of d.agendamentos) {
    const [y, m, dd] = a.data.split('-').map(Number);
    ags.addRow({
      data: new Date(Date.UTC(y, m - 1, dd)),
      hora: a.hora_inicio,
      fim: a.hora_fim,
      codigo: a.codigo,
      cliente: a.cliente_nome,
      telefone: a.cliente_telefone,
      servico: a.servico_nome,
      barbeiro: d.nomeBarbeiro(a.barbeiro_id),
      status: ROTULO_STATUS[a.status],
      origem: a.origem === 'CLIENTE' ? 'Site' : 'Balcão',
      valor: a.preco,
    });
  }
  ags.getColumn('data').numFmt = 'dd/mm/yyyy';
  ags.getColumn('valor').numFmt = MOEDA;
  ags.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colunas.length } };

  const buffer = await wb.xlsx.writeBuffer();
  baixar(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    nomeArquivo(d, 'xlsx'),
  );
}

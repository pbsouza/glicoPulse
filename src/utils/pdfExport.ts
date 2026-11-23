import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { GlucoseEntry, PatientSettings, ScheduleSlot } from '../types/glucose';
import {
  classifyReading,
  computeGlucoseStats,
  formatDateBR,
  formatGlucoseValue,
  formatShortDateBR,
  sortSchedulesAsc,
} from './glucoseUtils';

export interface PdfExportOptions {
  startDate: string;
  endDate: string;
  includeChart: boolean;
  includeStats: boolean;
  includeMatrix: boolean;
  includeChronologicalList: boolean;
  selectedSlotIds?: string[];
}

export function renderChartToDataUrl(
  entries: GlucoseEntry[],
  settings: PatientSettings
): string | null {
  if (entries.length === 0) return null;

  // Sort chronologically ascending for chart
  const ordered = [...entries].sort((a, b) =>
    `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)
  );

  const width = 1200;
  const height = 420;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  const padLeft = 86;
  const padRight = 36;
  const padTop = 34;
  const padBottom = 56;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const rawValues = ordered.map((e) => e.value);
  const maxVal = Math.max(240, Math.ceil((Math.max(...rawValues) + 25) / 20) * 20);
  const minVal = Math.min(40, Math.floor((Math.min(...rawValues) - 15) / 20) * 20);

  const yFor = (val: number) =>
    padTop + plotH - ((val - minVal) / Math.max(1, maxVal - minVal)) * plotH;
  const xFor = (idx: number) =>
    ordered.length === 1
      ? padLeft + plotW / 2
      : padLeft + (idx / (ordered.length - 1)) * plotW;

  // Target range shaded band (hypoThreshold to hyperThreshold)
  const yHyper = yFor(settings.hyperThreshold);
  const yHypo = yFor(settings.hypoThreshold);
  ctx.fillStyle = 'rgba(13, 148, 136, 0.08)';
  ctx.fillRect(padLeft, yHyper, plotW, yHypo - yHyper);

  // Horizontal grid lines & Y-axis labels
  ctx.font = '500 18px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  const ticks = [minVal, settings.hypoThreshold, 130, settings.hyperThreshold, maxVal].filter(
    (v, i, arr) => arr.indexOf(v) === i && v >= minVal && v <= maxVal
  );
  ticks.sort((a, b) => a - b);

  for (const tick of ticks) {
    const y = yFor(tick);
    ctx.strokeStyle =
      tick === settings.hypoThreshold
        ? '#FCA5A5'
        : tick === settings.hyperThreshold
          ? '#FCD34D'
          : '#E2E8F0';
    ctx.lineWidth = tick === settings.hypoThreshold || tick === settings.hyperThreshold ? 2 : 1;
    ctx.setLineDash(tick === settings.hypoThreshold || tick === settings.hyperThreshold ? [6, 5] : []);
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(padLeft + plotW, y);
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.fillText(formatGlucoseValue(tick, settings.unit), padLeft - 14, y);
  }
  ctx.setLineDash([]);

  // X-axis date ticks (up to 7 labels)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#64748B';
  ctx.font = '500 17px sans-serif';
  const maxLabels = Math.min(7, ordered.length);
  for (let i = 0; i < maxLabels; i++) {
    const idx =
      maxLabels === 1 ? 0 : Math.round((i / (maxLabels - 1)) * (ordered.length - 1));
    const entry = ordered[idx];
    ctx.fillText(formatShortDateBR(entry.date), xFor(idx), padTop + plotH + 16);
  }

  // Connecting trend line
  if (ordered.length > 1) {
    ctx.strokeStyle = '#0F766E';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ordered.forEach((entry, idx) => {
      const x = xFor(idx);
      const y = yFor(entry.value);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  // Data points
  ordered.forEach((entry, idx) => {
    const x = xFor(idx);
    const y = yFor(entry.value);
    let fill = '#047857';
    if (entry.value < settings.hypoThreshold) fill = '#BE123C';
    else if (entry.value > settings.severeHyperThreshold) fill = '#B91C1C';
    else if (entry.value > settings.hyperThreshold) fill = '#B45309';

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x, y, 6.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Border frame
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(padLeft, padTop, plotW, plotH);

  return canvas.toDataURL('image/png');
}

export function generateGlucosePdfReport(
  allEntries: GlucoseEntry[],
  schedules: ScheduleSlot[],
  settings: PatientSettings,
  options: PdfExportOptions
): { filename: string; count: number } {
  const selectedSlotSet = options.selectedSlotIds
    ? new Set(options.selectedSlotIds)
    : null;

  const filteredEntries = allEntries.filter(
    (e) =>
      e.date >= options.startDate &&
      e.date <= options.endDate &&
      (!selectedSlotSet || selectedSlotSet.has(e.slotId))
  );

  const orderedAsc = [...filteredEntries].sort((a, b) =>
    `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)
  );
  const orderedDesc = [...filteredEntries].sort((a, b) =>
    `${b.date}T${b.time}`.localeCompare(`${a.date}T${b.time}`)
  );

  const activeSchedules = sortSchedulesAsc(schedules).filter(
    (s) => s.enabled && (!selectedSlotSet || selectedSlotSet.has(s.id))
  );
  const includeOtherColumn =
    (!selectedSlotSet || selectedSlotSet.has('other')) &&
    filteredEntries.some((e) => e.slotId === 'other');

  const matrixColumns: {
    id: string;
    label: string;
    time?: string;
    slot?: ScheduleSlot;
  }[] = [
    ...activeSchedules.map((s) => ({
      id: s.id,
      label: s.label,
      time: s.time,
      slot: s,
    })),
    ...(includeOtherColumn
      ? [{ id: 'other', label: 'Avulso', time: 'Fora grade' }]
      : []),
  ];

  const slotMap = new Map(schedules.map((s) => [s.id, s]));
  const stats = computeGlucoseStats(filteredEntries, schedules, settings);

  const selectedLabels = selectedSlotSet
    ? [
        ...sortSchedulesAsc(schedules)
          .filter((s) => selectedSlotSet.has(s.id))
          .map((s) => s.label),
        ...(selectedSlotSet.has('other') ? ['Avulso'] : []),
      ]
    : null;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let cursorY = 14;

  // Clinical Top Banner
  doc.setFillColor(15, 118, 110); // #0F766E
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('Relatório de controle glicêmico', margin, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const periodLabel = `Período: ${formatDateBR(options.startDate)} a ${formatDateBR(options.endDate)}   |   Unidade: ${settings.unit}`;
  doc.text(periodLabel, margin, 21);

  const generatedAt = new Date().toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  doc.text(`Gerado em ${generatedAt}`, pageWidth - margin, 21, { align: 'right' });

  cursorY = 35;

  // Patient & Clinical Metadata Box
  const hasPatientInfo =
    settings.patientName.trim() || settings.doctorName.trim() || settings.diabetesInfo.trim();

  if (hasPatientInfo) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, cursorY, pageWidth - margin * 2, 18, 2, 2, 'FD');

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Paciente:', margin + 4, cursorY + 6.5);
    doc.setFont('helvetica', 'normal');
    doc.text(settings.patientName.trim() || 'Não informado', margin + 22, cursorY + 6.5);

    doc.setFont('helvetica', 'bold');
    doc.text('Médico:', margin + 96, cursorY + 6.5);
    doc.setFont('helvetica', 'normal');
    doc.text(settings.doctorName.trim() || 'Não informado', margin + 112, cursorY + 6.5);

    doc.setFont('helvetica', 'bold');
    doc.text('Perfil / Obs.:', margin + 4, cursorY + 13.5);
    doc.setFont('helvetica', 'normal');
    doc.text(
      settings.diabetesInfo.trim() ||
        `Meta hipoglicemia < ${formatGlucoseValue(settings.hypoThreshold, settings.unit)} | Hiperglicemia > ${formatGlucoseValue(settings.hyperThreshold, settings.unit)} ${settings.unit}`,
      margin + 27,
      cursorY + 13.5
    );

    cursorY += 24;
  }

  if (selectedLabels && selectedLabels.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 118, 110);
    const filterText = `Medições selecionadas: ${selectedLabels.join(', ')}`;
    const wrapped = doc.splitTextToSize(filterText, pageWidth - margin * 2);
    doc.text(wrapped, margin, cursorY);
    cursorY += wrapped.length * 4 + 3;
  }

  // Statistical Summary Section
  if (options.includeStats) {
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Resumo Estatístico do Período', margin, cursorY);
    cursorY += 4;

    const kpis = [
      {
        label: 'Média Glicêmica',
        value:
          stats.count > 0
            ? `${formatGlucoseValue(stats.average, settings.unit)} ${settings.unit}`
            : '--',
      },
      {
        label: 'HbA1c Estimada (GMI)',
        value: stats.count > 0 ? `${stats.gmiPercent.toFixed(1)}%` : '--',
      },
      {
        label: 'Tempo no Alvo (TIR)',
        value: stats.count > 0 ? `${stats.tirPercent}% (${stats.inRangeCount}/${stats.count})` : '--',
      },
      {
        label: 'Mínima / Máxima',
        value:
          stats.count > 0
            ? `${formatGlucoseValue(stats.min, settings.unit)} / ${formatGlucoseValue(stats.max, settings.unit)}`
            : '--',
      },
      {
        label: 'Variabilidade (CV%)',
        value: stats.count > 0 ? `${stats.cvPercent.toFixed(1)}%` : '--',
      },
    ];

    const boxGap = 3;
    const totalW = pageWidth - margin * 2;
    const boxW = (totalW - boxGap * (kpis.length - 1)) / kpis.length;

    kpis.forEach((kpi, i) => {
      const x = margin + i * (boxW + boxGap);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, cursorY, boxW, 17, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(kpi.label, x + 3, cursorY + 5.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(kpi.value, x + 3, cursorY + 12.5);
    });

    cursorY += 23;

    // Distribution line
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Distribuição das ${stats.count} medições:  • Na meta: ${stats.inRangeCount} (${stats.tirPercent}%)   • Abaixo (<${formatGlucoseValue(settings.hypoThreshold, settings.unit)}): ${stats.belowCount} (${stats.belowPercent}%)   • Acima: ${stats.aboveCount} (${stats.abovePercent}%)`,
      margin,
      cursorY
    );
    cursorY += 7;
  }

  // Embedded Glycemic Curve Chart
  if (options.includeChart && orderedAsc.length > 0) {
    const chartImg = renderChartToDataUrl(orderedAsc, settings);
    if (chartImg) {
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Curva de Tendência Glicêmica', margin, cursorY);
      cursorY += 3;

      const chartW = pageWidth - margin * 2;
      const chartH = chartW * (420 / 1200);
      doc.addImage(chartImg, 'PNG', margin, cursorY, chartW, chartH);
      cursorY += chartH + 8;
    }
  }

  // Daily Schedule Matrix Table
  if (options.includeMatrix && orderedDesc.length > 0 && matrixColumns.length > 0) {
    if (cursorY > 220) {
      doc.addPage();
      cursorY = 16;
    }

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Grade Diária por Horários Configurados', margin, cursorY);
    cursorY += 3;

    const uniqueDates = Array.from(new Set(orderedDesc.map((e) => e.date))).sort((a, b) =>
      b.localeCompare(a)
    );

    const headRow = [
      'Data',
      ...matrixColumns.map((col) =>
        col.time ? `${col.label}\n(${col.time})` : col.label
      ),
      'Média',
    ];

    const bodyRows = uniqueDates.map((dateStr) => {
      const dayEntries = orderedDesc.filter((e) => e.date === dateStr);
      const dayAvg =
        dayEntries.length > 0
          ? dayEntries.reduce((acc, e) => acc + e.value, 0) / dayEntries.length
          : 0;

      const slotCells = matrixColumns.map((col) => {
        const matches = dayEntries.filter((e) => e.slotId === col.id);
        if (matches.length === 0) return '—';
        return matches.map((m) => formatGlucoseValue(m.value, settings.unit)).join(' / ');
      });

      return [
        formatDateBR(dateStr),
        ...slotCells,
        dayEntries.length > 0 ? formatGlucoseValue(dayAvg, settings.unit) : '—',
      ];
    });

    autoTable(doc, {
      startY: cursorY,
      head: [headRow],
      body: bodyRows,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 8,
        cellPadding: 2.2,
        halign: 'center',
        valign: 'middle',
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [15, 118, 110],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold', cellWidth: 22 },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      didParseCell: (hookData) => {
        if (
          hookData.section === 'body' &&
          hookData.column.index > 0 &&
          hookData.column.index <= matrixColumns.length
        ) {
          const text = String(hookData.cell.raw ?? '');
          if (text !== '—') {
            const firstNum = parseFloat(text.split('/')[0].trim());
            const mgVal =
              settings.unit === 'mmol/L' ? Math.round(firstNum * 18.0182) : firstNum;
            const col = matrixColumns[hookData.column.index - 1];
            const info = classifyReading(mgVal, col.slot, settings);
            if (info.status === 'low') {
              hookData.cell.styles.textColor = [190, 18, 60];
              hookData.cell.styles.fontStyle = 'bold';
            } else if (info.status === 'elevated' || info.status === 'high') {
              hookData.cell.styles.textColor = [180, 83, 9];
              hookData.cell.styles.fontStyle = 'bold';
            } else {
              hookData.cell.styles.textColor = [4, 120, 87];
            }
          }
        }
      },
    });

    cursorY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY + 20;
    cursorY += 8;
  }

  // Full Chronological List with Notes
  if (options.includeChronologicalList && orderedDesc.length > 0) {
    if (cursorY > 230) {
      doc.addPage();
      cursorY = 16;
    }

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Registro Cronológico Detalhado', margin, cursorY);
    cursorY += 3;

    const listRows = orderedDesc.map((entry) => {
      const slot = slotMap.get(entry.slotId);
      const info = classifyReading(entry.value, slot, settings);
      const extraParts: string[] = [];
      if (entry.insulinUnits !== undefined && entry.insulinUnits > 0) {
        extraParts.push(`${entry.insulinUnits}U ins.`);
      }
      if (entry.carbsGrams !== undefined && entry.carbsGrams > 0) {
        extraParts.push(`${entry.carbsGrams}g carb.`);
      }
      if (entry.notes.trim()) {
        extraParts.push(entry.notes.trim());
      }

      return [
        formatDateBR(entry.date),
        entry.time,
        slot?.label ?? 'Avulso',
        `${formatGlucoseValue(entry.value, settings.unit)} ${settings.unit}`,
        info.label,
        extraParts.join(' · ') || '—',
      ];
    });

    autoTable(doc, {
      startY: cursorY,
      head: [['Data', 'Hora', 'Horário', 'Glicemia', 'Classificação', 'Observações / Contexto']],
      body: listRows,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 8,
        cellPadding: 2.2,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 14 },
        2: { cellWidth: 28 },
        3: { cellWidth: 24, fontStyle: 'bold' },
        4: { cellWidth: 28 },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });
  }

  if (filteredEntries.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Nenhuma medição registrada no período selecionado.', margin, cursorY + 8);
  }

  // Footer with page numbers on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.getHeight();
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageH - 12, pageWidth - margin, pageH - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'GlicoPulse — Relatório gerado localmente no dispositivo para acompanhamento clínico.',
      margin,
      pageH - 7
    );
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageH - 7, { align: 'right' });
  }

  const filename = `glicopulse-relatorio-${options.startDate}-a-${options.endDate}.pdf`;
  doc.save(filename);

  return { filename, count: filteredEntries.length };
}

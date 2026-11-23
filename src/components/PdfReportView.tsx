import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  FileDown,
  Maximize2,
  Printer,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { GlucoseEntry, PatientSettings, ScheduleSlot } from '../types/glucose';
import {
  classifyReading,
  computeGlucoseStats,
  formatDateBR,
  formatGlucoseValue,
  getLocalDateString,
  sortEntriesDesc,
  sortSchedulesAsc,
} from '../utils/glucoseUtils';
import { generateGlucosePdfReport, renderChartToDataUrl } from '../utils/pdfExport';

interface PdfReportViewProps {
  entries: GlucoseEntry[];
  schedules: ScheduleSlot[];
  settings: PatientSettings;
}

interface MatrixColumn {
  id: string;
  label: string;
  time?: string;
  slot?: ScheduleSlot;
}

interface ReportDocumentSheetProps {
  startDate: string;
  endDate: string;
  generatedAt: string;
  settings: PatientSettings;
  filteredEntries: GlucoseEntry[];
  orderedDesc: GlucoseEntry[];
  uniqueDates: string[];
  matrixColumns: MatrixColumn[];
  slotMap: Map<string, ScheduleSlot>;
  stats: ReturnType<typeof computeGlucoseStats>;
  selectedLabels: string[] | null;
  chartDataUrl: string | null;
  includeStats: boolean;
  includeChart: boolean;
  includeMatrix: boolean;
  includeChronologicalList: boolean;
  noMeasurementsSelected: boolean;
}

const ReportDocumentSheet: React.FC<ReportDocumentSheetProps> = ({
  startDate,
  endDate,
  generatedAt,
  settings,
  filteredEntries,
  orderedDesc,
  uniqueDates,
  matrixColumns,
  slotMap,
  stats,
  selectedLabels,
  chartDataUrl,
  includeStats,
  includeChart,
  includeMatrix,
  includeChronologicalList,
  noMeasurementsSelected,
}) => {
  const hasPatientInfo = Boolean(
    settings.patientName.trim() ||
      settings.doctorName.trim() ||
      settings.diabetesInfo.trim()
  );

  return (
    <article className="mx-auto w-full max-w-[794px] bg-white text-slate-900 shadow-md border border-slate-300/80 print:max-w-none print:shadow-none print:border-0">
      {/* Clinical Top Banner (1:1 with jsPDF) */}
      <div className="bg-[#0F766E] px-6 py-4 text-white">
        <h3 className="font-display text-lg font-bold tracking-tight">
          Relatório de controle glicêmico
        </h3>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-teal-50 font-mono tabular-nums">
          <span>
            Período: {formatDateBR(startDate)} a {formatDateBR(endDate)} | Unidade:{' '}
            {settings.unit}
          </span>
          <span>Gerado em {generatedAt}</span>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-5 print:p-4">
        {/* Patient & Clinical Metadata Box */}
        {hasPatientInfo && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 rounded-md border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[11px] text-slate-900">
            <div>
              <strong className="font-semibold">Paciente: </strong>
              <span>{settings.patientName.trim() || 'Não informado'}</span>
            </div>
            <div>
              <strong className="font-semibold">Médico: </strong>
              <span>{settings.doctorName.trim() || 'Não informado'}</span>
            </div>
            <div className="sm:col-span-2">
              <strong className="font-semibold">Perfil / Obs.: </strong>
              <span>
                {settings.diabetesInfo.trim() ||
                  `Meta hipoglicemia < ${formatGlucoseValue(settings.hypoThreshold, settings.unit)} | Hiperglicemia > ${formatGlucoseValue(settings.hyperThreshold, settings.unit)} ${settings.unit}`}
              </span>
            </div>
          </div>
        )}

        {/* Active Measurement Filter Label */}
        {selectedLabels && selectedLabels.length > 0 && (
          <p className="text-[11px] font-semibold text-[#0F766E]">
            Medições selecionadas: {selectedLabels.join(', ')}
          </p>
        )}

        {/* Statistical Summary Section */}
        {includeStats && (
          <section className="space-y-2.5">
            <h4 className="font-display text-[13px] font-bold text-slate-900">
              Resumo Estatístico do Período
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div className="rounded border border-slate-200 bg-slate-50 px-2.5 py-2">
                <p className="text-[10px] text-slate-500">Média Glicêmica</p>
                <p className="mt-1 font-mono text-xs font-bold tabular-nums text-slate-900">
                  {stats.count > 0
                    ? `${formatGlucoseValue(stats.average, settings.unit)} ${settings.unit}`
                    : '--'}
                </p>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 px-2.5 py-2">
                <p className="text-[10px] text-slate-500">HbA1c Estimada (GMI)</p>
                <p className="mt-1 font-mono text-xs font-bold tabular-nums text-slate-900">
                  {stats.count > 0 ? `${stats.gmiPercent.toFixed(1)}%` : '--'}
                </p>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 px-2.5 py-2">
                <p className="text-[10px] text-slate-500">Tempo no Alvo (TIR)</p>
                <p className="mt-1 font-mono text-xs font-bold tabular-nums text-slate-900">
                  {stats.count > 0
                    ? `${stats.tirPercent}% (${stats.inRangeCount}/${stats.count})`
                    : '--'}
                </p>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 px-2.5 py-2">
                <p className="text-[10px] text-slate-500">Mínima / Máxima</p>
                <p className="mt-1 font-mono text-xs font-bold tabular-nums text-slate-900">
                  {stats.count > 0
                    ? `${formatGlucoseValue(stats.min, settings.unit)} / ${formatGlucoseValue(stats.max, settings.unit)}`
                    : '--'}
                </p>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 px-2.5 py-2 col-span-2 sm:col-span-1">
                <p className="text-[10px] text-slate-500">Variabilidade (CV%)</p>
                <p className="mt-1 font-mono text-xs font-bold tabular-nums text-slate-900">
                  {stats.count > 0 ? `${stats.cvPercent.toFixed(1)}%` : '--'}
                </p>
              </div>
            </div>

            <p className="text-[11px] text-slate-600 font-mono tabular-nums">
              Distribuição das {stats.count} medições: • Na meta: {stats.inRangeCount} (
              {stats.tirPercent}%) • Abaixo (&lt;
              {formatGlucoseValue(settings.hypoThreshold, settings.unit)}): {stats.belowCount} (
              {stats.belowPercent}%) • Acima: {stats.aboveCount} ({stats.abovePercent}%)
            </p>
          </section>
        )}

        {/* Embedded Glycemic Curve Chart (exact PDF canvas image) */}
        {includeChart && chartDataUrl && (
          <section className="space-y-1.5 break-inside-avoid">
            <h4 className="font-display text-[13px] font-bold text-slate-900">
              Curva de Tendência Glicêmica
            </h4>
            <div className="overflow-hidden border border-slate-200 bg-white">
              <img
                src={chartDataUrl}
                alt="Curva de Tendência Glicêmica"
                className="w-full h-auto block"
              />
            </div>
          </section>
        )}

        {/* Empty State */}
        {filteredEntries.length === 0 ? (
          <div className="rounded border border-dashed border-slate-300 px-6 py-8 text-center text-xs text-slate-500">
            {noMeasurementsSelected
              ? 'Selecione ao menos uma medição para visualizar o relatório.'
              : 'Nenhuma medição registrada no período selecionado.'}
          </div>
        ) : (
          <>
            {/* Daily Schedule Matrix Table (ALL days, ALL columns + Média) */}
            {includeMatrix && orderedDesc.length > 0 && matrixColumns.length > 0 && (
              <section className="space-y-1.5">
                <h4 className="font-display text-[13px] font-bold text-slate-900">
                  Grade Diária por Horários Configurados
                </h4>
                <div className="overflow-x-auto print:overflow-visible border border-slate-200">
                  <table className="w-full border-collapse text-[10.5px]">
                    <thead>
                      <tr className="bg-[#0F766E] text-white">
                        <th className="border border-[#0D665F] px-2 py-1.5 text-left font-bold whitespace-nowrap">
                          Data
                        </th>
                        {matrixColumns.map((col) => (
                          <th
                            key={col.id}
                            className="border border-[#0D665F] px-1.5 py-1.5 text-center font-bold whitespace-nowrap"
                          >
                            <div>{col.label}</div>
                            {col.time && (
                              <div className="font-mono text-[9.5px] font-normal text-teal-100">
                                ({col.time})
                              </div>
                            )}
                          </th>
                        ))}
                        <th className="border border-[#0D665F] px-2 py-1.5 text-center font-bold whitespace-nowrap">
                          Média
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {uniqueDates.map((d, rowIdx) => {
                        const dayEntries = orderedDesc.filter((e) => e.date === d);
                        const dayAvg =
                          dayEntries.length > 0
                            ? dayEntries.reduce((acc, e) => acc + e.value, 0) /
                              dayEntries.length
                            : 0;
                        return (
                          <tr
                            key={d}
                            className={rowIdx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}
                          >
                            <td className="border border-slate-200 px-2 py-1.5 font-mono font-bold tabular-nums text-slate-800 whitespace-nowrap">
                              {formatDateBR(d)}
                            </td>
                            {matrixColumns.map((col) => {
                              const matches = dayEntries.filter(
                                (e) => e.slotId === col.id
                              );
                              const first = matches[0];
                              const st = first
                                ? classifyReading(first.value, col.slot, settings)
                                : null;
                              let colorClass = 'text-slate-300';
                              if (st) {
                                if (st.status === 'low') {
                                  colorClass = 'text-[#BE123C] font-bold';
                                } else if (
                                  st.status === 'elevated' ||
                                  st.status === 'high'
                                ) {
                                  colorClass = 'text-[#B45309] font-bold';
                                } else {
                                  colorClass = 'text-[#047857]';
                                }
                              }
                              return (
                                <td
                                  key={col.id}
                                  className={`border border-slate-200 px-1.5 py-1.5 text-center font-mono tabular-nums ${colorClass}`}
                                >
                                  {matches.length > 0
                                    ? matches
                                        .map((m) =>
                                          formatGlucoseValue(m.value, settings.unit)
                                        )
                                        .join(' / ')
                                    : '—'}
                                </td>
                              );
                            })}
                            <td className="border border-slate-200 px-2 py-1.5 text-center font-mono font-semibold tabular-nums text-slate-800 whitespace-nowrap">
                              {dayEntries.length > 0
                                ? formatGlucoseValue(dayAvg, settings.unit)
                                : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Full Chronological List with Notes */}
            {includeChronologicalList && orderedDesc.length > 0 && (
              <section className="space-y-1.5">
                <h4 className="font-display text-[13px] font-bold text-slate-900">
                  Registro Cronológico Detalhado
                </h4>
                <div className="overflow-x-auto print:overflow-visible border border-slate-200">
                  <table className="w-full border-collapse text-left text-[10.5px]">
                    <thead>
                      <tr className="bg-slate-800 text-white">
                        <th className="border border-slate-700 px-2 py-1.5 font-bold whitespace-nowrap">
                          Data
                        </th>
                        <th className="border border-slate-700 px-2 py-1.5 font-bold whitespace-nowrap">
                          Hora
                        </th>
                        <th className="border border-slate-700 px-2 py-1.5 font-bold whitespace-nowrap">
                          Horário
                        </th>
                        <th className="border border-slate-700 px-2 py-1.5 font-bold whitespace-nowrap">
                          Glicemia
                        </th>
                        <th className="border border-slate-700 px-2 py-1.5 font-bold whitespace-nowrap">
                          Classificação
                        </th>
                        <th className="border border-slate-700 px-2 py-1.5 font-bold">
                          Observações / Contexto
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderedDesc.map((entry, rowIdx) => {
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

                        return (
                          <tr
                            key={entry.id}
                            className={rowIdx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}
                          >
                            <td className="border border-slate-200 px-2 py-1.5 font-mono tabular-nums text-slate-800 whitespace-nowrap">
                              {formatDateBR(entry.date)}
                            </td>
                            <td className="border border-slate-200 px-2 py-1.5 font-mono tabular-nums text-slate-800 whitespace-nowrap">
                              {entry.time}
                            </td>
                            <td className="border border-slate-200 px-2 py-1.5 text-slate-800 whitespace-nowrap">
                              {slot?.label ?? 'Avulso'}
                            </td>
                            <td className="border border-slate-200 px-2 py-1.5 font-mono font-bold tabular-nums text-slate-900 whitespace-nowrap">
                              {formatGlucoseValue(entry.value, settings.unit)} {settings.unit}
                            </td>
                            <td className="border border-slate-200 px-2 py-1.5 text-slate-800 whitespace-nowrap">
                              {info.label}
                            </td>
                            <td className="border border-slate-200 px-2 py-1.5 text-slate-600">
                              {extraParts.join(' · ') || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}

        {/* Document Footer */}
        <footer className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
          <span>
            GlicoPulse — Relatório gerado localmente no dispositivo para acompanhamento clínico.
          </span>
          <span className="font-mono tabular-nums">
            {filteredEntries.length}{' '}
            {filteredEntries.length === 1 ? 'medição incluída' : 'medições incluídas'}
          </span>
        </footer>
      </div>
    </article>
  );
};

export const PdfReportView: React.FC<PdfReportViewProps> = ({
  entries,
  schedules,
  settings,
}) => {
  const todayStr = getLocalDateString();
  const getOffsetDate = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - (daysAgo - 1));
    return getLocalDateString(d);
  };

  const [presetDays, setPresetDays] = useState<number | 'custom'>(14);
  const [startDate, setStartDate] = useState(getOffsetDate(14));
  const [endDate, setEndDate] = useState(todayStr);

  const [includeStats, setIncludeStats] = useState(true);
  const [includeChart, setIncludeChart] = useState(true);
  const [includeMatrix, setIncludeMatrix] = useState(true);
  const [includeChronologicalList, setIncludeChronologicalList] = useState(true);
  // null = all measurements selected
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[] | null>(null);

  const [fullPreviewOpen, setFullPreviewOpen] = useState(false);
  const [previewZoom, setPreviewZoom] = useState<'fit' | 'a4'>('fit');
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!fullPreviewOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFullPreviewOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullPreviewOpen]);

  const selectPreset = (days: number) => {
    setPresetDays(days);
    setStartDate(getOffsetDate(days));
    setEndDate(todayStr);
  };

  const activeSchedules = useMemo(
    () => sortSchedulesAsc(schedules).filter((s) => s.enabled),
    [schedules]
  );

  const slotMap = useMemo(() => new Map(schedules.map((s) => [s.id, s])), [schedules]);

  const slotOptions = useMemo(
    () => [
      ...activeSchedules.map((s) => ({
        id: s.id,
        label: s.label,
        time: s.time,
        slot: s as ScheduleSlot | undefined,
      })),
      {
        id: 'other',
        label: 'Avulso',
        time: 'Fora da grade',
        slot: undefined,
      },
    ],
    [activeSchedules]
  );

  const allSlotIds = useMemo(() => slotOptions.map((o) => o.id), [slotOptions]);

  const effectiveSelectedIds = useMemo(
    () => (selectedSlotIds === null ? allSlotIds : selectedSlotIds),
    [selectedSlotIds, allSlotIds]
  );

  const selectedSlotSet = useMemo(
    () => new Set(effectiveSelectedIds),
    [effectiveSelectedIds]
  );

  const isCustomSlotFilter =
    selectedSlotIds !== null && effectiveSelectedIds.length < allSlotIds.length;

  const toggleSlotSelection = (slotId: string) => {
    const nextSet = new Set(effectiveSelectedIds);
    if (nextSet.has(slotId)) {
      nextSet.delete(slotId);
    } else {
      nextSet.add(slotId);
    }
    if (nextSet.size === allSlotIds.length && allSlotIds.every((id) => nextSet.has(id))) {
      setSelectedSlotIds(null);
    } else {
      setSelectedSlotIds(allSlotIds.filter((id) => nextSet.has(id)));
    }
  };

  const filteredEntries = useMemo(() => {
    return sortEntriesDesc(entries).filter(
      (e) =>
        e.date >= startDate &&
        e.date <= endDate &&
        selectedSlotSet.has(e.slotId)
    );
  }, [entries, startDate, endDate, selectedSlotSet]);

  const orderedAsc = useMemo(
    () =>
      [...filteredEntries].sort((a, b) =>
        `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)
      ),
    [filteredEntries]
  );

  const orderedDesc = filteredEntries;

  const previewMatrixColumns = useMemo<MatrixColumn[]>(() => {
    const cols: MatrixColumn[] = activeSchedules
      .filter((s) => selectedSlotSet.has(s.id))
      .map((s) => ({
        id: s.id,
        label: s.label,
        time: s.time,
        slot: s as ScheduleSlot | undefined,
      }));
    const hasOtherEntries = filteredEntries.some((e) => e.slotId === 'other');
    if (selectedSlotSet.has('other') && hasOtherEntries) {
      cols.push({
        id: 'other',
        label: 'Avulso',
        time: 'Fora grade',
        slot: undefined,
      });
    }
    return cols;
  }, [activeSchedules, selectedSlotSet, filteredEntries]);

  const stats = useMemo(
    () => computeGlucoseStats(filteredEntries, schedules, settings),
    [filteredEntries, schedules, settings]
  );

  const uniqueDates = useMemo(() => {
    return Array.from(new Set(filteredEntries.map((e) => e.date))).sort((a, b) =>
      b.localeCompare(a)
    );
  }, [filteredEntries]);

  const selectedLabels = useMemo(
    () =>
      isCustomSlotFilter
        ? slotOptions
            .filter((o) => selectedSlotSet.has(o.id))
            .map((o) => o.label)
        : null,
    [isCustomSlotFilter, slotOptions, selectedSlotSet]
  );

  const chartDataUrl = useMemo(() => {
    if (!includeChart || orderedAsc.length === 0) return null;
    return renderChartToDataUrl(orderedAsc, settings);
  }, [includeChart, orderedAsc, settings]);

  const generatedAt = useMemo(
    () =>
      new Date().toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }),
    [startDate, endDate, filteredEntries.length]
  );

  const handleDownloadPdf = () => {
    if (effectiveSelectedIds.length === 0) return;
    const { filename, count } = generateGlucosePdfReport(entries, schedules, settings, {
      startDate,
      endDate,
      includeChart,
      includeStats,
      includeMatrix,
      includeChronologicalList,
      selectedSlotIds: isCustomSlotFilter ? effectiveSelectedIds : undefined,
    });
    setExportFeedback(`PDF "${filename}" gerado com ${count} medições.`);
    setTimeout(() => setExportFeedback(null), 5000);
  };

  const handlePrint = () => {
    if (effectiveSelectedIds.length === 0) return;
    window.print();
  };

  const sharedSheetProps: ReportDocumentSheetProps = {
    startDate,
    endDate,
    generatedAt,
    settings,
    filteredEntries,
    orderedDesc,
    uniqueDates,
    matrixColumns: previewMatrixColumns,
    slotMap,
    stats,
    selectedLabels,
    chartDataUrl,
    includeStats,
    includeChart,
    includeMatrix,
    includeChronologicalList,
    noMeasurementsSelected: effectiveSelectedIds.length === 0,
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start print:block">
      {/* Left Configuration Panel */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5 no-print">
        <div className="pb-3 border-b border-slate-100">
          <h2 className="font-display text-base font-bold text-slate-900">
            Configurar Relatório PDF
          </h2>
          <p className="text-xs text-slate-500">
            Visualize o documento A4 completo antes de imprimir ou baixar.
          </p>
        </div>

        {/* Period Presets */}
        <div>
          <span className="block text-xs font-semibold text-slate-700 mb-2">Período</span>
          <div className="grid grid-cols-4 gap-1.5 rounded-xl bg-slate-100 p-1">
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => selectPreset(d)}
                className={`min-h-[38px] rounded-lg text-xs font-semibold transition-colors ${
                  presetDays === d
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {d} dias
              </button>
            ))}
          </div>
        </div>

        {/* Custom Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="pdf-start" className="block text-xs font-semibold text-slate-700 mb-1">
              Data Inicial
            </label>
            <input
              id="pdf-start"
              type="date"
              value={startDate}
              onChange={(e) => {
                setPresetDays('custom');
                setStartDate(e.target.value);
              }}
              className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 font-mono text-xs tabular-nums text-slate-900 focus:border-teal-700 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="pdf-end" className="block text-xs font-semibold text-slate-700 mb-1">
              Data Final
            </label>
            <input
              id="pdf-end"
              type="date"
              value={endDate}
              onChange={(e) => {
                setPresetDays('custom');
                setEndDate(e.target.value);
              }}
              className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 font-mono text-xs tabular-nums text-slate-900 focus:border-teal-700 focus:outline-none"
            />
          </div>
        </div>

        {/* Measurement Slots Multi-Select */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-700">
              Medições Incluídas ({effectiveSelectedIds.length}/{allSlotIds.length})
            </span>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSelectedSlotIds(null)}
                className="font-semibold text-teal-700 hover:text-teal-800 transition-colors"
              >
                Todas
              </button>
              <span aria-hidden="true" className="text-slate-300">|</span>
              <button
                type="button"
                onClick={() => setSelectedSlotIds([])}
                className="font-semibold text-slate-500 hover:text-slate-800 transition-colors"
              >
                Limpar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {slotOptions.map((opt) => {
              const checked = selectedSlotSet.has(opt.id);
              return (
                <label
                  key={opt.id}
                  className={`flex min-h-[40px] cursor-pointer items-center gap-2 rounded-xl border px-2.5 py-1.5 transition-colors ${
                    checked
                      ? 'border-teal-700/40 bg-teal-50/70 text-slate-900'
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSlotSelection(opt.id)}
                    className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-700 shrink-0"
                  />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">
                    {opt.label}
                  </span>
                </label>
              );
            })}
          </div>
          {effectiveSelectedIds.length === 0 && (
            <p className="text-xs font-medium text-rose-700">
              Selecione ao menos uma medição para exportar ou imprimir.
            </p>
          )}
        </div>

        {/* Section Checkboxes */}
        <div className="space-y-2.5 pt-1">
          <span className="block text-xs font-semibold text-slate-700">
            Seções Incluídas no Relatório
          </span>
          {(
            [
              {
                checked: includeStats,
                onChange: setIncludeStats,
                label: 'Resumo estatístico (Média, GMI, Tempo no Alvo)',
              },
              {
                checked: includeChart,
                onChange: setIncludeChart,
                label: 'Gráfico da curva glicêmica',
              },
              {
                checked: includeMatrix,
                onChange: setIncludeMatrix,
                label: 'Grade diária por horários configurados',
              },
              {
                checked: includeChronologicalList,
                onChange: setIncludeChronologicalList,
                label: 'Lista cronológica completa com observações',
              },
            ] as const
          ).map((item, idx) => (
            <label key={idx} className="flex items-center gap-2.5 cursor-pointer py-1">
              <input
                type="checkbox"
                checked={item.checked}
                onChange={(e) => item.onChange(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
              />
              <span className="text-xs text-slate-700">{item.label}</span>
            </label>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="pt-2 space-y-2.5">
          <button
            type="button"
            disabled={effectiveSelectedIds.length === 0}
            onClick={() => setFullPreviewOpen(true)}
            className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-teal-700/30 bg-teal-50 px-5 py-2.5 text-xs font-semibold text-teal-900 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            <Eye className="h-4 w-4" />
            <span>Visualizar Impressão (Tela Cheia)</span>
          </button>

          <button
            type="button"
            disabled={effectiveSelectedIds.length === 0}
            onClick={handleDownloadPdf}
            className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            <FileDown className="h-4 w-4" />
            <span>Baixar Relatório PDF ({filteredEntries.length} leituras)</span>
          </button>

          <button
            type="button"
            disabled={effectiveSelectedIds.length === 0}
            onClick={handlePrint}
            className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            <Printer className="h-4 w-4" />
            <span>Imprimir Direto</span>
          </button>
        </div>

        {exportFeedback && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{exportFeedback}</span>
          </div>
        )}
      </section>

      {/* Right Exact WYSIWYG Document Preview (and direct @media print target) */}
      <section className="lg:col-span-2 space-y-3 print:m-0 print:p-0">
        {/* Preview Header Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 no-print">
          <div>
            <h3 className="font-display text-sm font-bold text-slate-900">
              Pré-visualização exata da impressão (A4)
            </h3>
            <p className="text-xs text-slate-500">
              Layout fiel ao documento que será impresso ou salvo em PDF.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={effectiveSelectedIds.length === 0}
              onClick={() => setFullPreviewOpen(true)}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              <span>Tela Cheia</span>
            </button>
            <button
              type="button"
              disabled={effectiveSelectedIds.length === 0}
              onClick={handlePrint}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Imprimir</span>
            </button>
          </div>
        </div>

        {/* Simulated Paper Desk Canvas (stripped cleanly when printing) */}
        <div className="rounded-2xl border border-slate-200 bg-slate-200/70 p-3 sm:p-6 print:rounded-none print:border-0 print:bg-white print:p-0">
          <ReportDocumentSheet {...sharedSheetProps} />
        </div>
      </section>

      {/* Full-Screen Exact Print Preview Modal (no-print so window.print prints the clean inline sheet) */}
      {fullPreviewOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-slate-900/85 backdrop-blur-xs no-print"
          role="dialog"
          aria-modal="true"
          aria-label="Pré-visualização de impressão A4"
        >
          {/* Modal Sticky Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 bg-slate-900 px-4 sm:px-6 py-3 text-white">
            <div className="min-w-0">
              <h3 className="font-display text-sm sm:text-base font-bold truncate">
                Pré-visualização de Impressão (A4)
              </h3>
              <p className="text-xs text-slate-400 font-mono tabular-nums truncate">
                {formatDateBR(startDate)} a {formatDateBR(endDate)} · {filteredEntries.length}{' '}
                {filteredEntries.length === 1 ? 'medição' : 'medições'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setPreviewZoom((z) => (z === 'fit' ? 'a4' : 'fit'))
                }
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
              >
                {previewZoom === 'fit' ? (
                  <>
                    <ZoomIn className="h-4 w-4" />
                    <span>Tamanho Real A4</span>
                  </>
                ) : (
                  <>
                    <ZoomOut className="h-4 w-4" />
                    <span>Ajustar à Tela</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
              >
                <Printer className="h-4 w-4" />
                <span>Imprimir</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-500 transition-colors whitespace-nowrap shrink-0"
              >
                <FileDown className="h-4 w-4" />
                <span>Baixar PDF</span>
              </button>

              <button
                type="button"
                onClick={() => setFullPreviewOpen(false)}
                aria-label="Fechar pré-visualização"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Scrollable A4 Desk Surface */}
          <div className="flex-1 overflow-auto p-3 sm:p-8">
            <div className={previewZoom === 'a4' ? 'min-w-[794px] mx-auto' : 'w-full'}>
              <ReportDocumentSheet {...sharedSheetProps} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


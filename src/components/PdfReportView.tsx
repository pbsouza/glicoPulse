import React, { useMemo, useState } from 'react';
import { FileDown, Printer, CheckCircle2 } from 'lucide-react';
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
import { generateGlucosePdfReport } from '../utils/pdfExport';

interface PdfReportViewProps {
  entries: GlucoseEntry[];
  schedules: ScheduleSlot[];
  settings: PatientSettings;
}

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

  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  const selectPreset = (days: number) => {
    setPresetDays(days);
    setStartDate(getOffsetDate(days));
    setEndDate(todayStr);
  };

  const filteredEntries = useMemo(() => {
    return sortEntriesDesc(entries).filter(
      (e) => e.date >= startDate && e.date <= endDate
    );
  }, [entries, startDate, endDate]);

  const activeSchedules = useMemo(
    () => sortSchedulesAsc(schedules).filter((s) => s.enabled),
    [schedules]
  );

  const stats = useMemo(
    () => computeGlucoseStats(filteredEntries, schedules, settings),
    [filteredEntries, schedules, settings]
  );

  const uniqueDates = useMemo(() => {
    return Array.from(new Set(filteredEntries.map((e) => e.date))).sort((a, b) =>
      b.localeCompare(a)
    );
  }, [filteredEntries]);

  const handleDownloadPdf = () => {
    const { filename, count } = generateGlucosePdfReport(entries, schedules, settings, {
      startDate,
      endDate,
      includeChart,
      includeStats,
      includeMatrix,
      includeChronologicalList,
    });
    setExportFeedback(`PDF "${filename}" gerado com ${count} medições.`);
    setTimeout(() => setExportFeedback(null), 5000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      {/* Left Configuration Panel */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5 no-print">
        <div className="pb-3 border-b border-slate-100">
          <h2 className="font-display text-base font-bold text-slate-900">
            Configurar Relatório PDF
          </h2>
          <p className="text-xs text-slate-500">
            Gere um documento A4 completo para levar à sua consulta médica.
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

        {/* Section Checkboxes */}
        <div className="space-y-2.5 pt-1">
          <span className="block text-xs font-semibold text-slate-700">
            Seções Incluídas no PDF
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
            onClick={handleDownloadPdf}
            className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            <FileDown className="h-4 w-4" />
            <span>Baixar Relatório PDF ({filteredEntries.length} leituras)</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
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

      {/* Right Live Document Preview */}
      <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {/* Simulated Clinical Paper Header */}
        <div className="bg-teal-800 px-6 py-5 text-white">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-lg font-bold">
                Pré-visualização do Relatório Clínico
              </h3>
              <p className="mt-0.5 text-xs text-teal-100 font-mono tabular-nums">
                {formatDateBR(startDate)} a {formatDateBR(endDate)} · Unidade: {settings.unit}
              </p>
            </div>
            <span className="font-mono text-xs text-teal-100 tabular-nums">
              {filteredEntries.length} medições
            </span>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Patient Header Preview */}
          {(settings.patientName || settings.doctorName || settings.diabetesInfo) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
              <div>
                <span className="text-slate-500">Paciente: </span>
                <strong className="text-slate-900">
                  {settings.patientName || 'Não informado'}
                </strong>
              </div>
              <div>
                <span className="text-slate-500">Médico: </span>
                <strong className="text-slate-900">
                  {settings.doctorName || 'Não informado'}
                </strong>
              </div>
              <div>
                <span className="text-slate-500">Perfil: </span>
                <strong className="text-slate-900">
                  {settings.diabetesInfo || 'Padrão'}
                </strong>
              </div>
            </div>
          )}

          {/* KPI Preview */}
          {includeStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <p className="text-[11px] text-slate-500">Média</p>
                <p className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-900">
                  {stats.count > 0 ? formatGlucoseValue(stats.average, settings.unit) : '--'}{' '}
                  <span className="text-xs font-normal text-slate-500">{settings.unit}</span>
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <p className="text-[11px] text-slate-500">HbA1c Est. (GMI)</p>
                <p className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-900">
                  {stats.count > 0 ? `${stats.gmiPercent.toFixed(1)}%` : '--'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <p className="text-[11px] text-slate-500">Tempo no Alvo</p>
                <p className="mt-1 font-mono text-lg font-bold tabular-nums text-emerald-700">
                  {stats.count > 0 ? `${stats.tirPercent}%` : '--'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <p className="text-[11px] text-slate-500">Mín / Máx</p>
                <p className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-900">
                  {stats.count > 0
                    ? `${formatGlucoseValue(stats.min, settings.unit)}/${formatGlucoseValue(stats.max, settings.unit)}`
                    : '--'}
                </p>
              </div>
            </div>
          )}

          {/* Matrix Preview */}
          {filteredEntries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
              Nenhuma medição encontrada entre {formatDateBR(startDate)} e {formatDateBR(endDate)}.
            </div>
          ) : includeMatrix ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700">
                    <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Data</th>
                    {activeSchedules.map((s) => (
                      <th key={s.id} className="px-2.5 py-2.5 text-center font-semibold whitespace-nowrap">
                        <div>{s.label}</div>
                        <div className="font-mono text-[10px] font-normal text-slate-500">
                          {s.time}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {uniqueDates.slice(0, 10).map((d) => {
                    const dayEntries = filteredEntries.filter((e) => e.date === d);
                    return (
                      <tr key={d}>
                        <td className="px-3 py-2 font-mono font-semibold tabular-nums text-slate-800 whitespace-nowrap">
                          {formatDateBR(d)}
                        </td>
                        {activeSchedules.map((slot) => {
                          const match = dayEntries.find((e) => e.slotId === slot.id);
                          const st = match ? classifyReading(match.value, slot, settings) : null;
                          return (
                            <td
                              key={slot.id}
                              className={`px-2.5 py-2 text-center font-mono tabular-nums ${
                                st ? `font-bold ${st.textClass}` : 'text-slate-300'
                              }`}
                            >
                              {match ? formatGlucoseValue(match.value, settings.unit) : '—'}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {uniqueDates.length > 10 && (
                <div className="border-t border-slate-100 bg-slate-50 px-3 py-2 text-center text-[11px] text-slate-500">
                  Mostrando os 10 dias mais recentes na pré-visualização. O arquivo PDF incluirá todos os {uniqueDates.length} dias.
                </div>
              )}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
};

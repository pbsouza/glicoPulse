import React, { useMemo, useState } from 'react';
import {
  Plus,
  Clock,
  CheckCircle2,
  Circle,
  FileText,
  ArrowRight,
  SlidersHorizontal,
} from 'lucide-react';
import { GlucoseEntry, PatientSettings, ScheduleSlot } from '../types/glucose';
import {
  classifyReading,
  computeGlucoseStats,
  formatDateBR,
  formatGlucoseValue,
  getLocalDateString,
  getNextScheduledSlot,
  sortEntriesDesc,
  sortSchedulesAsc,
} from '../utils/glucoseUtils';
import { GlucoseChart } from './GlucoseChart';

interface DashboardViewProps {
  entries: GlucoseEntry[];
  schedules: ScheduleSlot[];
  settings: PatientSettings;
  onOpenNewLog: (presetSlotId?: string, presetDate?: string) => void;
  onEditEntry: (entry: GlucoseEntry) => void;
  onNavigate: (tab: 'dashboard' | 'diary' | 'schedules' | 'pdf') => void;
}

type PeriodDays = 7 | 14 | 30 | 90;

export const DashboardView: React.FC<DashboardViewProps> = ({
  entries,
  schedules,
  settings,
  onOpenNewLog,
  onEditEntry,
  onNavigate,
}) => {
  const [periodDays, setPeriodDays] = useState<PeriodDays>(14);

  const todayStr = getLocalDateString();
  const activeSchedules = useMemo(
    () => sortSchedulesAsc(schedules).filter((s) => s.enabled),
    [schedules]
  );
  const slotMap = useMemo(() => new Map(schedules.map((s) => [s.id, s])), [schedules]);

  const sortedAll = useMemo(() => sortEntriesDesc(entries), [entries]);
  const latestEntry = sortedAll[0] ?? null;
  const latestStatus = latestEntry
    ? classifyReading(latestEntry.value, slotMap.get(latestEntry.slotId), settings)
    : null;

  const periodEntries = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (periodDays - 1));
    const cutoffStr = getLocalDateString(cutoff);
    return sortedAll.filter((e) => e.date >= cutoffStr);
  }, [sortedAll, periodDays]);

  const stats = useMemo(
    () => computeGlucoseStats(periodEntries, schedules, settings),
    [periodEntries, schedules, settings]
  );

  const todayEntries = useMemo(
    () => sortedAll.filter((e) => e.date === todayStr),
    [sortedAll, todayStr]
  );

  const nextSlotInfo = useMemo(
    () => getNextScheduledSlot(schedules, todayEntries),
    [schedules, todayEntries]
  );

  const todayLoggedCount = useMemo(() => {
    const loggedSlots = new Set(todayEntries.map((e) => e.slotId));
    return activeSchedules.filter((s) => loggedSlots.has(s.id)).length;
  }, [activeSchedules, todayEntries]);

  return (
    <div className="space-y-6">
      {/* KPI Summary Strip */}
      <section aria-label="Resumo glicêmico" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Latest Reading */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">Última Leitura</span>
            {latestStatus && (
              <span className={`text-xs font-semibold ${latestStatus.textClass}`}>
                {latestStatus.label}
              </span>
            )}
          </div>
          {latestEntry ? (
            <>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="font-mono text-3xl font-bold tracking-tight tabular-nums text-slate-900">
                  {formatGlucoseValue(latestEntry.value, settings.unit)}
                </span>
                <span className="font-mono text-xs text-slate-500">{settings.unit}</span>
              </div>
              <p className="mt-2 text-xs text-slate-500 truncate">
                {slotMap.get(latestEntry.slotId)?.label ?? 'Avulso'} · {formatDateBR(latestEntry.date)} às {latestEntry.time}
              </p>
            </>
          ) : (
            <div className="mt-3">
              <p className="font-mono text-2xl font-bold text-slate-300">--</p>
              <p className="mt-2 text-xs text-slate-500">Nenhuma leitura registrada</p>
            </div>
          )}
        </div>

        {/* Card 2: Mean & GMI */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">
              Média ({periodDays} dias)
            </span>
            <span className="font-mono text-xs tabular-nums text-slate-500">
              {stats.count} leituras
            </span>
          </div>
          {stats.count > 0 ? (
            <>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="font-mono text-3xl font-bold tracking-tight tabular-nums text-slate-900">
                  {formatGlucoseValue(stats.average, settings.unit)}
                </span>
                <span className="font-mono text-xs text-slate-500">{settings.unit}</span>
              </div>
              <p className="mt-2 text-xs text-slate-600 font-mono tabular-nums">
                HbA1c est. (GMI): <strong className="text-slate-900">{stats.gmiPercent.toFixed(1)}%</strong> · CV {stats.cvPercent.toFixed(0)}%
              </p>
            </>
          ) : (
            <div className="mt-3">
              <p className="font-mono text-2xl font-bold text-slate-300">--</p>
              <p className="mt-2 text-xs text-slate-500">Aguardando medições no período</p>
            </div>
          )}
        </div>

        {/* Card 3: Time in Range */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">Tempo no Alvo (TIR)</span>
            {stats.count > 0 && (
              <span className="font-mono text-xs tabular-nums text-emerald-700 font-semibold">
                {stats.inRangeCount}/{stats.count}
              </span>
            )}
          </div>
          {stats.count > 0 ? (
            <>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="font-mono text-3xl font-bold tracking-tight tabular-nums text-slate-900">
                  {stats.tirPercent}%
                </span>
                <span className="text-xs text-slate-500">dentro da meta</span>
              </div>
              {/* Stacked Range Bar */}
              <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
                {stats.belowPercent > 0 && (
                  <div
                    style={{ width: `${stats.belowPercent}%` }}
                    className="bg-rose-600"
                    title={`Abaixo: ${stats.belowPercent}%`}
                  />
                )}
                {stats.tirPercent > 0 && (
                  <div
                    style={{ width: `${stats.tirPercent}%` }}
                    className="bg-emerald-600"
                    title={`Na meta: ${stats.tirPercent}%`}
                  />
                )}
                {stats.abovePercent > 0 && (
                  <div
                    style={{ width: `${stats.abovePercent}%` }}
                    className="bg-amber-500"
                    title={`Acima: ${stats.abovePercent}%`}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="mt-3">
              <p className="font-mono text-2xl font-bold text-slate-300">--%</p>
              <p className="mt-2 text-xs text-slate-500">Sem dados para cálculo</p>
            </div>
          )}
        </div>

        {/* Card 4: Next Scheduled Measurement */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500">Próximo Horário</span>
              <span className="font-mono text-xs tabular-nums text-slate-500">
                Hoje: {todayLoggedCount}/{activeSchedules.length}
              </span>
            </div>
            {nextSlotInfo ? (
              <div className="mt-2">
                <p className="font-display text-lg font-bold text-slate-900 truncate">
                  {nextSlotInfo.slot.label}
                </p>
                <p className="font-mono text-sm tabular-nums text-teal-700 font-semibold">
                  {nextSlotInfo.isTomorrow ? 'Amanhã às ' : 'Hoje às '}
                  {nextSlotInfo.slot.time}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500">Nenhum horário ativo</p>
            )}
          </div>
          {nextSlotInfo && (
            <button
              type="button"
              onClick={() => onOpenNewLog(nextSlotInfo.slot.id, todayStr)}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800 transition-colors"
            >
              <span>Registrar este horário</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </section>

      {/* Main Content Split: Chart (left 2 cols) + Today Schedule Checklist (right 1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Trend Chart Container */}
        <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                Curva de Tendência Glicêmica
              </h2>
              <p className="text-xs text-slate-500">
                Mínima {stats.count > 0 ? formatGlucoseValue(stats.min, settings.unit) : '--'} · Máxima{' '}
                {stats.count > 0 ? formatGlucoseValue(stats.max, settings.unit) : '--'} {settings.unit}
              </p>
            </div>

            {/* Period Filter Segmented Control */}
            <div
              role="group"
              aria-label="Selecionar período do gráfico"
              className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1 self-start sm:self-auto"
            >
              {([7, 14, 30, 90] as PeriodDays[]).map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setPeriodDays(days)}
                  className={`min-h-[36px] rounded-lg px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    periodDays === days
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {days}d
                </button>
              ))}
            </div>
          </div>

          <GlucoseChart entries={periodEntries} schedules={schedules} settings={settings} />

          {/* Quick Footer Actions inside Chart Section */}
          <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 font-mono tabular-nums">
              <span>
                Na meta: <strong className="text-emerald-700">{stats.tirPercent}%</strong>
              </span>
              <span>
                Baixas: <strong className="text-rose-700">{stats.belowCount}</strong>
              </span>
              <span>
                Elevadas: <strong className="text-amber-700">{stats.aboveCount}</strong>
              </span>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('pdf')}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
            >
              <FileText className="h-4 w-4 text-teal-700" />
              <span>Exportar Relatório PDF</span>
            </button>
          </div>
        </section>

        {/* Today's Configurable Schedule Checklist */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2 pb-4 mb-2 border-b border-slate-100">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                Horários de Hoje
              </h2>
              <p className="text-xs text-slate-500">{formatDateBR(todayStr)}</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('schedules')}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Configurar</span>
            </button>
          </div>

          {activeSchedules.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-slate-600">Nenhum horário ativo.</p>
              <button
                type="button"
                onClick={() => onNavigate('schedules')}
                className="mt-3 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
              >
                Configurar Horários
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {activeSchedules.map((slot) => {
                const slotEntries = todayEntries.filter((e) => e.slotId === slot.id);
                const latestForSlot = slotEntries[0];
                const status = latestForSlot
                  ? classifyReading(latestForSlot.value, slot, settings)
                  : null;

                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() =>
                      latestForSlot
                        ? onEditEntry(latestForSlot)
                        : onOpenNewLog(slot.id, todayStr)
                    }
                    className="flex w-full min-h-[58px] items-center justify-between gap-3 py-3 px-2 -mx-2 rounded-xl text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {latestForSlot ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-teal-700" />
                      ) : (
                        <Circle className="h-5 w-5 shrink-0 text-slate-300" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {slot.label}
                        </p>
                        <p className="flex items-center gap-1 font-mono text-xs tabular-nums text-slate-500">
                          <Clock className="h-3 w-3" />
                          <span>{slot.time}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            Meta {formatGlucoseValue(slot.targetMin, settings.unit)}–
                            {formatGlucoseValue(slot.targetMax, settings.unit)}
                          </span>
                        </p>
                      </div>
                    </div>

                    {latestForSlot && status ? (
                      <div className="text-right shrink-0">
                        <p className="font-mono text-sm font-bold tabular-nums text-slate-900">
                          {formatGlucoseValue(latestForSlot.value, settings.unit)}{' '}
                          <span className="text-[11px] font-normal text-slate-500">
                            {settings.unit}
                          </span>
                        </p>
                        <p className={`text-[11px] font-semibold ${status.textClass}`}>
                          {status.shortLabel}
                        </p>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 shrink-0">
                        <Plus className="h-3.5 w-3.5" />
                        Registrar
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import { Pencil, Trash2, Search, Plus, Check, X } from 'lucide-react';
import {
  GlucoseClassification,
  GlucoseEntry,
  PatientSettings,
  ScheduleSlot,
} from '../types/glucose';
import {
  classifyReading,
  formatDateBR,
  formatGlucoseValue,
  sortEntriesDesc,
  sortSchedulesAsc,
} from '../utils/glucoseUtils';

interface DiaryViewProps {
  entries: GlucoseEntry[];
  schedules: ScheduleSlot[];
  settings: PatientSettings;
  onOpenNewLog: (presetSlotId?: string, presetDate?: string) => void;
  onEditEntry: (entry: GlucoseEntry) => void;
  onDeleteEntry: (id: string) => void;
}

type ViewMode = 'matrix' | 'list';
type StatusFilter = 'all' | 'in_range' | 'low' | 'above';

export const DiaryView: React.FC<DiaryViewProps> = ({
  entries,
  schedules,
  settings,
  onOpenNewLog,
  onEditEntry,
  onDeleteEntry,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('matrix');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const activeSchedules = useMemo(
    () => sortSchedulesAsc(schedules).filter((s) => s.enabled),
    [schedules]
  );
  const slotMap = useMemo(() => new Map(schedules.map((s) => [s.id, s])), [schedules]);

  const sortedEntries = useMemo(() => sortEntriesDesc(entries), [entries]);

  const filteredEntries = useMemo(() => {
    return sortedEntries.filter((entry) => {
      const slot = slotMap.get(entry.slotId);
      const info = classifyReading(entry.value, slot, settings);

      if (statusFilter === 'in_range' && info.status !== 'in_range') return false;
      if (statusFilter === 'low' && info.status !== 'low') return false;
      if (
        statusFilter === 'above' &&
        info.status !== 'elevated' &&
        info.status !== 'high'
      ) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const dateStr = formatDateBR(entry.date).toLowerCase();
        const slotLabel = (slot?.label ?? 'avulso').toLowerCase();
        const noteStr = entry.notes.toLowerCase();
        const valStr = formatGlucoseValue(entry.value, settings.unit);
        return (
          dateStr.includes(q) ||
          slotLabel.includes(q) ||
          noteStr.includes(q) ||
          valStr.includes(q)
        );
      }

      return true;
    });
  }, [sortedEntries, slotMap, settings, statusFilter, searchQuery]);

  const uniqueDates = useMemo(() => {
    return Array.from(new Set(filteredEntries.map((e) => e.date))).sort((a, b) =>
      b.localeCompare(a)
    );
  }, [filteredEntries]);

  const matchesStatus = (status: GlucoseClassification, filter: StatusFilter) => {
    if (filter === 'all') return true;
    if (filter === 'in_range') return status === 'in_range';
    if (filter === 'low') return status === 'low';
    return status === 'elevated' || status === 'high';
  };
  void matchesStatus;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          {/* Mode Switch */}
          <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              className={`min-h-[38px] rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'matrix'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Grade por Horários
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`min-h-[38px] rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Lista Cronológica
            </button>
          </div>

          {/* Status Filter */}
          <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1">
            {(
              [
                { id: 'all', label: 'Todas' },
                { id: 'in_range', label: 'Na meta' },
                { id: 'low', label: 'Baixas' },
                { id: 'above', label: 'Elevadas' },
              ] as { id: StatusFilter; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStatusFilter(opt.id)}
                className={`min-h-[38px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === opt.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search & Add */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar data, horário ou nota..."
              className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:bg-white focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => onOpenNewLog()}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Nova Leitura</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {filteredEntries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-display text-base font-bold text-slate-800">
            Nenhuma medição encontrada
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {entries.length === 0
              ? 'Comece registrando sua primeira leitura de glicemia para construir seu diário.'
              : 'Tente limpar os filtros ou buscar por outro termo.'}
          </p>
          <button
            type="button"
            onClick={() => onOpenNewLog()}
            className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Registrar Primeira Medição</span>
          </button>
        </div>
      ) : viewMode === 'matrix' ? (
        /* Matrix View: Days x Configured Schedule Slots */
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap border-r border-slate-200">
                    Data
                  </th>
                  {activeSchedules.map((slot) => (
                    <th
                      key={slot.id}
                      className="px-3 py-3 text-center text-xs font-semibold text-slate-700 whitespace-nowrap min-w-[96px]"
                    >
                      <div>{slot.label}</div>
                      <div className="font-mono text-[11px] font-normal tabular-nums text-slate-500">
                        {slot.time}
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 whitespace-nowrap border-l border-slate-200">
                    Média do Dia
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {uniqueDates.map((dateStr) => {
                  const dayEntries = filteredEntries.filter((e) => e.date === dateStr);
                  const dayAvg =
                    dayEntries.length > 0
                      ? dayEntries.reduce((acc, e) => acc + e.value, 0) / dayEntries.length
                      : 0;

                  return (
                    <tr key={dateStr} className="hover:bg-slate-50/70 transition-colors">
                      <td className="sticky left-0 z-10 bg-white px-4 py-3 font-mono text-xs font-semibold tabular-nums text-slate-900 whitespace-nowrap border-r border-slate-100">
                        {formatDateBR(dateStr)}
                      </td>
                      {activeSchedules.map((slot) => {
                        const slotMatches = dayEntries.filter((e) => e.slotId === slot.id);
                        const primary = slotMatches[0];
                        const status = primary
                          ? classifyReading(primary.value, slot, settings)
                          : null;

                        return (
                          <td key={slot.id} className="px-2 py-2 text-center">
                            {primary && status ? (
                              <button
                                type="button"
                                onClick={() => onEditEntry(primary)}
                                title={`${slot.label} · ${primary.time} · ${status.label}${primary.notes ? ` · ${primary.notes}` : ''}`}
                                className={`inline-flex min-h-[38px] min-w-[68px] flex-col items-center justify-center rounded-lg border px-2.5 py-1 transition-colors hover:opacity-85 ${status.surfaceClass} ${status.borderClass}`}
                              >
                                <span
                                  className={`font-mono text-sm font-bold tabular-nums ${status.textClass}`}
                                >
                                  {formatGlucoseValue(primary.value, settings.unit)}
                                </span>
                                {slotMatches.length > 1 && (
                                  <span className="text-[10px] font-medium text-slate-500">
                                    +{slotMatches.length - 1}
                                  </span>
                                )}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onOpenNewLog(slot.id, dateStr)}
                                aria-label={`Registrar ${slot.label} em ${formatDateBR(dateStr)}`}
                                className="inline-flex min-h-[38px] min-w-[44px] items-center justify-center rounded-lg text-slate-300 hover:bg-slate-100 hover:text-teal-700 transition-colors"
                              >
                                —
                              </button>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-right font-mono text-xs font-bold tabular-nums text-slate-900 whitespace-nowrap border-l border-slate-100">
                        {dayEntries.length > 0
                          ? `${formatGlucoseValue(dayAvg, settings.unit)} ${settings.unit}`
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Chronological Detailed List */
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="divide-y divide-slate-100">
            {filteredEntries.map((entry) => {
              const slot = slotMap.get(entry.slotId);
              const status = classifyReading(entry.value, slot, settings);
              const isDeleting = confirmDeleteId === entry.id;

              return (
                <div
                  key={entry.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-4 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-4 min-w-0">
                    <div
                      className={`flex min-w-[82px] flex-col items-center justify-center rounded-xl border px-3 py-2 shrink-0 ${status.surfaceClass} ${status.borderClass}`}
                    >
                      <span className={`font-mono text-lg font-bold tabular-nums ${status.textClass}`}>
                        {formatGlucoseValue(entry.value, settings.unit)}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {settings.unit}
                      </span>
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-display font-bold text-slate-900">
                          {slot?.label ?? 'Avulso'}
                        </span>
                        <span className="text-slate-300" aria-hidden="true">·</span>
                        <span className={`text-xs font-semibold ${status.textClass}`}>
                          {status.label}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
                        <span>{formatDateBR(entry.date)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{entry.time}</span>
                        {entry.insulinUnits !== undefined && entry.insulinUnits > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-slate-700">{entry.insulinUnits}U insulina</span>
                          </>
                        )}
                        {entry.carbsGrams !== undefined && entry.carbsGrams > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-slate-700">{entry.carbsGrams}g carb.</span>
                          </>
                        )}
                      </div>

                      {entry.notes && (
                        <p className="text-xs text-slate-600 leading-relaxed">{entry.notes}</p>
                      )}
                    </div>
                  </div>

                  {/* Row Actions */}
                  <div className="flex items-center justify-end gap-2 shrink-0">
                    {isDeleting ? (
                      <div className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1">
                        <span className="text-xs font-semibold text-rose-800 mr-1">Excluir?</span>
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteEntry(entry.id);
                            setConfirmDeleteId(null);
                          }}
                          aria-label="Confirmar exclusão"
                          className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-700 text-white hover:bg-rose-800"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          aria-label="Cancelar exclusão"
                          className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onEditEntry(entry)}
                          aria-label="Editar medição"
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(entry.id)}
                          aria-label="Excluir medição"
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

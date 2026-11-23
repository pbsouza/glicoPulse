import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { GlucoseEntry, PatientSettings, ScheduleSlot } from '../types/glucose';
import {
  classifyReading,
  findClosestSlot,
  formatGlucoseValue,
  getLocalDateString,
  getLocalTimeString,
  parseInputToMgDl,
  sortSchedulesAsc,
} from '../utils/glucoseUtils';

interface LogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: Omit<GlucoseEntry, 'id' | 'createdAt'>, existingId?: string) => void;
  schedules: ScheduleSlot[];
  settings: PatientSettings;
  editingEntry?: GlucoseEntry | null;
  presetSlotId?: string | null;
  presetDate?: string | null;
}

export const LogModal: React.FC<LogModalProps> = ({
  isOpen,
  onClose,
  onSave,
  schedules,
  settings,
  editingEntry,
  presetSlotId,
  presetDate,
}) => {
  const activeSchedules = sortSchedulesAsc(schedules).filter((s) => s.enabled);

  const [valueInput, setValueInput] = useState('');
  const [date, setDate] = useState(getLocalDateString());
  const [time, setTime] = useState(getLocalTimeString());
  const [slotId, setSlotId] = useState(activeSchedules[0]?.id ?? 'other');
  const [insulinInput, setInsulinInput] = useState('');
  const [carbsInput, setCarbsInput] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    if (editingEntry) {
      setValueInput(formatGlucoseValue(editingEntry.value, settings.unit));
      setDate(editingEntry.date);
      setTime(editingEntry.time);
      setSlotId(editingEntry.slotId);
      setInsulinInput(editingEntry.insulinUnits !== undefined ? String(editingEntry.insulinUnits) : '');
      setCarbsInput(editingEntry.carbsGrams !== undefined ? String(editingEntry.carbsGrams) : '');
      setNotes(editingEntry.notes);
      setError('');
    } else {
      const nowTime = getLocalTimeString();
      const targetSlot = presetSlotId
        ? schedules.find((s) => s.id === presetSlotId)
        : undefined;
      setValueInput('');
      setDate(presetDate || getLocalDateString());
      setTime(targetSlot ? targetSlot.time : nowTime);
      setSlotId(presetSlotId || findClosestSlot(nowTime, schedules));
      setInsulinInput('');
      setCarbsInput('');
      setNotes('');
      setError('');
    }
  }, [isOpen, editingEntry, presetSlotId, presetDate, schedules, settings.unit]);

  if (!isOpen) return null;

  const parsedRaw = parseFloat(valueInput.replace(',', '.'));
  const hasNumericPreview = !Number.isNaN(parsedRaw) && parsedRaw > 0;
  const previewMgDl = hasNumericPreview ? parseInputToMgDl(parsedRaw, settings.unit) : 0;
  const selectedSlot = schedules.find((s) => s.id === slotId);
  const previewStatus = hasNumericPreview
    ? classifyReading(previewMgDl, selectedSlot, settings)
    : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasNumericPreview) {
      setError('Informe um valor glicêmico válido.');
      return;
    }
    if (previewMgDl < 20 || previewMgDl > 700) {
      setError(
        settings.unit === 'mg/dL'
          ? 'Informe um valor entre 20 e 700 mg/dL.'
          : 'Informe um valor entre 1.1 e 38.8 mmol/L.'
      );
      return;
    }

    const insulinVal = insulinInput.trim() ? parseFloat(insulinInput.replace(',', '.')) : undefined;
    const carbsVal = carbsInput.trim() ? parseInt(carbsInput, 10) : undefined;

    onSave(
      {
        value: previewMgDl,
        date,
        time,
        slotId,
        notes: notes.trim(),
        insulinUnits: insulinVal && !Number.isNaN(insulinVal) ? insulinVal : undefined,
        carbsGrams: carbsVal && !Number.isNaN(carbsVal) ? carbsVal : undefined,
      },
      editingEntry?.id
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 sm:p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="log-modal-title"
    >
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Mobile Sheet Drag Handle */}
        <div className="sm:hidden pt-3 pb-1">
          <div className="mx-auto h-1.5 w-10 rounded-full bg-slate-300" />
        </div>

        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 id="log-modal-title" className="font-display text-lg font-bold text-slate-900">
              {editingEntry ? 'Editar Medição' : 'Registrar Glicemia'}
            </h2>
            <p className="text-xs text-slate-500">
              Salvo localmente neste dispositivo
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Glucose Value Input */}
          <div>
            <label htmlFor="glucose-value" className="block text-xs font-semibold text-slate-700 mb-2">
              Valor da Glicemia ({settings.unit})
            </label>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <input
                  id="glucose-value"
                  type="number"
                  inputMode="decimal"
                  step={settings.unit === 'mmol/L' ? '0.1' : '1'}
                  min={settings.unit === 'mmol/L' ? '1.1' : '20'}
                  max={settings.unit === 'mmol/L' ? '38.8' : '700'}
                  placeholder={settings.unit === 'mg/dL' ? 'Ex: 112' : 'Ex: 6.2'}
                  value={valueInput}
                  onChange={(e) => {
                    setValueInput(e.target.value);
                    setError('');
                  }}
                  autoFocus
                  className="w-full rounded-xl border border-slate-300 bg-slate-50/60 px-4 py-3.5 pr-16 font-mono text-2xl font-bold tabular-nums text-slate-900 focus:border-teal-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-700/15"
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-mono text-xs font-medium text-slate-500">
                  {settings.unit}
                </span>
              </div>

              {previewStatus && (
                <div
                  className={`rounded-xl border px-3.5 py-3 text-right shrink-0 ${previewStatus.surfaceClass} ${previewStatus.borderClass}`}
                >
                  <p className={`text-xs font-bold ${previewStatus.textClass}`}>
                    {previewStatus.label}
                  </p>
                  {selectedSlot && (
                    <p className="mt-0.5 font-mono text-[11px] tabular-nums text-slate-600">
                      Meta {formatGlucoseValue(selectedSlot.targetMin, settings.unit)}–
                      {formatGlucoseValue(selectedSlot.targetMax, settings.unit)}
                    </p>
                  )}
                </div>
              )}
            </div>
            {error && <p className="mt-1.5 text-xs font-medium text-rose-700">{error}</p>}
          </div>

          {/* Schedule Slot Selector */}
          <div>
            <span className="block text-xs font-semibold text-slate-700 mb-2">
              Horário Configurado
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {activeSchedules.map((slot) => {
                const isSelected = slotId === slot.id;
                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => setSlotId(slot.id)}
                    className={`flex min-h-[44px] flex-col items-start justify-center rounded-xl border px-3 py-2 text-left transition-colors ${
                      isSelected
                        ? 'border-teal-700 bg-teal-50 text-teal-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xs font-semibold truncate w-full">{slot.label}</span>
                    <span className="font-mono text-[11px] tabular-nums text-slate-500">
                      {slot.time}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setSlotId('other')}
                className={`flex min-h-[44px] flex-col items-start justify-center rounded-xl border px-3 py-2 text-left transition-colors ${
                  slotId === 'other'
                    ? 'border-teal-700 bg-teal-50 text-teal-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className="text-xs font-semibold">Avulso</span>
                <span className="text-[11px] text-slate-500">Fora da grade</span>
              </button>
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="log-date" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Data
              </label>
              <input
                id="log-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm tabular-nums text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
              />
            </div>
            <div>
              <label htmlFor="log-time" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Hora
              </label>
              <input
                id="log-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm tabular-nums text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
              />
            </div>
          </div>

          {/* Optional Insulin & Carbs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="log-insulin" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Insulina (U) <span className="font-normal text-slate-400">opcional</span>
              </label>
              <input
                id="log-insulin"
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0"
                placeholder="Ex: 6"
                value={insulinInput}
                onChange={(e) => setInsulinInput(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm tabular-nums text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
              />
            </div>
            <div>
              <label htmlFor="log-carbs" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Carboidratos (g) <span className="font-normal text-slate-400">opcional</span>
              </label>
              <input
                id="log-carbs"
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="Ex: 45"
                value={carbsInput}
                onChange={(e) => setCarbsInput(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm tabular-nums text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="log-notes" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Observações <span className="font-normal text-slate-400">opcional</span>
            </label>
            <textarea
              id="log-notes"
              rows={2}
              placeholder="Refeição, exercício, sintomas ou medicação..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="min-h-[44px] rounded-xl bg-teal-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              {editingEntry ? 'Salvar Alterações' : 'Salvar Medição'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

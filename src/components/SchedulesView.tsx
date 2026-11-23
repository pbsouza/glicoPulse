import React, { useEffect, useRef, useState } from 'react';
import {
  Plus,
  Trash2,
  RotateCcw,
  Download,
  Upload,
  Check,
  X,
  Pencil,
  Save,
} from 'lucide-react';
import {
  GlucoseEntry,
  GlucoseUnit,
  PatientSettings,
  ScheduleSlot,
  SlotCategory,
} from '../types/glucose';
import {
  SLOT_CATEGORY_LABELS,
  formatGlucoseValue,
  parseInputToMgDl,
  sortSchedulesAsc,
} from '../utils/glucoseUtils';
import { PWAInstallButton } from './PWAInstallButton';

interface SchedulesViewProps {
  schedules: ScheduleSlot[];
  onSaveSlot: (slot: ScheduleSlot, isExisting: boolean) => Promise<void>;
  onToggleSlot: (slot: ScheduleSlot) => Promise<void>;
  onDeleteSlot: (slotId: string) => Promise<void>;
  onResetSchedules: () => Promise<void>;
  settings: PatientSettings;
  onUpdateSettings: (next: PatientSettings) => Promise<void>;
  entries: GlucoseEntry[];
  onImportBackup: (data: {
    entries: GlucoseEntry[];
    schedules?: ScheduleSlot[];
    settings?: PatientSettings;
  }) => Promise<void>;
  onClearAllEntries: () => Promise<void>;
}

export const SchedulesView: React.FC<SchedulesViewProps> = ({
  schedules,
  onSaveSlot,
  onToggleSlot,
  onDeleteSlot,
  onResetSchedules,
  settings,
  onUpdateSettings,
  entries,
  onImportBackup,
  onClearAllEntries,
}) => {
  const orderedSchedules = sortSchedulesAsc(schedules);

  // Add / Edit Schedule Form State
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [slotLabel, setSlotLabel] = useState('');
  const [slotTime, setSlotTime] = useState('08:00');
  const [slotCategory, setSlotCategory] = useState<SlotCategory>('pre_meal');
  const [slotMin, setSlotMin] = useState('70');
  const [slotMax, setSlotMax] = useState('130');
  const [slotFormOpen, setSlotFormOpen] = useState(false);

  // Draft Settings State (saves explicitly to avoid excessive Firestore writes per keystroke)
  const [draftSettings, setDraftSettings] = useState<PatientSettings>(settings);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    setDraftSettings(settings);
  }, [settings]);

  const [confirmClearData, setConfirmClearData] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const openNewSlotForm = () => {
    setEditingSlotId(null);
    setSlotLabel('');
    setSlotTime('16:00');
    setSlotCategory('other');
    setSlotMin(formatGlucoseValue(70, settings.unit));
    setSlotMax(formatGlucoseValue(160, settings.unit));
    setSlotFormOpen(true);
  };

  const openEditSlotForm = (slot: ScheduleSlot) => {
    setEditingSlotId(slot.id);
    setSlotLabel(slot.label);
    setSlotTime(slot.time);
    setSlotCategory(slot.category);
    setSlotMin(formatGlucoseValue(slot.targetMin, settings.unit));
    setSlotMax(formatGlucoseValue(slot.targetMax, settings.unit));
    setSlotFormOpen(true);
  };

  const handleSaveSlotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanLabel = slotLabel.trim();
    if (!cleanLabel) return;

    const minVal = parseInputToMgDl(parseFloat(slotMin) || 70, settings.unit);
    const maxVal = parseInputToMgDl(parseFloat(slotMax) || 180, settings.unit);
    const existing = editingSlotId ? schedules.find((s) => s.id === editingSlotId) : undefined;

    setBusyAction(true);
    try {
      const slotPayload: ScheduleSlot = {
        id: existing ? existing.id : `slot-${Date.now()}`,
        label: cleanLabel,
        time: slotTime,
        category: slotCategory,
        enabled: existing ? existing.enabled : true,
        targetMin: Math.min(minVal, maxVal),
        targetMax: Math.max(minVal, maxVal),
      };
      await onSaveSlot(slotPayload, Boolean(existing));
      showFeedback(
        existing
          ? `Horário "${cleanLabel}" atualizado.`
          : `Horário "${cleanLabel}" adicionado.`
      );
      setSlotFormOpen(false);
      setEditingSlotId(null);
    } finally {
      setBusyAction(false);
    }
  };

  const handleResetDefaults = async () => {
    setBusyAction(true);
    try {
      await onResetSchedules();
      showFeedback('Horários padrão clínicos restaurados.');
    } finally {
      setBusyAction(false);
    }
  };

  const handleSaveSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await onUpdateSettings(draftSettings);
      showFeedback('Perfil clínico e metas salvos na nuvem.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleExportJson = () => {
    const payload = {
      app: 'GlicoPulse',
      exportedAt: new Date().toISOString(),
      settings,
      schedules,
      entries,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `glicopulse-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showFeedback('Backup JSON exportado com sucesso.');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed.entries)) {
          showFeedback('Arquivo inválido: lista de medições não encontrada.');
          return;
        }
        setBusyAction(true);
        await onImportBackup({
          entries: parsed.entries,
          schedules: Array.isArray(parsed.schedules) ? parsed.schedules : undefined,
          settings:
            parsed.settings && typeof parsed.settings === 'object'
              ? parsed.settings
              : undefined,
        });
        showFeedback(`Backup importado (${parsed.entries.length} medições).`);
      } catch {
        showFeedback('Erro ao ler arquivo JSON de backup.');
      } finally {
        setBusyAction(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {feedbackMsg && (
        <div
          role="status"
          className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-xs font-semibold text-teal-900"
        >
          {feedbackMsg}
        </div>
      )}

      {/* PWA Installation Section */}
      <PWAInstallButton variant="card" />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* Left Column (3 cols): Configurable Measurement Schedules */}
        <section className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                Horários Configuráveis de Medição
              </h2>
              <p className="text-xs text-slate-500">
                Personalize os horários do seu dia, metas individuais e colunas do relatório PDF.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busyAction}
                onClick={handleResetDefaults}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Padrão</span>
              </button>
              <button
                type="button"
                disabled={busyAction}
                onClick={openNewSlotForm}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Novo Horário</span>
              </button>
            </div>
          </div>

          {/* Inline Add/Edit Form */}
          {slotFormOpen && (
            <form
              onSubmit={handleSaveSlotSubmit}
              className="mt-4 rounded-xl border border-teal-200 bg-teal-50/40 p-4 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-bold text-slate-900">
                  {editingSlotId ? 'Editar Horário' : 'Adicionar Novo Horário'}
                </h3>
                <button
                  type="button"
                  onClick={() => setSlotFormOpen(false)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome do Horário
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={60}
                    placeholder="Ex: Lanche da tarde, Pré-treino, Madrugada"
                    value={slotLabel}
                    onChange={(e) => setSlotLabel(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Hora Alvo
                  </label>
                  <input
                    type="time"
                    required
                    value={slotTime}
                    onChange={(e) => setSlotTime(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm tabular-nums text-slate-900 focus:border-teal-700 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Categoria
                  </label>
                  <select
                    value={slotCategory}
                    onChange={(e) => setSlotCategory(e.target.value as SlotCategory)}
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                  >
                    {Object.entries(SLOT_CATEGORY_LABELS).map(([k, lbl]) => (
                      <option key={k} value={k}>
                        {lbl}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Meta Mínima ({settings.unit})
                  </label>
                  <input
                    type="number"
                    step={settings.unit === 'mmol/L' ? '0.1' : '1'}
                    value={slotMin}
                    onChange={(e) => setSlotMin(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm tabular-nums text-slate-900 focus:border-teal-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Meta Máxima ({settings.unit})
                  </label>
                  <input
                    type="number"
                    step={settings.unit === 'mmol/L' ? '0.1' : '1'}
                    value={slotMax}
                    onChange={(e) => setSlotMax(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm tabular-nums text-slate-900 focus:border-teal-700 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="submit"
                  disabled={busyAction}
                  className="min-h-[42px] rounded-xl bg-teal-700 px-5 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 transition-colors"
                >
                  {editingSlotId ? 'Salvar Horário' : 'Adicionar Horário'}
                </button>
              </div>
            </form>
          )}

          {/* Schedule List */}
          <div className="mt-2 divide-y divide-slate-100">
            {orderedSchedules.map((slot) => (
              <div
                key={slot.id}
                className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 py-3.5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={slot.enabled}
                    onChange={() => void onToggleSlot(slot)}
                    aria-label={`Ativar horário ${slot.label}`}
                    className="h-5 w-5 rounded border-slate-300 text-teal-700 focus:ring-teal-700 cursor-pointer"
                  />
                  <div className={slot.enabled ? 'min-w-0' : 'min-w-0 opacity-50'}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold tabular-nums text-teal-800">
                        {slot.time}
                      </span>
                      <span className="text-sm font-semibold text-slate-900 truncate">
                        {slot.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {SLOT_CATEGORY_LABELS[slot.category]} · Meta{' '}
                      <span className="font-mono tabular-nums">
                        {formatGlucoseValue(slot.targetMin, settings.unit)}–
                        {formatGlucoseValue(slot.targetMax, settings.unit)} {settings.unit}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditSlotForm(slot)}
                    aria-label={`Editar ${slot.label}`}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await onDeleteSlot(slot.id);
                      showFeedback('Horário removido da grade.');
                    }}
                    aria-label={`Remover ${slot.label}`}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Right Column (2 cols): Patient Profile, Thresholds & Data Backup */}
        <div className="lg:col-span-2 space-y-6">
          {/* Clinical Profile & Units */}
          <form
            onSubmit={handleSaveSettingsSubmit}
            className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4"
          >
            <div className="pb-3 border-b border-slate-100">
              <h2 className="font-display text-base font-bold text-slate-900">
                Perfil Clínico e Metas
              </h2>
              <p className="text-xs text-slate-500">
                Exibido no cabeçalho dos seus relatórios em PDF.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nome do Paciente
              </label>
              <input
                type="text"
                maxLength={120}
                placeholder="Ex: Maria Silva"
                value={draftSettings.patientName}
                onChange={(e) =>
                  setDraftSettings({ ...draftSettings, patientName: e.target.value })
                }
                className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Médico / Endocrinologista
              </label>
              <input
                type="text"
                maxLength={120}
                placeholder="Ex: Dr. Carlos Almeida"
                value={draftSettings.doctorName}
                onChange={(e) =>
                  setDraftSettings({ ...draftSettings, doctorName: e.target.value })
                }
                className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Tipo / Medicação / Observação Fixa
              </label>
              <input
                type="text"
                maxLength={200}
                placeholder="Ex: DM2 · Metformina 850mg"
                value={draftSettings.diabetesInfo}
                onChange={(e) =>
                  setDraftSettings({ ...draftSettings, diabetesInfo: e.target.value })
                }
                className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Unidade de Medida
                </label>
                <div className="inline-flex w-full rounded-xl bg-slate-100 p-1">
                  {(['mg/dL', 'mmol/L'] as GlucoseUnit[]).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setDraftSettings({ ...draftSettings, unit: u })}
                      className={`flex-1 min-h-[36px] rounded-lg text-xs font-semibold transition-colors ${
                        draftSettings.unit === u
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Alerta Hipoglicemia
                </label>
                <input
                  type="number"
                  min={40}
                  max={100}
                  value={draftSettings.hypoThreshold}
                  onChange={(e) =>
                    setDraftSettings({
                      ...draftSettings,
                      hypoThreshold: Math.max(40, Math.min(100, Number(e.target.value) || 70)),
                    })
                  }
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm tabular-nums text-slate-900 focus:border-teal-700 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Alerta Hiperglicemia (mg/dL)
                </label>
                <input
                  type="number"
                  min={120}
                  max={300}
                  value={draftSettings.hyperThreshold}
                  onChange={(e) =>
                    setDraftSettings({
                      ...draftSettings,
                      hyperThreshold: Math.max(
                        120,
                        Math.min(300, Number(e.target.value) || 180)
                      ),
                    })
                  }
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm tabular-nums text-slate-900 focus:border-teal-700 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Hiperglicemia Severa (mg/dL)
                </label>
                <input
                  type="number"
                  min={180}
                  max={450}
                  value={draftSettings.severeHyperThreshold}
                  onChange={(e) =>
                    setDraftSettings({
                      ...draftSettings,
                      severeHyperThreshold: Math.max(
                        180,
                        Math.min(450, Number(e.target.value) || 250)
                      ),
                    })
                  }
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm tabular-nums text-slate-900 focus:border-teal-700 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 transition-colors"
            >
              <Save className="h-4 w-4" />
              <span>{savingSettings ? 'Salvando...' : 'Salvar Perfil e Metas'}</span>
            </button>
          </form>

          {/* Cloud & JSON Backup Controls */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <h2 className="font-display text-base font-bold text-slate-900">
                Backup e Dados da Conta
              </h2>
              <p className="text-xs text-slate-500">
                Sincronizado no Firestore ({entries.length} medições registradas).
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleExportJson}
                className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors"
              >
                <Download className="h-4 w-4 text-teal-700" />
                <span>Exportar JSON</span>
              </button>

              <button
                type="button"
                disabled={busyAction}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50 transition-colors"
              >
                <Upload className="h-4 w-4 text-teal-700" />
                <span>Importar JSON</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2">

              {confirmClearData ? (
                <div className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1">
                  <span className="text-xs font-semibold text-rose-800">Apagar tudo?</span>
                  <button
                    type="button"
                    disabled={busyAction}
                    onClick={async () => {
                      setBusyAction(true);
                      try {
                        await onClearAllEntries();
                        setConfirmClearData(false);
                        showFeedback('Todas as medições foram removidas.');
                      } finally {
                        setBusyAction(false);
                      }
                    }}
                    aria-label="Confirmar limpeza"
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-700 text-white hover:bg-rose-800"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearData(false)}
                    aria-label="Cancelar limpeza"
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-700 border border-slate-200"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClearData(true)}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Limpar Medições</span>
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

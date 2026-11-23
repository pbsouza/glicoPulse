import {
  GlucoseEntry,
  GlucoseStats,
  GlucoseUnit,
  PatientSettings,
  ReadingStatusInfo,
  ScheduleSlot,
  SlotCategory,
} from '../types/glucose';

export const DEFAULT_SCHEDULES: ScheduleSlot[] = [
  {
    id: 'jejum',
    label: 'Jejum',
    time: '07:00',
    category: 'fasting',
    enabled: true,
    targetMin: 70,
    targetMax: 130,
  },
  {
    id: 'pos-cafe',
    label: 'Pós-café',
    time: '09:30',
    category: 'post_meal',
    enabled: true,
    targetMin: 70,
    targetMax: 180,
  },
  {
    id: 'pre-almoco',
    label: 'Pré-almoço',
    time: '12:00',
    category: 'pre_meal',
    enabled: true,
    targetMin: 70,
    targetMax: 130,
  },
  {
    id: 'pos-almoco',
    label: 'Pós-almoço',
    time: '14:30',
    category: 'post_meal',
    enabled: true,
    targetMin: 70,
    targetMax: 180,
  },
  {
    id: 'pre-jantar',
    label: 'Pré-jantar',
    time: '19:00',
    category: 'pre_meal',
    enabled: true,
    targetMin: 70,
    targetMax: 130,
  },
  {
    id: 'pos-jantar',
    label: 'Pós-jantar',
    time: '21:30',
    category: 'post_meal',
    enabled: true,
    targetMin: 70,
    targetMax: 180,
  },
  {
    id: 'ao-deitar',
    label: 'Ao deitar',
    time: '22:30',
    category: 'bedtime',
    enabled: true,
    targetMin: 90,
    targetMax: 150,
  },
];

export const DEFAULT_SETTINGS: PatientSettings = {
  patientName: '',
  doctorName: '',
  diabetesInfo: '',
  unit: 'mg/dL',
  hypoThreshold: 70,
  hyperThreshold: 180,
  severeHyperThreshold: 250,
};

export const SLOT_CATEGORY_LABELS: Record<SlotCategory, string> = {
  fasting: 'Jejum',
  pre_meal: 'Pré-refeição',
  post_meal: 'Pós-refeição',
  bedtime: 'Ao deitar',
  other: 'Outro horário',
};

export function formatGlucoseValue(valueMgDl: number, unit: GlucoseUnit): string {
  if (unit === 'mmol/L') {
    return (valueMgDl / 18.0182).toFixed(1);
  }
  return Math.round(valueMgDl).toString();
}

export function parseInputToMgDl(rawValue: number, unit: GlucoseUnit): number {
  if (unit === 'mmol/L') {
    return Math.round(rawValue * 18.0182);
  }
  return Math.round(rawValue);
}

export function classifyReading(
  valueMgDl: number,
  slot: ScheduleSlot | undefined,
  settings: PatientSettings
): ReadingStatusInfo {
  const minTarget = slot ? Math.max(settings.hypoThreshold, slot.targetMin) : settings.hypoThreshold;
  const maxTarget = slot ? slot.targetMax : settings.hyperThreshold;

  if (valueMgDl < settings.hypoThreshold || valueMgDl < minTarget) {
    return {
      status: 'low',
      label: valueMgDl < settings.hypoThreshold ? 'Hipoglicemia' : 'Abaixo da meta',
      shortLabel: 'Baixa',
      textClass: 'text-rose-700',
      surfaceClass: 'bg-rose-50',
      borderClass: 'border-rose-200',
      hexColor: '#BE123C',
    };
  }

  if (valueMgDl <= maxTarget) {
    return {
      status: 'in_range',
      label: 'Na meta',
      shortLabel: 'Na meta',
      textClass: 'text-emerald-700',
      surfaceClass: 'bg-emerald-50',
      borderClass: 'border-emerald-200',
      hexColor: '#047857',
    };
  }

  if (valueMgDl <= settings.severeHyperThreshold) {
    return {
      status: 'elevated',
      label: 'Acima da meta',
      shortLabel: 'Elevada',
      textClass: 'text-amber-700',
      surfaceClass: 'bg-amber-50',
      borderClass: 'border-amber-200',
      hexColor: '#B45309',
    };
  }

  return {
    status: 'high',
    label: 'Hiperglicemia severa',
    shortLabel: 'Muito alta',
    textClass: 'text-red-700',
    surfaceClass: 'bg-red-50',
    borderClass: 'border-red-200',
    hexColor: '#B91C1C',
  };
}

export function computeGlucoseStats(
  entries: GlucoseEntry[],
  schedules: ScheduleSlot[],
  settings: PatientSettings
): GlucoseStats {
  if (entries.length === 0) {
    return {
      count: 0,
      average: 0,
      min: 0,
      max: 0,
      stdDev: 0,
      cvPercent: 0,
      gmiPercent: 0,
      tirPercent: 0,
      belowPercent: 0,
      abovePercent: 0,
      inRangeCount: 0,
      belowCount: 0,
      aboveCount: 0,
    };
  }

  const slotMap = new Map(schedules.map((s) => [s.id, s]));
  let sum = 0;
  let min = entries[0].value;
  let max = entries[0].value;
  let inRangeCount = 0;
  let belowCount = 0;
  let aboveCount = 0;

  for (const entry of entries) {
    sum += entry.value;
    if (entry.value < min) min = entry.value;
    if (entry.value > max) max = entry.value;

    const info = classifyReading(entry.value, slotMap.get(entry.slotId), settings);
    if (info.status === 'low') {
      belowCount++;
    } else if (info.status === 'in_range') {
      inRangeCount++;
    } else {
      aboveCount++;
    }
  }

  const count = entries.length;
  const average = sum / count;

  let varianceSum = 0;
  for (const entry of entries) {
    varianceSum += Math.pow(entry.value - average, 2);
  }
  const stdDev = Math.sqrt(varianceSum / count);
  const cvPercent = average > 0 ? (stdDev / average) * 100 : 0;

  // Glucose Management Indicator (GMI) formula: 3.31 + 0.02392 * [mean glucose in mg/dL]
  const gmiPercent = 3.31 + 0.02392 * average;

  return {
    count,
    average,
    min,
    max,
    stdDev,
    cvPercent,
    gmiPercent,
    tirPercent: Math.round((inRangeCount / count) * 100),
    belowPercent: Math.round((belowCount / count) * 100),
    abovePercent: Math.round((aboveCount / count) * 100),
    inRangeCount,
    belowCount,
    aboveCount,
  };
}

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

export function findClosestSlot(timeStr: string, schedules: ScheduleSlot[]): string {
  const active = schedules.filter((s) => s.enabled);
  if (active.length === 0) return schedules[0]?.id ?? 'other';

  const targetMin = timeToMinutes(timeStr);
  let best = active[0];
  let bestDiff = Math.abs(timeToMinutes(best.time) - targetMin);

  for (const slot of active) {
    const diff = Math.abs(timeToMinutes(slot.time) - targetMin);
    if (diff < bestDiff) {
      best = slot;
      bestDiff = diff;
    }
  }
  return best.id;
}

export function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalTimeString(date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function formatDateBR(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

export function formatShortDateBR(isoDate: string): string {
  const [, m, d] = isoDate.split('-');
  if (!m || !d) return isoDate;
  return `${d}/${m}`;
}

export function sortEntriesDesc(entries: GlucoseEntry[]): GlucoseEntry[] {
  return [...entries].sort((a, b) => {
    const keyA = `${a.date}T${a.time}`;
    const keyB = `${b.date}T${b.time}`;
    return keyB.localeCompare(keyA);
  });
}

export function sortSchedulesAsc(schedules: ScheduleSlot[]): ScheduleSlot[] {
  return [...schedules].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
}

export function getNextScheduledSlot(
  schedules: ScheduleSlot[],
  todayEntries: GlucoseEntry[],
  now = new Date()
): { slot: ScheduleSlot; isTomorrow: boolean } | null {
  const active = sortSchedulesAsc(schedules).filter((s) => s.enabled);
  if (active.length === 0) return null;

  const loggedSlotIds = new Set(todayEntries.map((e) => e.slotId));
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // First try next unlogged slot that is upcoming or within 45 min past due
  const upcomingUnlogged = active.find(
    (s) => !loggedSlotIds.has(s.id) && timeToMinutes(s.time) >= nowMinutes - 45
  );
  if (upcomingUnlogged) {
    return { slot: upcomingUnlogged, isTomorrow: false };
  }

  // Otherwise any remaining unlogged slot today
  const anyUnlogged = active.find((s) => !loggedSlotIds.has(s.id));
  if (anyUnlogged) {
    return { slot: anyUnlogged, isTomorrow: false };
  }

  // All done today -> first slot tomorrow
  return { slot: active[0], isTomorrow: true };
}

export function generateSampleEntries(schedules: ScheduleSlot[]): GlucoseEntry[] {
  const active = sortSchedulesAsc(schedules).filter((s) => s.enabled);
  if (active.length === 0) return [];

  const today = new Date();
  const entries: GlucoseEntry[] = [];

  const notesByCategory: Record<SlotCategory, string[]> = {
    fasting: ['Jejum de 8h', 'Sono tranquilo', 'Acordou cedo', ''],
    pre_meal: ['Antes da refeição', 'Caminhada leve pela manhã', '', ''],
    post_meal: [
      '2h após refeição equilibrada',
      'Refeição com mais carboidratos',
      'Salada e proteína',
      '',
    ],
    bedtime: ['Antes de dormir', 'Ceia leve (iogurte)', '', ''],
    other: ['Medição extra', ''],
  };

  for (let daysAgo = 13; daysAgo >= 0; daysAgo--) {
    const d = new Date(today);
    d.setDate(today.getDate() - daysAgo);
    const dateStr = getLocalDateString(d);

    for (let idx = 0; idx < active.length; idx++) {
      const slot = active[idx];
      // For today, leave the last 2 slots pending so user sees active daily checklist
      if (daysAgo === 0 && idx >= Math.max(2, active.length - 2)) {
        continue;
      }

      const seed = (daysAgo * 31 + idx * 17) % 100;
      let base = slot.category === 'post_meal' ? 142 : slot.category === 'bedtime' ? 118 : 104;

      if (seed < 7) {
        base = 64 + (seed % 5); // occasional low
      } else if (seed > 86) {
        base = 186 + (seed % 28); // occasional elevated/high
      } else {
        base = base + ((seed % 29) - 14);
      }

      const notePool = notesByCategory[slot.category];
      const note = notePool[(daysAgo + idx) % notePool.length];

      entries.push({
        id: `sample-${dateStr}-${slot.id}`,
        value: Math.max(52, Math.min(280, Math.round(base))),
        date: dateStr,
        time: slot.time,
        slotId: slot.id,
        notes: note,
        carbsGrams: slot.category === 'post_meal' ? 35 + ((seed * 3) % 30) : undefined,
        createdAt: new Date(d.getTime() + idx * 3600000).toISOString(),
      });
    }
  }

  return sortEntriesDesc(entries);
}

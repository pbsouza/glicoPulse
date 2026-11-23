export type GlucoseUnit = 'mg/dL' | 'mmol/L';

export type SlotCategory = 'fasting' | 'pre_meal' | 'post_meal' | 'bedtime' | 'other';

export type UserRole = 'master' | 'user';

export type UserAccessStatus = 'pending' | 'approved' | 'denied';

export interface UserAccount {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  status: UserAccessStatus;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

export interface ScheduleSlot {
  id: string;
  label: string;
  time: string; // HH:MM
  category: SlotCategory;
  enabled: boolean;
  targetMin: number; // stored in mg/dL
  targetMax: number; // stored in mg/dL
}

export interface GlucoseEntry {
  id: string;
  value: number; // always stored canonically in mg/dL
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  slotId: string;
  notes: string;
  insulinUnits?: number;
  carbsGrams?: number;
  createdAt: string;
}

export interface PatientSettings {
  patientName: string;
  doctorName: string;
  diabetesInfo: string;
  unit: GlucoseUnit;
  hypoThreshold: number; // mg/dL
  hyperThreshold: number; // mg/dL
  severeHyperThreshold: number; // mg/dL
}

export type GlucoseClassification = 'low' | 'in_range' | 'elevated' | 'high';

export interface ReadingStatusInfo {
  status: GlucoseClassification;
  label: string;
  shortLabel: string;
  textClass: string;
  surfaceClass: string;
  borderClass: string;
  hexColor: string;
}

export interface GlucoseStats {
  count: number;
  average: number;
  min: number;
  max: number;
  stdDev: number;
  cvPercent: number;
  gmiPercent: number;
  tirPercent: number;
  belowPercent: number;
  abovePercent: number;
  inRangeCount: number;
  belowCount: number;
  aboveCount: number;
}

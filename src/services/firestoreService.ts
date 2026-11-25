import { User } from 'firebase/auth';
import {
  Timestamp,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocFromCache,
  getDocsFromCache,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  MASTER_EMAIL,
  OperationType,
  db,
  handleFirestoreError,
  isOfflineOrTransientError,
} from '../firebase';
import {
  GlucoseEntry,
  PatientSettings,
  ScheduleSlot,
  UserAccessStatus,
  UserAccount,
} from '../types/glucose';
import {
  DEFAULT_SCHEDULES,
  DEFAULT_SETTINGS,
  sortEntriesDesc,
  sortSchedulesAsc,
} from '../utils/glucoseUtils';

const ID_REGEX = /^[a-zA-Z0-9_\-]+$/;
const USER_ACCOUNT_CACHE_KEY = 'glicopulse_cached_user_account_v1';

let backgroundSyncErrorHandler: ((err: Error) => void) | null = null;

export function setBackgroundSyncErrorHandler(
  handler: ((err: Error) => void) | null
): void {
  backgroundSyncErrorHandler = handler;
}

function reportBackgroundSyncError(err: unknown): void {
  if (isOfflineOrTransientError(err)) return;
  const wrapped = err instanceof Error ? err : new Error(String(err));
  if (backgroundSyncErrorHandler) {
    backgroundSyncErrorHandler(wrapped);
  }
}

export function getCachedUserAccount(uid: string): UserAccount | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(USER_ACCOUNT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserAccount>;
    if (!parsed || parsed.uid !== uid) return null;
    return {
      uid: String(parsed.uid),
      email: String(parsed.email ?? ''),
      displayName: String(parsed.displayName ?? ''),
      photoURL: String(parsed.photoURL ?? ''),
      role: parsed.role === 'master' ? 'master' : 'user',
      status:
        parsed.status === 'approved' || parsed.status === 'denied'
          ? parsed.status
          : 'pending',
      createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : undefined,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
      lastLoginAt:
        typeof parsed.lastLoginAt === 'string' ? parsed.lastLoginAt : undefined,
    };
  } catch {
    return null;
  }
}

export function setCachedUserAccount(account: UserAccount): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(USER_ACCOUNT_CACHE_KEY, JSON.stringify(account));
  } catch {
    // Ignore storage quota / private mode failures
  }
}

export function clearCachedUserAccount(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(USER_ACCOUNT_CACHE_KEY);
  } catch {
    // Ignore storage failures
  }
}

/**
 * Ensures writes enqueue immediately into Firestore's persistent IndexedDB outbox
 * without blocking UI actions while offline or during transient connectivity drops.
 */
async function commitFirestoreWrite(
  writePromise: Promise<void>,
  operationType: OperationType,
  path: string
): Promise<void> {
  const guarded = writePromise.catch((error) => {
    handleFirestoreError(error, operationType, path);
  });

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    void guarded.catch(reportBackgroundSyncError);
    await new Promise<void>((resolve) => setTimeout(resolve, 40));
    return;
  }

  let settled = false;
  await Promise.race([
    guarded.then(() => {
      settled = true;
    }),
    new Promise<void>((resolve) => setTimeout(resolve, 1500)),
  ]);

  if (!settled) {
    void guarded.catch(reportBackgroundSyncError);
  }
}

function sanitizeId(raw: string, fallbackPrefix: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 128);
  if (cleaned.length >= 1 && ID_REGEX.test(cleaned)) {
    return cleaned;
  }
  return `${fallbackPrefix}-${Date.now()}`;
}

function clampString(val: unknown, maxLen: number): string {
  return String(val ?? '').trim().slice(0, maxLen);
}

function clampNumber(val: unknown, min: number, max: number, fallback: number): number {
  const num = Number(val);
  if (Number.isNaN(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

function timestampToIso(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

export function isMasterEmail(email: string | null | undefined): boolean {
  return (email ?? '').toLowerCase() === MASTER_EMAIL.toLowerCase();
}

export async function ensureUserAccount(user: User): Promise<void> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  const isMaster = isMasterEmail(user.email) && user.emailVerified;

  try {
    let cachedSnap = null;
    try {
      cachedSnap = await getDocFromCache(ref);
    } catch {
      cachedSnap = null;
    }

    if (cachedSnap && cachedSnap.exists()) {
      const cachedData = cachedSnap.data({ serverTimestamps: 'estimate' });
      void commitFirestoreWrite(
        updateDoc(ref, {
          displayName: clampString(user.displayName ?? cachedData.displayName ?? '', 120),
          photoURL: clampString(user.photoURL ?? cachedData.photoURL ?? '', 500),
          lastLoginAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
        OperationType.UPDATE,
        path
      ).catch(reportBackgroundSyncError);
      return;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await commitFirestoreWrite(
        setDoc(ref, {
          uid: user.uid,
          email: clampString(user.email ?? '', 200),
          displayName: clampString(user.displayName ?? user.email ?? 'Usuário', 120),
          photoURL: clampString(user.photoURL ?? '', 500),
          role: isMaster ? 'master' : 'user',
          status: isMaster ? 'approved' : 'pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
        }),
        OperationType.CREATE,
        path
      );
    } else {
      await commitFirestoreWrite(
        updateDoc(ref, {
          displayName: clampString(user.displayName ?? snap.data().displayName ?? '', 120),
          photoURL: clampString(user.photoURL ?? snap.data().photoURL ?? '', 500),
          lastLoginAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
        OperationType.UPDATE,
        path
      );
    }
  } catch (error) {
    if (isOfflineOrTransientError(error)) {
      return;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeUserAccount(
  uid: string,
  onData: (account: UserAccount | null) => void,
  onError: (err: Error) => void
): () => void {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    { includeMetadataChanges: true },
    (snap) => {
      if (!snap.exists()) {
        if (snap.metadata.fromCache) {
          const fallback = getCachedUserAccount(uid);
          if (fallback) {
            onData(fallback);
            return;
          }
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            onData(null);
          }
          return;
        }
        clearCachedUserAccount();
        onData(null);
        return;
      }

      const d = snap.data({ serverTimestamps: 'estimate' });
      const account: UserAccount = {
        uid: String(d.uid),
        email: String(d.email ?? ''),
        displayName: String(d.displayName ?? ''),
        photoURL: String(d.photoURL ?? ''),
        role: d.role === 'master' ? 'master' : 'user',
        status:
          d.status === 'approved' || d.status === 'denied' ? d.status : 'pending',
        createdAt: timestampToIso(d.createdAt),
        updatedAt: timestampToIso(d.updatedAt),
        lastLoginAt: timestampToIso(d.lastLoginAt),
      };
      setCachedUserAccount(account);
      onData(account);
    },
    (error) => {
      if (isOfflineOrTransientError(error)) {
        const fallback = getCachedUserAccount(uid);
        if (fallback) {
          onData(fallback);
          return;
        }
      }
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeAllUsers(
  onData: (users: UserAccount[]) => void,
  onError: (err: Error) => void
): () => void {
  const path = 'users';
  return onSnapshot(
    collection(db, 'users'),
    { includeMetadataChanges: true },
    (snap) => {
      const list: UserAccount[] = snap.docs.map((docSnap) => {
        const d = docSnap.data({ serverTimestamps: 'estimate' });
        return {
          uid: String(d.uid ?? docSnap.id),
          email: String(d.email ?? ''),
          displayName: String(d.displayName ?? ''),
          photoURL: String(d.photoURL ?? ''),
          role: d.role === 'master' ? 'master' : 'user',
          status:
            d.status === 'approved' || d.status === 'denied' ? d.status : 'pending',
          createdAt: timestampToIso(d.createdAt),
          updatedAt: timestampToIso(d.updatedAt),
          lastLoginAt: timestampToIso(d.lastLoginAt),
        };
      });

      list.sort((a, b) => {
        if (a.role === 'master' && b.role !== 'master') return -1;
        if (b.role === 'master' && a.role !== 'master') return 1;
        const order = { pending: 0, approved: 1, denied: 2 };
        if (order[a.status] !== order[b.status]) {
          return order[a.status] - order[b.status];
        }
        return (b.lastLoginAt ?? '').localeCompare(a.lastLoginAt ?? '');
      });

      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function updateUserAccessStatus(
  targetUid: string,
  status: UserAccessStatus
): Promise<void> {
  const path = `users/${targetUid}`;
  await commitFirestoreWrite(
    updateDoc(doc(db, 'users', targetUid), {
      status,
      updatedAt: serverTimestamp(),
    }),
    OperationType.UPDATE,
    path
  );
}

export async function deleteUserAccount(targetUid: string): Promise<void> {
  const path = `users/${targetUid}`;
  await commitFirestoreWrite(
    deleteDoc(doc(db, 'users', targetUid)),
    OperationType.DELETE,
    path
  );
}

// --- Entries ---
export function subscribeUserEntries(
  uid: string,
  onData: (entries: GlucoseEntry[]) => void,
  onError: (err: Error) => void
): () => void {
  const path = `users/${uid}/entries`;
  const q = query(collection(db, 'users', uid, 'entries'), where('uid', '==', uid));

  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snap) => {
      const items: GlucoseEntry[] = snap.docs.map((docSnap) => {
        const d = docSnap.data({ serverTimestamps: 'estimate' });
        return {
          id: String(d.id ?? docSnap.id),
          value: Number(d.value),
          date: String(d.date),
          time: String(d.time),
          slotId: String(d.slotId),
          notes: String(d.notes ?? ''),
          insulinUnits:
            typeof d.insulinUnits === 'number' ? d.insulinUnits : undefined,
          carbsGrams:
            typeof d.carbsGrams === 'number' ? d.carbsGrams : undefined,
          createdAt: timestampToIso(d.createdAt),
        };
      });
      onData(sortEntriesDesc(items));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function saveGlucoseEntry(
  uid: string,
  payload: Omit<GlucoseEntry, 'id' | 'createdAt'>,
  existingId?: string
): Promise<void> {
  const entryId = existingId
    ? sanitizeId(existingId, 'entry')
    : `entry-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const path = `users/${uid}/entries/${entryId}`;
  const ref = doc(db, 'users', uid, 'entries', entryId);

  const sanitizedValue = clampNumber(payload.value, 20, 700, 100);
  const sanitizedDate = /^\d{4}-\d{2}-\d{2}$/.test(payload.date)
    ? payload.date
    : new Date().toISOString().slice(0, 10);
  const sanitizedTime = /^\d{2}:\d{2}$/.test(payload.time)
    ? payload.time
    : '08:00';
  const sanitizedSlotId = sanitizeId(payload.slotId || 'other', 'slot');
  const sanitizedNotes = clampString(payload.notes, 500);

  if (existingId) {
    const updatePayload: Record<string, unknown> = {
      value: sanitizedValue,
      date: sanitizedDate,
      time: sanitizedTime,
      slotId: sanitizedSlotId,
      notes: sanitizedNotes,
      updatedAt: serverTimestamp(),
    };

    if (payload.insulinUnits !== undefined) {
      updatePayload.insulinUnits = clampNumber(payload.insulinUnits, 0, 500, 0);
    } else {
      updatePayload.insulinUnits = deleteField();
    }

    if (payload.carbsGrams !== undefined) {
      updatePayload.carbsGrams = clampNumber(payload.carbsGrams, 0, 1000, 0);
    } else {
      updatePayload.carbsGrams = deleteField();
    }

    await commitFirestoreWrite(updateDoc(ref, updatePayload), OperationType.UPDATE, path);
  } else {
    const createPayload: Record<string, unknown> = {
      id: entryId,
      uid,
      value: sanitizedValue,
      date: sanitizedDate,
      time: sanitizedTime,
      slotId: sanitizedSlotId,
      notes: sanitizedNotes,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (payload.insulinUnits !== undefined) {
      createPayload.insulinUnits = clampNumber(payload.insulinUnits, 0, 500, 0);
    }
    if (payload.carbsGrams !== undefined) {
      createPayload.carbsGrams = clampNumber(payload.carbsGrams, 0, 1000, 0);
    }

    await commitFirestoreWrite(setDoc(ref, createPayload), OperationType.CREATE, path);
  }
}

export async function deleteGlucoseEntry(uid: string, entryId: string): Promise<void> {
  const path = `users/${uid}/entries/${entryId}`;
  await commitFirestoreWrite(
    deleteDoc(doc(db, 'users', uid, 'entries', entryId)),
    OperationType.DELETE,
    path
  );
}

export async function clearAllUserEntries(
  uid: string,
  entries: GlucoseEntry[]
): Promise<void> {
  if (entries.length === 0) return;
  const path = `users/${uid}/entries`;
  const chunkSize = 400;
  for (let i = 0; i < entries.length; i += chunkSize) {
    const batch = writeBatch(db);
    for (const entry of entries.slice(i, i + chunkSize)) {
      batch.delete(doc(db, 'users', uid, 'entries', entry.id));
    }
    await commitFirestoreWrite(batch.commit(), OperationType.DELETE, path);
  }
}

// --- Schedules ---
export function subscribeUserSchedules(
  uid: string,
  onData: (schedules: ScheduleSlot[], isEmptyInDb: boolean) => void,
  onError: (err: Error) => void
): () => void {
  const path = `users/${uid}/schedules`;
  const q = query(collection(db, 'users', uid, 'schedules'), where('uid', '==', uid));

  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snap) => {
      if (snap.empty) {
        // Only treat as genuinely empty in DB when confirmed by the server
        onData(DEFAULT_SCHEDULES, !snap.metadata.fromCache);
        return;
      }
      const slots: ScheduleSlot[] = snap.docs.map((docSnap) => {
        const d = docSnap.data({ serverTimestamps: 'estimate' });
        return {
          id: String(d.id ?? docSnap.id),
          label: String(d.label ?? 'Horário'),
          time: String(d.time ?? '08:00'),
          category: d.category ?? 'other',
          enabled: Boolean(d.enabled),
          targetMin: Number(d.targetMin ?? 70),
          targetMax: Number(d.targetMax ?? 180),
        };
      });
      onData(sortSchedulesAsc(slots), false);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function seedDefaultSchedulesIfNeeded(uid: string): Promise<void> {
  const path = `users/${uid}/schedules`;
  const batch = writeBatch(db);
  for (const slot of DEFAULT_SCHEDULES) {
    const ref = doc(db, 'users', uid, 'schedules', slot.id);
    batch.set(ref, {
      id: slot.id,
      uid,
      label: clampString(slot.label, 60),
      time: slot.time,
      category: slot.category,
      enabled: slot.enabled,
      targetMin: clampNumber(slot.targetMin, 20, 500, 70),
      targetMax: clampNumber(slot.targetMax, 20, 600, 180),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  await commitFirestoreWrite(batch.commit(), OperationType.WRITE, path);
}

export async function upsertScheduleSlot(
  uid: string,
  slot: ScheduleSlot,
  isExisting: boolean
): Promise<void> {
  const slotId = sanitizeId(slot.id, 'slot');
  const path = `users/${uid}/schedules/${slotId}`;
  const ref = doc(db, 'users', uid, 'schedules', slotId);
  const minVal = clampNumber(slot.targetMin, 20, 500, 70);
  const maxVal = Math.max(minVal, clampNumber(slot.targetMax, 20, 600, 180));
  const cleanLabel = clampString(slot.label, 60) || 'Horário';
  const cleanTime = /^\d{2}:\d{2}$/.test(slot.time) ? slot.time : '08:00';

  if (isExisting) {
    await commitFirestoreWrite(
      updateDoc(ref, {
        label: cleanLabel,
        time: cleanTime,
        category: slot.category,
        enabled: Boolean(slot.enabled),
        targetMin: minVal,
        targetMax: maxVal,
        updatedAt: serverTimestamp(),
      }),
      OperationType.UPDATE,
      path
    );
  } else {
    await commitFirestoreWrite(
      setDoc(ref, {
        id: slotId,
        uid,
        label: cleanLabel,
        time: cleanTime,
        category: slot.category,
        enabled: Boolean(slot.enabled),
        targetMin: minVal,
        targetMax: maxVal,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
      OperationType.CREATE,
      path
    );
  }
}

export async function removeScheduleSlot(uid: string, slotId: string): Promise<void> {
  const path = `users/${uid}/schedules/${slotId}`;
  await commitFirestoreWrite(
    deleteDoc(doc(db, 'users', uid, 'schedules', slotId)),
    OperationType.DELETE,
    path
  );
}

export async function resetSchedulesToDefault(
  uid: string,
  currentSchedules: ScheduleSlot[]
): Promise<void> {
  const path = `users/${uid}/schedules`;
  let persistedIds = new Set<string>();
  try {
    const cachedSnap = await getDocsFromCache(
      query(collection(db, 'users', uid, 'schedules'), where('uid', '==', uid))
    );
    persistedIds = new Set(cachedSnap.docs.map((d) => d.id));
  } catch {
    persistedIds = new Set(currentSchedules.map((c) => c.id));
  }

  const batch = writeBatch(db);
  const defaultIds = new Set(DEFAULT_SCHEDULES.map((d) => d.id));

  for (const existingId of persistedIds) {
    if (!defaultIds.has(existingId)) {
      batch.delete(doc(db, 'users', uid, 'schedules', existingId));
    }
  }

  for (const def of DEFAULT_SCHEDULES) {
    const ref = doc(db, 'users', uid, 'schedules', def.id);
    if (persistedIds.has(def.id)) {
      batch.update(ref, {
        label: def.label,
        time: def.time,
        category: def.category,
        enabled: def.enabled,
        targetMin: def.targetMin,
        targetMax: def.targetMax,
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(ref, {
        id: def.id,
        uid,
        label: def.label,
        time: def.time,
        category: def.category,
        enabled: def.enabled,
        targetMin: def.targetMin,
        targetMax: def.targetMax,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }

  await commitFirestoreWrite(batch.commit(), OperationType.WRITE, path);
}

// --- Settings ---
export function subscribeUserSettings(
  uid: string,
  onData: (settings: PatientSettings) => void,
  onError: (err: Error) => void
): () => void {
  const path = `users/${uid}/settings/preferences`;
  return onSnapshot(
    doc(db, 'users', uid, 'settings', 'preferences'),
    { includeMetadataChanges: true },
    (snap) => {
      if (!snap.exists()) {
        onData(DEFAULT_SETTINGS);
        return;
      }
      const d = snap.data({ serverTimestamps: 'estimate' });
      onData({
        patientName: String(d.patientName ?? ''),
        doctorName: String(d.doctorName ?? ''),
        diabetesInfo: String(d.diabetesInfo ?? ''),
        unit: d.unit === 'mmol/L' ? 'mmol/L' : 'mg/dL',
        hypoThreshold: Number(d.hypoThreshold ?? 70),
        hyperThreshold: Number(d.hyperThreshold ?? 180),
        severeHyperThreshold: Number(d.severeHyperThreshold ?? 250),
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function saveUserSettings(
  uid: string,
  settings: PatientSettings
): Promise<void> {
  const path = `users/${uid}/settings/preferences`;
  await commitFirestoreWrite(
    setDoc(doc(db, 'users', uid, 'settings', 'preferences'), {
      uid,
      patientName: clampString(settings.patientName, 120),
      doctorName: clampString(settings.doctorName, 120),
      diabetesInfo: clampString(settings.diabetesInfo, 200),
      unit: settings.unit === 'mmol/L' ? 'mmol/L' : 'mg/dL',
      hypoThreshold: clampNumber(settings.hypoThreshold, 40, 100, 70),
      hyperThreshold: clampNumber(settings.hyperThreshold, 120, 300, 180),
      severeHyperThreshold: clampNumber(settings.severeHyperThreshold, 180, 450, 250),
      updatedAt: serverTimestamp(),
    }),
    OperationType.WRITE,
    path
  );
}

export async function batchSeedEntries(
  uid: string,
  entries: GlucoseEntry[]
): Promise<void> {
  if (entries.length === 0) return;
  const path = `users/${uid}/entries`;
  const chunkSize = 400;
  for (let i = 0; i < entries.length; i += chunkSize) {
    const batch = writeBatch(db);
    for (const entry of entries.slice(i, i + chunkSize)) {
      const entryId = sanitizeId(entry.id, 'entry');
      const ref = doc(db, 'users', uid, 'entries', entryId);
      const docPayload: Record<string, unknown> = {
        id: entryId,
        uid,
        value: clampNumber(entry.value, 20, 700, 100),
        date: /^\d{4}-\d{2}-\d{2}$/.test(entry.date)
          ? entry.date
          : new Date().toISOString().slice(0, 10),
        time: /^\d{2}:\d{2}$/.test(entry.time) ? entry.time : '08:00',
        slotId: sanitizeId(entry.slotId || 'other', 'slot'),
        notes: clampString(entry.notes, 500),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (entry.insulinUnits !== undefined) {
        docPayload.insulinUnits = clampNumber(entry.insulinUnits, 0, 500, 0);
      }
      if (entry.carbsGrams !== undefined) {
        docPayload.carbsGrams = clampNumber(entry.carbsGrams, 0, 1000, 0);
      }
      batch.set(ref, docPayload);
    }
    await commitFirestoreWrite(batch.commit(), OperationType.CREATE, path);
  }
}

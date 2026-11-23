import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BookOpen,
  Clock,
  FileText,
  LogOut,
  Plus,
  Users,
} from 'lucide-react';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import {
  GlucoseEntry,
  PatientSettings,
  ScheduleSlot,
  UserAccessStatus,
  UserAccount,
} from './types/glucose';
import {
  DEFAULT_SCHEDULES,
  DEFAULT_SETTINGS,
} from './utils/glucoseUtils';
import {
  batchSeedEntries,
  clearAllUserEntries,
  deleteGlucoseEntry,
  deleteUserAccount,
  ensureUserAccount,
  isMasterEmail,
  removeScheduleSlot,
  resetSchedulesToDefault,
  saveGlucoseEntry,
  saveUserSettings,
  seedDefaultSchedulesIfNeeded,
  subscribeAllUsers,
  subscribeUserAccount,
  subscribeUserEntries,
  subscribeUserSchedules,
  subscribeUserSettings,
  updateUserAccessStatus,
  upsertScheduleSlot,
} from './services/firestoreService';
import { DashboardView } from './components/DashboardView';
import { DiaryView } from './components/DiaryView';
import { SchedulesView } from './components/SchedulesView';
import { PdfReportView } from './components/PdfReportView';
import { MasterAccessView } from './components/MasterAccessView';
import { AuthGateView } from './components/AuthGateView';
import { LogModal } from './components/LogModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';

type AppTab = 'dashboard' | 'diary' | 'schedules' | 'pdf' | 'users';

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<Error | null>(null);

  const [entries, setEntries] = useState<GlucoseEntry[]>([]);
  const [schedules, setSchedules] = useState<ScheduleSlot[]>(DEFAULT_SCHEDULES);
  const [settings, setSettings] = useState<PatientSettings>(DEFAULT_SETTINGS);
  const [managedUsers, setManagedUsers] = useState<UserAccount[]>([]);

  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<GlucoseEntry | null>(null);
  const [presetSlotId, setPresetSlotId] = useState<string | null>(null);
  const [presetDate, setPresetDate] = useState<string | null>(null);

  const seededSchedulesUidRef = useRef<Set<string>>(new Set());

  if (runtimeError) {
    throw runtimeError;
  }

  // 1. Auth state listener & user profile bootstrap
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthError(null);

      if (!user) {
        setUserAccount(null);
        setEntries([]);
        setSchedules(DEFAULT_SCHEDULES);
        setSettings(DEFAULT_SETTINGS);
        setManagedUsers([]);
        setAccountLoading(false);
        setAuthReady(true);
        return;
      }

      setAccountLoading(true);
      try {
        await ensureUserAccount(user);
      } catch (err) {
        setRuntimeError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // 2. Real-time user account subscription (access status & role)
  useEffect(() => {
    if (!authReady || !firebaseUser) return;

    const unsubscribe = subscribeUserAccount(
      firebaseUser.uid,
      (account) => {
        setUserAccount(account);
        setAccountLoading(false);
      },
      (err) => {
        setAccountLoading(false);
        setRuntimeError(err);
      }
    );

    return () => unsubscribe();
  }, [authReady, firebaseUser]);

  const isMaster = Boolean(
    firebaseUser &&
      userAccount?.role === 'master' &&
      isMasterEmail(firebaseUser.email) &&
      firebaseUser.emailVerified
  );

  const isApproved = Boolean(
    firebaseUser &&
      userAccount &&
      (userAccount.status === 'approved' || isMaster)
  );

  // 3. Real-time clinical data listeners (ONLY when authenticated & approved)
  useEffect(() => {
    if (!authReady || !firebaseUser || !isApproved) return;

    const uid = firebaseUser.uid;
    const unsubEntries = subscribeUserEntries(uid, setEntries, setRuntimeError);
    const unsubSchedules = subscribeUserSchedules(
      uid,
      (slots, isEmptyInDb) => {
        setSchedules(slots);
        if (isEmptyInDb && !seededSchedulesUidRef.current.has(uid)) {
          seededSchedulesUidRef.current.add(uid);
          void seedDefaultSchedulesIfNeeded(uid).catch((err) =>
            setRuntimeError(err instanceof Error ? err : new Error(String(err)))
          );
        }
      },
      setRuntimeError
    );
    const unsubSettings = subscribeUserSettings(uid, setSettings, setRuntimeError);

    return () => {
      unsubEntries();
      unsubSchedules();
      unsubSettings();
    };
  }, [authReady, firebaseUser, isApproved]);

  // 4. Master user access control list listener
  useEffect(() => {
    if (!authReady || !firebaseUser || !isMaster) {
      setManagedUsers([]);
      return;
    }

    const unsubUsers = subscribeAllUsers(setManagedUsers, setRuntimeError);
    return () => unsubUsers();
  }, [authReady, firebaseUser, isMaster]);

  const pendingUsersCount = useMemo(
    () => managedUsers.filter((u) => u.status === 'pending').length,
    [managedUsers]
  );

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('popup-closed-by-user')) {
        setAuthError('Login cancelado antes da conclusão.');
      } else {
        setAuthError('Não foi possível autenticar com o Google. Tente novamente.');
      }
    }
  };

  const handleSignOut = async () => {
    setActiveTab('dashboard');
    await signOut(auth);
  };

  // Auth Gate Conditions
  if (!authReady || (firebaseUser && accountLoading)) {
    return (
      <AuthGateView
        mode="loading"
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />
    );
  }

  if (!firebaseUser) {
    return (
      <AuthGateView
        mode="login"
        authError={authError}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />
    );
  }

  if (!isApproved) {
    const gateMode = userAccount?.status === 'denied' ? 'denied' : 'pending';
    return (
      <AuthGateView
        mode={gateMode}
        firebaseUser={firebaseUser}
        userAccount={userAccount}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />
    );
  }

  // Authorized Handlers
  const uid = firebaseUser.uid;

  const handleOpenNewLog = (slotId?: string, date?: string) => {
    setEditingEntry(null);
    setPresetSlotId(slotId ?? null);
    setPresetDate(date ?? null);
    setLogModalOpen(true);
  };

  const handleEditEntry = (entry: GlucoseEntry) => {
    setEditingEntry(entry);
    setPresetSlotId(null);
    setPresetDate(null);
    setLogModalOpen(true);
  };

  const handleSaveEntry = (
    payload: Omit<GlucoseEntry, 'id' | 'createdAt'>,
    existingId?: string
  ) => {
    void saveGlucoseEntry(uid, payload, existingId).catch((err) =>
      setRuntimeError(err instanceof Error ? err : new Error(String(err)))
    );
  };

  const handleDeleteEntry = (id: string) => {
    void deleteGlucoseEntry(uid, id).catch((err) =>
      setRuntimeError(err instanceof Error ? err : new Error(String(err)))
    );
  };

  const handleSaveSlot = async (slot: ScheduleSlot, isExisting: boolean) => {
    await upsertScheduleSlot(uid, slot, isExisting);
  };

  const handleToggleSlot = async (slot: ScheduleSlot) => {
    await upsertScheduleSlot(uid, { ...slot, enabled: !slot.enabled }, true);
  };

  const handleDeleteSlot = async (slotId: string) => {
    await removeScheduleSlot(uid, slotId);
  };

  const handleResetSchedules = async () => {
    await resetSchedulesToDefault(uid, schedules);
  };

  const handleUpdateSettings = async (next: PatientSettings) => {
    await saveUserSettings(uid, next);
  };

  const handleClearAllEntries = async () => {
    await clearAllUserEntries(uid, entries);
  };

  const handleImportBackup = async (data: {
    entries: GlucoseEntry[];
    schedules?: ScheduleSlot[];
    settings?: PatientSettings;
  }) => {
    await batchSeedEntries(uid, data.entries);
    if (data.schedules && data.schedules.length > 0) {
      const existingIds = new Set(schedules.map((s) => s.id));
      for (const s of data.schedules) {
        await upsertScheduleSlot(uid, s, existingIds.has(s.id));
      }
    }
    if (data.settings) {
      await saveUserSettings(uid, { ...DEFAULT_SETTINGS, ...data.settings });
    }
  };

  const handleUpdateUserStatus = async (
    targetUid: string,
    status: UserAccessStatus
  ) => {
    await updateUserAccessStatus(targetUid, status);
  };

  const handleDeleteManagedUser = async (targetUid: string) => {
    await deleteUserAccount(targetUid);
  };

  const navItems: {
    id: AppTab;
    label: string;
    mobileLabel: string;
    icon: typeof Activity;
  }[] = [
    { id: 'dashboard', label: 'Painel', mobileLabel: 'Painel', icon: Activity },
    { id: 'diary', label: 'Diário', mobileLabel: 'Diário', icon: BookOpen },
    { id: 'schedules', label: 'Horários', mobileLabel: 'Horários', icon: Clock },
    { id: 'pdf', label: 'Relatório PDF', mobileLabel: 'PDF', icon: FileText },
    ...(isMaster
      ? [
          {
            id: 'users' as AppTab,
            label: pendingUsersCount > 0 ? `Usuários (${pendingUsersCount})` : 'Usuários',
            mobileLabel: 'Usuários',
            icon: Users,
          },
        ]
      : []),
  ];

  const pageMeta: Record<AppTab, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Painel Glicêmico',
      subtitle: 'Visão geral das suas medições, tempo no alvo e agenda diária.',
    },
    diary: {
      title: 'Diário de Glicemia',
      subtitle: 'Grade clínica por horários configurados e histórico cronológico.',
    },
    schedules: {
      title: 'Horários e Metas',
      subtitle: 'Personalize seus horários de medição, metas clínicas e backup.',
    },
    pdf: {
      title: 'Exportação de Relatório PDF',
      subtitle: 'Configure o período e baixe o documento clínico em PDF.',
    },
    users: {
      title: 'Controle de Acesso (Master)',
      subtitle: 'Autorize ou negue a utilização do sistema por usuários autenticados.',
    },
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Navigation Bar (Strict 3-Zone Contract) */}
      <header className="border-b border-slate-200 bg-white no-print">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 sm:px-6 h-16">
          {/* Zone 1: Brand Wordmark + Real PNG Icon */}
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 rounded-lg"
          >
            <img
              src="./pwa-192x192.png"
              alt="GlicoPulse"
              className="h-7 w-7 rounded-lg object-cover"
            />
            <span className="font-display text-lg font-bold tracking-tight text-slate-900">
              GlicoPulse
            </span>
          </button>

          {/* Zone 2: Desktop Single-Line Text Navigation Links */}
          <nav
            aria-label="Navegação principal"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
          >
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`relative py-2 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700 ${
                    active
                      ? 'text-teal-800 font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{item.label}</span>
                  {active && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-teal-700" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => handleOpenNewLog()}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Registrar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6 pt-6 pb-24 md:pb-12 space-y-6 print:max-w-none print:p-0 print:m-0">
        {/* Workspace Subheader + User Identity + PWA Install */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
              {pageMeta[activeTab].title}
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {pageMeta[activeTab].subtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="font-mono truncate max-w-[190px]">
                {firebaseUser.email}
              </span>
              {isMaster && (
                <>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className="font-semibold text-teal-800">Master</span>
                </>
              )}
            </div>

            <PWAInstallButton variant="compact" />

            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sair</span>
            </button>
          </div>
        </div>

        {/* Active View */}
        {activeTab === 'dashboard' && (
          <DashboardView
            entries={entries}
            schedules={schedules}
            settings={settings}
            onOpenNewLog={handleOpenNewLog}
            onEditEntry={handleEditEntry}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'diary' && (
          <DiaryView
            entries={entries}
            schedules={schedules}
            settings={settings}
            onOpenNewLog={handleOpenNewLog}
            onEditEntry={handleEditEntry}
            onDeleteEntry={handleDeleteEntry}
          />
        )}

        {activeTab === 'schedules' && (
          <SchedulesView
            schedules={schedules}
            onSaveSlot={handleSaveSlot}
            onToggleSlot={handleToggleSlot}
            onDeleteSlot={handleDeleteSlot}
            onResetSchedules={handleResetSchedules}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            entries={entries}
            onImportBackup={handleImportBackup}
            onClearAllEntries={handleClearAllEntries}
          />
        )}

        {activeTab === 'pdf' && (
          <PdfReportView
            entries={entries}
            schedules={schedules}
            settings={settings}
          />
        )}

        {activeTab === 'users' && isMaster && (
          <MasterAccessView
            users={managedUsers}
            currentUserUid={uid}
            onUpdateStatus={handleUpdateUserStatus}
            onDeleteUser={handleDeleteManagedUser}
          />
        )}
      </main>

      {/* Desktop Quiet Footer */}
      <footer className="hidden md:block border-t border-slate-200 bg-white/60 py-4 text-center text-xs text-slate-500 no-print">
        GlicoPulse — Controle de glicemia com sincronização Firebase, acesso autorizado e exportação clínica em PDF.
      </footer>

      {/* Mobile Fixed Bottom Tab Bar */}
      <nav
        aria-label="Navegação mobile"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md pb-safe no-print"
      >
        <div
          className={`grid h-14 items-center ${
            navItems.length === 5 ? 'grid-cols-5' : 'grid-cols-4'
          }`}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center min-h-[44px] transition-colors ${
                  active ? 'text-teal-700' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
                <span className="mt-0.5 text-[11px] font-medium tracking-tight">
                  {item.mobileLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Log / Edit Measurement Modal */}
      <LogModal
        isOpen={logModalOpen}
        onClose={() => setLogModalOpen(false)}
        onSave={handleSaveEntry}
        onDelete={handleDeleteEntry}
        schedules={schedules}
        settings={settings}
        editingEntry={editingEntry}
        presetSlotId={presetSlotId}
        presetDate={presetDate}
      />

      {/* Offline Connectivity Indicator */}
      <OfflineIndicator />
    </div>
  );
}

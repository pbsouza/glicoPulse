import React, { useState } from 'react';
import { Clock, ShieldAlert, LogOut, ShieldCheck, FileText, Activity } from 'lucide-react';
import { User } from 'firebase/auth';
import { UserAccount } from '../types/glucose';
import { MASTER_EMAIL } from '../firebase';
import { PWAInstallButton } from './PWAInstallButton';

interface AuthGateViewProps {
  mode: 'login' | 'loading' | 'pending' | 'denied';
  firebaseUser?: User | null;
  userAccount?: UserAccount | null;
  authError?: string | null;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

export const AuthGateView: React.FC<AuthGateViewProps> = ({
  mode,
  firebaseUser,
  userAccount,
  authError,
  onSignIn,
  onSignOut,
}) => {
  const [submitting, setSubmitting] = useState(false);

  const handleGoogleLogin = async () => {
    setSubmitting(true);
    try {
      await onSignIn();
    } finally {
      setSubmitting(false);
    }
  };

  if (mode === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-4">
          <img
            src="./pwa-192x192.png"
            alt="GlicoPulse"
            className="mx-auto h-14 w-14 rounded-2xl border border-slate-200"
          />
          <div>
            <p className="font-display text-base font-bold text-slate-900">GlicoPulse</p>
            <p className="mt-1 text-xs text-slate-500">Verificando sessão e permissões...</p>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'pending') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 border border-amber-200 text-amber-700 shrink-0">
              <Clock className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-lg font-bold text-slate-900">
                Aguardando Liberação
              </h1>
              <p className="text-xs text-slate-500 truncate">
                {userAccount?.email || firebaseUser?.email}
              </p>
            </div>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed">
            Sua conta foi autenticada com sucesso, mas o acesso ao sistema precisa ser autorizado pelo usuário master (<span className="font-mono text-xs text-slate-800">{MASTER_EMAIL}</span>).
          </p>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 leading-relaxed">
            Esta tela é atualizada automaticamente assim que a permissão for concedida.
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <PWAInstallButton variant="compact" />
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors ml-auto"
            >
              <LogOut className="h-4 w-4" />
              <span>Sair da conta</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'denied') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 border border-rose-200 text-rose-700 shrink-0">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-lg font-bold text-slate-900">
                Acesso Não Autorizado
              </h1>
              <p className="text-xs text-slate-500 truncate">
                {userAccount?.email || firebaseUser?.email}
              </p>
            </div>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed">
            A utilização do sistema para esta conta foi negada ou revogada pelo administrador master. Caso necessário, solicite a liberação diretamente ao responsável.
          </p>

          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Sair e trocar de conta</span>
          </button>
        </div>
      </div>
    );
  }

  // Login screen
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 sm:p-6">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between py-2">
        <div className="flex items-center gap-2.5">
          <img
            src="./pwa-192x192.png"
            alt="GlicoPulse"
            className="h-8 w-8 rounded-lg border border-slate-200"
          />
          <span className="font-display text-lg font-bold tracking-tight text-slate-900">
            GlicoPulse
          </span>
        </div>
        <PWAInstallButton variant="compact" />
      </div>

      <main className="mx-auto w-full max-w-md my-auto py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-6">
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
              Controle de glicemia sincronizado
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Entre com sua conta Google para registrar medições, personalizar horários e exportar relatórios em PDF.
            </p>
          </div>

          <div className="space-y-3 border-y border-slate-100 py-4 text-xs text-slate-600">
            <div className="flex items-center gap-3">
              <Activity className="h-4 w-4 shrink-0 text-teal-700" />
              <span>Horários configuráveis, curvas de tendência e tempo no alvo</span>
            </div>
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 shrink-0 text-teal-700" />
              <span>Exportação clínica em PDF pronta para consulta médica</span>
            </div>
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-4 w-4 shrink-0 text-teal-700" />
              <span>Acesso autenticado via Firebase com aprovação do usuário master</span>
            </div>
          </div>

          {authError && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800"
            >
              {authError}
            </div>
          )}

          <button
            type="button"
            disabled={submitting}
            onClick={handleGoogleLogin}
            className="flex w-full min-h-[48px] items-center justify-center gap-3 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M21.35 11.1h-9.17v2.98h5.27c-.23 1.22-.92 2.25-1.97 2.94v2.45h3.18c1.86-1.71 2.94-4.23 2.94-7.21 0-.4-.04-.79-.25-1.16z"
              />
              <path
                fill="currentColor"
                d="M12.18 22c2.66 0 4.89-.88 6.52-2.38l-3.18-2.45c-.88.59-2.01.94-3.34.94-2.57 0-4.74-1.73-5.52-4.06H3.38v2.52C5 19.79 8.33 22 12.18 22z"
              />
              <path
                fill="currentColor"
                d="M6.66 14.05c-.2-.59-.31-1.22-.31-1.87s.11-1.28.31-1.87V7.79H3.38A9.82 9.82 0 0 0 2.34 12.18c0 1.59.38 3.09 1.04 4.39l3.28-2.52z"
              />
              <path
                fill="currentColor"
                d="M12.18 6.25c1.45 0 2.75.5 3.77 1.48l2.83-2.83C17.06 3.3 14.84 2.36 12.18 2.36c-3.85 0-7.18 2.21-8.8 5.43l3.28 2.52c.78-2.33 2.95-4.06 5.52-4.06z"
              />
            </svg>
            <span>{submitting ? 'Conectando...' : 'Entrar com Google'}</span>
          </button>
        </div>
      </main>

      <footer className="text-center text-xs text-slate-400 py-2">
        GlicoPulse PWA · Dados protegidos por autenticação Firebase
      </footer>
    </div>
  );
};

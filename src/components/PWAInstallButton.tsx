import React, { useState } from 'react';
import { Download, Smartphone, Share, X, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'card';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'compact' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [installing, setInstalling] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    if (variant === 'card') {
      return (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" />
          <div>
            <p className="font-semibold">Aplicativo instalado neste dispositivo</p>
            <p className="text-xs text-emerald-700">
              O GlicoPulse está rodando em modo standalone com suporte offline ativo.
            </p>
          </div>
        </div>
      );
    }
    return null;
  }

  const handleNativeInstall = async () => {
    setInstalling(true);
    try {
      await install();
    } finally {
      setInstalling(false);
    }
  };

  // Native Chromium / Android / Edge / Desktop install button: ONLY triggers real installation
  if (isInstallable) {
    return variant === 'compact' ? (
      <button
        type="button"
        disabled={installing}
        onClick={handleNativeInstall}
        className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3.5 py-2 text-xs font-semibold text-teal-800 transition-colors hover:bg-teal-100 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 whitespace-nowrap shrink-0"
      >
        <Download className="h-4 w-4 shrink-0" />
        <span>{installing ? 'Instalando...' : 'Instalar App'}</span>
      </button>
    ) : (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-start gap-3">
          <img
            src="./pwa-192x192.png"
            alt="Ícone GlicoPulse"
            className="h-12 w-12 rounded-xl border border-slate-200 object-cover shrink-0"
          />
          <div>
            <h4 className="font-display text-sm font-semibold text-slate-900">
              Instalar GlicoPulse no Dispositivo (PWA)
            </h4>
            <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
              Instale diretamente na tela inicial para abrir como aplicativo nativo e usar offline.
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={installing}
          onClick={handleNativeInstall}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 whitespace-nowrap shrink-0"
        >
          <Download className="h-4 w-4" />
          <span>{installing ? 'Instalando...' : 'Instalar Agora'}</span>
        </button>
      </div>
    );
  }

  // iOS Safari fallback (WebKit does not support beforeinstallprompt)
  if (isIOS) {
    return (
      <>
        {variant === 'compact' ? (
          <button
            type="button"
            onClick={() => setShowIOSGuide(true)}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3.5 py-2 text-xs font-semibold text-teal-800 transition-colors hover:bg-teal-100 whitespace-nowrap shrink-0"
          >
            <Download className="h-4 w-4 shrink-0" />
            <span>Instalar no iOS</span>
          </button>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start gap-3">
              <img
                src="./pwa-192x192.png"
                alt="Ícone GlicoPulse"
                className="h-12 w-12 rounded-xl border border-slate-200 object-cover shrink-0"
              />
              <div>
                <h4 className="font-display text-sm font-semibold text-slate-900">
                  Instalar GlicoPulse no iPhone / iPad
                </h4>
                <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                  No Safari, adicione à Tela de Início para executar em tela cheia.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowIOSGuide(true)}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 whitespace-nowrap shrink-0"
            >
              <Share className="h-4 w-4" />
              <span>Adicionar à Tela</span>
            </button>
          </div>
        )}

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-ios-title"
          >
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <h3 id="pwa-ios-title" className="font-display text-base font-bold text-slate-900">
                  Adicionar à Tela de Início (iOS)
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Fechar"
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 border border-slate-200">
                  <Share className="h-5 w-5 shrink-0 text-teal-700 mt-0.5" />
                  <p>
                    1. Toque em <strong>Compartilhar</strong> na barra do Safari.
                  </p>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 border border-slate-200">
                  <Smartphone className="h-5 w-5 shrink-0 text-teal-700 mt-0.5" />
                  <p>
                    2. Selecione <strong>Adicionar à Tela de Início</strong>.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full min-h-[44px] rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // When beforeinstallprompt is not yet available (e.g., embedded preview iframe or already installed in browser),
  // do not show a button that opens instructions in compact header mode.
  if (variant === 'compact') {
    return null;
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <img
        src="./pwa-192x192.png"
        alt="Ícone GlicoPulse"
        className="h-11 w-11 rounded-xl border border-slate-200 object-cover shrink-0"
      />
      <div>
        <h4 className="font-display text-sm font-semibold text-slate-900">
          Aplicativo Web Instalável (PWA)
        </h4>
        <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
          O botão de instalação direta aparece automaticamente quando o navegador libera o prompt nativo (fora de visualizações embutidas ou se ainda não estiver instalado).
        </p>
      </div>
    </div>
  );
};

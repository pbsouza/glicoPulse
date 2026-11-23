import React, { useState } from 'react';
import { Download, Smartphone, Share, X, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'card';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'compact' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

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

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      {variant === 'compact' ? (
        <button
          type="button"
          onClick={handleInstallClick}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3.5 py-2 text-xs font-semibold text-teal-800 transition-colors hover:bg-teal-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 whitespace-nowrap shrink-0"
        >
          <Download className="h-4 w-4 shrink-0" />
          <span>{isIOS ? 'Instalar no iOS' : 'Instalar App'}</span>
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
                Acesse na tela inicial como aplicativo nativo, com abertura instantânea e uso 100% offline.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleInstallClick}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 whitespace-nowrap shrink-0"
          >
            <Download className="h-4 w-4" />
            <span>{isInstallable ? 'Instalar Agora' : 'Como Instalar'}</span>
          </button>
        </div>
      )}

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-guide-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src="./pwa-192x192.png"
                  alt="GlicoPulse"
                  className="h-11 w-11 rounded-xl border border-slate-200"
                />
                <div>
                  <h3 id="pwa-guide-title" className="font-display text-base font-bold text-slate-900">
                    Instalar GlicoPulse no Dispositivo
                  </h3>
                  <p className="text-xs text-slate-500">Uso local offline sem loja de aplicativos</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="Fechar instruções"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isIOS ? (
              <div className="mt-5 space-y-3 text-sm text-slate-700">
                <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 border border-slate-200">
                  <Share className="h-5 w-5 shrink-0 text-teal-700 mt-0.5" />
                  <p>
                    1. No Safari, toque no botão <strong>Compartilhar</strong> na barra inferior ou superior.
                  </p>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 border border-slate-200">
                  <Smartphone className="h-5 w-5 shrink-0 text-teal-700 mt-0.5" />
                  <p>
                    2. Role a lista e selecione <strong>Adicionar à Tela de Início</strong>.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-3 text-sm text-slate-700">
                <p className="leading-relaxed">
                  Para instalar diretamente no seu celular ou computador:
                </p>
                <ul className="space-y-2 rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs text-slate-700 leading-relaxed">
                  <li>
                    <strong>Chrome / Edge (Desktop):</strong> clique no ícone de instalação na barra de endereços à direita ou abra o menu <strong>⋮ → Instalar GlicoPulse</strong>.
                  </li>
                  <li>
                    <strong>Chrome (Android):</strong> toque no menu <strong>⋮</strong> e selecione <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.
                  </li>
                </ul>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-5 w-full min-h-[44px] rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
};

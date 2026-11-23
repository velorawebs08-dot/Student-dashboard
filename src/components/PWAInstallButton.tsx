import { Download, Smartphone, X } from 'lucide-react';
import { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { siteData } from '../siteData';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'card';
}

export function PWAInstallButton({ variant = 'compact' }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (!isInstallable && !isIOS) {
    return null;
  }

  if (variant === 'card') {
    return (
      <>
        <div className="rounded-2xl bg-white border border-slate-200 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#0F2A4A]/8 text-[#0F2A4A] flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#0F2A4A]">Install {siteData.tuitionName}</p>
              <p className="text-xs text-slate-500">Add to your home screen for one-tap access</p>
            </div>
          </div>
          <button
            type="button"
            onClick={isInstallable ? install : () => setShowIOSGuide(true)}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0F2A4A] text-white text-xs font-semibold hover:bg-[#163861] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Install App
          </button>
        </div>

        {showIOSGuide && <IOSInstallModal onClose={() => setShowIOSGuide(false)} />}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={isInstallable ? install : () => setShowIOSGuide(true)}
        className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0F2A4A]/8 hover:bg-[#0F2A4A]/14 text-[#0F2A4A] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install</span>
      </button>

      {showIOSGuide && <IOSInstallModal onClose={() => setShowIOSGuide(false)} />}
    </>
  );
}

function IOSInstallModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-base font-bold text-[#0F2A4A]">Install on iPhone or iPad</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close instructions"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <ol className="mt-4 space-y-2.5 text-sm text-slate-600">
          <li>1. Tap the <strong>Share</strong> icon in Safari&apos;s toolbar.</li>
          <li>2. Scroll down and select <strong>Add to Home Screen</strong>.</li>
          <li>3. Tap <strong>Add</strong> in the top right corner.</li>
        </ol>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full min-h-[44px] rounded-xl bg-[#0F2A4A] text-white text-sm font-semibold hover:bg-[#163861] transition-colors cursor-pointer"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

"use client";

import { Download, Share, SquarePlus, X } from "lucide-react";
import { useEffect, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export default function InstallApp({ compact = false }: { compact?: boolean }) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));

    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const markInstalled = () => {
      setInstalled(true);
      setPrompt(null);
      setShowHelp(false);
    };
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  if (installed) return null;

  const install = async () => {
    if (!prompt) {
      setShowHelp(true);
      return;
    }
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setPrompt(null);
  };

  return (
    <>
      <button type="button" className={`install-app-btn ${compact ? "compact" : ""}`} onClick={() => void install()}>
        <Download size={compact ? 15 : 17} />
        {compact ? "Pasang app" : "Pasang Elsewhere di perangkat ini"}
      </button>
      {showHelp && (
        <div className="install-help-backdrop" role="presentation" onClick={() => setShowHelp(false)}>
          <section className="install-help" role="dialog" aria-modal="true" aria-labelledby="install-title" onClick={(event) => event.stopPropagation()}>
            <button className="install-help-close" aria-label="Tutup petunjuk" onClick={() => setShowHelp(false)}><X size={18} /></button>
            <div className="install-help-icon">E</div>
            <span>ELSEWHERE & CO.</span>
            <h2 id="install-title">Pasang sebagai aplikasi</h2>
            {isIos ? (
              <ol>
                <li><Share size={18} /> Tekan tombol <b>Share</b> di Safari.</li>
                <li><SquarePlus size={18} /> Pilih <b>Add to Home Screen</b>.</li>
                <li>Tekan <b>Add</b>. Elsewhere akan muncul di layar utama.</li>
              </ol>
            ) : (
              <ol>
                <li>Buka menu browser di pojok kanan atas.</li>
                <li><Download size={18} /> Pilih <b>Install app</b> atau <b>Add to Home screen</b>.</li>
                <li>Konfirmasi pemasangan.</li>
              </ol>
            )}
            <p>Kamu dan Hanum tetap login dengan akun masing-masing. Semua perubahan tersimpan ke workspace Supabase yang sama.</p>
          </section>
        </div>
      )}
    </>
  );
}

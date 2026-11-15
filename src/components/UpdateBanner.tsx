import { useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { isNative, PUBLIC_URL } from '../lib/platform';

interface VersionInfo {
  android?: { versionCode: number; url: string };
}

/**
 * Nur in der Android-App: vergleicht den installierten Build mit /version.json auf der Website
 * (beim Deploy geschrieben) und bietet die neuere APK an. Geprüft beim Start und beim Zurückkehren.
 */
export default function UpdateBanner() {
  const [url, setUrl] = useState<string>();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isNative) return;
    const check = async () => {
      try {
        const [info, res] = await Promise.all([CapApp.getInfo(), fetch(`${PUBLIC_URL}/version.json`, { cache: 'no-store' })]);
        if (!res.ok) return;
        const remote = (await res.json()) as VersionInfo;
        if (remote.android && remote.android.versionCode > Number(info.build)) setUrl(new URL(remote.android.url, PUBLIC_URL).toString());
      } catch {
        /* offline – beim nächsten Mal */
      }
    };
    check();
    const sub = CapApp.addListener('resume', check);
    return () => {
      sub.then((h) => h.remove()).catch(() => undefined);
    };
  }, []);

  if (!url || dismissed) return null;
  return (
    <div className="update-banner">
      <span>Eine neue Version von Lorebook ist da.</span>
      {/* öffnet den System-Browser, der die APK lädt und an den Installer übergibt */}
      <a className="btn small primary" href={url} target="_blank" rel="noopener">Herunterladen</a>
      <button className="btn small ghost" onClick={() => setDismissed(true)} aria-label="Schließen">✕</button>
    </div>
  );
}

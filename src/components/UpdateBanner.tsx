import { useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { isNative, PUBLIC_URL } from '../lib/platform';
import { tr } from '../lib/i18n';

interface VersionInfo {
  android?: { versionCode: number; url: string };
}

/**
 * Android app only: compares the installed build with /version.json on the website
 * (written on deploy) and offers the newer APK. Checked on start and when returning to the app.
 */
export default function UpdateBanner() {
  const [url, setUrl] = useState<string>();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isNative) return;
    const check = async () => {
      try {
        const [info, res] = await Promise.all([
          CapApp.getInfo(),
          fetch(`${PUBLIC_URL}/version.json`, { cache: 'no-store' }),
        ]);
        if (!res.ok) return;
        const remote = (await res.json()) as VersionInfo;
        if (remote.android && remote.android.versionCode > Number(info.build))
          setUrl(new URL(remote.android.url, PUBLIC_URL).toString());
      } catch {
        /* offline – try again next time */
      }
    };
    void check();
    const sub = CapApp.addListener('resume', () => void check());
    return () => {
      sub.then((h) => h.remove()).catch(() => undefined);
    };
  }, []);

  if (!url || dismissed) return null;
  return (
    <div className="update-banner">
      <span>{tr('Eine neue Version von Lorebook ist da.', 'A new version of Lorebook is available.')}</span>
      {/* opens the system browser, which downloads the APK and hands it to the installer */}
      <a className="btn small primary" href={url} target="_blank" rel="noopener">
        {tr('Herunterladen', 'Download')}
      </a>
      <button className="btn small ghost" onClick={() => setDismissed(true)} aria-label={tr('Schließen', 'Close')}>
        ✕
      </button>
    </div>
  );
}

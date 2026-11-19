import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { migrateLegacyProgress } from './lib/progress';
import { initSync } from './lib/sync';
import { isNative } from './lib/platform';
import { initReminders } from './lib/reminders';
import { onLangChange } from './lib/i18n';
import { localizeDemo } from './lib/demo';
import './styles.css';

// the Android app ships all files in the APK, a service worker would only get in the way there
if (!isNative) registerSW({ immediate: true });

// after the confirmation link Supabase appends tokens/errors to the hash, which would confuse the router
if (/access_token=|error_description=|type=signup/.test(location.hash)) {
  history.replaceState(null, '', `${location.pathname}#/account`);
}

// ask the browser not to evict the local data
navigator.storage?.persist?.().catch(() => undefined);

migrateLegacyProgress()
  .catch((e) => console.error('[lorebook] Migration', e))
  .finally(() => {
    // the demo chapter follows the selected language
    void localizeDemo().catch((e) => console.error('[lorebook] Demo', e));
    onLangChange(() => void localizeDemo().catch((e) => console.error('[lorebook] Demo', e)));
    void initSync();
    initReminders();
  });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

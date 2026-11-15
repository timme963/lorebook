import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { migrateLegacyProgress } from './lib/progress';
import { initSync } from './lib/sync';
import './styles.css';

registerSW({ immediate: true });

// Nach Klick auf den Bestätigungslink hängt Supabase Tokens/Fehler an den Hash – der würde den Router stören
if (/access_token=|error_description=|type=signup/.test(location.hash)) {
  history.replaceState(null, '', `${location.pathname}#/account`);
}

// Browser bitten, die lokalen Daten nicht automatisch zu löschen
navigator.storage?.persist?.().catch(() => undefined);

migrateLegacyProgress()
  .catch((e) => console.error('[lorebook] Migration', e))
  .finally(() => void initSync());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

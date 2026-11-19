// For deploy:web-only: ship the last downloaded APK (release/) again so download and update check keep working.
import { copyFileSync, existsSync } from 'node:fs';

for (const f of ['lorebook.apk', 'version.json']) {
  if (existsSync(`release/${f}`)) copyFileSync(`release/${f}`, `dist/${f}`);
  else console.warn(`release/${f} fehlt – erst einmal "npm run deploy" ausführen.`);
}

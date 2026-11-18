// Für deploy:web-only: die zuletzt geladene APK (release/) wieder mit ausliefern, damit Download und Update-Check nicht wegfallen.
import { copyFileSync, existsSync } from 'node:fs';

for (const f of ['lorebook.apk', 'version.json']) {
  if (existsSync(`release/${f}`)) copyFileSync(`release/${f}`, `dist/${f}`);
  else console.warn(`release/${f} fehlt – erst einmal "npm run deploy" ausführen.`);
}

# Lorebook

Lernen mit **Vorabfragen → Story → Nachfragen → Spaced Repetition**, pro Kapitel und mit einem Boss-Fight für den ganzen Kurs.

Lorebook ruft selbst keine KI auf. Du lädst dein PDF bei Claude, ChatGPT oder Gemini hoch, nimmst dazu den fertigen Prompt aus der App und fügst die Antwort (JSON) wieder ein. Die App zeigt die Inhalte an, fragt ab und plant die Wiederholungen.

- **Lokal zuerst, keine Kosten.** Alle Daten liegen in IndexedDB im Browser bzw. in der App. Ohne Account verlassen sie das Gerät nicht.
- **Optionaler Account (Supabase, Frankfurt):** E-Mail + Passwort. Kurse und Fortschritt werden zwischen Geräten synchronisiert. PDFs bleiben immer lokal.
- **Web-App (PWA):** https://lorebook-9yf.pages.dev – installierbar (PC, iPhone), funktioniert offline.
- **Android-App (Capacitor):** https://lorebook-9yf.pages.dev/lorebook.apk – mit täglicher Erinnerung an fällige Karten und Update-Hinweis.
- **Deutsch und Englisch:** Oberfläche, Prompts und Demo-Kapitel. Die Lerninhalte entstehen in der Sprache des PDFs. Impressum/Datenschutz nur deutsch.
- **Story-Stile:** Vorschläge mit Hinweis, wofür sie passen (Start-up für BWL, Gerichtsdrama für Jura …), „Passend zum Stoff“ lässt die KI wählen, eigener Stil möglich.
- **Vorlesen & Spracheingabe:** 🔊 bei Story, Fragen und Erklärungen, 🎤 bei Lückentext und offenen Fragen. Geschwindigkeit, Stimme und automatisches Vorlesen unter „Account & Daten“. Browser: Web Speech API, App: Capacitor-Plugins (`src/lib/speech.ts`).
- **Hörmodus & freihändig:** Story als Hörbuch, Wiederholung komplett per Sprache (`src/components/HandsFree.tsx`, Antwort-Erkennung in `src/lib/voiceAnswer.ts`).
- **Schwachstellen:** Abrufwahrscheinlichkeit (FSRS) pro Lernziel auf der Kursseite, gezieltes Training unter 90 % (`src/lib/insights.ts`).
- **Formeln:** LaTeX zwischen `\( \)` bzw. `\[ \]`, gerendert mit KaTeX (lazy). Der Import repariert vergessene doppelte Backslashes (`src/lib/math.ts`).
- **Korrektheit:** Zu jeder Frage gibt es Zitat und PDF-Seite. Prompt B prüft die erzeugten Inhalte in einem zweiten Chat gegen das PDF. Falsche Fragen lassen sich melden und kommen dann nicht mehr in die Wiederholung.

Live: https://lorebook-9yf.pages.dev · Impressum und Datenschutz unter `#/impressum` und `#/datenschutz` (Angaben in `src/legal.ts`).

## Entwicklung

```bash
npm install
npm run dev              # http://localhost:5173
npm test                 # Unit-Tests (Import-Validierung, Bewertung, Serie, Boss)
npm run build
npm run deploy           # Build + neueste APK von GitHub holen + Cloudflare Pages (Projekt "lorebook")
npm run deploy:web-only  # wie deploy, aber mit der zuletzt geladenen APK statt einer neuen (z. B. wenn der Android-Build noch läuft)
```

`npm run deploy` braucht die GitHub CLI (`gh`, angemeldet), weil es die APK aus dem letzten erfolgreichen Build lädt.

## Android-App

- Jeder Push auf `main` baut per GitHub Actions (`.github/workflows/android.yml`) eine signierte APK als Artefakt `lorebook-apk`. Die versionCode ist die Run-Nummer.
- `npm run deploy` legt sie als `/lorebook.apk` und `/version.json` auf die Website. Die App vergleicht beim Start mit `version.json` und bietet Updates an.
- Lokal: `npm run android:sync`, dann `npm run android:open` (Android Studio).
- **Signierschlüssel:** liegt in `~/.lorebook/` (`release.jks`, `keystore.properties`) und als GitHub-Secrets. Einmalig angelegt mit `bash scripts/setup-signing.sh`. **Nicht löschen** – ohne ihn lassen sich Updates nicht über die installierte App installieren.
- Icons: Quellen in `assets/`, erzeugt mit `npx @capacitor/assets generate --android`. Web-Icons in `public/` (`@vite-pwa/assets-generator`).

## Backend (Supabase)

Projekt `lorebook` (`pvzzxmwtaokcefkuyevn`, Frankfurt).

- Tabelle `public.records(user_id, tbl, id, data jsonb, deleted, updated_at)` mit RLS (nur eigene Zeilen). Trigger `records_lww`: ältere Stände (`data._ts`) überschreiben keine neueren.
- Funktion `delete_own_account()`: löscht den eigenen Account samt Daten („Account löschen“ in der App).
- Sync (`src/lib/sync.ts`): lokale Änderungen bekommen `_ts`, werden hochgeladen; Abholen per `updated_at`; Löschungen als Tombstones. XP und Lerntage pro Gerät, damit nichts verloren geht.
- Auth-Einstellungen im Dashboard: Site URL `https://lorebook-9yf.pages.dev`, E-Mail-Bestätigung an. „Allow new users to sign up“ abschalten, wenn niemand sonst sich registrieren soll.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `src/lib/schema.ts` | Datenformat (zod) – muss zu den Prompts passen |
| `src/lib/prompts.ts` | Prompt Gliederung, Prompt A (Erzeugen), Prompt B (Prüfen) |
| `src/lib/importer.ts` | JSON aus Chat-Antwort holen, validieren, Korrekturanweisung erzeugen |
| `src/lib/srs.ts` | FSRS-Wiederholung (ts-fsrs) |
| `src/lib/courses.ts` | Import, Antwortprüfung, Boss-Fight |
| `src/lib/db.ts` | IndexedDB (Dexie), Sync-Hooks |
| `src/lib/sync.ts`, `supabase.ts` | Account und Synchronisierung |
| `src/lib/platform.ts` | Web oder Android-App, öffentliche URL |
| `src/lib/reminders.ts` | Tägliche Erinnerung (nur App, lokale Benachrichtigungen) |
| `src/lib/i18n.ts` | Deutsch/Englisch: `tr('Deutsch', 'English')`, Umschalter oben (pro Gerät gespeichert) |
| `src/lib/demo.ts` | Demo-Kapitel (deutsch und englisch) |
| `src/pages/*` | Oberfläche |

Ändert sich das Format, müssen `FORMAT_VERSION`, Schema und Prompts gemeinsam angepasst werden.

## Format (Kurzfassung)

```jsonc
{
  "lorebook": 1,
  "course": { "title": "…", "source": "…" },
  "chapter": {
    "number": 1, "title": "…", "pages": [3, 17],
    "objectives": [{ "id": "o1", "text": "…", "source": { "page": 5, "quote": "…" } }],
    "pretest":  [/* Fragen */],
    "story": { "title": "…", "setting": "…", "scenes": [{ "objective": "o1", "title": "…", "text": "…", "concept": "…" }], "ending": "…" },
    "posttest": [/* Fragen */],
    "review":   [/* Fragen */]
  },
  "verified": false,
  "verificationNotes": []
}
```

Fragetypen: `mc` (`options`, `correct`), `cloze` (`___` im `prompt`, `answers`), `open` (`modelAnswer`, `rubric`). Jede Frage hat `id`, `objective`, `level` (`remember|understand|apply|transfer`), `explanation` und `source`.

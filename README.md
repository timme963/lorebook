# Lorebook

Lernen mit **Vorabfragen → Story → Nachfragen → Spaced Repetition**, pro Kapitel und mit einem Boss-Fight für den ganzen Kurs.

Lorebook ruft selbst keine KI auf. Du lädst dein PDF bei Claude, ChatGPT oder Gemini hoch, nimmst dazu den fertigen Prompt aus der App und fügst die Antwort (JSON) wieder ein. Die App zeigt die Inhalte an, fragt ab und plant die Wiederholungen.

- **Kein Server, kein Account, keine Kosten.** Alle Daten (Kurse, PDFs, Fortschritt) liegen in IndexedDB im Browser.
- **PWA:** installierbar, Wiederholungen funktionieren offline.
- **Korrektheit:** Zu jeder Frage gibt es Zitat und PDF-Seite. Prompt B prüft die erzeugten Inhalte in einem zweiten Chat gegen das PDF. Falsche Fragen lassen sich melden und kommen dann nicht mehr in die Wiederholung.

## Entwicklung

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # Unit-Tests (Import-Validierung, Bewertung, Serie, Boss)
npm run build
npm run deploy    # Build + Cloudflare (Worker mit statischen Dateien, Projekt "lorebook")
```

## Aufbau

| Pfad | Inhalt |
|---|---|
| `src/lib/schema.ts` | Datenformat (zod) – muss zu den Prompts passen |
| `src/lib/prompts.ts` | Prompt Gliederung, Prompt A (Erzeugen), Prompt B (Prüfen) |
| `src/lib/importer.ts` | JSON aus Chat-Antwort holen, validieren, Korrekturanweisung erzeugen |
| `src/lib/srs.ts` | FSRS-Wiederholung (ts-fsrs) |
| `src/lib/courses.ts` | Import, Antwortprüfung, Boss-Fight |
| `src/lib/db.ts` | IndexedDB (Dexie) |
| `src/lib/demo.ts` | Demo-Kapitel |
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

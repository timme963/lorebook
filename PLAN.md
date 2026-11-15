# Lorebook – Plan

## Entscheidung (15.11.2026)
Die App erzeugt selbst nichts und nutzt keine API. Inhalte entstehen beim Nutzer in seinem eigenen Claude, ChatGPT oder Gemini, über vorgegebene Prompts. Die App ist eine reine Website (PWA): Sie zeigt an, fragt ab und plant die Wiederholungen. Alle Daten bleiben im Browser.

**Warum:** keine laufenden Kosten, kein Server, kein Account-System, kein Datenschutzproblem mit Kurs-PDFs.

## Lernzyklus pro Kapitel
1. **Vorabfragen** ohne Auflösung (Pretesting)
2. **Story**: eine Szene pro Lernziel, danach jeweils „Was steckt dahinter?“ mit Fachbegriff und Quelle
3. **Nachfragen** zu denselben Lernzielen mit Auflösung, Vergleich vorher/nachher pro Lernziel
4. **Wiederholung** aller Fragen mit FSRS
5. **Boss-Fight** über alle Kapitel, wenn der Kurs abgeschlossen ist (Schwerpunkt Anwendung/Transfer, besiegt ab 70 %)

## Korrektheit
- Prompt A erzeugt die Inhalte, jedes Lernziel und jede Frage mit wörtlichem Zitat und PDF-Seite
- Prompt B prüft in einem neuen Chat jede Frage gegen das PDF, korrigiert, setzt `verified: true` und schreibt Prüfnotizen
- Die App validiert Format und Querverweise und warnt bei weniger als 30 % Transferfragen oder fehlender Prüfung
- „📖 Quelle“ zeigt Zitat und Originalseite (PDF optional pro Kurs hinterlegen); „⚑ melden“ nimmt eine Frage aus der Wiederholung

## Stand
- [x] Format + Prompts (Gliederung, A, B)
- [x] Import mit Validierung und Korrekturanweisung
- [x] Kapitel-Ablauf, Story, Ergebnis
- [x] FSRS-Wiederholung mit Bewertung, Melden
- [x] Boss-Fight, XP/Level, sanfte Serie (1 Tag Pause erlaubt), Quest-Karte
- [x] PDF-Quellenansicht, Prüfungstermin, Export/Import, PWA/offline
- [x] Deployment auf Cloudflare: https://lorebook-9yf.pages.dev

## Als Nächstes
1. **Prompts an einer echten Kurseinheit testen** (das ist der wichtigste Schritt): jede Frage von Hand bewerten, Prompts nachschärfen, bis über 95 % korrekt sind
2. Nach 2–3 Wochen Nutzung prüfen: Sitzen die Inhalte in der Wiederholung besser als beim bisherigen Lernen?
3. Optional später: Wiederholungsplan auf den Prüfungstermin ausrichten, Statistik-Seite

---

# Erweiterung: Accounts & Sync (Plan, 15.11.2026)

## Ziel
Daten sollen nicht verschwinden, wenn der Browser-Speicher gelöscht wird, und auf Laptop und Handy gleich sein.

## Grundprinzip: lokal zuerst, Cloud als Sicherung
- **IndexedDB bleibt die Hauptquelle.** Die App liest und schreibt weiter lokal und funktioniert offline genauso wie jetzt.
- **Der Account ist optional.** Ohne Login bleibt alles wie bisher. Mit Login wird im Hintergrund synchronisiert.
- **Die Inhaltserzeugung ändert sich nicht.** Weiterhin keine API und keine KI-Kosten. Der Server speichert nur, was du importierst und lernst.

## Technik: Supabase (Empfehlung)
| | Supabase | Cloudflare (D1 + R2 + Worker) |
|---|---|---|
| Login | fertig (E-Mail-Link, Google) | selbst bauen (z. B. Better Auth) |
| Datenbank + Zugriffsschutz | Postgres + Row Level Security, direkt aus dem Browser | eigener Worker mit API-Code |
| Dateien (PDFs) | Storage, 1 GB frei | R2, 10 GB frei |
| Eigener Servercode | praktisch keiner | API, Auth, Validierung |
| Haken | Free-Projekte pausieren nach 7 Tagen ohne Zugriff (manuell wieder starten) | mehr Code, mehr Wartung |

**Empfehlung Supabase**, Region Frankfurt (EU). Die Website bleibt auf Cloudflare Pages und spricht direkt mit Supabase. Die Pause nach 7 Tagen trifft dich nur in langen Lernpausen. Dann ist das Projekt mit einem Klick wieder an, und lokal lernst du ohnehin weiter.

## Datenmodell (Server)
Jede Tabelle hat `user_id`, `updated_at`, `deleted` (weiches Löschen für Sync). RLS: Jeder sieht nur die eigenen Zeilen.
```
courses       (id, user_id, title, source, exam_date, updated_at, deleted)
chapters      (id, user_id, course_id, number, content jsonb, verified, notes,
               phase, scene_index, pre_answers jsonb, post_answers jsonb,
               pre_score, post_score, completed_at, updated_at, deleted)
cards         (id, user_id, chapter_id, question_id, fsrs jsonb, due,
               suspended, flagged, updated_at, deleted)
reviews       (id uuid, user_id, card_id, rating, at)          -- nur anhängen
xp_events     (id uuid, user_id, amount, reason, at)           -- nur anhängen
boss_results  (course_id, user_id, best, last, attempts, updated_at)
pdfs          → privater Storage-Bucket  {user_id}/{course_id}.pdf (optional)
```

## Sync-Logik (der eigentliche Kern)
1. **Ausgang:** Jede lokale Änderung landet zusätzlich in einer Warteschlange (`outbox`) in IndexedDB. Online wird sie gebündelt hochgeladen, offline wartet sie.
2. **Eingang:** Abholen aller Zeilen mit `updated_at` > letzter Sync-Zeitpunkt. Beim App-Start, beim Zurückkehren in den Tab und alle paar Minuten.
3. **Konflikte (gleiche Karte auf zwei Geräten geändert):**
   - Karten: Die Wiederholung mit dem späteren `last_review` gewinnt.
   - Kapitel-Fortschritt: Der weiter fortgeschrittene Stand gewinnt (`done` > `posttest` > `story` …).
   - Sonst: die zuletzt geänderte Zeile gewinnt.
   - `reviews` und `xp_events` werden nur angehängt, daher gibt es dort keine Konflikte. **XP und Serie werden aus den Ereignissen berechnet** statt als Zähler gespeichert, damit auf zwei Geräten nichts verloren geht.
4. **Erster Login:** vorhandene Browser-Daten hochladen und mit dem Account zusammenführen. Bei einem bereits befüllten Account fragt die App vorher nach: zusammenführen oder Account-Stand übernehmen.

## Datenschutz & Recht
- Kursinhalte enthalten Zitate aus geschützten Kurstexten. Sie bleiben privat pro Account, es gibt keine Teilen-Funktion.
- **Account löschen** (inkl. aller Daten und PDFs) direkt in der App.
- Solange nur du die App nutzt, reicht das. **Bevor andere sich registrieren:** Impressum, Datenschutzerklärung, Auftragsverarbeitungsvertrag (AVV) mit Supabase.
- PDFs in die Cloud laden ist Opt-in pro Kurs. Standard: Das PDF bleibt nur auf dem Gerät.

## Bonus: echte Erinnerungen
Mit Sync kennt der Server die Fälligkeitstermine. Damit sind echte Push-Benachrichtigungen möglich: „12 Karten fällig“, täglich zur gewünschten Uhrzeit (Supabase Cron + Edge Function + Web Push). Auf dem iPhone geht das nur mit der installierten App (ab iOS 16.4).

## Phasen
| # | Inhalt | Aufwand (Schätzung) |
|---|---|---|
| 1 | Supabase-Projekt (EU), Schema, RLS, Typen | ½ Wochenende |
| 2 | Login (E-Mail-Link), Account-Seite, Abmelden | ½ Wochenende |
| 3 | Sync: Warteschlange, Abholen, Konfliktregeln, XP aus Ereignissen, erster Login | 1–1½ Wochenenden |
| 4 | Tests: zwei Geräte, offline lernen, Konflikte, Löschen | ½ Wochenende |
| 5 | PDFs in Storage (Opt-in), Account löschen | ½ Wochenende |
| 6 | Push-Erinnerungen | 1 Wochenende |

**Gesamt ca. 3–4 Wochenenden**, Phase 6 optional. Phase 3 ist das Risiko: Fehler im Sync bedeuten verlorenen Fortschritt. Deshalb bleibt der Export als Sicherung, und vor dem ersten Sync wird automatisch eine lokale Sicherung angelegt.

## Offene Entscheidungen
- Supabase oder komplett Cloudflare?
- Login nur per E-Mail-Link oder zusätzlich mit Google?
- Nur für dich oder von Anfang an für andere (dann Rechtliches vorziehen)?
- PDFs in die Cloud: ja (Opt-in) oder nie?

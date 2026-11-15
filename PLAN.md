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
3. Optional später: Abgleich zwischen Geräten, Wiederholungsplan auf den Prüfungstermin ausrichten, Statistik-Seite

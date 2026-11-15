import { FORMAT_VERSION } from './schema';

export interface PromptVars {
  course: string;
  chapterNumber: string;
  chapterTitle: string;
  style: string;
}

export const STORY_STYLES = [
  'Krimi',
  'Fantasy-Abenteuer',
  'Science-Fiction',
  'Alltag im Büro/Studium',
  'Historischer Roman',
  'Heist (Coup-Planung)',
];

const EXAMPLE = `{
  "lorebook": ${FORMAT_VERSION},
  "course": { "title": "…", "source": "Dateiname oder Titel des PDFs" },
  "chapter": {
    "number": 1,
    "title": "…",
    "pages": [3, 17],
    "objectives": [
      { "id": "o1", "text": "Lernziel als ganzer Satz", "source": { "page": 5, "quote": "wörtliches Zitat aus dem PDF" } }
    ],
    "pretest": [ /* Fragen, siehe Fragetypen */ ],
    "story": {
      "title": "…",
      "setting": "2–3 Sätze: Ort, Hauptfigur, Konflikt",
      "scenes": [
        { "objective": "o1", "title": "…", "text": "Szene (120–250 Wörter)", "concept": "Fachliche Erklärung in 2–4 Sätzen" }
      ],
      "ending": "Auflösung (60–150 Wörter)"
    },
    "posttest": [ /* Fragen */ ],
    "review": [ /* Fragen */ ]
  },
  "verified": false,
  "verificationNotes": []
}`;

const QUESTION_TYPES = `Multiple Choice:
{ "id": "q1", "objective": "o1", "level": "understand", "type": "mc",
  "prompt": "Frage", "options": ["A", "B", "C", "D"], "correct": 2,
  "explanation": "Warum C stimmt und warum A, B, D falsch sind",
  "source": { "page": 5, "quote": "wörtliches Zitat, das die Antwort belegt" } }

Lückentext (Platzhalter ___ genau einmal im prompt):
{ "id": "q2", "objective": "o1", "level": "remember", "type": "cloze",
  "prompt": "Satz mit ___ als Lücke", "answers": ["Begriff", "Synonym"],
  "explanation": "…", "source": { "page": 5, "quote": "…" } }

Offene Frage (auch für Transfer):
{ "id": "q3", "objective": "o2", "level": "transfer", "type": "open",
  "prompt": "Neues Szenario + Frage", "modelAnswer": "Musterantwort",
  "rubric": ["Kernpunkt 1", "Kernpunkt 2"],
  "explanation": "…", "source": { "page": 9, "quote": "…" } }

"level" ist eines von: "remember", "understand", "apply", "transfer".`;

export function outlinePrompt(): string {
  return `Ich habe dir ein PDF mit Lernmaterial hochgeladen. Erstelle eine Gliederung der Kapitel bzw. großen Abschnitte, die sich jeweils als Lerneinheit von 20–40 Minuten eignen.

Gib pro Kapitel eine Zeile aus im Format:
Nummer | Titel | PDF-Seite von–bis

Wichtig: Seitenzahlen sind die PDF-Seiten, wie sie ein PDF-Viewer zählt (erste Seite der Datei = 1), nicht die gedruckten Seitenzahlen. Keine weiteren Erklärungen.`;
}

export function generatePrompt(v: PromptVars): string {
  const style = v.style.trim() || 'frei wählbar, passend zum Thema';
  return `Du bist ein erfahrener Didaktiker und Autor. Ich habe dir ein PDF mit Lernmaterial hochgeladen. Erstelle daraus eine Lerneinheit für die App "Lorebook".

KURS: ${v.course || '(Titel des PDFs)'}
KAPITEL: ${v.chapterNumber || '?'} – ${v.chapterTitle || '(siehe PDF)'}
STORY-STIL: ${style}

Bearbeite NUR dieses Kapitel. Nutze ausschließlich Inhalte aus dem PDF – kein Zusatzwissen, keine erfundenen Fakten. Schreibe in der Sprache des PDFs.

## Ablauf in der App
1. Vorabfragen ("pretest"): Der Lernende rät, bevor er etwas liest (Pretesting-Effekt).
2. Story ("story"): erklärt die Inhalte als Geschichte.
3. Nachfragen ("posttest"): prüfen dieselben Lernziele mit anderen Fragen.
4. Wiederholung: alle Fragen gehen in Spaced Repetition, zusätzlich "review".

## Regeln
**Lernziele ("objectives")**: 4–8 Stück, IDs "o1", "o2", … Jedes mit wörtlichem Zitat (max. 2 Sätze, exakt wie im PDF) und PDF-Seitenzahl.

**Seitenzahlen**: immer PDF-Seiten, wie ein PDF-Viewer zählt (erste Seite der Datei = 1), nicht die gedruckten Seitenzahlen. "pages" = erste und letzte PDF-Seite des Kapitels.

**Story**:
- Eine durchgehende Handlung mit Hauptfigur, Konflikt und Auflösung.
- JEDE Szene behandelt GENAU EIN Lernziel (Feld "objective"). Jedes Lernziel bekommt mindestens eine Szene, in der Reihenfolge des Kapitels.
- Das Konzept muss die Handlung vorantreiben: Die Figur löst ein Problem, WEIL sie das Konzept versteht oder anwendet. Keine Ausschmückungen, die mit dem Stoff nichts zu tun haben.
- Fachbegriffe kommen in der Szene vor und werden durch die Handlung verständlich.
- "concept": nüchterne, fachlich exakte Erklärung des Lernziels in 2–4 Sätzen, mit den Fachbegriffen aus dem PDF.
- Die Story darf nichts fachlich Falsches enthalten. Vereinfachungen nur, wenn sie korrekt bleiben.

**Fragen**:
- "pretest": 3–5 Fragen (nur "mc" oder "cloze"), verständlich auch ohne Vorwissen.
- "posttest": 4–8 Fragen zu denselben Lernzielen, aber anders formuliert und nicht identisch mit den Vorabfragen.
- "review": 8–15 zusätzliche Fragen für die Wiederholung, gemischt.
- Mindestens 30 % aller Fragen haben "level" "apply" oder "transfer".
- Transfer = ein NEUES Szenario aus einem anderen Lebens- oder Fachbereich, nicht aus der Story und nicht aus den Beispielen im PDF. Die Antwort muss zwingend aus dem Konzept folgen, nicht nur plausibel sein.
- Multiple Choice: 4 Optionen, genau eine richtig, Ablenker aus typischen Missverständnissen. Position der richtigen Antwort variieren ("correct" ist der Index ab 0).
- Jede Frage hat "explanation" und "source" mit wörtlichem Zitat, das die Antwort belegt.
- Frage-IDs eindeutig über alle Listen: "q1", "q2", …
- Wenn du dir bei einer Frage nicht sicher bist, lass sie weg.

## Fragetypen
${QUESTION_TYPES}

## Ausgabeformat
Gib AUSSCHLIESSLICH ein JSON-Objekt in einem einzigen \`\`\`json-Codeblock aus, ohne Text davor oder danach:

${EXAMPLE}

"verified" bleibt false. Wenn die Antwort zu lang wird und abbricht, setze nach "weiter" exakt an der Abbruchstelle fort.`;
}

export function verifyPrompt(): string {
  return `Du bist ein strenger Fachprüfer. Ich gebe dir (1) ein PDF mit Lernmaterial und (2) unten eine Lerneinheit im JSON-Format, die ein anderes KI-Modell daraus erzeugt hat. Prüfe sie Punkt für Punkt gegen das PDF und korrigiere sie.

## Prüfe
1. Jedes Zitat ("quote") steht wörtlich auf der angegebenen PDF-Seite (erste Seite der Datei = 1). Falsche Seite → korrigieren. Zitat nicht auffindbar → durch echtes Zitat ersetzen oder Element entfernen.
2. Jede Musterlösung ist durch das Zitat bzw. das PDF gedeckt.
3. Multiple Choice: genau EINE Option ist richtig, "correct" zeigt auf sie, keine Option ist "auch irgendwie richtig".
4. Lückentext: alle in "answers" genannten Begriffe passen, wichtige Synonyme fehlen nicht.
5. Transferfragen: Die Musterantwort folgt ZWINGEND aus dem Konzept. Nur plausibel oder strittig → umformulieren oder entfernen.
6. Story und "concept"-Texte enthalten keine fachlich falschen oder irreführenden Aussagen.
7. Jede Szene behandelt genau das Lernziel aus "objective".

## Regeln für Änderungen
- Behalte alle IDs. Wenn du eine Frage entfernst, stelle sicher, dass "pretest" und "posttest" jeweils mindestens eine Frage behalten.
- Erfinde nichts, was nicht im PDF steht.
- Setze "verified" auf true.
- Schreibe in "verificationNotes" eine kurze Liste aller Änderungen (z. B. "q7 entfernt: zwei Optionen richtig", "o3: Seite 12 → 13"). Keine Änderungen nötig → ["Keine Beanstandungen"].

## Ausgabe
Gib AUSSCHLIESSLICH das komplette korrigierte JSON in einem einzigen \`\`\`json-Codeblock aus, ohne Text davor oder danach. Format und Feldnamen exakt beibehalten.

## Lerneinheit
[HIER DAS JSON AUS DEM ERSTEN SCHRITT EINFÜGEN]`;
}

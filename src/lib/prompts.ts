import { tr } from './i18n';
import { FORMAT_VERSION } from './schema';

export interface PromptVars {
  course: string;
  chapterNumber: string;
  chapterTitle: string;
  /** empty = the AI picks a fitting genre */
  style: string;
}

export interface StoryStyle {
  /** Value inserted into the prompt ('' = the AI picks) */
  value: string;
  label: string;
  /** What the style suits well */
  fits: string;
}

/** Story style suggestions. A custom style is always possible. */
export const STORY_STYLES = (): StoryStyle[] => [
  {
    value: '',
    label: tr('✨ Passend zum Stoff', '✨ Fits the material'),
    fits: tr(
      'Die KI wählt das Genre, das den Inhalt am besten trägt.',
      'The AI picks the genre that carries the content best.',
    ),
  },
  {
    value: tr('Mentor und Lehrling', 'Mentor and apprentice'),
    label: tr('Mentor & Lehrling', 'Mentor & apprentice'),
    fits: tr('Methoden, Lerntechniken, Soft Skills, Pädagogik', 'methods, study skills, soft skills, education'),
  },
  {
    value: tr('Start-up-Gründung', 'Start-up founding'),
    label: tr('Start-up', 'Start-up'),
    fits: tr(
      'BWL, Kostenrechnung, Marketing, VWL, Management',
      'business, accounting, marketing, economics, management',
    ),
  },
  {
    value: tr('Krimi / Ermittlung', 'Crime / investigation'),
    label: tr('Krimi', 'Crime'),
    fits: tr('Ursachen finden, Diagnose, Fehlersuche, Statistik', 'finding causes, diagnosis, debugging, statistics'),
  },
  {
    value: tr('Gerichtsdrama', 'Courtroom drama'),
    label: tr('Gerichtsdrama', 'Courtroom drama'),
    fits: tr('Jura, Argumentation, Ethik, Abwägungen', 'law, argumentation, ethics, trade-offs'),
  },
  {
    value: tr('Krankenhausserie', 'Hospital drama'),
    label: tr('Krankenhaus', 'Hospital'),
    fits: tr('Psychologie, Medizin, Biologie, Pflege', 'psychology, medicine, biology, nursing'),
  },
  {
    value: tr('Heist (Coup-Planung)', 'Heist (planning the job)'),
    label: 'Heist',
    fits: tr('Abläufe, Planung, Projektmanagement, Algorithmen', 'processes, planning, project management, algorithms'),
  },
  {
    value: tr('Expedition / Abenteuer', 'Expedition / adventure'),
    label: tr('Expedition', 'Expedition'),
    fits: tr(
      'Schritt-für-Schritt-Verfahren, Naturwissenschaften, Geografie',
      'step-by-step procedures, natural sciences, geography',
    ),
  },
  {
    value: tr('Science-Fiction auf einer Raumstation', 'Science fiction on a space station'),
    label: 'Sci-Fi',
    fits: tr('Physik, Technik, Informatik, Systeme', 'physics, engineering, computer science, systems'),
  },
  {
    value: tr(
      'Fantasy mit Magiesystem, dessen Regeln dem Stoff entsprechen',
      'Fantasy with a magic system whose rules mirror the material',
    ),
    label: 'Fantasy',
    fits: tr('abstrakte Regeln: Mathe, Logik, Grammatik, Formeln', 'abstract rules: maths, logic, grammar, formulas'),
  },
  {
    value: tr('Zeitreise / Historischer Roman', 'Time travel / historical novel'),
    label: tr('Zeitreise', 'Time travel'),
    fits: tr('Geschichte, Theorien mit Entstehungsgeschichte', 'history, theories and how they came about'),
  },
  {
    value: tr('Strategie und Verhandlung', 'Strategy and negotiation'),
    label: tr('Strategie', 'Strategy'),
    fits: tr('Spieltheorie, Politik, Verhandlung, Führung', 'game theory, politics, negotiation, leadership'),
  },
];

// ---------------------------------------------------------------- German

const EXAMPLE_DE = `{
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

const QUESTION_TYPES_DE = `Multiple Choice:
{ "id": "q1", "objective": "o1", "level": "understand", "type": "mc",
  "prompt": "Frage", "options": ["A", "B", "C", "D"], "correct": 2,
  "explanation": "Warum C stimmt und warum A, B, D falsch sind",
  "source": { "page": 5, "quote": "wörtliches Zitat, das die Antwort belegt" } }

Multiple Choice mit Mehrfachauswahl ("correct" als Liste):
{ "id": "q4", "objective": "o1", "level": "understand", "type": "mc",
  "prompt": "Welche Aussagen treffen zu?", "options": ["A", "B", "C", "D"], "correct": [0, 2],
  "explanation": "A und C stimmen, weil …; B und D sind falsch, weil …",
  "source": { "page": 5, "quote": "…" } }

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

function outlineDe(): string {
  return `Ich habe dir ein PDF mit Lernmaterial hochgeladen. Erstelle eine Gliederung der Kapitel bzw. großen Abschnitte, die sich jeweils als Lerneinheit von 20–40 Minuten eignen.

Gib pro Kapitel eine Zeile aus im Format:
Nummer | Titel | PDF-Seite von–bis

Wichtig: Seitenzahlen sind die PDF-Seiten, wie sie ein PDF-Viewer zählt (erste Seite der Datei = 1), nicht die gedruckten Seitenzahlen. Keine weiteren Erklärungen.`;
}

function generateDe(v: PromptVars): string {
  const style = v.style.trim()
    ? v.style.trim()
    : 'Wähle selbst das Genre, das diesen Stoff am besten trägt (z. B. Start-up für BWL, Gerichtsdrama für Jura, Krankenhaus für Psychologie, Fantasy mit Magiesystem für Mathe/Logik). Hauptsache, die Handlung entsteht aus den Konzepten.';
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
- Multiple Choice: 4–5 Optionen, Ablenker aus typischen Missverständnissen. Zwei Formen mischen:
  - Einfachauswahl: "correct" ist eine Zahl, genau eine Option ist richtig.
  - Mehrfachauswahl: "correct" ist eine Liste, z. B. [0, 2]. Es dürfen 1 bis alle Optionen richtig sein; der Lernende sieht nur „mehrere Antworten möglich“, nicht wie viele. Etwa ein Drittel der Multiple-Choice-Fragen so stellen, vor allem bei Aufzählungen, Merkmalen, Voraussetzungen und Abgrenzungen.
  - Jede Option muss für sich eindeutig richtig oder falsch sein. Position der richtigen Antworten variieren ("correct" zählt ab 0). "explanation" begründet jede Option.
- Jede Frage hat "explanation" und "source" mit wörtlichem Zitat, das die Antwort belegt.
- Frage-IDs eindeutig über alle Listen: "q1", "q2", …
- Wenn du dir bei einer Frage nicht sicher bist, lass sie weg.

**Formeln**: Mathematische Ausdrücke als LaTeX, im Fließtext zwischen \\( und \\), abgesetzt zwischen \\[ und \\]. Im JSON muss jeder Backslash verdoppelt werden, z. B. "\\\\(K_0 = \\\\frac{K_n}{(1+i)^n}\\\\)". Kein $ als Formelzeichen (Geldbeträge ganz normal schreiben). Ausnahmen: "quote" bleibt wörtlich wie im PDF, und "answers" bei Lückentexten enthält nur tippbare Begriffe oder Zahlen, kein LaTeX.

## Fragetypen
${QUESTION_TYPES_DE}

## Ausgabeformat
Gib AUSSCHLIESSLICH ein JSON-Objekt in einem einzigen \`\`\`json-Codeblock aus, ohne Text davor oder danach:

${EXAMPLE_DE}

"verified" bleibt false. Wenn die Antwort zu lang wird und abbricht, setze nach "weiter" exakt an der Abbruchstelle fort.`;
}

function verifyDe(): string {
  return `Du bist ein strenger Fachprüfer. Ich gebe dir (1) ein PDF mit Lernmaterial und (2) unten eine Lerneinheit im JSON-Format, die ein anderes KI-Modell daraus erzeugt hat. Prüfe sie Punkt für Punkt gegen das PDF und korrigiere sie.

## Prüfe
1. Jedes Zitat ("quote") steht wörtlich auf der angegebenen PDF-Seite (erste Seite der Datei = 1). Falsche Seite → korrigieren. Zitat nicht auffindbar → durch echtes Zitat ersetzen oder Element entfernen.
2. Jede Musterlösung ist durch das Zitat bzw. das PDF gedeckt.
3. Multiple Choice: Bei einer Zahl in "correct" ist genau EINE Option richtig. Bei einer Liste sind genau die gelisteten Optionen richtig und alle anderen eindeutig falsch. Keine Option ist "auch irgendwie richtig".
4. Lückentext: alle in "answers" genannten Begriffe passen, wichtige Synonyme fehlen nicht.
5. Transferfragen: Die Musterantwort folgt ZWINGEND aus dem Konzept. Nur plausibel oder strittig → umformulieren oder entfernen.
6. Story und "concept"-Texte enthalten keine fachlich falschen oder irreführenden Aussagen.
7. Jede Szene behandelt genau das Lernziel aus "objective".
8. Formeln sind fachlich richtig und als LaTeX zwischen \\( \\) bzw. \\[ \\] geschrieben, mit verdoppelten Backslashes im JSON.

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

// ---------------------------------------------------------------- English

const EXAMPLE_EN = `{
  "lorebook": ${FORMAT_VERSION},
  "course": { "title": "…", "source": "file name or title of the PDF" },
  "chapter": {
    "number": 1,
    "title": "…",
    "pages": [3, 17],
    "objectives": [
      { "id": "o1", "text": "Learning objective as a full sentence", "source": { "page": 5, "quote": "verbatim quote from the PDF" } }
    ],
    "pretest": [ /* questions, see question types */ ],
    "story": {
      "title": "…",
      "setting": "2–3 sentences: place, protagonist, conflict",
      "scenes": [
        { "objective": "o1", "title": "…", "text": "Scene (120–250 words)", "concept": "Precise explanation in 2–4 sentences" }
      ],
      "ending": "Resolution (60–150 words)"
    },
    "posttest": [ /* questions */ ],
    "review": [ /* questions */ ]
  },
  "verified": false,
  "verificationNotes": []
}`;

const QUESTION_TYPES_EN = `Multiple choice:
{ "id": "q1", "objective": "o1", "level": "understand", "type": "mc",
  "prompt": "Question", "options": ["A", "B", "C", "D"], "correct": 2,
  "explanation": "Why C is right and why A, B, D are wrong",
  "source": { "page": 5, "quote": "verbatim quote that supports the answer" } }

Multiple choice with multiple answers ("correct" as a list):
{ "id": "q4", "objective": "o1", "level": "understand", "type": "mc",
  "prompt": "Which statements are true?", "options": ["A", "B", "C", "D"], "correct": [0, 2],
  "explanation": "A and C are true because …; B and D are wrong because …",
  "source": { "page": 5, "quote": "…" } }

Cloze (placeholder ___ exactly once in the prompt):
{ "id": "q2", "objective": "o1", "level": "remember", "type": "cloze",
  "prompt": "Sentence with ___ as the gap", "answers": ["term", "synonym"],
  "explanation": "…", "source": { "page": 5, "quote": "…" } }

Open question (also for transfer):
{ "id": "q3", "objective": "o2", "level": "transfer", "type": "open",
  "prompt": "New scenario + question", "modelAnswer": "Model answer",
  "rubric": ["Key point 1", "Key point 2"],
  "explanation": "…", "source": { "page": 9, "quote": "…" } }

"level" is one of: "remember", "understand", "apply", "transfer".`;

function outlineEn(): string {
  return `I have uploaded a PDF with study material. Create an outline of the chapters or major sections, each suitable as a 20–40 minute study unit.

Output one line per chapter in the format:
Number | Title | PDF page from–to

Important: page numbers are PDF pages as a PDF viewer counts them (first page of the file = 1), not the printed page numbers. No further explanations.`;
}

function generateEn(v: PromptVars): string {
  const style = v.style.trim()
    ? v.style.trim()
    : 'Choose the genre that carries this material best (e.g. start-up for business, courtroom drama for law, hospital for psychology, fantasy with a magic system for maths/logic). What matters is that the plot grows out of the concepts.';
  return `You are an experienced instructional designer and author. I have uploaded a PDF with study material. Turn it into a learning unit for the app "Lorebook".

COURSE: ${v.course || '(title of the PDF)'}
CHAPTER: ${v.chapterNumber || '?'} – ${v.chapterTitle || '(see PDF)'}
STORY STYLE: ${style}

Work on THIS chapter ONLY. Use only content from the PDF – no outside knowledge, no invented facts. Write in the language of the PDF.

## Flow in the app
1. Pre-questions ("pretest"): the learner guesses before reading anything (pretesting effect).
2. Story ("story"): explains the content as a story.
3. Post-questions ("posttest"): test the same objectives with different questions.
4. Review: all questions go into spaced repetition, plus "review".

## Rules
**Objectives ("objectives")**: 4–8, IDs "o1", "o2", … Each with a verbatim quote (max. 2 sentences, exactly as in the PDF) and the PDF page number.

**Page numbers**: always PDF pages as a PDF viewer counts them (first page of the file = 1), not the printed page numbers. "pages" = first and last PDF page of the chapter.

**Story**:
- One continuous plot with a protagonist, conflict and resolution.
- EACH scene covers EXACTLY ONE objective (field "objective"). Every objective gets at least one scene, in the order of the chapter.
- The concept must drive the plot: the character solves a problem BECAUSE they understand or apply the concept. No embellishments unrelated to the material.
- Technical terms appear in the scene and become clear through the plot.
- "concept": a sober, technically exact explanation of the objective in 2–4 sentences, using the terms from the PDF.
- The story must not contain anything technically wrong. Simplify only where it stays correct.

**Questions**:
- "pretest": 3–5 questions ("mc" or "cloze" only), understandable without prior knowledge.
- "posttest": 4–8 questions on the same objectives, but phrased differently and not identical to the pre-questions.
- "review": 8–15 additional questions for review, mixed.
- At least 30 % of all questions have "level" "apply" or "transfer".
- Transfer = a NEW scenario from a different area of life or field, not from the story and not from the examples in the PDF. The answer must follow necessarily from the concept, not merely be plausible.
- Multiple choice: 4–5 options, distractors based on typical misconceptions. Mix two forms:
  - Single answer: "correct" is a number, exactly one option is correct.
  - Multiple answers: "correct" is a list, e.g. [0, 2]. Anywhere from 1 to all options may be correct; the learner only sees "more than one answer possible", not how many. Make about a third of the multiple-choice questions like this, especially for lists, characteristics, conditions and distinctions.
  - Each option must be clearly right or wrong on its own. Vary the position of the correct answers ("correct" is 0-based). "explanation" justifies every option.
- Every question has "explanation" and "source" with a verbatim quote that supports the answer.
- Question IDs unique across all lists: "q1", "q2", …
- If you are not sure about a question, leave it out.

**Formulas**: write mathematical expressions as LaTeX, inline between \\( and \\), displayed between \\[ and \\]. In JSON every backslash must be doubled, e.g. "\\\\(K_0 = \\\\frac{K_n}{(1+i)^n}\\\\)". Do not use $ as a math delimiter (write amounts of money normally). Exceptions: "quote" stays verbatim as in the PDF, and "answers" in cloze questions contain only typeable terms or numbers, no LaTeX.

## Question types
${QUESTION_TYPES_EN}

## Output format
Output ONLY one JSON object in a single \`\`\`json code block, with no text before or after:

${EXAMPLE_EN}

"verified" stays false. If the answer gets too long and is cut off, continue exactly where it stopped after I write "continue".`;
}

function verifyEn(): string {
  return `You are a strict subject-matter reviewer. I am giving you (1) a PDF with study material and (2) below a learning unit in JSON format that another AI model generated from it. Check it point by point against the PDF and correct it.

## Check
1. Every quote ("quote") appears verbatim on the stated PDF page (first page of the file = 1). Wrong page → fix it. Quote not found → replace it with a real quote or remove the item.
2. Every model answer is supported by the quote or the PDF.
3. Multiple choice: if "correct" is a number, exactly ONE option is correct. If it is a list, exactly the listed options are correct and all others clearly wrong. No option is "sort of correct too".
4. Cloze: all terms in "answers" fit, important synonyms are not missing.
5. Transfer questions: the model answer follows NECESSARILY from the concept. Merely plausible or debatable → rephrase or remove.
6. The story and "concept" texts contain no technically wrong or misleading statements.
7. Each scene covers exactly the objective in "objective".
8. Formulas are correct and written as LaTeX between \\( \\) or \\[ \\], with doubled backslashes in the JSON.

## Rules for changes
- Keep all IDs. If you remove a question, make sure "pretest" and "posttest" each keep at least one question.
- Do not invent anything that is not in the PDF.
- Set "verified" to true.
- Write a short list of all changes in "verificationNotes" (e.g. "q7 removed: two options correct", "o3: page 12 → 13"). No changes needed → ["No issues found"].

## Output
Output ONLY the complete corrected JSON in a single \`\`\`json code block, with no text before or after. Keep the format and field names exactly.

## Learning unit
[PASTE THE JSON FROM THE FIRST STEP HERE]`;
}

// ---------------------------------------------------------------- Selection by language

export const outlinePrompt = (): string => tr(outlineDe(), outlineEn());
export const generatePrompt = (v: PromptVars): string => tr(generateDe(v), generateEn(v));
export const verifyPrompt = (): string => tr(verifyDe(), verifyEn());

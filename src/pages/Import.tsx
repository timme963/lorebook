import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import CopyButton from '../components/CopyButton';
import { importChapter } from '../lib/courses';
import { db } from '../lib/db';
import { parseChapterFile, repairPrompt, type ImportResult } from '../lib/importer';
import { generatePrompt, outlinePrompt, STORY_STYLES, verifyPrompt } from '../lib/prompts';
import { go } from '../router';

const NEW = '__new__';

function PromptBox({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <div className="prompt-box">
      <div className="row between wrap gap">
        <strong>{title}</strong>
        <div className="row gap">
          <button className="btn small ghost" onClick={() => setShow((s) => !s)}>{show ? 'Ausblenden' : 'Ansehen'}</button>
          <CopyButton text={text} label="Prompt kopieren" className="btn small primary" />
        </div>
      </div>
      {children}
      {show && <pre className="prompt-text">{text}</pre>}
    </div>
  );
}

export default function ImportPage({ courseId }: { courseId?: string }) {
  const courses = useLiveQuery(() => db.courses.orderBy('title').toArray(), [], []);
  const [target, setTarget] = useState<string>(courseId ?? NEW);
  const [courseTitle, setCourseTitle] = useState('');
  const [chapterNumber, setChapterNumber] = useState('1');
  const [chapterTitle, setChapterTitle] = useState('');
  const [style, setStyle] = useState(STORY_STYLES[0]);
  const [pasted, setPasted] = useState('');
  const [result, setResult] = useState<ImportResult>();
  const [busy, setBusy] = useState(false);

  const targetCourse = courses.find((c) => c.id === target);

  // nächste freie Kapitelnummer vorschlagen
  useEffect(() => {
    if (!targetCourse) return;
    db.chapters
      .where('courseId')
      .equals(targetCourse.id)
      .toArray()
      .then((chs) => setChapterNumber(String(chs.reduce((m, c) => Math.max(m, c.number), 0) + 1)));
  }, [targetCourse]);

  const prompt = useMemo(
    () => generatePrompt({ course: targetCourse?.title ?? courseTitle, chapterNumber, chapterTitle, style }),
    [targetCourse, courseTitle, chapterNumber, chapterTitle, style],
  );

  useEffect(() => {
    if (!pasted.trim()) return setResult(undefined);
    const t = setTimeout(() => setResult(parseChapterFile(pasted)), 250);
    return () => clearTimeout(t);
  }, [pasted]);

  async function onFile(f: File | undefined) {
    if (f) setPasted(await f.text());
  }

  async function doImport() {
    if (!result?.data) return;
    setBusy(true);
    const { chapter } = await importChapter(result.data, targetCourse?.id);
    go({ name: 'chapter', id: chapter.id });
  }

  const d = result?.data;

  return (
    <div className="stack">
      <h1>Kapitel importieren</h1>

      <section className="card stack">
        <h2 className="step"><span>1</span> Kapitel festlegen</h2>
        <div className="form-grid">
          <label>
            Kurs
            <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value={NEW}>Neuer Kurs …</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </label>
          {!targetCourse && (
            <label>
              Kurstitel
              <input className="input" value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} placeholder="z. B. KE 2 – Kostenrechnung" />
            </label>
          )}
          <label>
            Kapitel-Nr.
            <input className="input" inputMode="numeric" value={chapterNumber} onChange={(e) => setChapterNumber(e.target.value)} />
          </label>
          <label>
            Kapiteltitel (wie im PDF)
            <input className="input" value={chapterTitle} onChange={(e) => setChapterTitle(e.target.value)} placeholder="z. B. 2.3 Deckungsbeitragsrechnung" />
          </label>
          <label>
            Story-Stil
            <input className="input" list="styles" value={style} onChange={(e) => setStyle(e.target.value)} />
            <datalist id="styles">
              {STORY_STYLES.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
        </div>
        <details>
          <summary>Du kennst die Kapitel und Seiten noch nicht?</summary>
          <PromptBox title="Gliederung erstellen (optional)" text={outlinePrompt()}>
            <p className="muted small">PDF hochladen, diesen Prompt dazu. Du bekommst eine Liste mit Kapiteln und Seiten.</p>
          </PromptBox>
        </details>
      </section>

      <section className="card stack">
        <h2 className="step"><span>2</span> Inhalte erzeugen lassen</h2>
        <ol className="steps-list">
          <li>Öffne einen <strong>neuen Chat</strong> in Claude, ChatGPT oder Gemini (ein Modell mit PDF-Upload; das stärkste, das du hast).</li>
          <li>Lade dein PDF hoch und füge <strong>Prompt A</strong> ein.</li>
          <li>Bricht die Antwort ab, schreibe „weiter“ und kopiere später beide Teile zusammen.</li>
        </ol>
        <PromptBox title="Prompt A – Lerneinheit erzeugen" text={prompt} />
      </section>

      <section className="card stack">
        <h2 className="step"><span>3</span> Prüfen lassen <span className="tag">empfohlen</span></h2>
        <p className="muted">
          Ein zweiter, unabhängiger Durchlauf prüft jede Frage gegen das PDF, korrigiert Seitenzahlen und entfernt Fragen ohne Beleg. Das ist dein
          Schutz gegen Halluzinationen.
        </p>
        <ol className="steps-list">
          <li>Öffne einen <strong>weiteren neuen Chat</strong> (nicht denselben!).</li>
          <li>Lade das PDF erneut hoch, füge <strong>Prompt B</strong> ein und ersetze den Platzhalter am Ende durch das JSON aus Schritt 2.</li>
        </ol>
        <PromptBox title="Prompt B – Inhalte prüfen" text={verifyPrompt()} />
      </section>

      <section className="card stack">
        <h2 className="step"><span>4</span> Ergebnis einfügen</h2>
        <textarea
          className="input mono"
          rows={8}
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onFile(e.dataTransfer.files[0]);
          }}
          placeholder="Antwort aus dem Chat hier einfügen (ganze Antwort ist ok) oder eine .json-Datei hierher ziehen"
        />
        <label className="btn small ghost file-btn">
          .json-Datei wählen
          <input type="file" accept=".json,application/json,text/plain" onChange={(e) => onFile(e.target.files?.[0])} hidden />
        </label>

        {result && !result.ok && (
          <div className="feedback bad">
            <p className="verdict">Das passt noch nicht ganz ({result.errors.length} Fehler)</p>
            <ul className="small">
              {result.errors.map((e, i) => (
                <li key={i}><code>{e}</code></li>
              ))}
            </ul>
            <p>Kopiere diese Korrekturanweisung in denselben Chat und füge die neue Antwort hier ein:</p>
            <CopyButton text={repairPrompt(result.errors)} label="Korrekturanweisung kopieren" className="btn primary" />
          </div>
        )}

        {d && (
          <div className="feedback good stack">
            <p className="verdict">
              ✓ {d.course.title} · Kapitel {d.chapter.number}: {d.chapter.title}
            </p>
            <p className="small">
              {d.chapter.objectives.length} Lernziele · {d.chapter.story.scenes.length} Szenen · {d.chapter.pretest.length} Vorabfragen ·{' '}
              {d.chapter.posttest.length} Nachfragen · {d.chapter.review.length} Wiederholungsfragen ·{' '}
              {d.verified ? <strong>geprüft</strong> : <strong>ungeprüft</strong>}
            </p>
            {targetCourse && d.course.title !== targetCourse.title && (
              <p className="small">Wird dem Kurs „{targetCourse.title}“ hinzugefügt.</p>
            )}
            {result.warnings.length > 0 && (
              <ul className="small warnings">
                {result.warnings.map((w, i) => (
                  <li key={i}>⚠ {w}</li>
                ))}
              </ul>
            )}
            <button className="btn primary" onClick={doImport} disabled={busy}>Importieren und loslegen</button>
          </div>
        )}
      </section>
    </div>
  );
}

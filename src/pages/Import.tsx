import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, type ReactNode } from 'react';
import CopyButton from '../components/CopyButton';
import { importChapter } from '../lib/courses';
import { db } from '../lib/db';
import { parseChapterFile, repairPrompt, type ImportResult } from '../lib/importer';
import { generatePrompt, outlinePrompt, STORY_STYLES, verifyPrompt } from '../lib/prompts';
import { go } from '../router';
import { tr } from '../lib/i18n';

const NEW = '__new__';

function PromptBox({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <div className="prompt-box">
      <div className="row between wrap gap">
        <strong>{title}</strong>
        <div className="row gap">
          <button className="btn small ghost" onClick={() => setShow((s) => !s)}>
            {show ? tr('Ausblenden', 'Hide') : tr('Ansehen', 'View')}
          </button>
          <CopyButton text={text} label={tr('Prompt kopieren', 'Copy prompt')} className="btn small primary" />
        </div>
      </div>
      {children}
      {show && <pre className="prompt-text">{text}</pre>}
    </div>
  );
}

function StylePicker({
  style,
  setStyle,
  custom,
  setCustom,
}: {
  style: string;
  setStyle: (s: string) => void;
  custom: boolean;
  setCustom: (b: boolean) => void;
}) {
  const styles = STORY_STYLES();
  const active = custom ? undefined : styles.find((s) => s.value === style);
  return (
    <div className="stack style-picker">
      <span className="label">{tr('Story-Stil', 'Story style')}</span>
      <div className="chips">
        {styles.map((s) => (
          <button
            key={s.label}
            type="button"
            className={`chip ${!custom && s.value === style ? 'active' : ''}`}
            title={s.fits}
            onClick={() => {
              setCustom(false);
              setStyle(s.value);
            }}
          >
            {s.label}
          </button>
        ))}
        <button
          type="button"
          className={`chip ${custom ? 'active' : ''}`}
          onClick={() => {
            setCustom(true);
            setStyle('');
          }}
        >
          {tr('✎ Eigener Stil', '✎ Your own')}
        </button>
      </div>
      {custom ? (
        <input
          className="input"
          autoFocus
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          placeholder={tr(
            'z. B. Western, Kochshow, Sitcom in einer WG, Piratenschiff …',
            'e.g. western, cooking show, flat-share sitcom, pirate ship …',
          )}
        />
      ) : (
        active && (
          <p className="muted small">
            {active.value ? `${tr('Passt gut für', 'Good for')}: ${active.fits}` : active.fits}
          </p>
        )
      )}
    </div>
  );
}

export default function ImportPage({ courseId }: { courseId?: string }) {
  const courses = useLiveQuery(() => db.courses.orderBy('title').toArray(), [], []);
  const [target, setTarget] = useState<string>(courseId ?? NEW);
  const [courseTitle, setCourseTitle] = useState('');
  const [chapterNumber, setChapterNumber] = useState('1');
  const [chapterTitle, setChapterTitle] = useState('');
  const [style, setStyle] = useState(''); // '' = the AI picks a style that fits the material
  const [customStyle, setCustomStyle] = useState(false);
  const [pasted, setPasted] = useState('');
  const [result, setResult] = useState<ImportResult>();
  const [busy, setBusy] = useState(false);
  const [importError, setImportError] = useState<string>();

  const targetCourse = courses.find((c) => c.id === target);

  // suggest the next free chapter number
  useEffect(() => {
    if (!targetCourse) return;
    void db.chapters
      .where('courseId')
      .equals(targetCourse.id)
      .toArray()
      .then((chs) => setChapterNumber(String(chs.reduce((m, c) => Math.max(m, c.number), 0) + 1)));
  }, [targetCourse]);

  const prompt = generatePrompt({ course: targetCourse?.title ?? courseTitle, chapterNumber, chapterTitle, style });

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
    setImportError(undefined);
    try {
      const { chapter } = await importChapter(result.data, targetCourse?.id);
      go({ name: 'chapter', id: chapter.id });
    } catch (e) {
      // e.g. storage full – re-enable the button instead of hanging silently
      setImportError((e as Error).message);
      setBusy(false);
    }
  }

  const d = result?.data;

  return (
    <div className="stack">
      <h1>{tr('Kapitel importieren', 'Import chapter')}</h1>

      <section className="card stack">
        <h2 className="step">
          <span>1</span> {tr('Kapitel festlegen', 'Define the chapter')}
        </h2>
        <div className="form-grid">
          <label>
            {tr('Kurs', 'Course')}
            <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value={NEW}>{tr('Neuer Kurs …', 'New course …')}</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          {!targetCourse && (
            <label>
              {tr('Kurstitel', 'Course title')}
              <input
                className="input"
                value={courseTitle}
                onChange={(e) => setCourseTitle(e.target.value)}
                placeholder={tr('z. B. KE 2 – Kostenrechnung', 'e.g. Unit 2 – Cost accounting')}
              />
            </label>
          )}
          <label>
            {tr('Kapitel-Nr.', 'Chapter no.')}
            <input
              className="input"
              inputMode="numeric"
              value={chapterNumber}
              onChange={(e) => setChapterNumber(e.target.value)}
            />
          </label>
          <label>
            {tr('Kapiteltitel (wie im PDF)', 'Chapter title (as in the PDF)')}
            <input
              className="input"
              value={chapterTitle}
              onChange={(e) => setChapterTitle(e.target.value)}
              placeholder={tr('z. B. 2.3 Deckungsbeitragsrechnung', 'e.g. 2.3 Contribution margin analysis')}
            />
          </label>
        </div>
        <StylePicker style={style} setStyle={setStyle} custom={customStyle} setCustom={setCustomStyle} />
        <details>
          <summary>
            {tr('Du kennst die Kapitel und Seiten noch nicht?', "Don't know the chapters and pages yet?")}
          </summary>
          <PromptBox
            title={tr('Gliederung erstellen (optional)', 'Create an outline (optional)')}
            text={outlinePrompt()}
          >
            <p className="muted small">
              {tr(
                'PDF hochladen, diesen Prompt dazu. Du bekommst eine Liste mit Kapiteln und Seiten.',
                'Upload the PDF and add this prompt. You get a list of chapters and pages.',
              )}
            </p>
          </PromptBox>
        </details>
      </section>

      <section className="card stack">
        <h2 className="step">
          <span>2</span> {tr('Inhalte erzeugen lassen', 'Generate the content')}
        </h2>
        <ol className="steps-list">
          {tr(
            <>
              <li>
                Öffne einen <strong>neuen Chat</strong> in Claude, ChatGPT oder Gemini (ein Modell mit PDF-Upload; das
                stärkste, das du hast).
              </li>
              <li>
                Lade dein PDF hoch und füge <strong>Prompt A</strong> ein.
              </li>
              <li>Bricht die Antwort ab, schreibe „weiter“ und kopiere später beide Teile zusammen.</li>
            </>,
            <>
              <li>
                Open a <strong>new chat</strong> in Claude, ChatGPT or Gemini (a model with PDF upload; the strongest
                one you have).
              </li>
              <li>
                Upload your PDF and paste <strong>Prompt A</strong>.
              </li>
              <li>If the answer gets cut off, write "continue" and later copy both parts together.</li>
            </>,
          )}
        </ol>
        <PromptBox
          title={tr('Prompt A – Lerneinheit erzeugen', 'Prompt A – generate the learning unit')}
          text={prompt}
        />
      </section>

      <section className="card stack">
        <h2 className="step">
          <span>3</span> {tr('Prüfen lassen', 'Have it checked')}{' '}
          <span className="tag">{tr('empfohlen', 'recommended')}</span>
        </h2>
        <p className="muted">
          {tr(
            'Ein zweiter, unabhängiger Durchlauf prüft jede Frage gegen das PDF, korrigiert Seitenzahlen und entfernt Fragen ohne Beleg. Das ist dein Schutz gegen Halluzinationen.',
            'A second, independent pass checks every question against the PDF, fixes page numbers and removes questions without evidence. This is your protection against hallucinations.',
          )}
        </p>
        <ol className="steps-list">
          {tr(
            <>
              <li>
                Öffne einen <strong>weiteren neuen Chat</strong> (nicht denselben!).
              </li>
              <li>
                Lade das PDF erneut hoch, füge <strong>Prompt B</strong> ein und ersetze den Platzhalter am Ende durch
                das JSON aus Schritt 2.
              </li>
            </>,
            <>
              <li>
                Open <strong>another new chat</strong> (not the same one!).
              </li>
              <li>
                Upload the PDF again, paste <strong>Prompt B</strong> and replace the placeholder at the end with the
                JSON from step 2.
              </li>
            </>,
          )}
        </ol>
        <PromptBox title={tr('Prompt B – Inhalte prüfen', 'Prompt B – check the content')} text={verifyPrompt()} />
      </section>

      <section className="card stack">
        <h2 className="step">
          <span>4</span> {tr('Ergebnis einfügen', 'Paste the result')}
        </h2>
        <textarea
          className="input mono"
          rows={8}
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void onFile(e.dataTransfer.files[0]);
          }}
          placeholder={tr(
            'Antwort aus dem Chat hier einfügen (ganze Antwort ist ok) oder eine .json-Datei hierher ziehen',
            'Paste the chat answer here (the whole answer is fine) or drop a .json file here',
          )}
        />
        <label className="btn small ghost file-btn">
          {tr('.json-Datei wählen', 'Choose .json file')}
          <input
            type="file"
            accept=".json,application/json,text/plain"
            onChange={(e) => onFile(e.target.files?.[0])}
            hidden
          />
        </label>

        {result && !result.ok && (
          <div className="feedback bad">
            <p className="verdict">
              {tr(
                `Das passt noch nicht ganz (${result.errors.length} Fehler)`,
                `Not quite right yet (${result.errors.length} errors)`,
              )}
            </p>
            <ul className="small">
              {result.errors.map((e, i) => (
                <li key={i}>
                  <code>{e}</code>
                </li>
              ))}
            </ul>
            <p>
              {tr(
                'Kopiere diese Korrekturanweisung in denselben Chat und füge die neue Antwort hier ein:',
                'Copy this correction request into the same chat and paste the new answer here:',
              )}
            </p>
            <CopyButton
              text={repairPrompt(result.errors)}
              label={tr('Korrekturanweisung kopieren', 'Copy correction request')}
              className="btn primary"
            />
          </div>
        )}

        {d && (
          <div className="feedback good stack">
            <p className="verdict">
              ✓ {d.course.title} · {tr('Kapitel', 'Chapter')} {d.chapter.number}: {d.chapter.title}
            </p>
            <p className="small">
              {tr(
                `${d.chapter.objectives.length} Lernziele · ${d.chapter.story.scenes.length} Szenen · ${d.chapter.pretest.length} Vorabfragen · ${d.chapter.posttest.length} Nachfragen · ${d.chapter.review.length} Wiederholungsfragen · `,
                `${d.chapter.objectives.length} objectives · ${d.chapter.story.scenes.length} scenes · ${d.chapter.pretest.length} pre-questions · ${d.chapter.posttest.length} post-questions · ${d.chapter.review.length} review questions · `,
              )}
              <strong>{d.verified ? tr('geprüft', 'verified') : tr('ungeprüft', 'unverified')}</strong>
            </p>
            {targetCourse && d.course.title !== targetCourse.title && (
              <p className="small">
                {tr(
                  `Wird dem Kurs „${targetCourse.title}“ hinzugefügt.`,
                  `Will be added to the course "${targetCourse.title}".`,
                )}
              </p>
            )}
            {result.warnings.length > 0 && (
              <ul className="small warnings">
                {result.warnings.map((w, i) => (
                  <li key={i}>⚠ {w}</li>
                ))}
              </ul>
            )}
            <button className="btn primary" onClick={doImport} disabled={busy}>
              {tr('Importieren und loslegen', 'Import and start')}
            </button>
            {importError && (
              <p className="error small">
                {tr('Import fehlgeschlagen:', 'Import failed:')} {importError}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

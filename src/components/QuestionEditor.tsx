import { useState } from 'react';
import { tr } from '../lib/i18n';
import { applyZodLocale, correctSet, QuestionSchema, type Question } from '../lib/schema';

interface QuestionEditorProps {
  readonly question: Question;
  readonly onSave: (q: Question) => Promise<void>;
  readonly onCancel: () => void;
  /** Takes the question out of review instead of fixing it; omitted where that makes no sense */
  readonly onHide?: () => Promise<void>;
}

/** Splits a text area into its non-empty lines. */
function lines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Edits the text, options, answers and explanation of a question; the result is validated like an import. */
export default function QuestionEditor({ question, onSave, onCancel, onHide }: QuestionEditorProps) {
  const [prompt, setPrompt] = useState(question.prompt);
  const [explanation, setExplanation] = useState(question.explanation);
  const [options, setOptions] = useState<string[]>(question.type === 'mc' ? question.options : []);
  const [correct, setCorrect] = useState<number[]>(question.type === 'mc' ? correctSet(question) : []);
  const [answers, setAnswers] = useState(question.type === 'cloze' ? question.answers.join('\n') : '');
  const [modelAnswer, setModelAnswer] = useState(question.type === 'open' ? question.modelAnswer : '');
  const [rubric, setRubric] = useState(question.type === 'open' ? question.rubric.join('\n') : '');
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function build(): Question {
    const texts = { prompt: prompt.trim(), explanation: explanation.trim() };
    if (question.type === 'mc') {
      const kept = options.map((o) => o.trim());
      // one correct option stays single choice, several make it multiple choice
      const [only] = correct;
      return {
        ...question,
        ...texts,
        options: kept,
        correct: correct.length === 1 && only !== undefined ? only : correct,
      };
    }
    if (question.type === 'cloze') return { ...question, ...texts, answers: lines(answers) };
    return { ...question, ...texts, modelAnswer: modelAnswer.trim(), rubric: lines(rubric) };
  }

  async function save() {
    applyZodLocale();
    const parsed = QuestionSchema.safeParse(build());
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((i) => `${i.path.join('.') || tr('Frage', 'Question')}: ${i.message}`));
      return;
    }
    setBusy(true);
    try {
      await onSave(parsed.data);
    } catch (e) {
      setErrors([e instanceof Error ? e.message : String(e)]);
      setBusy(false);
    }
  }

  function toggleCorrect(i: number) {
    setCorrect((c) => (c.includes(i) ? c.filter((x) => x !== i) : [...c, i].sort((a, b) => a - b)));
  }

  function removeOption(i: number) {
    setOptions((o) => o.filter((_, j) => j !== i));
    setCorrect((c) => c.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x)));
  }

  return (
    <section className="card stack question-editor">
      <h3>{tr('Frage bearbeiten', 'Edit question')}</h3>
      <label className="stack">
        <span className="label">
          {question.type === 'cloze' ? tr('Frage (Lücke als ___)', 'Question (blank as ___)') : tr('Frage', 'Question')}
        </span>
        <textarea className="input" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      </label>

      {question.type === 'mc' && (
        <div className="stack">
          <span className="label">{tr('Antwortoptionen – Haken = richtig', 'Answer options – tick = correct')}</span>
          {options.map((opt, i) => (
            <div key={i} className="row gap editor-option">
              <input
                type="checkbox"
                checked={correct.includes(i)}
                onChange={() => toggleCorrect(i)}
                aria-label={tr(
                  `Option ${String.fromCharCode(65 + i)} ist richtig`,
                  `Option ${String.fromCharCode(65 + i)} is correct`,
                )}
              />
              <strong>{String.fromCharCode(65 + i)}</strong>
              <input
                className="input grow"
                value={opt}
                onChange={(e) => setOptions((o) => o.map((x, j) => (j === i ? e.target.value : x)))}
              />
              <button
                className="btn small ghost"
                disabled={options.length <= 2}
                onClick={() => removeOption(i)}
                aria-label={tr('Option entfernen', 'Remove option')}
              >
                ✕
              </button>
            </div>
          ))}
          {options.length < 6 && (
            <button className="btn small self-start" onClick={() => setOptions((o) => [...o, ''])}>
              {tr('+ Option', '+ Option')}
            </button>
          )}
          <p className="muted small">
            {tr(
              'Ein Haken = Einfachauswahl, mehrere Haken = „mehrere Antworten möglich“.',
              'One tick = single choice, several ticks = "more than one answer possible".',
            )}
          </p>
        </div>
      )}

      {question.type === 'cloze' && (
        <label className="stack">
          <span className="label">
            {tr('Akzeptierte Antworten (eine pro Zeile)', 'Accepted answers (one per line)')}
          </span>
          <textarea className="input" rows={3} value={answers} onChange={(e) => setAnswers(e.target.value)} />
        </label>
      )}

      {question.type === 'open' && (
        <>
          <label className="stack">
            <span className="label">{tr('Musterantwort', 'Model answer')}</span>
            <textarea className="input" rows={4} value={modelAnswer} onChange={(e) => setModelAnswer(e.target.value)} />
          </label>
          <label className="stack">
            <span className="label">{tr('Bewertungspunkte (einer pro Zeile)', 'Rubric points (one per line)')}</span>
            <textarea className="input" rows={4} value={rubric} onChange={(e) => setRubric(e.target.value)} />
          </label>
        </>
      )}

      <label className="stack">
        <span className="label">{tr('Erklärung', 'Explanation')}</span>
        <textarea className="input" rows={3} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
      </label>

      {errors.length > 0 && (
        <ul className="error small">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div className="row gap wrap">
        <button className="btn primary" onClick={save} disabled={busy}>
          {tr('Speichern', 'Save')}
        </button>
        <button className="btn ghost" onClick={onCancel} disabled={busy}>
          {tr('Abbrechen', 'Cancel')}
        </button>
        {onHide && (
          <button className="btn ghost" onClick={onHide} disabled={busy}>
            {tr('Stattdessen aus der Wiederholung nehmen', 'Remove from review instead')}
          </button>
        )}
      </div>
    </section>
  );
}

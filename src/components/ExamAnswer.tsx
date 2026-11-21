import { tr } from '../lib/i18n';
import { encodeGiven, isMulti, parseGiven, type Question } from '../lib/schema';
import Rich from './Rich';

interface ExamAnswerProps {
  readonly q: Question;
  readonly given: string;
  readonly onChange: (given: string) => void;
}

/** Answer input during the mock exam: editable until handed in, no feedback. */
export default function ExamAnswer({ q, given, onChange }: ExamAnswerProps) {
  if (q.type === 'mc') {
    const multi = isMulti(q);
    const picked = parseGiven(given);
    const toggle = (i: number) => {
      if (!multi) return onChange(picked.includes(i) ? '' : String(i));
      onChange(encodeGiven(picked.includes(i) ? picked.filter((x) => x !== i) : [...picked, i]));
    };
    return (
      <div className="stack">
        {multi && <p className="multi-hint">☑ {tr('Mehrere Antworten möglich', 'More than one answer possible')}</p>}
        <div className="options">
          {q.options.map((opt, i) => (
            <button
              key={i}
              type="button"
              className={`option${multi ? ' multi' : ''}${picked.includes(i) ? ' selected' : ''}`}
              aria-pressed={picked.includes(i)}
              onClick={() => toggle(i)}
            >
              <span className="opt-letter">{multi && picked.includes(i) ? '✓' : String.fromCharCode(65 + i)}</span>
              <span>
                <Rich text={opt} />
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (q.type === 'cloze') {
    return (
      <input
        className="input"
        value={given}
        onChange={(e) => onChange(e.target.value)}
        placeholder={tr('Deine Antwort', 'Your answer')}
      />
    );
  }
  return (
    <textarea
      className="input"
      rows={6}
      value={given}
      onChange={(e) => onChange(e.target.value)}
      placeholder={tr(
        'Antworte in eigenen Worten. Stichpunkte reichen.',
        'Answer in your own words. Bullet points are fine.',
      )}
    />
  );
}

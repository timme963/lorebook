import { useEffect, useRef, useState } from 'react';
import { checkAuto } from '../lib/courses';
import type { CardRow, ChapterRow } from '../lib/db';
import { tr } from '../lib/i18n';
import type { Question } from '../lib/schema';
import { detectLang, listenOnce, speak, stopListening, stopSpeaking, type SpeechLang } from '../lib/speech';
import { Rating, type Grade } from '../lib/srs';
import { isDontKnow, isStop, parseChoice, parseRating } from '../lib/voiceAnswer';
import Rich from './Rich';

export interface HandsFreeItem {
  card: CardRow;
  q: Question;
  chapter: ChapterRow;
}

type Phase = 'speaking' | 'listening' | 'feedback';

const L = (lang: SpeechLang, de: string, en: string) => (lang === 'en' ? en : de);

function promptText(q: Question, lang: SpeechLang): string {
  if (q.type === 'mc') return `${q.prompt} ${q.options.map((o, i) => `${String.fromCharCode(65 + i)}: ${o}.`).join(' ')}`;
  if (q.type === 'cloze') return q.prompt.replace('___', L(lang, ' … Lücke … ', ' … blank … '));
  return q.prompt;
}

/**
 * Freihändige Wiederholung: Frage wird vorgelesen, Antwort per Stimme, Auflösung wird vorgelesen, Bewertung automatisch.
 * Multiple Choice: „A“ … „D“, „die zweite“ oder der Inhalt. Lückentext: das Wort. Offene Frage: frei antworten,
 * dann Musterantwort hören und mit „nochmal / schwer / gut / leicht“ bewerten. „weiß ich nicht“ und „stopp“ gehen immer.
 */
export default function HandsFree({
  queue,
  startPos,
  onRate,
  onExit,
}: {
  queue: HandsFreeItem[];
  startPos: number;
  onRate: (item: HandsFreeItem, g: Grade) => Promise<void>;
  onExit: () => void;
}) {
  const [current, setCurrent] = useState<HandsFreeItem>(queue[startPos]);
  const [phase, setPhase] = useState<Phase>('speaking');
  const [heard, setHeard] = useState('');
  const [verdict, setVerdict] = useState<string>();
  const [error, setError] = useState<string>();
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    void run();
    return () => {
      alive.current = false;
      stopSpeaking();
      stopListening();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** vorlesen; false = abgebrochen */
  async function say(text: string): Promise<boolean> {
    if (!alive.current) return false;
    setPhase('speaking');
    return (await speak(text, `hf:${Math.random()}`)) && alive.current;
  }

  async function hear(lang: SpeechLang): Promise<string | null> {
    if (!alive.current) return null;
    setPhase('listening');
    setHeard('');
    const r = await listenOnce(lang);
    if (!alive.current) return null;
    if (r.error === 'not-allowed' || r.error === 'denied' || r.error === 'service-not-allowed') {
      setError(tr('Mikrofon nicht erlaubt – freihändiger Modus beendet.', 'Microphone not allowed – hands-free mode ended.'));
      return null;
    }
    if (r.error && r.error !== 'no-speech' && r.error !== 'aborted') {
      setError(`${tr('Spracherkennung fehlgeschlagen – freihändiger Modus beendet.', 'Speech recognition failed – hands-free mode ended.')} (${r.error})`);
      return null;
    }
    setHeard(r.text);
    if (isStop(r.text)) return null;
    return r.text;
  }

  async function run() {
    for (let p = startPos; p < queue.length; p++) {
      const res = await ask(queue[p]);
      if (res === 'stop') {
        if (alive.current) onExit();
        return;
      }
    }
  }

  async function ask(item: HandsFreeItem): Promise<'next' | 'stop'> {
    const { q } = item;
    const lang = detectLang(q.prompt);
    setCurrent(item);
    setVerdict(undefined);
    setHeard('');
    if (!(await say(promptText(q, lang)))) return 'stop';

    let grade: Grade;
    if (q.type === 'open') {
      const answer = await hear(lang);
      if (answer === null) return 'stop';
      if (!(await say(`${L(lang, 'Musterantwort:', 'Model answer:')} ${q.modelAnswer} ${L(lang, 'Wie gut warst du? Sag nochmal, schwer, gut oder leicht.', 'How did you do? Say again, hard, good or easy.')}`))) return 'stop';
      let rating: Grade | undefined;
      for (let tries = 0; tries < 2 && rating === undefined; tries++) {
        const r = await hear(lang);
        if (r === null) return 'stop';
        rating = parseRating(r);
        if (rating === undefined && tries === 0 && !(await say(L(lang, 'Bitte sag nochmal, schwer, gut oder leicht.', 'Please say again, hard, good or easy.')))) return 'stop';
      }
      grade = rating ?? Rating.Hard;
      setVerdict(tr('Selbst bewertet', 'Self-rated'));
    } else {
      let correct = false;
      let understood = false;
      for (let tries = 0; tries < 2 && !understood; tries++) {
        const answer = await hear(lang);
        if (answer === null) return 'stop';
        if (!answer || isDontKnow(answer)) {
          understood = !!answer;
          if (!answer && tries === 0) {
            if (!(await say(L(lang, 'Ich habe nichts gehört. Nochmal bitte.', "I didn't hear anything. Once more, please.")))) return 'stop';
            continue;
          }
          break;
        }
        if (q.type === 'mc') {
          const idx = parseChoice(answer, q.options);
          if (idx < 0) {
            if (tries === 0 && !(await say(L(lang, 'Nicht verstanden. Sag A, B, C oder D.', "Didn't catch that. Say A, B, C or D.")))) return 'stop';
            continue;
          }
          understood = true;
          correct = checkAuto(q, String(idx));
        } else {
          understood = true;
          correct = checkAuto(q, answer);
        }
      }
      const right = q.type === 'mc' ? `${String.fromCharCode(65 + q.correct)}: ${q.options[q.correct]}` : q.answers[0];
      setVerdict(correct ? tr('Richtig!', 'Correct!') : `${tr('Richtig wäre:', 'Correct would be:')} ${right}`);
      setPhase('feedback');
      const feedback = correct
        ? `${L(lang, 'Richtig.', 'Correct.')} ${q.explanation}`
        : `${L(lang, 'Leider nicht. Richtig ist', 'Not quite. The answer is')} ${right}. ${q.explanation}`;
      if (!(await say(feedback))) return 'stop';
      grade = correct ? Rating.Good : Rating.Again;
    }
    if (!alive.current) return 'stop';
    await onRate(item, grade);
    return 'next';
  }

  const q = current.q;
  return (
    <section className="card stack handsfree">
      <div className="row between wrap gap">
        <span className={`hf-status hf-${phase}`}>
          {phase === 'speaking' ? tr('🔊 Liest vor …', '🔊 Reading …') : phase === 'listening' ? tr('🎤 Hört zu …', '🎤 Listening …') : tr('✓ Auswertung', '✓ Result')}
        </span>
        <button className="btn small" onClick={onExit}>■ {tr('Freihändig beenden', 'End hands-free')}</button>
      </div>
      <p className="muted small">{current.chapter.content.title}</p>
      <h3 className="q-prompt"><Rich text={q.type === 'cloze' ? q.prompt.replace('___', '_____') : q.prompt} /></h3>
      {q.type === 'mc' && (
        <ol className="hf-options">
          {q.options.map((o, i) => (
            <li key={i}><strong>{String.fromCharCode(65 + i)}</strong> <Rich text={o} /></li>
          ))}
        </ol>
      )}
      {heard && <p className="small">{tr('Gehört:', 'Heard:')} „{heard}“</p>}
      {verdict && <p className="verdict"><Rich text={verdict} /></p>}
      {error && <p className="error small">{error}</p>}
      <p className="muted small">
        {q.type === 'mc'
          ? tr('Sag „A“, „B“, „C“ oder „D“ – oder „weiß ich nicht“. „Stopp“ beendet.', 'Say "A", "B", "C" or "D" – or "don\'t know". "Stop" ends.')
          : q.type === 'cloze'
            ? tr('Sag das fehlende Wort – oder „weiß ich nicht“. „Stopp“ beendet.', 'Say the missing word – or "don\'t know". "Stop" ends.')
            : tr('Antworte frei, danach hörst du die Musterantwort und bewertest dich selbst. „Stopp“ beendet.', 'Answer freely, then hear the model answer and rate yourself. "Stop" ends.')}
      </p>
    </section>
  );
}

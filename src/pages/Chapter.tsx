import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import QuestionCard from '../components/QuestionCard';
import { SourceButton } from '../components/Source';
import { completeChapter, scoreOf } from '../lib/courses';
import { db, type AnswerRecord, type ChapterRow } from '../lib/db';
import { addXp } from '../lib/progress';
import { correctSet, parseGiven, type Question } from '../lib/schema';
import { href } from '../router';
import { tr } from '../lib/i18n';
import { SpeakButton } from '../components/Speech';
import Rich from '../components/Rich';
import { getSpeechSettings, speak, stopSpeaking, ttsSupported } from '../lib/speech';

function Progress({ phase }: { phase: ChapterRow['phase'] }) {
  const steps: [ChapterRow['phase'], string][] = [
    ['pretest', tr('Was weißt du schon?', 'What do you know already?')],
    ['story', 'Story'],
    ['posttest', tr('Was weißt du jetzt?', 'What do you know now?')],
    ['done', tr('Ergebnis', 'Result')],
  ];
  const idx = steps.findIndex(([p]) => p === phase);
  return (
    <ol className="phase-steps">
      {steps.map(([p, label], i) => (
        <li key={p} className={i < idx ? 'past' : i === idx ? 'current' : ''}>{label}</li>
      ))}
    </ol>
  );
}

function QuestionRun({
  ch,
  questions,
  answers,
  mode,
  onAnswer,
  title,
  intro,
}: {
  ch: ChapterRow;
  questions: Question[];
  answers: Record<string, AnswerRecord>;
  mode: 'silent' | 'feedback';
  onAnswer: (q: Question, r: AnswerRecord) => void;
  title: string;
  intro: string;
}) {
  const next = questions.find((q) => !answers[q.id]);
  const n = questions.length - questions.filter((q) => !answers[q.id]).length;
  if (!next) return null;
  return (
    <div className="stack">
      <div>
        <h2>{title}</h2>
        <p className="muted">{intro}</p>
      </div>
      <div className="bar thin"><div style={{ width: `${(n / questions.length) * 100}%` }} /></div>
      <QuestionCard
        key={next.id}
        q={next}
        courseId={ch.courseId}
        mode={mode}
        onDone={(r) => onAnswer(next, r)}
        meta={<span className="muted small">{tr(`Frage ${n + 1} von ${questions.length}`, `Question ${n + 1} of ${questions.length}`)}</span>}
      />
    </div>
  );
}

function StoryView({ ch }: { ch: ChapterRow }) {
  const { story, objectives } = ch.content;
  const i = ch.sceneIndex;
  const isEnding = i >= story.scenes.length;
  const scene = story.scenes[i];
  const objective = scene && objectives.find((o) => o.id === scene.objective);
  const [conceptOpen, setConceptOpen] = useState(false);

  const sceneText = scene ? `${scene.title}. ${scene.text}` : `${story.ending}`;
  const sceneKey = `scene:${ch.id}:${i}`;

  // Hörmodus: ganze Story am Stück (Szene, dann „Was steckt dahinter?“, dann nächste Szene, am Ende die Auflösung)
  const [listening, setListening] = useState(false);
  const listeningRef = useRef(false);

  // Szene wechselt: Vorlesen stoppen, ggf. neue Szene automatisch vorlesen – außer der Hörmodus steuert selbst
  useEffect(() => {
    if (listeningRef.current) return;
    if (getSpeechSettings().autoStory) void speak(sceneText, sceneKey);
    return () => {
      if (!listeningRef.current) stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey]);

  // Seite verlassen beendet den Hörmodus
  useEffect(
    () => () => {
      listeningRef.current = false;
      stopSpeaking();
    },
    [],
  );

  async function listenAll() {
    stopSpeaking();
    listeningRef.current = true;
    setListening(true);
    let idx = ch.sceneIndex;
    while (listeningRef.current) {
      const sc = story.scenes[idx];
      if (!sc) {
        await speak(`${tr('Auflösung.', 'Resolution.')} ${story.ending}`, `listen:end`);
        break;
      }
      setConceptOpen(false);
      if (!(await speak(`${sc.title}. ${sc.text}`, `listen:${idx}`)) || !listeningRef.current) break;
      setConceptOpen(true);
      if (!(await speak(`${tr('Was steckt dahinter?', "What's behind it?")} ${sc.concept}`, `listen:${idx}:c`)) || !listeningRef.current) break;
      idx++;
      await db.chapters.update(ch.id, { sceneIndex: idx });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    listeningRef.current = false;
    setListening(false);
  }

  function stopListen() {
    listeningRef.current = false;
    setListening(false);
    stopSpeaking();
  }

  async function goTo(next: number) {
    setConceptOpen(false);
    await db.chapters.update(ch.id, { sceneIndex: next });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="stack">
      <div className="story-head">
        <p className="eyebrow">{tr('Kapitel', 'Chapter')} {ch.number} · {ch.content.title}</p>
        <h2 className="story-title">{story.title}</h2>
        {i === 0 && <p className="story-setting">{story.setting}</p>}
        {ttsSupported() && (
          <div className="listen-bar">
            {listening ? (
              <button className="btn small primary" onClick={stopListen}>■ {tr('Anhören stoppen', 'Stop listening')}</button>
            ) : (
              <button className="btn small" onClick={() => void listenAll()} title={tr('Story wie ein Hörbuch – Szene für Szene inkl. Erklärung', 'Story like an audiobook – scene by scene including the explanation')}>
                🎧 {isEnding ? tr('Auflösung anhören', 'Listen to the resolution') : i === 0 ? tr('Ganze Story anhören', 'Listen to the whole story') : tr('Ab hier anhören', 'Listen from here')}
              </button>
            )}
          </div>
        )}
      </div>
      <div className="scene-dots" aria-label={tr('Fortschritt', 'Progress')}>
        {story.scenes.map((_, j) => (
          <button key={j} className={j < i ? 'past' : j === i ? 'current' : ''} onClick={() => j <= i && goTo(j)} aria-label={`${tr('Szene', 'Scene')} ${j + 1}`} />
        ))}
        <button className={isEnding ? 'current' : ''} aria-label={tr('Ende', 'End')} onClick={() => undefined} />
      </div>

      {!isEnding && scene && (
        <article className="card story">
          <div className="row between gap">
            <h3 className="scene-title">{scene.title}</h3>
            <SpeakButton text={sceneText} id={sceneKey} />
          </div>
          {scene.text.split(/\n+/).map((p, k) => (
            <p key={k}><Rich text={p} /></p>
          ))}
          <div className={`concept ${conceptOpen ? 'open' : ''}`}>
            {conceptOpen ? (
              <>
                <p className="label">{tr('Was steckt dahinter?', 'What\'s behind it?')}</p>
                <div className="row between gap">
                  <p><Rich text={scene.concept} /></p>
                  <SpeakButton text={scene.concept} />
                </div>
                {objective && (
                  <div className="row between wrap gap">
                    <span className="muted small">{tr('Lernziel:', 'Objective:')} <Rich text={objective.text} /></span>
                    <SourceButton courseId={ch.courseId} source={objective.source} />
                  </div>
                )}
              </>
            ) : (
              <button className="btn block" onClick={() => setConceptOpen(true)}>💡 {tr('Was steckt dahinter?', 'What\'s behind it?')}</button>
            )}
          </div>
        </article>
      )}

      {isEnding && (
        <article className="card story">
          <div className="row between gap">
            <h3 className="scene-title">{tr('Auflösung', 'Resolution')}</h3>
            <SpeakButton text={sceneText} id={sceneKey} />
          </div>
          {story.ending.split(/\n+/).map((p, k) => (
            <p key={k}><Rich text={p} /></p>
          ))}
          <div className="concept open">
            <p className="label">{tr('Was du in diesem Kapitel gelernt hast', 'What you learned in this chapter')}</p>
            <ul>
              {objectives.map((o) => (
                <li key={o.id}><Rich text={o.text} /></li>
              ))}
            </ul>
          </div>
        </article>
      )}

      <div className="row between">
        <button className="btn ghost" disabled={i === 0} onClick={() => goTo(i - 1)}>{tr('← Zurück', '← Back')}</button>
        {!isEnding ? (
          <button className="btn primary" disabled={!conceptOpen} title={conceptOpen ? '' : tr('Erst „Was steckt dahinter?“ lesen', 'Read "What\'s behind it?" first')} onClick={() => goTo(i + 1)}>
            {tr('Weiter →', 'Next →')}
          </button>
        ) : ch.phase === 'done' ? (
          <a className="btn primary" href={href({ name: 'course', id: ch.courseId })}>{tr('Zur Quest-Karte', 'To the quest map')}</a>
        ) : (
          <button className="btn primary" onClick={() => db.chapters.update(ch.id, { phase: 'posttest' })}>{tr('Zu den Nachfragen →', 'To the post-questions →')}</button>
        )}
      </div>
    </div>
  );
}

function Result({ ch }: { ch: ChapterRow }) {
  const { content } = ch;
  const cards = useLiveQuery(() => db.cards.where('chapterId').equals(ch.id).count(), [ch.id], 0);
  const pre = ch.preScore ?? 0;
  const post = ch.postScore ?? 0;
  const [rereading, setRereading] = useState(false);

  if (rereading) return <StoryView ch={ch} />;

  const perObjective = content.objectives.map((o) => {
    const preQs = content.pretest.filter((q) => q.objective === o.id);
    const postQs = content.posttest.filter((q) => q.objective === o.id);
    return {
      o,
      pre: preQs.length ? scoreOf(ch.preAnswers, preQs) : undefined,
      post: postQs.length ? scoreOf(ch.postAnswers, postQs) : undefined,
    };
  });

  return (
    <div className="stack">
      <section className="card result">
        <p className="eyebrow">{tr('Kapitel gemeistert', 'Chapter mastered')}</p>
        <h2>{content.title}</h2>
        <div className="compare">
          <div>
            <span className="muted small">{tr('vorher', 'before')}</span>
            <span className="big">{Math.round(pre * 100)} %</span>
          </div>
          <span className="arrow">→</span>
          <div>
            <span className="muted small">{tr('nachher', 'after')}</span>
            <span className="big accent">{Math.round(post * 100)} %</span>
          </div>
        </div>
        <p>
          {post > pre
            ? tr(`+${Math.round((post - pre) * 100)} Prozentpunkte Lernzuwachs.`, `+${Math.round((post - pre) * 100)} percentage points gained.`)
            : post === pre && post >= 0.99
              ? tr('Du konntest es schon vorher – stark.', 'You knew it already – impressive.')
              : tr(
                  'Kein Zuwachs gemessen. Die Wiederholung in den nächsten Tagen ist jetzt besonders wichtig.',
                  'No gain measured. The reviews over the next days matter most now.',
                )}{' '}
          {tr(`${cards} Fragen sind jetzt in deiner Wiederholung.`, `${cards} questions are now in your review.`)}
        </p>
      </section>

      <section className="card stack">
        <h3>{tr('Nach Lernzielen', 'By objective')}</h3>
        <ul className="objective-list">
          {perObjective.map(({ o, pre, post }) => (
            <li key={o.id}>
              <span className="grow"><Rich text={o.text} /></span>
              <span className="muted small nowrap">
                {pre === undefined ? '–' : `${Math.round(pre * 100)} %`} → {post === undefined ? '–' : `${Math.round(post * 100)} %`}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card stack">
        <h3>{tr('Deine Vorab-Antworten aufgelöst', 'Your pre-question answers resolved')}</h3>
        <ul className="pre-list">
          {content.pretest.map((q) => {
            const a = ch.preAnswers[q.id];
            const right = q.type === 'mc' ? correctSet(q).map((i) => q.options[i]).join(' · ') : q.type === 'cloze' ? q.answers[0] : q.modelAnswer;
            const givenText = !a?.given ? tr('weiß ich nicht', "don't know") : q.type === 'mc' ? parseGiven(a.given).map((i) => q.options[i]).join(' · ') : a.given;
            return (
              <li key={q.id}>
                <p><strong><Rich text={q.prompt} /></strong></p>
                <p className="small">
                  {a?.correct ? '✓' : '✗'} {tr('Du:', 'You:')} <Rich text={givenText} /> · {tr('Richtig:', 'Correct:')} <strong><Rich text={right} /></strong>
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="row gap wrap">
        <a className="btn primary" href={href({ name: 'course', id: ch.courseId })}>{tr('Zur Quest-Karte', 'To the quest map')}</a>
        <button
          className="btn"
          onClick={async () => {
            await db.chapters.update(ch.id, { sceneIndex: 0 });
            setRereading(true);
          }}
        >
          {tr('Story nochmal lesen', 'Read the story again')}
        </button>
      </div>
    </div>
  );
}

export default function ChapterPage({ id }: { id: string }) {
  const ch = useLiveQuery(async () => (await db.chapters.get(id)) ?? null, [id]);
  if (ch === undefined) return null;
  if (ch === null) {
    return (
      <div className="card empty">
        <h2>{tr('Kapitel nicht gefunden', 'Chapter not found')}</h2>
        <a className="btn" href={href({ name: 'home' })}>{tr('Zur Übersicht', 'To overview')}</a>
      </div>
    );
  }
  const c = ch.content;

  async function answerPre(q: Question, r: AnswerRecord) {
    const preAnswers = { ...ch!.preAnswers, [q.id]: r };
    const finished = c.pretest.every((x) => preAnswers[x.id]);
    await db.chapters.update(id, {
      preAnswers,
      ...(finished ? { phase: 'story' as const, sceneIndex: 0, preScore: scoreOf(preAnswers, c.pretest) } : {}),
    });
    await addXp(2);
  }

  async function answerPost(q: Question, r: AnswerRecord) {
    const postAnswers = { ...ch!.postAnswers, [q.id]: r };
    const finished = c.posttest.every((x) => postAnswers[x.id]);
    await db.chapters.update(id, { postAnswers, ...(finished ? { postScore: scoreOf(postAnswers, c.posttest) } : {}) });
    await addXp(r.score >= 1 ? 5 : 2);
    if (finished) await completeChapter({ ...ch!, postAnswers, postScore: scoreOf(postAnswers, c.posttest) });
  }

  let body;
  switch (ch.phase) {
    case 'new':
      body = (
        <section className="card stack intro">
          <p className="eyebrow">{tr('Kapitel', 'Chapter')} {ch.number} · {tr('S.', 'p.')} {c.pages[0]}–{c.pages[1]}</p>
          <h1>{c.title}</h1>
          {!ch.verified && (
            <p className="feedback neutral small">⚠ {tr('Dieses Kapitel wurde nicht mit Prompt B geprüft. Fehler sind wahrscheinlicher – nutze „Quelle“ bei Zweifeln.', 'This chapter was not checked with Prompt B. Errors are more likely – use "Source" when in doubt.')}</p>
          )}
          {tr(
            <p>
              Zuerst <strong>{c.pretest.length} kurze Fragen</strong>, bevor du etwas liest. Rate ruhig, falsche Antworten sind hier ausdrücklich
              erwünscht: Das Raten bereitet dein Gehirn auf den Stoff vor. Danach folgt die Story mit {c.story.scenes.length} Szenen, dann die
              Nachfragen.
            </p>,
            <p>
              First, <strong>{c.pretest.length} short questions</strong> before you read anything. Just guess – wrong answers are explicitly welcome
              here: guessing primes your brain for the material. Then comes the story with {c.story.scenes.length} scenes, followed by the
              post-questions.
            </p>,
          )}
          <button className="btn primary self-start" onClick={() => db.chapters.update(id, { phase: 'pretest' })}>{tr('Los geht\'s', 'Let\'s go')}</button>
        </section>
      );
      break;
    case 'pretest':
      body = (
        <QuestionRun
          ch={ch}
          questions={c.pretest}
          answers={ch.preAnswers}
          mode="silent"
          onAnswer={answerPre}
          title={tr('Was weißt du schon?', 'What do you know already?')}
          intro={tr('Keine Auflösung jetzt – die gibt es am Ende des Kapitels. Rate einfach.', 'No answers yet – you get them at the end of the chapter. Just guess.')}
        />
      );
      break;
    case 'story':
      body = <StoryView ch={ch} />;
      break;
    case 'posttest':
      body = (
        <QuestionRun
          ch={ch}
          questions={c.posttest}
          answers={ch.postAnswers}
          mode="feedback"
          onAnswer={answerPost}
          title={tr('Was weißt du jetzt?', 'What do you know now?')}
          intro={tr('Dieselben Lernziele, neue Fragen. Diesmal mit Auflösung.', 'Same objectives, new questions. This time with answers.')}
        />
      );
      break;
    case 'done':
      body = <Result ch={ch} />;
      break;
  }

  return (
    <div className="stack">
      <a className="back" href={href({ name: 'course', id: ch.courseId })}>{tr('← Quest-Karte', '← Quest map')}</a>
      {ch.phase !== 'new' && <Progress phase={ch.phase} />}
      {body}
    </div>
  );
}

import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import QuestionCard from '../components/QuestionCard';
import { SourceButton } from '../components/Source';
import { completeChapter, scoreOf } from '../lib/courses';
import { db, type AnswerRecord, type ChapterRow } from '../lib/db';
import { addXp } from '../lib/progress';
import type { Question } from '../lib/schema';
import { href } from '../router';

function Progress({ phase }: { phase: ChapterRow['phase'] }) {
  const steps: [ChapterRow['phase'], string][] = [
    ['pretest', 'Was weißt du schon?'],
    ['story', 'Story'],
    ['posttest', 'Was weißt du jetzt?'],
    ['done', 'Ergebnis'],
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
        meta={<span className="muted small">Frage {n + 1} von {questions.length}</span>}
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

  async function goTo(next: number) {
    setConceptOpen(false);
    await db.chapters.update(ch.id, { sceneIndex: next });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="stack">
      <div className="story-head">
        <p className="eyebrow">Kapitel {ch.number} · {ch.content.title}</p>
        <h2 className="story-title">{story.title}</h2>
        {i === 0 && <p className="story-setting">{story.setting}</p>}
      </div>
      <div className="scene-dots" aria-label="Fortschritt">
        {story.scenes.map((_, j) => (
          <button key={j} className={j < i ? 'past' : j === i ? 'current' : ''} onClick={() => j <= i && goTo(j)} aria-label={`Szene ${j + 1}`} />
        ))}
        <button className={isEnding ? 'current' : ''} aria-label="Ende" onClick={() => undefined} />
      </div>

      {!isEnding && scene && (
        <article className="card story">
          <h3 className="scene-title">{scene.title}</h3>
          {scene.text.split(/\n+/).map((p, k) => (
            <p key={k}>{p}</p>
          ))}
          <div className={`concept ${conceptOpen ? 'open' : ''}`}>
            {conceptOpen ? (
              <>
                <p className="label">Was steckt dahinter?</p>
                <p>{scene.concept}</p>
                {objective && (
                  <div className="row between wrap gap">
                    <span className="muted small">Lernziel: {objective.text}</span>
                    <SourceButton courseId={ch.courseId} source={objective.source} />
                  </div>
                )}
              </>
            ) : (
              <button className="btn block" onClick={() => setConceptOpen(true)}>💡 Was steckt dahinter?</button>
            )}
          </div>
        </article>
      )}

      {isEnding && (
        <article className="card story">
          <h3 className="scene-title">Auflösung</h3>
          {story.ending.split(/\n+/).map((p, k) => (
            <p key={k}>{p}</p>
          ))}
          <div className="concept open">
            <p className="label">Was du in diesem Kapitel gelernt hast</p>
            <ul>
              {objectives.map((o) => (
                <li key={o.id}>{o.text}</li>
              ))}
            </ul>
          </div>
        </article>
      )}

      <div className="row between">
        <button className="btn ghost" disabled={i === 0} onClick={() => goTo(i - 1)}>← Zurück</button>
        {!isEnding ? (
          <button className="btn primary" disabled={!conceptOpen} title={conceptOpen ? '' : 'Erst „Was steckt dahinter?“ lesen'} onClick={() => goTo(i + 1)}>
            Weiter →
          </button>
        ) : ch.phase === 'done' ? (
          <a className="btn primary" href={href({ name: 'course', id: ch.courseId })}>Zur Quest-Karte</a>
        ) : (
          <button className="btn primary" onClick={() => db.chapters.update(ch.id, { phase: 'posttest' })}>Zu den Nachfragen →</button>
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
        <p className="eyebrow">Kapitel gemeistert</p>
        <h2>{content.title}</h2>
        <div className="compare">
          <div>
            <span className="muted small">vorher</span>
            <span className="big">{Math.round(pre * 100)} %</span>
          </div>
          <span className="arrow">→</span>
          <div>
            <span className="muted small">nachher</span>
            <span className="big accent">{Math.round(post * 100)} %</span>
          </div>
        </div>
        <p>
          {post > pre
            ? `+${Math.round((post - pre) * 100)} Prozentpunkte Lernzuwachs.`
            : post === pre && post >= 0.99
              ? 'Du konntest es schon vorher – stark.'
              : 'Kein Zuwachs gemessen. Die Wiederholung in den nächsten Tagen ist jetzt besonders wichtig.'}{' '}
          {cards} Fragen sind jetzt in deiner Wiederholung.
        </p>
      </section>

      <section className="card stack">
        <h3>Nach Lernzielen</h3>
        <ul className="objective-list">
          {perObjective.map(({ o, pre, post }) => (
            <li key={o.id}>
              <span className="grow">{o.text}</span>
              <span className="muted small nowrap">
                {pre === undefined ? '–' : `${Math.round(pre * 100)} %`} → {post === undefined ? '–' : `${Math.round(post * 100)} %`}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card stack">
        <h3>Deine Vorab-Antworten aufgelöst</h3>
        <ul className="pre-list">
          {content.pretest.map((q) => {
            const a = ch.preAnswers[q.id];
            const right = q.type === 'mc' ? q.options[q.correct] : q.type === 'cloze' ? q.answers[0] : q.modelAnswer;
            const givenText = !a?.given ? 'weiß ich nicht' : q.type === 'mc' ? q.options[Number(a.given)] : a.given;
            return (
              <li key={q.id}>
                <p><strong>{q.prompt}</strong></p>
                <p className="small">
                  {a?.correct ? '✓' : '✗'} Du: {givenText} · Richtig: <strong>{right}</strong>
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="row gap wrap">
        <a className="btn primary" href={href({ name: 'course', id: ch.courseId })}>Zur Quest-Karte</a>
        <button
          className="btn"
          onClick={async () => {
            await db.chapters.update(ch.id, { sceneIndex: 0 });
            setRereading(true);
          }}
        >
          Story nochmal lesen
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
        <h2>Kapitel nicht gefunden</h2>
        <a className="btn" href={href({ name: 'home' })}>Zur Übersicht</a>
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
          <p className="eyebrow">Kapitel {ch.number} · S. {c.pages[0]}–{c.pages[1]}</p>
          <h1>{c.title}</h1>
          {!ch.verified && (
            <p className="feedback neutral small">⚠ Dieses Kapitel wurde nicht mit Prompt B geprüft. Fehler sind wahrscheinlicher – nutze „Quelle“ bei Zweifeln.</p>
          )}
          <p>
            Zuerst <strong>{c.pretest.length} kurze Fragen</strong>, bevor du etwas liest. Rate ruhig, falsche Antworten sind hier ausdrücklich
            erwünscht: Das Raten bereitet dein Gehirn auf den Stoff vor. Danach folgt die Story mit {c.story.scenes.length} Szenen, dann die
            Nachfragen.
          </p>
          <button className="btn primary self-start" onClick={() => db.chapters.update(id, { phase: 'pretest' })}>Los geht's</button>
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
          title="Was weißt du schon?"
          intro="Keine Auflösung jetzt – die gibt es am Ende des Kapitels. Rate einfach."
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
          title="Was weißt du jetzt?"
          intro="Dieselben Lernziele, neue Fragen. Diesmal mit Auflösung."
        />
      );
      break;
    case 'done':
      body = <Result ch={ch} />;
      break;
  }

  return (
    <div className="stack">
      <a className="back" href={href({ name: 'course', id: ch.courseId })}>← Quest-Karte</a>
      {ch.phase !== 'new' && <Progress phase={ch.phase} />}
      {body}
    </div>
  );
}

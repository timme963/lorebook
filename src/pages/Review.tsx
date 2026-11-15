import { useEffect, useState } from 'react';
import QuestionCard from '../components/QuestionCard';
import { db, type AnswerRecord, type CardRow, type ChapterRow } from '../lib/db';
import type { Question } from '../lib/schema';
import { dueCards, flagCard, gradeCard, previewIntervals, Rating, type Grade } from '../lib/srs';
import { href } from '../router';

interface Item {
  card: CardRow;
  q: Question;
  chapter: ChapterRow;
}

const SESSION_MAX = 50;

async function loadQueue(courseId?: string): Promise<Item[]> {
  const cards = (await dueCards(courseId)).slice(0, SESSION_MAX);
  const chapterIds = [...new Set(cards.map((c) => c.chapterId))];
  const chapters = new Map((await db.chapters.bulkGet(chapterIds)).filter(Boolean).map((c) => [c!.id, c!]));
  const items: Item[] = [];
  for (const card of cards) {
    const ch = chapters.get(card.chapterId);
    const q = ch && [...ch.content.pretest, ...ch.content.posttest, ...ch.content.review].find((x) => x.id === card.questionId);
    if (ch && q) items.push({ card, q, chapter: ch });
  }
  // Interleaving: Kapitel mischen statt blockweise
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function RatingButtons({ item, record, onRate }: { item: Item; record: AnswerRecord; onRate: (g: Grade) => void }) {
  const iv = previewIntervals(item.card);
  const auto = record.correct !== null;
  if (auto && !record.correct) {
    return (
      <button className="btn primary" onClick={() => onRate(Rating.Again)} autoFocus>
        Weiter (kommt in {iv[Rating.Again]} wieder)
      </button>
    );
  }
  const suggested: Grade = auto ? Rating.Good : record.score >= 0.99 ? Rating.Good : record.score >= 0.5 ? Rating.Hard : Rating.Again;
  const buttons: [Grade, string][] = auto
    ? [
        [Rating.Hard, 'Schwer'],
        [Rating.Good, 'Gut'],
        [Rating.Easy, 'Leicht'],
      ]
    : [
        [Rating.Again, 'Nochmal'],
        [Rating.Hard, 'Schwer'],
        [Rating.Good, 'Gut'],
        [Rating.Easy, 'Leicht'],
      ];
  return (
    <div className="rating">
      <p className="muted small">Wie leicht fiel es dir?</p>
      <div className="row gap wrap">
        {buttons.map(([g, label]) => (
          <button key={g} className={`btn rate rate-${g} ${g === suggested ? 'primary' : ''}`} onClick={() => onRate(g)}>
            {label}
            <small>{iv[g]}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ReviewPage({ courseId }: { courseId?: string }) {
  const [queue, setQueue] = useState<Item[]>();
  const [pos, setPos] = useState(0);
  const [stats, setStats] = useState({ done: 0, good: 0 });
  const [flagging, setFlagging] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    loadQueue(courseId).then(setQueue);
  }, [courseId]);

  if (!queue) return null;
  const item = queue[pos];
  const back = courseId ? href({ name: 'course', id: courseId }) : href({ name: 'home' });

  if (!item) {
    return (
      <div className="stack">
        <section className="card result">
          <p className="eyebrow">Wiederholung</p>
          {stats.done === 0 ? (
            <>
              <h2>Nichts fällig 🎉</h2>
              <p>Alles wiederholt, was gerade dran ist. Komm morgen wieder – genau der Abstand macht's.</p>
            </>
          ) : (
            <>
              <h2>Geschafft!</h2>
              <div className="compare">
                <div><span className="big">{stats.done}</span><span className="muted small">Karten</span></div>
                <div><span className="big accent">{Math.round((stats.good / stats.done) * 100)} %</span><span className="muted small">gewusst</span></div>
              </div>
              <p>+{stats.good * 10 + (stats.done - stats.good) * 4} XP</p>
            </>
          )}
          <div className="row gap wrap center">
            <a className="btn primary" href={back}>Fertig</a>
            {stats.done > 0 && (
              <button
                className="btn"
                onClick={async () => {
                  setPos(0);
                  setStats({ done: 0, good: 0 });
                  setQueue(await loadQueue(courseId));
                }}
              >
                Nach weiteren fälligen Karten suchen
              </button>
            )}
          </div>
        </section>
      </div>
    );
  }

  async function rate(g: Grade) {
    await gradeCard(item.card, g);
    setStats((s) => ({ done: s.done + 1, good: s.good + (g === Rating.Again ? 0 : 1) }));
    setPos((p) => p + 1);
  }

  async function flag() {
    await flagCard(item.card, reason.trim());
    setFlagging(false);
    setReason('');
    setPos((p) => p + 1);
  }

  return (
    <div className="stack">
      <a className="back" href={back}>← Beenden</a>
      <div className="row between">
        <h2>Wiederholung</h2>
        <span className="muted">{pos + 1} / {queue.length}</span>
      </div>
      <div className="bar thin"><div style={{ width: `${(pos / queue.length) * 100}%` }} /></div>
      <QuestionCard
        key={item.card.id}
        q={item.q}
        courseId={item.card.courseId}
        mode="feedback"
        onDone={() => undefined}
        after={(r) => <RatingButtons item={item} record={r} onRate={rate} />}
        meta={<span className="muted small">{item.chapter.content.title}</span>}
      />
      {!flagging ? (
        <button className="btn small ghost self-start" onClick={() => setFlagging(true)}>⚑ Frage ist falsch oder unklar</button>
      ) : (
        <div className="card stack">
          <p className="small">Die Frage wird aus der Wiederholung genommen. Auf der Kursseite kannst du sie wieder freigeben.</p>
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Was stimmt nicht? (optional)" />
          <div className="row gap">
            <button className="btn primary" onClick={flag}>Melden</button>
            <button className="btn ghost" onClick={() => setFlagging(false)}>Abbrechen</button>
          </div>
        </div>
      )}
    </div>
  );
}

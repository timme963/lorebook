import { useEffect, useRef, useState } from 'react';
import QuestionCard from '../components/QuestionCard';
import { shuffle } from '../lib/courses';
import { db, type AnswerRecord, type CardRow, type ChapterRow } from '../lib/db';
import type { Question } from '../lib/schema';
import { dueCards, flagCard, gradeCard, previewIntervals, Rating, type Grade } from '../lib/srs';
import { href } from '../router';
import { tr } from '../lib/i18n';
import HandsFree from '../components/HandsFree';
import { weakCards } from '../lib/insights';
import { dictationSupported, ttsSupported } from '../lib/speech';

interface Item {
  card: CardRow;
  q: Question;
  chapter: ChapterRow;
}

const SESSION_MAX = 50;

async function loadQueue(courseId?: string, focus?: 'weak'): Promise<Item[]> {
  const cards =
    focus === 'weak' && courseId ? await weakCards(courseId) : (await dueCards(courseId)).slice(0, SESSION_MAX);
  const chapterIds = [...new Set(cards.map((c) => c.chapterId))];
  const chapters = new Map((await db.chapters.bulkGet(chapterIds)).filter(Boolean).map((c) => [c!.id, c!]));
  const items: Item[] = [];
  for (const card of cards) {
    const ch = chapters.get(card.chapterId);
    const q =
      ch && [...ch.content.pretest, ...ch.content.posttest, ...ch.content.review].find((x) => x.id === card.questionId);
    if (ch && q) items.push({ card, q, chapter: ch });
  }
  // interleaving: mix chapters instead of blocks
  return shuffle(items);
}

function RatingButtons({ item, record, onRate }: { item: Item; record: AnswerRecord; onRate: (g: Grade) => void }) {
  const iv = previewIntervals(item.card);
  const auto = record.correct !== null;
  if (auto && !record.correct) {
    return (
      <button className="btn primary" onClick={() => onRate(Rating.Again)} autoFocus>
        {tr(`Weiter (kommt in ${iv[Rating.Again]} wieder)`, `Next (back in ${iv[Rating.Again]})`)}
      </button>
    );
  }
  const suggested: Grade = auto
    ? Rating.Good
    : record.score >= 0.99
      ? Rating.Good
      : record.score >= 0.5
        ? Rating.Hard
        : Rating.Again;
  const buttons: [Grade, string][] = auto
    ? [
        [Rating.Hard, tr('Schwer', 'Hard')],
        [Rating.Good, tr('Gut', 'Good')],
        [Rating.Easy, tr('Leicht', 'Easy')],
      ]
    : [
        [Rating.Again, tr('Nochmal', 'Again')],
        [Rating.Hard, tr('Schwer', 'Hard')],
        [Rating.Good, tr('Gut', 'Good')],
        [Rating.Easy, tr('Leicht', 'Easy')],
      ];
  return (
    <div className="rating">
      <p className="muted small">{tr('Wie leicht fiel es dir?', 'How easy was it?')}</p>
      <div className="row gap wrap">
        {buttons.map(([g, label]) => (
          <button
            key={g}
            className={`btn rate rate-${g} ${g === suggested ? 'primary' : ''}`}
            onClick={() => onRate(g)}
          >
            {label}
            <small>{iv[g]}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ReviewPage({ courseId, focus }: { courseId?: string; focus?: 'weak' }) {
  const [queue, setQueue] = useState<Item[]>();
  const [pos, setPos] = useState(0);
  const [stats, setStats] = useState({ done: 0, good: 0 });
  const [flagging, setFlagging] = useState(false);
  const [reason, setReason] = useState('');
  const [handsFree, setHandsFree] = useState(false);
  // prevents a double click from rating a card twice and skipping the next one
  const rating = useRef(false);
  const canHandsFree = ttsSupported() && dictationSupported();
  const title = focus === 'weak' ? tr('Schwachstellen-Training', 'Weak-spot training') : tr('Wiederholung', 'Review');

  useEffect(() => {
    loadQueue(courseId, focus).then(setQueue, (e: unknown) => console.error('[lorebook] review queue', e));
  }, [courseId, focus]);

  if (!queue) return null;
  const item = queue[pos];
  const back = courseId ? href({ name: 'course', id: courseId }) : href({ name: 'home' });

  if (!item) {
    return (
      <div className="stack">
        <section className="card result">
          <p className="eyebrow">{title}</p>
          {stats.done === 0 ? (
            <>
              <h2>
                {focus === 'weak'
                  ? tr('Keine Schwachstellen 🎉', 'No weak spots 🎉')
                  : tr('Nichts fällig 🎉', 'Nothing due 🎉')}
              </h2>
              <p>
                {focus === 'weak'
                  ? tr(
                      'Für das Training braucht es Lernziele mit Wiederholungen. Schließe Kapitel ab und wiederhole ein paar Tage.',
                      'Training needs objectives with reviews. Complete chapters and review for a few days.',
                    )
                  : tr(
                      "Alles wiederholt, was gerade dran ist. Komm morgen wieder – genau der Abstand macht's.",
                      'Everything due has been reviewed. Come back tomorrow – the gap is what makes it work.',
                    )}
              </p>
            </>
          ) : (
            <>
              <h2>{tr('Geschafft!', 'Done!')}</h2>
              <div className="compare">
                <div>
                  <span className="big">{stats.done}</span>
                  <span className="muted small">{tr('Karten', 'cards')}</span>
                </div>
                <div>
                  <span className="big accent">{Math.round((stats.good / stats.done) * 100)} %</span>
                  <span className="muted small">{tr('gewusst', 'known')}</span>
                </div>
              </div>
              <p>+{stats.good * 10 + (stats.done - stats.good) * 4} XP</p>
            </>
          )}
          <div className="row gap wrap center">
            <a className="btn primary" href={back}>
              {tr('Fertig', 'Done')}
            </a>
            {stats.done > 0 && focus !== 'weak' && (
              <button
                className="btn"
                onClick={async () => {
                  setPos(0);
                  setStats({ done: 0, good: 0 });
                  setQueue(await loadQueue(courseId));
                }}
              >
                {tr('Nach weiteren fälligen Karten suchen', 'Look for more due cards')}
              </button>
            )}
          </div>
        </section>
      </div>
    );
  }

  async function rateItem(it: Item, g: Grade) {
    if (rating.current) return;
    rating.current = true;
    try {
      await gradeCard(it.card, g);
      setStats((s) => ({
        done: s.done + 1,
        good: s.good + (g === Rating.Again ? 0 : 1),
      }));
      setPos((p) => p + 1);
    } finally {
      rating.current = false;
    }
  }

  const current: Item = item;
  const rate = (g: Grade) => rateItem(current, g);

  async function flag() {
    await flagCard(current.card, reason.trim());
    setFlagging(false);
    setReason('');
    setPos((p) => p + 1);
  }

  return (
    <div className="stack">
      <a className="back" href={back}>
        {tr('← Beenden', '← Finish')}
      </a>
      <div className="row between">
        <h2>{title}</h2>
        <div className="row gap">
          {canHandsFree && !handsFree && (
            <button
              className="btn small"
              onClick={() => setHandsFree(true)}
              title={tr(
                'Fragen werden vorgelesen, du antwortest per Stimme',
                'Questions are read aloud, you answer by voice',
              )}
            >
              🎧 {tr('Freihändig', 'Hands-free')}
            </button>
          )}
          <span className="muted">
            {pos + 1} / {queue.length}
          </span>
        </div>
      </div>
      <div className="bar thin">
        <div style={{ width: `${(pos / queue.length) * 100}%` }} />
      </div>
      {handsFree ? (
        <HandsFree queue={queue} startPos={pos} onRate={rateItem} onExit={() => setHandsFree(false)} />
      ) : (
        <QuestionCard
          key={item.card.id}
          q={item.q}
          courseId={item.card.courseId}
          mode="feedback"
          onDone={() => undefined}
          after={(r) => <RatingButtons item={item} record={r} onRate={rate} />}
          meta={<span className="muted small">{item.chapter.content.title}</span>}
        />
      )}
      {handsFree ? null : !flagging ? (
        <button className="btn small ghost self-start" onClick={() => setFlagging(true)}>
          {tr('⚑ Frage ist falsch oder unklar', '⚑ Question is wrong or unclear')}
        </button>
      ) : (
        <div className="card stack">
          <p className="small">
            {tr(
              'Die Frage wird aus der Wiederholung genommen. Auf der Kursseite kannst du sie wieder freigeben.',
              'The question is removed from review. You can release it again on the course page.',
            )}
          </p>
          <input
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={tr('Was stimmt nicht? (optional)', "What's wrong? (optional)")}
          />
          <div className="row gap">
            <button className="btn primary" onClick={flag}>
              {tr('Melden', 'Report')}
            </button>
            <button className="btn ghost" onClick={() => setFlagging(false)}>
              {tr('Abbrechen', 'Cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

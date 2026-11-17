import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { tr } from '../lib/i18n';
import { objectiveStats, weakObjectives } from '../lib/insights';
import { href } from '../router';
import Rich from './Rich';

const SHOW = 5;

function tone(r: number): string {
  return r >= 0.9 ? 'good' : r >= 0.75 ? 'ok' : 'weak';
}

/** Wie gut sitzt welches Lernziel? Schwächste zuerst, mit Button fürs gezielte Training. */
export default function ObjectiveInsights({ courseId }: { courseId: string }) {
  const stats = useLiveQuery(() => objectiveStats(courseId), [courseId]);
  const [all, setAll] = useState(false);
  if (!stats || stats.length === 0) return null;

  const measured = stats.filter((s) => s.retention !== undefined);
  const weak = weakObjectives(stats);
  const list = all ? stats : stats.slice(0, SHOW);

  return (
    <section className="card stack">
      <div className="row between wrap gap">
        <h3>{tr('Wie gut sitzt was?', 'How well do you know it?')}</h3>
        {weak.length > 0 && (
          <a className="btn small primary" href={href({ name: 'review', courseId, focus: 'weak' })}>
            🎯 {tr('Schwachstellen trainieren', 'Train weak spots')}
          </a>
        )}
      </div>
      <p className="muted small">
        {measured.length === 0
          ? tr('Sobald du ein paar Tage wiederholt hast, siehst du hier pro Lernziel, wie sicher es sitzt.', 'Once you have reviewed for a few days, you will see here how well each objective sticks.')
          : tr('Geschätzte Chance, dass du es jetzt weißt (aus deinen Wiederholungen). Schwächste zuerst.', 'Estimated chance that you know it right now (from your reviews). Weakest first.')}
      </p>
      <ul className="insight-list">
        {list.map((s) => (
          <li key={s.key}>
            <div className="row between gap">
              <span className="grow small">
                <span className="muted">{tr('Kap.', 'Ch.')} {s.chapterNumber} · </span>
                <Rich text={s.text} />
              </span>
              <span className={`small nowrap insight-${s.retention === undefined ? 'none' : tone(s.retention)}`}>
                {s.retention === undefined ? '–' : `${Math.round(s.retention * 100)} %`}
                {s.lapses > 0 && <span className="muted"> · {s.lapses}× {tr('vergessen', 'forgotten')}</span>}
              </span>
            </div>
            <div className="bar thin">
              <div className={s.retention === undefined ? '' : `fill-${tone(s.retention)}`} style={{ width: `${Math.round((s.retention ?? 0) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
      {stats.length > SHOW && (
        <button className="btn small ghost self-start" onClick={() => setAll((a) => !a)}>
          {all ? tr('Weniger zeigen', 'Show less') : tr(`Alle ${stats.length} Lernziele zeigen`, `Show all ${stats.length} objectives`)}
        </button>
      )}
    </section>
  );
}

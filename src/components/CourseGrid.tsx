import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import { moveCourse, reorderedIds, toggleStar } from '../lib/courses';
import type { ChapterRow, CourseRow } from '../lib/db';
import { plural, tr } from '../lib/i18n';
import type { CardRow } from '../lib/db';
import { href } from '../router';

interface CourseGridProps {
  readonly courses: CourseRow[];
  readonly chapters: ChapterRow[];
  readonly due: CardRow[];
}

/** Course cards on the home page: starred ones first, order changed by dragging the handle. */
export default function CourseGrid({ courses, chapters, due }: CourseGridProps) {
  // order shown while the drop is being saved, so the card does not jump back for a moment
  const [pending, setPending] = useState<string[]>();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const byId = new Map(courses.map((c) => [c.id, c]));
  const shown = pending?.flatMap((id) => byId.get(id) ?? []) ?? courses;

  async function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    setPending(reorderedIds(courses, activeId, overId));
    try {
      await moveCourse(activeId, overId);
    } finally {
      setPending(undefined);
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={shown.map((c) => c.id)} strategy={rectSortingStrategy}>
        <div className="grid">
          {shown.map((c) => {
            const chs = chapters.filter((ch) => ch.courseId === c.id);
            return (
              <CourseCard
                key={c.id}
                course={c}
                chapterCount={chs.length}
                done={chs.filter((ch) => ch.phase === 'done').length}
                dueCount={due.filter((d) => d.courseId === c.id).length}
                draggable={courses.length > 1}
              />
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}

interface CourseCardProps {
  readonly course: CourseRow;
  readonly chapterCount: number;
  readonly done: number;
  readonly dueCount: number;
  readonly draggable: boolean;
}

function CourseCard({ course: c, chapterCount, done, dueCount, draggable }: CourseCardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: c.id,
  });
  const style = { transform: CSS.Translate.toString(transform), transition };
  const starLabel = c.starred ? tr('Stern entfernen', 'Remove star') : tr('Mit Stern nach oben', 'Star and pin to top');
  const classes = ['card', 'course-card', c.starred ? 'starred' : '', isDragging ? 'dragging' : ''].filter(Boolean);

  return (
    <div ref={setNodeRef} style={style} className={classes.join(' ')}>
      <div className="course-head">
        {draggable && (
          <button
            ref={setActivatorNodeRef}
            className="drag-handle"
            title={tr('Ziehen, um die Reihenfolge zu ändern', 'Drag to reorder')}
            aria-label={tr(`${c.title} verschieben`, `Move ${c.title}`)}
            {...attributes}
            {...listeners}
          >
            ⠿
          </button>
        )}
        <h3>
          <a className="course-link" href={href({ name: 'course', id: c.id })}>
            {c.title}
          </a>
        </h3>
        <button
          className="star-btn"
          aria-pressed={!!c.starred}
          title={starLabel}
          aria-label={starLabel}
          onClick={() => toggleStar(c.id)}
        >
          {c.starred ? '★' : '☆'}
        </button>
      </div>
      <p className="muted small">
        {plural(chapterCount, 'Kapitel', 'Kapitel', 'chapter', 'chapters')} · {done} {tr('abgeschlossen', 'completed')}
        {dueCount ? ` · ${dueCount} ${tr('fällig', 'due')}` : ''}
      </p>
      <div className="bar">
        <div style={{ width: chapterCount ? `${(done / chapterCount) * 100}%` : '0%' }} />
      </div>
    </div>
  );
}

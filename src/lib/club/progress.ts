import type { Course, Lesson, LessonProgress } from './types.ts';
import { sortedLessons } from './tier.ts';

export type ProgressMap = Record<string, LessonProgress | undefined>;

/** Percentuale 0-100 di lezioni completate tra quelle accessibili (o tutte se `only` e' assente). */
export function courseProgress(course: Course, prog: ProgressMap, only?: (l: Lesson) => boolean): { done: number; total: number; pct: number } {
  const list = course.lessons.filter((l) => (only ? only(l) : true));
  const done = list.filter((l) => prog[l.id]?.done).length;
  return { done, total: list.length, pct: list.length ? Math.round((done / list.length) * 100) : 0 };
}

/** "Continua da dove eri": ultima lezione toccata non completata, altrimenti la prima non completata. */
export function resumeLesson(course: Course, prog: ProgressMap, only?: (l: Lesson) => boolean): { lesson: Lesson; posSec: number } | null {
  const list = sortedLessons(course).filter((l) => (only ? only(l) : true));
  if (!list.length) return null;
  const started = list.filter((l) => prog[l.id] && !prog[l.id]!.done && ((prog[l.id]!.posSec ?? 0) > 0 || (prog[l.id]!.page ?? 0) > 1))
    .sort((a, b) => (prog[b.id]!.ts) - (prog[a.id]!.ts))[0];
  if (started) return { lesson: started, posSec: prog[started.id]!.posSec ?? 0 };
  const next = list.find((l) => !prog[l.id]?.done);
  return next ? { lesson: next, posSec: 0 } : null;
}

/** Lezione successiva a `lessonId` (nell'ordine del corso). */
export function nextLesson(course: Course, lessonId: string): Lesson | null {
  const list = sortedLessons(course);
  const i = list.findIndex((l) => l.id === lessonId);
  return i >= 0 && i < list.length - 1 ? list[i + 1] : null;
}

/** Una lezione video/audio conta come vista quando si e' oltre il 90% della durata. */
export const countsAsWatched = (posSec: number, durationSec?: number) => !!durationSec && durationSec > 0 && posSec / durationSec >= 0.9;

/** Durata totale (secondi) delle lezioni con durata. */
export const totalDuration = (course: Course) => course.lessons.reduce((a, l) => a + (l.durationSec ?? 0), 0);

export function fmtDurationShort(sec: number): string {
  if (sec < 60) return `${Math.round(sec)} s`;
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
}

import type { CourseDefinition, ProgressState } from './types.js';

export function storageKey(course: CourseDefinition): string {
  return `mcf:${course.id}:${course.version || 'unversioned'}`;
}
export function emptyState(course: CourseDefinition): ProgressState {
  return {
    schema: 1,
    courseId: course.id,
    version: course.version ?? null,
    questions: {},
    activities: {},
    assessments: {},
    lessons: {},
    questionOrders: {},
    completedAt: null,
  };
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
export function validState(value: unknown, course: CourseDefinition): value is ProgressState {
  if (
    !record(value) ||
    value.schema !== 1 ||
    value.courseId !== course.id ||
    value.version !== (course.version ?? null)
  )
    return false;
  if (
    !['questions', 'activities', 'assessments', 'lessons', 'questionOrders'].every((key) =>
      record(value[key]),
    )
  )
    return false;
  if (value.completedAt !== null && typeof value.completedAt !== 'string') return false;
  const booleans = (item: unknown) =>
    record(item) && Object.values(item).every((entry) => typeof entry === 'boolean');
  if (!booleans(value.activities) || !booleans(value.lessons)) return false;
  if (
    !Object.values(value.questionOrders as Record<string, unknown>).every(
      (entry) => Array.isArray(entry) && entry.every((id) => typeof id === 'string'),
    )
  )
    return false;
  if (
    !Object.values(value.questions as Record<string, unknown>).every(
      (entry) =>
        record(entry) &&
        typeof entry.complete === 'boolean' &&
        (typeof entry.correct === 'boolean' || entry.correct === null),
    )
  )
    return false;
  return Object.values(value.assessments as Record<string, unknown>).every(
    (entry) =>
      record(entry) &&
      typeof entry.submitted === 'boolean' &&
      typeof entry.score === 'number' &&
      Number.isFinite(entry.score) &&
      typeof entry.possible === 'number' &&
      Number.isFinite(entry.possible) &&
      (typeof entry.passed === 'boolean' || entry.passed === null),
  );
}
export function loadState(course: CourseDefinition): ProgressState {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey(course)) || 'null');
    return validState(value, course) ? value : emptyState(course);
  } catch {
    return emptyState(course);
  }
}
export function saveState(course: CourseDefinition, state: ProgressState): void {
  try {
    localStorage.setItem(storageKey(course), JSON.stringify(state));
  } catch {
    /* The reader remains usable when storage is blocked, but persistence is unavailable. */
  }
}

import type { CourseDefinition, ProgressState } from './types.js';
export function percent(course: CourseDefinition, state: ProgressState): number {
  return course.lessons.length
    ? Math.round(
        (course.lessons.filter((lesson) => state.lessons[lesson.id]).length /
          course.lessons.length) *
          100,
      )
    : 0;
}
export function refreshProgress(course: CourseDefinition, state: ProgressState): void {
  const value = percent(course, state);
  document.querySelectorAll<HTMLElement>('[data-progress]').forEach((node) => {
    node.textContent = `${value}%`;
  });
  document.querySelectorAll<HTMLElement>('[data-progress-bar]').forEach((node) => {
    node.style.width = `${value}%`;
  });
  document
    .querySelectorAll<HTMLElement>('[data-lesson-id]')
    .forEach((node) => node.classList.toggle('done', !!state.lessons[node.dataset.lessonId ?? '']));
  if (value === 100) {
    state.completedAt ||= new Date().toISOString();
    document.querySelectorAll('.badge').forEach((node) => node.classList.remove('hidden'));
    document.querySelectorAll<HTMLElement>('[data-completion-date]').forEach((node) => {
      node.textContent = new Date(state.completedAt!).toLocaleDateString();
    });
  }
}

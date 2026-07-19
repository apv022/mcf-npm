import { saveState, validState } from './storage.js';
import type { CourseDefinition, ProgressState } from './types.js';
export function wireTransfer(course: CourseDefinition, getState: () => ProgressState): void {
  document.querySelector<HTMLElement>('[data-export]')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(getState(), null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${course.id}-progress.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  });
  document
    .querySelector<HTMLInputElement>('[data-import]')
    ?.addEventListener('change', async (event) => {
      try {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const value: unknown = JSON.parse(await file.text());
        if (!validState(value, course)) throw new Error();
        saveState(course, value);
        location.reload();
      } catch {
        alert('This is not a valid progress file for this course version.');
      }
    });
}

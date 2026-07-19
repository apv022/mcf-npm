import { evaluateEssay } from './essays.js';
import { wireTransfer } from './import-export.js';
import { completion, evaluateQuestion, hasResponse, responseFrom } from './questions.js';
import { refreshProgress } from './progress.js';
import { loadState, saveState } from './storage.js';
import type {
  ActivityDefinition,
  CourseDefinition,
  ProgressState,
  QuestionDefinition,
} from './types.js';

declare global {
  interface Window {
    MCF_COURSE: CourseDefinition;
  }
}
const course = window.MCF_COURSE;
const state: ProgressState = loadState(course);
const lessonId = document.body.dataset.lesson;
const lesson = course.lessons.find((item) => item.id === lessonId);
const key = (activity: ActivityDefinition, question?: QuestionDefinition) =>
  `${lessonId}:${activity.id}${question ? `:${question.id}` : ''}`;
function persist(): void {
  saveState(course, state);
  updateCompletion();
}
function restore(element: HTMLElement, value: unknown): void {
  if (value === undefined) return;
  element.querySelectorAll<HTMLInputElement>('input').forEach((input) => {
    input.checked = Array.isArray(value)
      ? value.includes(input.value)
      : input.value === String(value);
  });
  const text = element.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    'textarea,input.text-response',
  );
  if (text) text.value = String(value);
}
function chooseQuestions(activity: ActivityDefinition): string[] {
  const activityKey = key(activity);
  if (state.questionOrders[activityKey]) return state.questionOrders[activityKey];
  const ids = activity.questions.map((question) => question.id);
  if (activity.randomize)
    for (let index = ids.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [ids[index], ids[other]] = [ids[other], ids[index]];
    }
  state.questionOrders[activityKey] = ids.slice(0, activity.question_pool_size ?? ids.length);
  saveState(course, state);
  return state.questionOrders[activityKey];
}
const selectedQuestions = (activity: ActivityDefinition) => {
  const ids = new Set(chooseQuestions(activity));
  return activity.questions.filter((question) => ids.has(question.id));
};
function showFeedback(element: HTMLElement, messages: string[], result?: boolean | null): void {
  const output = element.querySelector<HTMLElement>('.feedback')!;
  output.textContent = messages.join(' ');
  output.className = `feedback ${result === true ? 'correct' : result === false ? 'incorrect' : ''}`;
}
function wireQuestion(activity: ActivityDefinition, element: HTMLElement): void {
  const question = activity.questions.find((item) => item.id === element.dataset.id)!;
  const stateKey = key(activity, question);
  restore(element, state.questions[stateKey]?.response);
  element
    .querySelector('.hint-button')
    ?.addEventListener('click', () => element.querySelector('.hint')?.classList.toggle('hidden'));
  element.querySelectorAll('input,textarea').forEach((control) =>
    control.addEventListener('input', () => {
      const response = responseFrom(element),
        previous = state.questions[stateKey];
      state.questions[stateKey] = {
        response,
        complete: previous?.complete ?? false,
        correct: previous?.correct ?? null,
      };
      if (question.type === 'essay') {
        const result = evaluateEssay(String(response), question);
        showFeedback(
          element,
          result.feedback.length
            ? result.feedback
            : ['Response saved. Completion requirements met.'],
          null,
        );
        if (activity.type === 'assessment') state.questions[stateKey].complete = result.complete;
      }
      persist();
    }),
  );
  if (activity.type !== 'assessment')
    element.querySelector('.check-button')?.addEventListener('click', () => {
      const response = responseFrom(element),
        result = completion(question, response, activity.type === 'practice');
      state.questions[stateKey] = { response, complete: result.complete, correct: result.correct };
      if (question.type === 'essay')
        showFeedback(
          element,
          result.feedback.length
            ? result.feedback
            : ['Response saved. Completion requirements met.'],
          null,
        );
      else if (!hasResponse(response)) showFeedback(element, result.feedback, null);
      else
        showFeedback(
          element,
          [result.correct ? 'Correct — nicely done.' : 'Not quite. Try again.'],
          result.correct,
        );
      if (result.correct === true)
        element.querySelector('.explanation')?.classList.remove('hidden');
      persist();
    });
}
function submitAssessment(activity: ActivityDefinition, container: HTMLElement): void {
  const selected = selectedQuestions(activity),
    unmet = selected.filter((question) => {
      if (!question.required) return false;
      const response = state.questions[key(activity, question)]?.response;
      return question.type === 'essay'
        ? !evaluateEssay(String(response ?? ''), question).complete
        : !hasResponse(response);
    });
  if (unmet.length) {
    container.querySelector<HTMLElement>('.assessment-result')!.textContent =
      `Complete all required questions before submitting: ${unmet.map((question) => question.id).join(', ')}.`;
    return;
  }
  let earned = 0,
    possible = 0;
  for (const question of selected) {
    const itemKey = key(activity, question),
      response = state.questions[itemKey]?.response;
    if (question.type === 'essay') {
      const essay = evaluateEssay(String(response ?? ''), question);
      state.questions[itemKey] = { response, complete: essay.complete, correct: null };
    } else {
      const correct = evaluateQuestion(question, response);
      if (question.required || hasResponse(response)) {
        possible += question.points;
        if (correct) earned += question.points;
      }
      state.questions[itemKey] = { response, complete: hasResponse(response), correct };
    }
    container
      .querySelector(`[data-id="${CSS.escape(question.id)}"] .explanation`)
      ?.classList.remove('hidden');
  }
  const score = possible ? earned / possible : 1,
    passed = activity.passing_score === undefined ? null : score >= activity.passing_score;
  state.assessments[key(activity)] = { submitted: true, score, possible, passed };
  container.querySelector<HTMLElement>('.assessment-result')!.textContent =
    `Submitted score: ${earned}/${possible} (${Math.round(score * 100)}%). ${passed === null ? 'Submission complete.' : passed ? 'Passed.' : 'Not passed.'} Essays are completion-checked but excluded from automatic scoring.`;
  persist();
}
function updateCompletion(): void {
  if (lesson && lessonId) {
    for (const activity of lesson.activities ?? []) {
      const selected = selectedQuestions(activity);
      const complete =
        activity.type === 'notes'
          ? !!state.activities[key(activity)]
          : activity.type === 'assessment'
            ? !!state.assessments[key(activity)]?.submitted
            : selected
                .filter((question) => question.required)
                .every((question) => state.questions[key(activity, question)]?.complete);
      state.activities[key(activity)] = complete;
      document
        .querySelector(`[data-activity="${CSS.escape(activity.id)}"]`)
        ?.classList.toggle('complete', complete);
    }
    state.lessons[lessonId] = (lesson.activities ?? []).every(
      (activity) => state.activities[key(activity)],
    );
  }
  refreshProgress(course, state);
  saveState(course, state);
}
for (const activityElement of document.querySelectorAll<HTMLElement>('.activity')) {
  const activity = lesson?.activities?.find((item) => item.id === activityElement.dataset.activity);
  if (!activity) continue;
  const order = chooseQuestions(activity),
    questions = activityElement.querySelector('.questions');
  for (const id of order) {
    const element = activityElement.querySelector<HTMLElement>(
      `.question[data-id="${CSS.escape(id)}"]`,
    );
    if (element) {
      questions?.append(element);
      wireQuestion(activity, element);
    }
  }
  activityElement.querySelectorAll<HTMLElement>('.question').forEach((element) => {
    if (!order.includes(element.dataset.id!)) element.remove();
  });
  activityElement.querySelector('.notes-complete')?.addEventListener('click', () => {
    state.activities[key(activity)] = true;
    persist();
  });
  activityElement
    .querySelector('.assessment-submit')
    ?.addEventListener('click', () => submitAssessment(activity, activityElement));
  const submitted = state.assessments[key(activity)];
  if (submitted)
    activityElement.querySelector<HTMLElement>('.assessment-result')!.textContent =
      `Previously submitted: ${Math.round(submitted.score * 100)}%. ${submitted.passed === null ? '' : submitted.passed ? 'Passed.' : 'Not passed.'}`;
}
wireTransfer(course, () => state);
updateCompletion();

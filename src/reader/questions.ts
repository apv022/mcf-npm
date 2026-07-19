import { evaluateEssay } from './essays.js';
import type { QuestionDefinition } from './types.js';

export function hasResponse(value: unknown): boolean {
  return Array.isArray(value) ? value.length > 0 : String(value ?? '').trim().length > 0;
}
export function evaluateQuestion(question: QuestionDefinition, response: unknown): boolean | null {
  switch (question.type) {
    case 'multiple_select':
      return (
        JSON.stringify([...(response as string[])].sort()) ===
        JSON.stringify([...(question.answer as string[])].sort())
      );
    case 'true_false':
      return (response === 'true') === question.answer;
    case 'numeric':
      return (
        hasResponse(response) &&
        Number.isFinite(Number(response)) &&
        Math.abs(Number(response) - Number(question.answer)) <= (question.tolerance ?? 0)
      );
    case 'short_answer':
      return (
        String(response).trim().toLocaleLowerCase() ===
        String(question.answer).trim().toLocaleLowerCase()
      );
    case 'essay':
      return null;
    default:
      return response === question.answer;
  }
}
export function responseFrom(element: HTMLElement): unknown {
  const inputs = [
    ...element.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input,textarea'),
  ];
  if (element.dataset.type === 'multiple_select')
    return inputs
      .filter((input) => input instanceof HTMLInputElement && input.checked)
      .map((input) => input.value);
  const checked = inputs.find((input) => input instanceof HTMLInputElement && input.checked);
  return checked?.value ?? inputs[0]?.value ?? '';
}
export function completion(
  question: QuestionDefinition,
  response: unknown,
  requireCorrect: boolean,
): { complete: boolean; correct: boolean | null; feedback: string[] } {
  if (question.type === 'essay') {
    const result = evaluateEssay(String(response ?? ''), question);
    return { complete: result.complete, correct: null, feedback: result.feedback };
  }
  if (!hasResponse(response))
    return { complete: false, correct: null, feedback: ['Add a response first.'] };
  const correct = evaluateQuestion(question, response);
  return { complete: requireCorrect ? correct === true : true, correct, feedback: [] };
}

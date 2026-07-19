import assert from 'node:assert/strict';
import test from 'node:test';
import { completion, evaluateQuestion } from '../src/reader/questions.js';

const question = (type: string, answer: unknown, tolerance?: number) => ({
  id: 'q',
  type,
  answer,
  tolerance,
  points: 1,
  required: true,
});
test('choice and boolean answer semantics are exact', () => {
  assert.equal(evaluateQuestion(question('multiple_choice', 'a'), 'a'), true);
  assert.equal(evaluateQuestion(question('multiple_select', ['a', 'b']), ['b', 'a']), true);
  assert.equal(evaluateQuestion(question('true_false', false), 'false'), true);
});
test('numeric uses absolute tolerance', () => {
  assert.equal(evaluateQuestion(question('numeric', 10, 0.1), '10.1'), true);
  assert.equal(evaluateQuestion(question('numeric', 10, 0.1), '10.11'), false);
});
test('short answers trim and compare case-insensitively', () => {
  assert.equal(evaluateQuestion(question('short_answer', 'MCF'), '  mcf '), true);
});
test('practice completion requires correctness, assessment response completion does not', () => {
  assert.equal(completion(question('multiple_choice', 'a'), 'b', true).complete, false);
  assert.equal(completion(question('multiple_choice', 'a'), 'b', false).complete, true);
});

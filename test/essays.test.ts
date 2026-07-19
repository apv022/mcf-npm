import assert from 'node:assert/strict';
import test from 'node:test';
import { countSentences, countWords, evaluateEssay, keywordMatches } from '../src/reader/essays.js';

test('word counting splits trimmed text on whitespace', () => {
  assert.equal(countWords('  one\n two\tthree  '), 3);
  assert.equal(countWords(''), 0);
});
test('sentence counting follows terminal punctuation rules', () => {
  assert.equal(countSentences('One. Two? Three!'), 3);
  assert.equal(countSentences('One. Final fragment'), 2);
});
test('keywords use case-insensitive whole words and normalized phrases', () => {
  assert.equal(
    keywordMatches('Velocity uses DISPLACEMENT; not directionality.', [
      'velocity',
      'displacement',
      'direction',
    ]),
    2,
  );
  assert.equal(
    keywordMatches('A local-first course saves progress.', ['local-first course', 'progress']),
    2,
  );
});
test('completion reports every unmet requirement', () => {
  const question = {
    id: 'essay',
    type: 'essay',
    points: 1,
    required: true,
    minimum_words: 8,
    minimum_sentences: 2,
    keywords: ['velocity', 'direction'],
    minimum_keywords: 2,
  };
  const incomplete = evaluateEssay('Velocity is useful.', question);
  assert.equal(incomplete.complete, false);
  assert.deepEqual(incomplete.feedback, [
    'Write at least 2 sentences. Current: 1.',
    'Write at least 8 words. Current: 3.',
    'Mention at least 2 required concepts. Current: 1.',
  ]);
  assert.equal(
    evaluateEssay(
      'Velocity includes direction. This response contains enough useful words.',
      question,
    ).complete,
    true,
  );
});

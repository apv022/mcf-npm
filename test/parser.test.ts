import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { parseCourse, parseLessonSource } from '../src/parser.js';
import { ValidationError } from '../src/model.js';

const root = path.resolve('examples');
test('parses YAML package order and lesson activities', async () => {
  const course = await parseCourse(path.join(root, 'showcase'));
  assert.deepEqual(
    course.chapters[0].lessons.map((x) => x.id),
    ['rich-content', 'questions'],
  );
  assert.equal(course.chapters[0].lessons[1].activities.length, 2);
});
test('parses all six question types', async () => {
  const course = await parseCourse(path.join(root, 'showcase'));
  const types = course.chapters
    .flatMap((c) => c.lessons)
    .flatMap((l) => l.activities)
    .flatMap((a) => a.questions)
    .map((q) => q.type);
  assert.deepEqual(types, [
    'multiple_choice',
    'multiple_select',
    'true_false',
    'numeric',
    'short_answer',
    'essay',
  ]);
  const essay = course.chapters[0].lessons[1].activities[1].questions[2];
  assert.equal(essay.minimum_words, 12);
  assert.equal(essay.minimum_sentences, 2);
  assert.deepEqual(essay.keywords, ['local', 'progress', 'course']);
  assert.equal(essay.minimum_keywords, 2);
});
test('rejects invalid essay completion requirements', () => {
  const issues: import('../src/model.js').ValidationIssue[] = [];
  parseLessonSource(
    '---\nid: bad\ntitle: Bad\n---\n:::mcf-activity\ntype: practice\nid: p\n:::\n```mcf-question\nid: e\ntype: essay\nprompt: Explain\nminimum_words: 0\nkeywords: [one]\nminimum_keywords: 2\n```\n:::mcf-end\n',
    'bad.mcf',
    issues,
  );
  assert.ok(issues.some((item) => item.message.includes('positive integer')));
  assert.ok(issues.some((item) => item.message.includes('must not exceed')));
});
test('rejects content outside activity boundaries', () => {
  const issues: import('../src/model.js').ValidationIssue[] = [];
  parseLessonSource('---\nid: bad\ntitle: Bad\n---\nstray', 'bad.mcf', issues);
  assert.ok(issues.some((x) => x.message.includes('outside')));
});
test('rejects invalid answer references', () => {
  const issues: import('../src/model.js').ValidationIssue[] = [];
  parseLessonSource(
    '---\nid: bad\ntitle: Bad\n---\n:::mcf-activity\ntype: practice\nid: p\n:::\n```mcf-question\nid: q\ntype: multiple_choice\nprompt: Pick\noptions:\n - id: a\n   text: A\nanswer: b\n```\n:::mcf-end\n',
    'bad.mcf',
    issues,
  );
  assert.ok(issues.some((x) => x.message.includes('no option')));
});
test('rejects path traversal', async () => {
  await assert.rejects(
    parseCourse(path.join(root, 'invalid-traversal')),
    (error: unknown) => error instanceof ValidationError && error.message.includes('escapes'),
  );
});

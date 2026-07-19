import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCourse } from '../src/parser.js';
import { rich } from '../src/render.js';

test('renders CommonMark, tables, media, and local/remote references', async () => {
  const course = await parseCourse('examples/showcase'),
    lesson = course.chapters[0].lessons[0],
    html = rich(lesson.activities[0].content, lesson, course);
  for (const token of [
    '<h2>',
    '<strong>',
    '<table>',
    '<pre>',
    '<img',
    '<audio',
    '<video',
    '<iframe',
  ])
    assert.match(html, new RegExp(token));
  assert.match(html, /<img src="\.\.\/assets\/images\/path\.svg"/);
  assert.match(html, /Remote media/);
});
test('renders inline/display math and gracefully preserves malformed math', async () => {
  const course = await parseCourse('examples/showcase'),
    lesson = course.chapters[0].lessons[0];
  assert.match(rich('$x=1$\n\n$$y=2$$', lesson, course), /katex-display/);
  const malformed = rich('$\\notacommand{$', lesson, course);
  assert.match(malformed, /katex-error|notacommand/);
});
test('sanitizes scripts, event handlers, and unsafe protocols', async () => {
  const course = await parseCourse('examples/showcase'),
    lesson = course.chapters[0].lessons[0],
    html = rich(
      '<script>alert(1)</script><img src="javascript:alert(1)" onerror="alert(2)">',
      lesson,
      course,
    );
  assert.doesNotMatch(html, /<script|onerror|javascript:/i);
});

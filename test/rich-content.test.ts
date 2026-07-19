import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCourse } from '../src/parser.js';
import { rich, youtubeVideoId } from '../src/render.js';

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
test('preserves derivative notation while rendering math through Markdown', async () => {
  const course = await parseCourse('examples/calculus-i'),
    lesson = course.chapters
      .flatMap((chapter) => chapter.lessons)
      .find((item) => item.id.includes('derivative-definition'))!;
  const html = rich("$f'(x)=2x$\n\n$$f'(x)=\\lim_{h\\to0}\\frac{f(x+h)-f(x)}{h}$$", lesson, course);
  assert.match(html, /class="katex"/);
  assert.doesNotMatch(html, /&#39;|katex-error/);
});
test('does not replace literal text resembling an internal math placeholder', async () => {
  const course = await parseCourse('examples/showcase'),
    lesson = course.chapters[0].lessons[0],
    literal = 'MCFMATHPLACEHOLDER0END',
    html = rich(`${literal} and $x$`, lesson, course);
  assert.match(html, new RegExp(literal));
  assert.equal(html.match(/class="katex"/g)?.length, 1);
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
test('normalizes supported YouTube references for iframe embeds', () => {
  assert.equal(youtubeVideoId('youtube:Dw_tGRblTXk'), 'Dw_tGRblTXk');
  assert.equal(youtubeVideoId('https://www.youtube.com/watch?v=Dw_tGRblTXk'), 'Dw_tGRblTXk');
  assert.equal(youtubeVideoId('https://youtu.be/Dw_tGRblTXk'), 'Dw_tGRblTXk');
  assert.equal(youtubeVideoId('https://www.youtube.com/embed/Dw_tGRblTXk'), 'Dw_tGRblTXk');
});

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { compile } from '../src/compiler.js';
import { lessonBody } from '../src/render.js';
import { parseCourse } from '../src/parser.js';

test('renders sanitized rich content and interactive questions', async () => {
  const course = await parseCourse('examples/showcase');
  const lesson = course.chapters[0].lessons[1];
  const html = lessonBody(lesson, course);
  assert.match(html, /data-type="multiple_choice"/);
  assert.doesNotMatch(html, /<script/i);
  assert.match(html, /katex/);
  assert.doesNotMatch(html, /data-answer=/);
});
test('compiles end to end and preserves another library course', async () => {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), 'mcf-test-'));
  await compile('examples/minimal', output);
  await compile('examples/showcase', output);
  const library = JSON.parse(await fs.readFile(path.join(output, 'courses.json'), 'utf8'));
  assert.equal(library.length, 2);
  assert.ok(await fs.stat(path.join(output, 'mcf-showcase', 'lessons', 'questions.html')));
  assert.match(
    await fs.readFile(path.join(output, 'mcf-showcase', 'player.js'), 'utf8'),
    /localStorage/,
  );
  assert.match(
    await fs.readFile(path.join(output, 'mcf-showcase', 'lessons', 'rich-content.html'), 'utf8'),
    /\.\.\/katex\/katex\.min\.css/,
  );
  assert.ok(
    (await fs.readdir(path.join(output, 'mcf-showcase', 'katex', 'fonts'))).some((file) =>
      file.endsWith('.woff2'),
    ),
  );
  assert.ok(await fs.stat(path.join(output, 'mcf-showcase', 'assets', 'audio', 't-rex-roar.mp3')));
  assert.ok(await fs.stat(path.join(output, 'mcf-showcase', 'assets', 'video', 'flower.mp4')));
  assert.doesNotMatch(
    await fs.readFile(path.join(output, 'mcf-showcase', 'player.js'), 'utf8'),
    /import\s/,
  );
});
test('completion uses completed required lessons over all lessons', () => {
  const lessons = ['one', 'two', 'three'];
  const completed = new Set(['one', 'three']);
  assert.equal(
    Math.round((lessons.filter((x) => completed.has(x)).length / lessons.length) * 100),
    67,
  );
});

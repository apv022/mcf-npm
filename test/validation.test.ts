import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ValidationError } from '../src/model.js';
import { parseCourse, parseLessonSource } from '../src/parser.js';

async function fixture(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mcf-validation-'));
  await fs.cp('examples/minimal', root, { recursive: true });
  return root;
}
async function invalid(root: string, expected: RegExp): Promise<void> {
  await assert.rejects(
    parseCourse(root),
    (error: unknown) => error instanceof ValidationError && expected.test(error.message),
  );
}
test('rejects invalid YAML and missing required manifest fields', async () => {
  const root = await fixture();
  await fs.writeFile(path.join(root, 'manifest.yaml'), 'mcf: [\n');
  await invalid(root, /Invalid YAML/);
  const other = await fixture();
  await fs.writeFile(path.join(other, 'manifest.yaml'), 'mcf: "1.0"\n');
  await invalid(other, /Required field "id"/);
});
test('rejects unsupported versions and missing package paths', async () => {
  const root = await fixture();
  const manifest = await fs.readFile(path.join(root, 'manifest.yaml'), 'utf8');
  await fs.writeFile(
    path.join(root, 'manifest.yaml'),
    manifest.replace(/mcf:.*\n/, "mcf: '1.1'\n"),
  );
  await invalid(root, /Unsupported MCF version/);
  const other = await fixture();
  await fs.rm(path.join(other, 'chapters'), { recursive: true });
  await invalid(other, /chapters\/ directory/);
});
test('rejects missing chapter files, lesson directories, and lesson files', async () => {
  const root = await fixture();
  await fs.rm(path.join(root, 'chapters/start/chapter.yaml'));
  await invalid(root, /Invalid YAML/);
  const other = await fixture();
  await fs.rm(path.join(other, 'chapters/start/lessons'), { recursive: true });
  await invalid(other, /lessons\/ directory/);
  const third = await fixture();
  await fs.rm(path.join(third, 'chapters/start/lessons/01-welcome.mcf'));
  await invalid(third, /Lesson path does not exist/);
});
test('rejects missing assets and invalid numeric question schema', async () => {
  const root = await fixture();
  const lesson = path.join(root, 'chapters/start/lessons/01-welcome.mcf');
  await fs.appendFile(lesson, '\n');
  await fs.writeFile(
    lesson,
    (await fs.readFile(lesson, 'utf8')).replace(
      'This is a valid',
      '![missing](../../../assets/no.png)\n\nThis is a valid',
    ),
  );
  await invalid(root, /Referenced local asset does not exist/);
  const issues: import('../src/model.js').ValidationIssue[] = [];
  parseLessonSource(
    '---\nid: bad\ntitle: Bad\n---\n:::mcf-activity\ntype: practice\nid: p\n:::\n```mcf-question\nid: q\ntype: numeric\nprompt: Number\nanswer: nope\ntolerance: -1\n```\n:::mcf-end\n',
    'bad.mcf',
    issues,
  );
  assert.ok(issues.some((item) => item.message.includes('numeric')));
  assert.ok(issues.some((item) => item.message.includes('tolerance')));
});
test('rejects symlink traversal and unsupported activity/question types', async () => {
  const root = await fixture();
  await fs.mkdir(path.join(root, 'assets'));
  await fs.symlink('/etc/hosts', path.join(root, 'assets', 'outside.txt'));
  const lesson = path.join(root, 'chapters/start/lessons/01-welcome.mcf');
  await fs.writeFile(
    lesson,
    (await fs.readFile(lesson, 'utf8')).replace(
      'This is a valid',
      '[outside](../../../assets/outside.txt)\n\nThis is a valid',
    ),
  );
  await invalid(root, /escapes the course root/);
  const issues: import('../src/model.js').ValidationIssue[] = [];
  parseLessonSource(
    '---\nid: bad\ntitle: Bad\n---\n:::mcf-activity\ntype: lab\nid: bad-activity\n:::\n```mcf-question\nid: q\ntype: unsupported\nprompt: Bad\n```\n:::mcf-end\n',
    'bad.mcf',
    issues,
  );
  assert.ok(issues.some((item) => item.message.includes('unsupported type "lab"')));
  assert.ok(issues.some((item) => item.message.includes('unsupported type "unsupported"')));
});

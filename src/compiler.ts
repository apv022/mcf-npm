import fs from 'node:fs/promises';
import path from 'node:path';
import type { Course, Lesson } from './model.js';
import { parseCourse } from './parser.js';
import { lessonBody, page } from './render.js';
import { LIBRARY_JS, PLAYER_JS } from './runtime.js';
import { STYLES } from './styles.js';

async function write(file: string, content: string) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
}
async function copyDir(source: string, target: string) {
  try {
    await fs.cp(source, target, { recursive: true, force: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}
function data(course: Course) {
  return {
    id: course.id,
    title: course.title,
    language: course.language,
    description: course.description,
    authors: course.authors,
    license: course.license,
    version: course.version,
    cover: course.cover,
    chapters: course.chapters.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      lessons: c.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        description: l.description,
        activities: l.activities.map((a) => ({ ...a, content: undefined })),
      })),
    })),
    lessons: course.chapters.flatMap((c) => c.lessons.map((l) => ({ id: l.id, title: l.title }))),
  };
}
function sidebar(course: Course, current?: string): string {
  const prefix = current ? '' : 'lessons/';
  return `<aside class="sidebar"><a href="../index.html">← Course library</a><h1>${course.title}</h1><div class="progress"><i data-progress-bar style="width:0"></i></div><b data-progress>0%</b><nav>${course.chapters.map((c) => `<div><div class="chapter-label">${c.title}</div>${c.lessons.map((l) => `<a class="lesson-link ${l.id === current ? 'current' : ''}" data-lesson-id="${l.id}" href="${prefix}${encodeURIComponent(l.id)}.html">${l.title}</a>`).join('')}</div>`).join('')}</nav></aside>`;
}
function lessonPage(course: Course, lesson: Lesson, index: number, all: Lesson[]): string {
  const prev = all[index - 1],
    next = all[index + 1];
  const body = `<div class="course-shell">${sidebar(course, lesson.id)}<main class="main"><div class="lesson"><header class="lesson-header"><span class="eyebrow">Lesson ${index + 1} of ${all.length}</span><h1>${lesson.title}</h1>${lesson.description ? `<p>${lesson.description}</p>` : ''}</header>${lessonBody(lesson, course)}<div class="badge hidden"><div class="badge-mark">✓</div><h2>Course complete</h2><p>${course.title}</p></div><nav class="lesson-nav">${prev ? `<a class="button" href="${encodeURIComponent(prev.id)}.html">← ${prev.title}</a>` : '<span></span>'}${next ? `<a class="button" href="${encodeURIComponent(next.id)}.html">${next.title} →</a>` : '<a class="button" href="../index.html">Course overview</a>'}</nav></div></main></div><script>window.MCF_COURSE=${JSON.stringify(data(course)).replace(/</g, '\\u003c')}</script>`;
  return page(
    `${lesson.title} · ${course.title}`,
    course.language,
    body,
    '../styles.css',
    '../player.js',
  ).replace('<body>', `<body data-lesson="${lesson.id}">`);
}
async function updateLibrary(output: string, course: Course) {
  const file = path.join(output, 'courses.json');
  let list: Record<string, unknown>[] = [];
  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
    if (Array.isArray(parsed)) list = parsed;
  } catch {
    /* A missing library is initialized below. */
  }
  const entry = {
    id: course.id,
    title: course.title,
    description: course.description,
    authors: course.authors,
    version: course.version,
    cover: course.cover,
    lessons: course.chapters.flatMap((c) => c.lessons.map((l) => l.id)),
  };
  list = [...list.filter((x) => x.id !== course.id), entry].sort((a, b) =>
    String(a.title).localeCompare(String(b.title)),
  );
  await write(file, JSON.stringify(list, null, 2) + '\n');
  await write(
    path.join(output, 'library.js'),
    `window.MCF_LIBRARY=${JSON.stringify(list).replace(/</g, '\\u003c')};\n${LIBRARY_JS}`,
  );
  const html = `<main class="library"><header><span class="eyebrow">Local-first learning</span><h1>Course library</h1><p>Your compiled MCF courses, available offline.</p></header><section id="courses" class="course-grid"></section></main>`;
  await write(
    path.join(output, 'index.html'),
    page('MCF Course Library', 'en', html, 'styles.css', 'library.js'),
  );
  await write(path.join(output, 'styles.css'), STYLES);
}
export async function compile(
  input: string,
  output = 'courses',
): Promise<{ course: Course; directory: string }> {
  const course = await parseCourse(input);
  const root = path.resolve(output),
    target = path.join(root, course.id),
    staging = path.join(root, `.${course.id}.tmp-${process.pid}`);
  await fs.rm(staging, { recursive: true, force: true });
  await fs.mkdir(path.join(staging, 'lessons'), { recursive: true });
  const courseData = data(course);
  await write(path.join(staging, 'course.json'), JSON.stringify(courseData, null, 2) + '\n');
  await write(path.join(staging, 'styles.css'), STYLES);
  await write(path.join(staging, 'player.js'), PLAYER_JS);
  await copyDir(path.join(course.root, 'assets'), path.join(staging, 'assets'));
  const all = course.chapters.flatMap((c) => c.lessons);
  for (const [i, lesson] of all.entries())
    await write(
      path.join(staging, 'lessons', `${lesson.id}.html`),
      lessonPage(course, lesson, i, all),
    );
  const overview = `<div class="course-shell">${sidebar(course)}<main class="main"><div class="lesson"><span class="eyebrow">MCF course</span><h1>${course.title}</h1><p>${course.description ?? ''}</p><p>${(course.authors ?? []).join(', ')}</p><div class="progress"><i data-progress-bar></i></div><b data-progress>0%</b><p><a class="button" href="lessons/${encodeURIComponent(all[0].id)}.html">Start course</a></p><button data-export>Export progress</button> <label class="button">Import progress<input data-import type="file" accept="application/json" hidden></label><div class="badge hidden"><div class="badge-mark">✓</div><h2>Course complete</h2><p>${course.title}</p></div></div></main></div><script>window.MCF_COURSE=${JSON.stringify(courseData).replace(/</g, '\\u003c')}</script>`;
  await write(
    path.join(staging, 'index.html'),
    page(course.title, course.language, overview, 'styles.css', 'player.js'),
  );
  await fs.rm(target, { recursive: true, force: true });
  await fs.rename(staging, target);
  await updateLibrary(root, course);
  return { course, directory: target };
}

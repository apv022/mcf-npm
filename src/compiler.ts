import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import type { Course, Lesson } from './model.js';
import { parseCourse } from './parser.js';
import { escape, lessonBody, page } from './render.js';

const require = createRequire(import.meta.url);
const readerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../reader');
const katexRoot = path.join(path.dirname(require.resolve('katex/package.json')), 'dist');

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
async function copyReferencedFiles(course: Course, target: string): Promise<void> {
  if (course.cover && !/^https?:/i.test(course.cover)) {
    const source = path.resolve(course.root, course.cover);
    await fs.mkdir(path.dirname(path.join(target, course.cover)), { recursive: true });
    await fs.copyFile(source, path.join(target, course.cover));
  }
  for (const lesson of course.chapters.flatMap((chapter) => chapter.lessons)) {
    const fields = lesson.activities.flatMap((activity) => [
      activity.content,
      ...activity.questions.flatMap((question) => [
        question.prompt,
        question.hint ?? '',
        question.explanation ?? '',
        ...(question.options ?? []).map((option) => option.text),
      ]),
    ]);
    for (const content of fields) {
      for (const match of content.matchAll(
        /!?\[[^\]]*\]\(([^\s)]+)|@\[(?:audio|video)\]\(([^\s)]+)/g,
      )) {
        const reference = match[1] ?? match[2];
        if (/^(?:https?:|youtube:|mailto:|#)/i.test(reference)) continue;
        const source = path.resolve(path.dirname(path.join(course.root, lesson.source)), reference);
        const relative = path.relative(course.root, source);
        if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
          await fs.mkdir(path.dirname(path.join(target, relative)), { recursive: true });
          await fs.copyFile(source, path.join(target, relative));
        }
      }
    }
  }
}
function data(course: Course) {
  const lessons = uniqueLessons(course);
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
    lessons: lessons.map((l) => ({
      id: l.id,
      title: l.title,
      activities: l.activities.map((activity) => ({
        ...activity,
        content: undefined,
      })),
    })),
  };
}
function uniqueLessons(course: Course): Lesson[] {
  return [
    ...new Map(
      course.chapters.flatMap((chapter) => chapter.lessons).map((lesson) => [lesson.id, lesson]),
    ).values(),
  ];
}
function sidebar(course: Course, current?: string): string {
  const prefix = current ? '' : 'lessons/';
  return `<aside class="sidebar"><a href="../index.html">← Course library</a><h1>${escape(course.title)}</h1><div class="progress"><i data-progress-bar style="width:0"></i></div><b data-progress>0%</b><nav>${course.chapters.map((c) => `<div><div class="chapter-label">${escape(c.title)}</div>${c.lessons.map((l) => `<a class="lesson-link ${l.id === current ? 'current' : ''}" data-lesson-id="${escape(l.id)}" href="${prefix}${encodeURIComponent(l.id)}.html">${escape(l.title)}</a>`).join('')}</div>`).join('')}</nav></aside>`;
}
function lessonPage(course: Course, lesson: Lesson, index: number, all: Lesson[]): string {
  const prev = all[index - 1],
    next = all[index + 1];
  const body = `<div class="course-shell">${sidebar(course, lesson.id)}<main class="main"><div class="lesson"><header class="lesson-header"><span class="eyebrow">Lesson ${index + 1} of ${all.length}</span><h1>${escape(lesson.title)}</h1>${lesson.description ? `<p>${escape(lesson.description)}</p>` : ''}</header>${lessonBody(lesson, course)}<div class="badge hidden"><div class="badge-mark">✓</div><h2>Course complete</h2><p>${escape(course.title)}</p><p>Completed <span data-completion-date></span></p></div><nav class="lesson-nav">${prev ? `<a class="button" href="${encodeURIComponent(prev.id)}.html">← ${escape(prev.title)}</a>` : '<span></span>'}${next ? `<a class="button" href="${encodeURIComponent(next.id)}.html">${escape(next.title)} →</a>` : '<a class="button" href="../index.html">Course overview</a>'}</nav></div></main></div><script>window.MCF_COURSE=${JSON.stringify(data(course)).replace(/</g, '\\u003c')}</script>`;
  return page(
    `${lesson.title} · ${course.title}`,
    course.language,
    body,
    '../styles.css',
    '../player.js',
    '../katex/katex.min.css',
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
    lessons: uniqueLessons(course).map((lesson) => lesson.id),
  };
  list = [...list.filter((x) => x.id !== course.id), entry].sort((a, b) =>
    String(a.title).localeCompare(String(b.title)),
  );
  await write(file, JSON.stringify(list, null, 2) + '\n');
  const libraryRuntime = await fs.readFile(path.join(readerRoot, 'library.js'), 'utf8');
  await write(
    path.join(output, 'library.js'),
    `window.MCF_LIBRARY=${JSON.stringify(list).replace(/</g, '\\u003c')};\n${libraryRuntime}`,
  );
  const html = `<main class="library"><header><span class="eyebrow">Local-first learning</span><h1>Course library</h1><p>Your compiled MCF courses, available offline.</p></header><section id="courses" class="course-grid"></section></main>`;
  await write(
    path.join(output, 'index.html'),
    page('MCF Course Library', 'en', html, 'styles.css', 'library.js'),
  );
  await write(path.join(output, 'styles.css'), await readerStyles());
}
async function readerStyles(): Promise<string> {
  const directory = path.join(readerRoot, 'styles');
  const files = (await fs.readdir(directory)).filter((file) => file.endsWith('.css')).sort();
  return (
    await Promise.all(files.map((file) => fs.readFile(path.join(directory, file), 'utf8')))
  ).join('\n');
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
  await write(path.join(staging, 'styles.css'), await readerStyles());
  await fs.copyFile(path.join(readerRoot, 'player.js'), path.join(staging, 'player.js'));
  await fs.mkdir(path.join(staging, 'katex'), { recursive: true });
  await fs.copyFile(
    path.join(katexRoot, 'katex.min.css'),
    path.join(staging, 'katex', 'katex.min.css'),
  );
  await copyDir(path.join(katexRoot, 'fonts'), path.join(staging, 'katex', 'fonts'));
  await copyDir(path.join(course.root, 'assets'), path.join(staging, 'assets'));
  await copyReferencedFiles(course, staging);
  const all = uniqueLessons(course);
  for (const [i, lesson] of all.entries())
    await write(
      path.join(staging, 'lessons', `${lesson.id}.html`),
      lessonPage(course, lesson, i, all),
    );
  const overview = `<div class="course-shell">${sidebar(course)}<main class="main"><div class="lesson"><span class="eyebrow">MCF course</span><h1>${escape(course.title)}</h1><p>${escape(course.description ?? '')}</p><p>${escape((course.authors ?? []).join(', '))}</p><div class="progress"><i data-progress-bar></i></div><b data-progress>0%</b><p><a class="button" href="lessons/${encodeURIComponent(all[0].id)}.html">Start course</a></p><div class="progress-actions"><button data-export>Export progress</button><label class="button">Import progress<input data-import type="file" accept="application/json" hidden></label></div><div class="badge hidden"><div class="badge-mark">✓</div><h2>Course complete</h2><p>${escape(course.title)}</p><p>Completed <span data-completion-date></span></p></div></div></main></div><script>window.MCF_COURSE=${JSON.stringify(courseData).replace(/</g, '\\u003c')}</script>`;
  await write(
    path.join(staging, 'index.html'),
    page(course.title, course.language, overview, 'styles.css', 'player.js', 'katex/katex.min.css'),
  );
  await fs.rm(target, { recursive: true, force: true });
  await fs.rename(staging, target);
  await updateLibrary(root, course);
  return { course, directory: target };
}

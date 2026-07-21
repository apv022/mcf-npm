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
async function atomicWrite(file: string, content: string) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
  try {
    await fs.writeFile(temporary, content);
    await fs.rename(temporary, file);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }
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
  return `<aside class="sidebar">
  <a href="../index.html">← Course library</a>
  <h1>${escape(course.title)}</h1>
  <div class="progress"><i data-progress-bar style="width:0"></i></div>
  <b data-progress>0%</b>
  <nav>
${course.chapters
  .map(
    (chapter) => `    <div>
      <div class="chapter-label">${escape(chapter.title)}</div>
${chapter.lessons
  .map(
    (lesson) =>
      `      <a class="lesson-link ${lesson.id === current ? 'current' : ''}" data-lesson-id="${escape(lesson.id)}" href="${prefix}${encodeURIComponent(lesson.id)}.html">${escape(lesson.title)}</a>`,
  )
  .join('\n')}
    </div>`,
  )
  .join('\n')}
  </nav>
</aside>`;
}
function lessonPage(course: Course, lesson: Lesson, index: number, all: Lesson[]): string {
  const prev = all[index - 1],
    next = all[index + 1];
  const body = `<div class="course-shell">
${sidebar(course, lesson.id)}
<main class="main">
  <div class="lesson">
    <header class="lesson-header">
      <span class="eyebrow">Lesson ${index + 1} of ${all.length}</span>
      <h1>${escape(lesson.title)}</h1>
      ${lesson.description ? `<p>${escape(lesson.description)}</p>` : ''}
    </header>
${lessonBody(lesson, course)}
    <div class="badge hidden">
      <div class="badge-mark">✓</div>
      <h2>Course complete</h2>
      <p>${escape(course.title)}</p>
      <p>Completed <span data-completion-date></span></p>
    </div>
    <nav class="lesson-nav">
      ${prev ? `<a class="button" href="${encodeURIComponent(prev.id)}.html">← ${escape(prev.title)}</a>` : '<span></span>'}
      ${next ? `<a class="button" href="${encodeURIComponent(next.id)}.html">${escape(next.title)} →</a>` : '<a class="button" href="../index.html">Course overview</a>'}
    </nav>
  </div>
</main>
</div>
<script>
window.MCF_COURSE = ${JSON.stringify(data(course), null, 2).replace(/</g, '\\u003c')};
</script>`;
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
    `window.MCF_LIBRARY = ${JSON.stringify(list, null, 2).replace(/</g, '\\u003c')};\n${libraryRuntime}`,
  );
  const html = `<main class="library">
  <header>
    <span class="eyebrow">Local-first learning</span>
    <h1>Course library</h1>
    <p>Your compiled MCF courses, available offline.</p>
  </header>
  <section id="courses" class="course-grid"></section>
</main>`;
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

function mimeType(file: string): string {
  const extension = path.extname(file).toLowerCase();
  return ({
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.webp': 'image/webp', '.gif': 'image/gif', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
    '.ogg': 'audio/ogg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff': 'font/woff',
    '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  }[extension] ?? 'application/octet-stream');
}
async function dataUrl(file: string): Promise<string> {
  return `data:${mimeType(file)};base64,${(await fs.readFile(file)).toString('base64')}`;
}
async function standaloneAssets(course: Course): Promise<Map<string, string>> {
  const assets = new Map<string, string>();
  const files: string[] = [];
  async function collect(directory: string, prefix: string) {
    try {
      for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        const name = path.join(prefix, entry.name), full = path.join(directory, entry.name);
        if (entry.isDirectory()) await collect(full, name);
        else files.push(name);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  await collect(course.root, '');
  if (course.cover && !/^https?:/i.test(course.cover)) files.push(course.cover);
  for (const relative of [...new Set(files)]) {
    const file = path.join(course.root, relative);
    if (/\.(?:svg|png|jpe?g|webp|gif|mp3|wav|ogg|mp4|webm|woff2?|ttf)$/i.test(relative))
      assets.set(relative.split(path.sep).join('/'), await dataUrl(file));
  }
  return assets;
}
async function inlineStandalone(
  html: string,
  course: Course,
  styles: string,
  katexStyles: string,
): Promise<string> {
  const assets = await standaloneAssets(course);
  for (const [relative, url] of assets) {
    html = html.split(`../${relative}`).join(url).split(relative).join(url);
  }
  const katexFonts = new Map<string, string>();
  for (const file of await fs.readdir(path.join(katexRoot, 'fonts'))) {
    katexFonts.set(`fonts/${file}`, await dataUrl(path.join(katexRoot, 'fonts', file)));
  }
  for (const [relative, url] of katexFonts) katexStyles = katexStyles.split(relative).join(url);
  const player = await fs.readFile(path.join(readerRoot, 'player.js'), 'utf8');
  return html
    .replace(/<link rel="stylesheet" href="[^"]+">\s*/g, '')
    .replace(/<script src="[^"]+"><\/script>\s*/g, '')
    .replace('</head>', `<style>${styles}</style><style>${katexStyles}</style></head>`)
    .replace('</body>', `<script>${player}</script></body>`);
}

function standaloneSidebar(course: Course): string {
  return `<aside class="sidebar"><h1>${escape(course.title)}</h1>
  <div class="progress"><i data-progress-bar style="width:0"></i></div><b data-progress>0%</b><nav>
${course.chapters.map((chapter) => `<div><div class="chapter-label">${escape(chapter.title)}</div>
${chapter.lessons.map((lesson) => `<a class="lesson-link" data-lesson-id="${escape(lesson.id)}" href="#lesson-${encodeURIComponent(lesson.id)}">${escape(lesson.title)}</a>`).join('\n')}</div>`).join('\n')}
  </nav></aside>`;
}

export async function compileSingleFile(input: string, output: string): Promise<{ course: Course; file: string }> {
  const course = await parseCourse(input);
  const file = path.resolve(output), sourceRoot = path.resolve(input);
  if (file === sourceRoot || file.startsWith(`${sourceRoot}${path.sep}`))
    throw new Error('Standalone output must not be inside the source course package.');
  const lessons = uniqueLessons(course);
  const sections = lessons.map((lesson, index) => `<section class="standalone-lesson" id="lesson-${encodeURIComponent(lesson.id)}" data-lesson="${escape(lesson.id)}">
    <header class="lesson-header"><span class="eyebrow">Lesson ${index + 1} of ${lessons.length}</span><h1>${escape(lesson.title)}</h1>${lesson.description ? `<p>${escape(lesson.description)}</p>` : ''}</header>
${lessonBody(lesson, course)}
  </section>`).join('\n');
  const body = `<style>.standalone-lesson{display:none}.standalone-lesson.active{display:block}</style><div class="course-shell standalone"><div>${standaloneSidebar(course)}</div><main class="main"><div class="lesson"><section class="standalone-overview"><h1>${escape(course.title)}</h1><p>${escape(course.description ?? '')}</p><p>${escape((course.authors ?? []).join(', '))}</p></section>${sections}<div class="badge hidden"><div class="badge-mark">✓</div><h2>Course complete</h2><p>${escape(course.title)}</p><p>Completed <span data-completion-date></span></p></div></div></main></div>
<script>window.MCF_COURSE = ${JSON.stringify(data(course), null, 2).replace(/</g, '\\u003c')};</script>`;
  const styles = await readerStyles();
  const katexStyles = await fs.readFile(path.join(katexRoot, 'katex.min.css'), 'utf8');
  const html = page(course.title, course.language, body, 'styles.css', 'player.js', 'katex/katex.min.css')
    .replace('<body>', '<body data-standalone="true">');
  await atomicWrite(file, await inlineStandalone(html, course, styles, katexStyles));
  return { course, file };
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
  const overview = `<div class="course-shell">
${sidebar(course)}
<main class="main">
  <div class="lesson">
    <h1>${escape(course.title)}</h1>
    <p>${escape(course.description ?? '')}</p>
    <p>${escape((course.authors ?? []).join(', '))}</p>
    <div class="progress"><i data-progress-bar></i></div>
    <b data-progress>0%</b>
    <p><a class="button" href="lessons/${encodeURIComponent(all[0].id)}.html">Start course</a></p>
    <div class="progress-actions">
      <button data-export>Export progress</button>
      <label class="button">Import progress<input data-import type="file" accept="application/json" hidden></label>
    </div>
    <div class="badge hidden">
      <div class="badge-mark">✓</div>
      <h2>Course complete</h2>
      <p>${escape(course.title)}</p>
      <p>Completed <span data-completion-date></span></p>
    </div>
  </div>
</main>
</div>
<script>
window.MCF_COURSE = ${JSON.stringify(courseData, null, 2).replace(/</g, '\\u003c')};
</script>`;
  await write(
    path.join(staging, 'index.html'),
    page(course.title, course.language, overview, 'styles.css', 'player.js', 'katex/katex.min.css'),
  );
  await fs.rm(target, { recursive: true, force: true });
  await fs.rename(staging, target);
  await updateLibrary(root, course);
  return { course, directory: target };
}

import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';
import type { Activity, Chapter, Course, Lesson, Question, ValidationIssue } from './model.js';
import { ValidationError } from './model.js';

const ID = /^[a-z][a-z0-9._-]*$/;
const QUESTION_TYPES = new Set([
  'multiple_choice',
  'multiple_select',
  'true_false',
  'numeric',
  'short_answer',
  'essay',
]);
const ACTIVITY_TYPES = new Set(['notes', 'practice', 'assessment']);
type Data = Record<string, unknown>;

function issue(issues: ValidationIssue[], file: string, message: string) {
  issues.push({ file, message, severity: 'error' });
}
function obj(value: unknown): Data {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Data) : {};
}
function text(
  data: Data,
  key: string,
  file: string,
  issues: ValidationIssue[],
  required = true,
): string | undefined {
  const value = data[key];
  if (typeof value === 'string' && value.length) return value;
  if (required) issue(issues, file, `Required field "${key}" must be a non-empty string.`);
  return undefined;
}
function identifier(data: Data, key: string, file: string, issues: ValidationIssue[]): string {
  const value = text(data, key, file, issues) ?? 'invalid';
  if (!ID.test(value)) issue(issues, file, `Identifier "${value}" must match [a-z][a-z0-9._-]*.`);
  return value;
}
function optionalText(
  data: Data,
  key: string,
  file: string,
  issues: ValidationIssue[],
): string | undefined {
  if (data[key] === undefined) return undefined;
  return text(data, key, file, issues);
}
function strings(
  value: unknown,
  key: string,
  file: string,
  issues: ValidationIssue[],
): string[] | undefined {
  if (value === undefined) return undefined;
  if (Array.isArray(value) && value.every((x) => typeof x === 'string')) return value;
  issue(issues, file, `Field "${key}" must be a list of strings.`);
  return undefined;
}
function portablePath(
  root: string,
  base: string,
  ref: string,
  file: string,
  issues: ValidationIssue[],
): string | undefined {
  if (ref.includes('\\')) {
    issue(issues, file, `Path must use forward slashes: ${ref}`);
    return;
  }
  const resolved = path.resolve(base, ref);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    issue(issues, file, `Path escapes the course root: ${ref}`);
    return;
  }
  return resolved;
}
async function yamlFile(file: string, display: string, issues: ValidationIssue[]): Promise<Data> {
  try {
    return obj(yaml.load(await fs.readFile(file, 'utf8')));
  } catch (error) {
    issue(issues, display, `Invalid YAML: ${(error as Error).message}`);
    return {};
  }
}
async function isReallyContained(root: string, candidate: string): Promise<boolean> {
  const [realRoot, realCandidate] = await Promise.all([fs.realpath(root), fs.realpath(candidate)]);
  const relative = path.relative(realRoot, realCandidate);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}
function parseQuestion(raw: string, file: string, issues: ValidationIssue[]): Question | undefined {
  let data: Data;
  try {
    data = obj(yaml.load(raw));
  } catch (error) {
    issue(issues, file, `Invalid mcf-question YAML: ${(error as Error).message}`);
    return;
  }
  const id = identifier(data, 'id', file, issues);
  const type = text(data, 'type', file, issues) ?? 'invalid';
  const prompt = text(data, 'prompt', file, issues) ?? '';
  if (!QUESTION_TYPES.has(type))
    issue(issues, file, `Question "${id}" has unsupported type "${type}".`);
  const optionsRaw = data.options;
  let options: { id: string; text: string }[] | undefined;
  if (optionsRaw !== undefined) {
    if (!Array.isArray(optionsRaw)) issue(issues, file, `Question "${id}" options must be a list.`);
    else
      options = optionsRaw.map((entry) => {
        const option = obj(entry);
        return {
          id: identifier(option, 'id', file, issues),
          text: text(option, 'text', file, issues) ?? '',
        };
      });
  }
  const optionIds = options?.map((x) => x.id) ?? [];
  if (new Set(optionIds).size !== optionIds.length)
    issue(issues, file, `Question "${id}" has duplicate option IDs.`);
  if (type === 'multiple_choice' || type === 'multiple_select') {
    if (!options?.length) issue(issues, file, `Question "${id}" requires options.`);
    const answers = type === 'multiple_select' ? data.answer : [data.answer];
    if (!Array.isArray(answers) || !answers.length || answers.some((x) => typeof x !== 'string'))
      issue(issues, file, `Question "${id}" has an invalid answer.`);
    else
      for (const answer of answers)
        if (!optionIds.includes(answer as string))
          issue(
            issues,
            file,
            `Question "${id}" references answer "${answer}", but no option with that ID exists.`,
          );
    if (
      type === 'multiple_select' &&
      Array.isArray(data.answer) &&
      new Set(data.answer).size !== data.answer.length
    )
      issue(issues, file, `Question "${id}" answer must not contain duplicate option IDs.`);
  } else if (optionsRaw !== undefined) {
    issue(issues, file, `Question "${id}" type "${type}" must not define options.`);
  } else if (type === 'true_false' && typeof data.answer !== 'boolean')
    issue(issues, file, `Question "${id}" answer must be true or false.`);
  else if (type === 'numeric' && (typeof data.answer !== 'number' || !Number.isFinite(data.answer)))
    issue(issues, file, `Question "${id}" answer must be numeric.`);
  else if (type === 'short_answer' && typeof data.answer !== 'string')
    issue(issues, file, `Question "${id}" answer must be a string.`);
  else if (type === 'essay' && data.answer !== undefined)
    issue(issues, file, `Essay question "${id}" must not define an objective answer.`);
  const essayFields = ['minimum_words', 'minimum_sentences', 'keywords', 'minimum_keywords'];
  if (type !== 'essay' && essayFields.some((field) => data[field] !== undefined))
    issue(issues, file, `Question "${id}" uses essay completion fields but is not an essay.`);
  for (const field of ['minimum_words', 'minimum_sentences', 'minimum_keywords'])
    if (
      data[field] !== undefined &&
      (!Number.isInteger(data[field]) || (data[field] as number) <= 0)
    )
      issue(issues, file, `Essay question "${id}" field "${field}" must be a positive integer.`);
  const keywords = strings(data.keywords, 'keywords', file, issues);
  if (data.keywords !== undefined && (!keywords?.length || keywords.some((word) => !word.trim())))
    issue(
      issues,
      file,
      `Essay question "${id}" keywords must be a non-empty list of non-empty strings.`,
    );
  if (
    keywords &&
    new Set(keywords.map((word) => word.toLocaleLowerCase().trim())).size !== keywords.length
  )
    issue(issues, file, `Essay question "${id}" keywords must be distinct.`);
  if (data.minimum_keywords !== undefined && data.keywords === undefined)
    issue(issues, file, `Essay question "${id}" minimum_keywords requires keywords.`);
  if (
    typeof data.minimum_keywords === 'number' &&
    keywords &&
    data.minimum_keywords > keywords.length
  )
    issue(
      issues,
      file,
      `Essay question "${id}" minimum_keywords must not exceed the number of keywords.`,
    );
  if (
    data.tolerance !== undefined &&
    (type !== 'numeric' ||
      typeof data.tolerance !== 'number' ||
      !Number.isFinite(data.tolerance) ||
      data.tolerance < 0)
  )
    issue(issues, file, `Question "${id}" has invalid tolerance.`);
  if (
    data.points !== undefined &&
    (typeof data.points !== 'number' || !Number.isFinite(data.points) || data.points < 0)
  )
    issue(issues, file, `Question "${id}" points must be non-negative.`);
  if (data.required !== undefined && typeof data.required !== 'boolean')
    issue(issues, file, `Question "${id}" required must be boolean.`);
  const hint = optionalText(data, 'hint', file, issues);
  const explanation = optionalText(data, 'explanation', file, issues);
  return {
    id,
    type: type as Question['type'],
    prompt,
    options,
    answer: data.answer,
    tolerance: data.tolerance as number | undefined,
    hint,
    explanation,
    points: typeof data.points === 'number' ? data.points : 1,
    required: typeof data.required === 'boolean' ? data.required : true,
    minimum_words: data.minimum_words as number | undefined,
    minimum_sentences: data.minimum_sentences as number | undefined,
    keywords,
    minimum_keywords: data.minimum_keywords as number | undefined,
  };
}
export function parseLessonSource(
  source: string,
  file: string,
  issues: ValidationIssue[] = [],
): Lesson {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    issue(issues, file, 'Lesson must begin with YAML frontmatter delimited by ---.');
    return { id: 'invalid', title: '', source: file, activities: [] };
  }
  let front: Data = {};
  try {
    front = obj(yaml.load(match[1]));
  } catch (error) {
    issue(issues, file, `Invalid frontmatter YAML: ${(error as Error).message}`);
  }
  const body = match[2];
  const activities: Activity[] = [];
  const re =
    /:::mcf-activity\s*\r?\n([\s\S]*?)\r?\n:::\s*\r?\n([\s\S]*?)\r?\n:::mcf-end(?:\s*\r?\n|\s*$)/g;
  let cursor = 0;
  let found: RegExpExecArray | null;
  while ((found = re.exec(body))) {
    const outside = body
      .slice(cursor, found.index)
      .replace(/<!--[\s\S]*?-->/g, '')
      .trim();
    if (outside)
      issue(issues, file, `Content outside an activity container near "${outside.slice(0, 40)}".`);
    cursor = re.lastIndex;
    let meta: Data = {};
    try {
      meta = obj(yaml.load(found[1]));
    } catch (error) {
      issue(issues, file, `Invalid activity YAML: ${(error as Error).message}`);
    }
    const id = identifier(meta, 'id', file, issues);
    const type = text(meta, 'type', file, issues) ?? 'invalid';
    if (!ACTIVITY_TYPES.has(type))
      issue(issues, file, `Activity "${id}" has unsupported type "${type}".`);
    if (
      meta.passing_score !== undefined &&
      (type !== 'assessment' ||
        typeof meta.passing_score !== 'number' ||
        !Number.isFinite(meta.passing_score) ||
        meta.passing_score < 0 ||
        meta.passing_score > 1)
    )
      issue(issues, file, `Activity "${id}" has invalid passing_score.`);
    if (
      meta.randomize !== undefined &&
      (!['practice', 'assessment'].includes(type) || typeof meta.randomize !== 'boolean')
    )
      issue(issues, file, `Activity "${id}" has invalid randomize.`);
    if (
      meta.question_pool_size !== undefined &&
      (!['practice', 'assessment'].includes(type) ||
        !Number.isInteger(meta.question_pool_size) ||
        (meta.question_pool_size as number) <= 0)
    )
      issue(issues, file, `Activity "${id}" has invalid question_pool_size.`);
    const questions: Question[] = [];
    const content = found[2].replace(
      /```mcf-question\s*\r?\n([\s\S]*?)\r?\n```/g,
      (_all, raw: string) => {
        const q = parseQuestion(raw, file, issues);
        if (q) questions.push(q);
        return `\n<div data-mcf-question="${q?.id ?? 'invalid'}"></div>\n`;
      },
    );
    if (typeof meta.question_pool_size === 'number' && meta.question_pool_size > questions.length)
      issue(
        issues,
        file,
        `Activity "${id}" question_pool_size exceeds its ${questions.length} available questions.`,
      );
    activities.push({
      id,
      type: type as Activity['type'],
      title: optionalText(meta, 'title', file, issues),
      passing_score: meta.passing_score as number | undefined,
      randomize: meta.randomize as boolean | undefined,
      question_pool_size: meta.question_pool_size as number | undefined,
      content,
      questions,
    });
  }
  if (
    body
      .slice(cursor)
      .replace(/<!--[\s\S]*?-->/g, '')
      .trim()
  )
    issue(issues, file, 'Unclosed activity container or content outside an activity.');
  if (!activities.length) issue(issues, file, 'Lesson must contain at least one activity.');
  const activityIds = activities.map((activity) => activity.id);
  const questionIds = activities.flatMap((activity) =>
    activity.questions.map((question) => question.id),
  );
  if (new Set(activityIds).size !== activityIds.length)
    issue(issues, file, 'Activity IDs must be unique within the lesson.');
  if (new Set(questionIds).size !== questionIds.length)
    issue(issues, file, 'Question IDs must be unique within the lesson.');
  return {
    id: identifier(front, 'id', file, issues),
    title: text(front, 'title', file, issues) ?? '',
    description: optionalText(front, 'description', file, issues),
    authors: strings(front.authors, 'authors', file, issues),
    license: optionalText(front, 'license', file, issues),
    source: file,
    activities,
  };
}
export async function parseCourse(input: string): Promise<Course> {
  const root = path.resolve(input);
  const issues: ValidationIssue[] = [];
  const manifestPath = path.join(root, 'manifest.yaml');
  try {
    if (!(await fs.stat(root)).isDirectory()) throw new Error();
  } catch {
    throw new ValidationError([
      { file: input, message: 'Course directory does not exist.', severity: 'error' },
    ]);
  }
  const manifest = await yamlFile(manifestPath, 'manifest.yaml', issues);
  if (manifest.mcf !== '1.0')
    issue(
      issues,
      'manifest.yaml',
      `Unsupported MCF version "${String(manifest.mcf)}". This compiler currently supports "1.0".`,
    );
  const chaptersDir = path.join(root, 'chapters');
  try {
    if (!(await fs.stat(chaptersDir)).isDirectory()) throw new Error();
  } catch {
    issue(issues, 'manifest.yaml', 'Required chapters/ directory does not exist.');
  }
  const chapterRefs = manifest.chapters;
  const chapters: Chapter[] = [];
  if (!Array.isArray(chapterRefs) || !chapterRefs.length)
    issue(issues, 'manifest.yaml', 'Field "chapters" must be a non-empty ordered list.');
  else
    for (const entry of chapterRefs) {
      const source = obj(entry).source;
      if (typeof source !== 'string') {
        issue(issues, 'manifest.yaml', 'Each chapter entry must contain source.');
        continue;
      }
      const chapterDir = portablePath(root, root, source, 'manifest.yaml', issues);
      if (!chapterDir) continue;
      if (
        !path.relative(chaptersDir, chapterDir) ||
        path.relative(chaptersDir, chapterDir).startsWith('..')
      ) {
        if (chapterDir !== chaptersDir)
          issue(issues, 'manifest.yaml', `Chapter source must be under chapters/: ${source}`);
      }
      try {
        if (!(await fs.stat(chapterDir)).isDirectory()) throw new Error();
        if (!(await isReallyContained(root, chapterDir))) {
          issue(issues, 'manifest.yaml', `Chapter path escapes the course root: ${source}`);
          continue;
        }
      } catch {
        issue(issues, 'manifest.yaml', `Chapter path does not exist: ${source}`);
        continue;
      }
      const display = `${source}/chapter.yaml`;
      const data = await yamlFile(path.join(chapterDir, 'chapter.yaml'), display, issues);
      try {
        if (!(await fs.stat(path.join(chapterDir, 'lessons'))).isDirectory()) throw new Error();
      } catch {
        issue(issues, display, 'Required lessons/ directory does not exist.');
      }
      const lessons: Lesson[] = [];
      const refs = data.lessons;
      if (!Array.isArray(refs) || !refs.length)
        issue(issues, display, 'Field "lessons" must be a non-empty ordered list.');
      else
        for (const ref of refs) {
          if (typeof ref !== 'string') {
            issue(issues, display, 'Lesson entries must be paths.');
            continue;
          }
          const lessonPath = portablePath(root, chapterDir, ref, display, issues);
          if (!lessonPath) continue;
          if (path.extname(lessonPath) !== '.mcf')
            issue(issues, display, `Lesson must use .mcf extension: ${ref}`);
          try {
            if (!(await isReallyContained(root, lessonPath))) {
              issue(issues, display, `Lesson path escapes the course root: ${ref}`);
              continue;
            }
            lessons.push(
              parseLessonSource(
                await fs.readFile(lessonPath, 'utf8'),
                path.relative(root, lessonPath).split(path.sep).join('/'),
                issues,
              ),
            );
          } catch {
            issue(issues, display, `Lesson path does not exist: ${ref}`);
          }
        }
      chapters.push({
        id: identifier(data, 'id', display, issues),
        title: text(data, 'title', display, issues) ?? '',
        description: optionalText(data, 'description', display, issues),
        source,
        lessons,
      });
    }
  const chapterIds = chapters.map((chapter) => chapter.id);
  if (new Set(chapterIds).size !== chapterIds.length)
    issue(issues, 'manifest.yaml', 'Chapter IDs must be unique within the course.');
  const lessonSources = new Map<string, Set<string>>();
  for (const lesson of chapters.flatMap((chapter) => chapter.lessons)) {
    const sources = lessonSources.get(lesson.id) ?? new Set<string>();
    sources.add(lesson.source);
    lessonSources.set(lesson.id, sources);
  }
  if ([...lessonSources.values()].some((sources) => sources.size > 1))
    issue(
      issues,
      'manifest.yaml',
      'Distinct lesson files must use unique lesson IDs within the course.',
    );
  const course: Course = {
    mcf: '1.0',
    id: identifier(manifest, 'id', 'manifest.yaml', issues),
    title: text(manifest, 'title', 'manifest.yaml', issues) ?? '',
    language: text(manifest, 'language', 'manifest.yaml', issues) ?? '',
    description: optionalText(manifest, 'description', 'manifest.yaml', issues),
    authors: strings(manifest.authors, 'authors', 'manifest.yaml', issues),
    license: optionalText(manifest, 'license', 'manifest.yaml', issues),
    version: optionalText(manifest, 'version', 'manifest.yaml', issues),
    cover: optionalText(manifest, 'cover', 'manifest.yaml', issues),
    root,
    chapters,
  };
  const checkReference = async (ref: string, lesson?: Lesson) => {
    const display = lesson?.source ?? 'manifest.yaml';
    if (/^youtube:/i.test(ref)) {
      if (!/^youtube:[A-Za-z0-9_-]+$/.test(ref))
        issue(issues, display, `Invalid YouTube provider reference: ${ref}`);
      return;
    }
    if (/^https?:/i.test(ref)) {
      try {
        const url = new URL(ref);
        if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) throw new Error();
      } catch {
        issue(issues, display, `Invalid remote URL: ${ref}`);
      }
      return;
    }
    if (/^(?:mailto:|#)/i.test(ref)) return;
    const base = lesson ? path.dirname(path.join(root, lesson.source)) : root;
    const resolved = portablePath(root, base, ref, display, issues);
    if (!resolved) return;
    try {
      if (!(await fs.stat(resolved)).isFile()) throw new Error();
      if (!(await isReallyContained(root, resolved))) {
        issue(issues, display, `Path escapes the course root: ${ref}`);
      }
    } catch {
      issue(issues, display, `Referenced local asset does not exist: ${ref}`);
    }
  };
  if (course.cover) await checkReference(course.cover);
  for (const lesson of chapters.flatMap((chapter) => chapter.lessons)) {
    const richFields = lesson.activities.flatMap((activity) => [
      activity.content,
      ...activity.questions.flatMap((q) => [
        q.prompt,
        q.hint ?? '',
        q.explanation ?? '',
        ...(q.options ?? []).map((o) => o.text),
      ]),
    ]);
    for (const content of richFields) {
      const refs = [
        ...content.matchAll(/!?\[[^\]]*\]\(([^\s)]+)|@\[(?:audio|video)\]\(([^\s)]+)/g),
      ].map((match) => match[1] ?? match[2]);
      for (const ref of refs) await checkReference(ref, lesson);
    }
  }
  if (issues.some((x) => x.severity === 'error')) throw new ValidationError(issues);
  return course;
}

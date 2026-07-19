import path from 'node:path';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import katex from 'katex';
import type { Course, Lesson, Question } from './model.js';

export function escape(value: unknown): string {
  return String(value ?? '').replace(
    /[&<>'"]/g,
    (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[x]!,
  );
}
function safeUrl(url: string): string {
  return /^(?:https?:|mailto:|#|\.\.\/)/i.test(url) ? url : '#';
}
function localUrl(source: string, lesson: Lesson, course: Course): string {
  if (/^(?:https?:|youtube:)/i.test(source)) return source;
  const absolute = path.resolve(path.dirname(path.join(course.root, lesson.source)), source);
  const relative = path.relative(course.root, absolute).split(path.sep).join('/');
  return relative && !relative.startsWith('..') ? `../${relative}` : '#';
}
function math(source: string): string {
  return source
    .replace(/\$\$([\s\S]*?)\$\$/g, (_x, value: string) =>
      katex.renderToString(value.trim(), { displayMode: true, throwOnError: false }),
    )
    .replace(/(?<!\\)\$([^\n$]+)\$/g, (_x, value: string) =>
      katex.renderToString(value, { throwOnError: false }),
    );
}
export function rich(source: string, lesson: Lesson, course: Course): string {
  let input = source.replace(
    /@\[(audio|video)\]\((\S+)(?:\s+"([^"]*)")?\)/g,
    (_all, kind: string, ref: string, label: string) => {
      if (ref.startsWith('youtube:')) {
        const id = ref.slice(8);
        return `<div class="remote-media"><iframe src="https://www.youtube-nocookie.com/embed/${escape(id)}" title="${escape(label || 'Remote video')}" loading="lazy" allowfullscreen></iframe><small>Remote media — internet required</small></div>`;
      }
      const url = safeUrl(localUrl(ref, lesson, course));
      return `<figure><${kind} controls preload="metadata" src="${escape(url)}"></${kind}>${label ? `<figcaption>${escape(label)}</figcaption>` : ''}${/^https?:/i.test(ref) ? '<small>Remote media — internet required</small>' : ''}</figure>`;
    },
  );
  input = input.replace(
    /(!\[[^\]]*\]\()([^\s)]+)([^)]*\))/g,
    (_all, open: string, ref: string, close: string) =>
      `${open}${safeUrl(localUrl(ref, lesson, course))}${close}`,
  );
  input = input.replace(
    /(?<!!)(\[[^\]]+\]\()([^\s)]+)([^)]*\))/g,
    (_all, open: string, ref: string, close: string) =>
      `${open}${/^(?:https?:|mailto:|#)/i.test(ref) ? ref : safeUrl(localUrl(ref, lesson, course))}${close}`,
  );
  const rendered = math(marked.parse(input, { async: false }) as string);
  return sanitizeHtml(rendered, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'img',
      'audio',
      'video',
      'source',
      'iframe',
      'figure',
      'figcaption',
      'small',
      'span',
      'div',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['class', 'data-mcf-question'],
      img: ['src', 'alt', 'title', 'loading'],
      audio: ['src', 'controls', 'preload'],
      video: ['src', 'controls', 'preload'],
      iframe: ['src', 'title', 'loading', 'allowfullscreen'],
      code: ['class'],
      span: ['class', 'style', 'aria-hidden'],
      div: ['class', 'data-mcf-question'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
  });
}
function questionHtml(
  question: Question,
  lesson: Lesson,
  course: Course,
  assessment: boolean,
): string {
  const name = `${lesson.id}-${question.id}`;
  let control = '';
  if (question.type === 'multiple_choice' || question.type === 'multiple_select')
    control = (question.options ?? [])
      .map(
        (o) =>
          `<label class="option"><input type="${question.type === 'multiple_select' ? 'checkbox' : 'radio'}" name="${escape(name)}" value="${escape(o.id)}"> <span>${rich(o.text, lesson, course)}</span></label>`,
      )
      .join('');
  else if (question.type === 'true_false')
    control = ['true', 'false']
      .map(
        (v) =>
          `<label class="option"><input type="radio" name="${escape(name)}" value="${v}"> ${v === 'true' ? 'True' : 'False'}</label>`,
      )
      .join('');
  else if (question.type === 'essay')
    control = `<textarea rows="7" aria-label="Essay response"></textarea>`;
  else
    control = `<input class="text-response" type="${question.type === 'numeric' ? 'number' : 'text'}" ${question.type === 'numeric' ? 'step="any"' : ''} aria-label="Response">`;
  return `<section class="question" data-id="${escape(question.id)}" data-type="${escape(question.type)}"><div class="prompt">${rich(question.prompt, lesson, course)}</div><div class="responses">${control}</div><div class="question-actions">${question.hint ? '<button class="hint-button" type="button">Hint</button>' : ''}${assessment ? '' : `<button class="check-button" type="button">${question.type === 'essay' ? 'Check completion' : 'Check answer'}</button>`}</div>${question.hint ? `<div class="hint hidden">${rich(question.hint, lesson, course)}</div>` : ''}<div class="feedback" aria-live="polite"></div>${question.explanation ? `<div class="explanation hidden">${rich(question.explanation, lesson, course)}</div>` : ''}</section>`;
}
export function lessonBody(lesson: Lesson, course: Course): string {
  return lesson.activities
    .map((activity) => {
      let body = rich(activity.content, lesson, course);
      for (const q of activity.questions)
        body = body.replace(
          `<div data-mcf-question="${q.id}"></div>`,
          questionHtml(q, lesson, course, activity.type === 'assessment'),
        );
      return `<section class="activity" data-activity="${escape(activity.id)}" data-type="${activity.type}"><header><span class="eyebrow">${escape(activity.type)}</span><h2>${escape(activity.title ?? activity.id)}</h2></header><div class="questions">${body}</div>${activity.type === 'notes' ? '<button class="notes-complete" type="button">Mark notes complete</button>' : ''}${activity.type === 'assessment' ? '<button class="assessment-submit" type="button">Submit assessment</button><p class="assessment-result" aria-live="polite"></p>' : ''}</section>`;
    })
    .join('');
}
export function page(
  title: string,
  language: string,
  body: string,
  css = 'styles.css',
  script?: string,
  extraCss?: string,
): string {
  return `<!doctype html><html lang="${escape(language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><link rel="stylesheet" href="${css}">${extraCss ? `<link rel="stylesheet" href="${extraCss}">` : ''}</head><body>${body}${script ? `<script src="${script}"></script>` : ''}</body></html>`;
}

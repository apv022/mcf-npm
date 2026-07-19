import type { QuestionDefinition } from './types.js';

export interface EssayResult {
  complete: boolean;
  words: number;
  sentences: number;
  keywords: number;
  feedback: string[];
}
export function countWords(response: string): number {
  const value = response.trim();
  return value ? value.split(/\s+/u).length : 0;
}
export function countSentences(response: string): number {
  const value = response.trim();
  if (!value) return 0;
  const terminal = value.match(/[^.!?]+[.!?]+/gu)?.filter((part) => part.trim()).length ?? 0;
  const remainder = value.replace(/[^.!?]+[.!?]+/gu, '').trim();
  return terminal + (remainder ? 1 : 0);
}
function normalized(value: string): string {
  return value.toLocaleLowerCase().replace(/\s+/gu, ' ').trim();
}
export function keywordMatches(response: string, keywords: string[]): number {
  const value = normalized(response);
  return new Set(
    keywords.filter((keyword) => {
      const needle = normalized(keyword);
      if (!needle) return false;
      if (/^[\p{L}\p{N}_-]+$/u.test(needle))
        return new RegExp(
          `(^|[^\\p{L}\\p{N}_-])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\p{N}_-])`,
          'u',
        ).test(value);
      return value.includes(needle);
    }),
  ).size;
}
export function evaluateEssay(response: string, question: QuestionDefinition): EssayResult {
  const words = countWords(response),
    sentences = countSentences(response),
    matches = keywordMatches(response, question.keywords ?? []),
    feedback: string[] = [];
  if (question.minimum_sentences && sentences < question.minimum_sentences)
    feedback.push(`Write at least ${question.minimum_sentences} sentences. Current: ${sentences}.`);
  if (question.minimum_words && words < question.minimum_words)
    feedback.push(`Write at least ${question.minimum_words} words. Current: ${words}.`);
  const requiredKeywords = question.keywords?.length
    ? (question.minimum_keywords ?? question.keywords.length)
    : 0;
  if (matches < requiredKeywords)
    feedback.push(`Mention at least ${requiredKeywords} required concepts. Current: ${matches}.`);
  if (
    !question.minimum_words &&
    !question.minimum_sentences &&
    !requiredKeywords &&
    !response.trim()
  )
    feedback.push('Write a response before continuing.');
  return { complete: feedback.length === 0, words, sentences, keywords: matches, feedback };
}

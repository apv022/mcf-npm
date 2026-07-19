export type QuestionType =
  'multiple_choice' | 'multiple_select' | 'true_false' | 'numeric' | 'short_answer' | 'essay';
export type ActivityType = 'notes' | 'practice' | 'assessment';
export interface Option {
  id: string;
  text: string;
}
export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  options?: Option[];
  answer?: unknown;
  tolerance?: number;
  hint?: string;
  explanation?: string;
  points: number;
  required: boolean;
}
export interface Activity {
  id: string;
  type: ActivityType;
  title?: string;
  passing_score?: number;
  randomize?: boolean;
  question_pool_size?: number;
  content: string;
  questions: Question[];
}
export interface Lesson {
  id: string;
  title: string;
  description?: string;
  authors?: string[];
  license?: string;
  source: string;
  activities: Activity[];
}
export interface Chapter {
  id: string;
  title: string;
  description?: string;
  source: string;
  lessons: Lesson[];
}
export interface Course {
  mcf: '1.0';
  id: string;
  title: string;
  language: string;
  description?: string;
  authors?: string[];
  license?: string;
  version?: string;
  cover?: string;
  root: string;
  chapters: Chapter[];
}
export interface ValidationIssue {
  file: string;
  message: string;
  severity: 'error' | 'warning';
}
export class ValidationError extends Error {
  constructor(public issues: ValidationIssue[]) {
    super(issues.map((x) => `${x.file}:\n${x.message}`).join('\n\n'));
  }
}

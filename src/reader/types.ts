export interface QuestionDefinition {
  id: string;
  type: string;
  answer?: unknown;
  tolerance?: number;
  points: number;
  required: boolean;
  minimum_words?: number;
  minimum_sentences?: number;
  keywords?: string[];
  minimum_keywords?: number;
}
export interface ActivityDefinition {
  id: string;
  type: 'notes' | 'practice' | 'assessment';
  passing_score?: number;
  randomize?: boolean;
  question_pool_size?: number;
  questions: QuestionDefinition[];
}
export interface CourseDefinition {
  id: string;
  version?: string;
  title: string;
  lessons: Array<{ id: string; title: string; activities?: ActivityDefinition[] }>;
}
export interface QuestionState {
  response: unknown;
  complete: boolean;
  correct: boolean | null;
}
export interface AssessmentState {
  submitted: boolean;
  score: number;
  possible: number;
  passed: boolean | null;
}
export interface ProgressState {
  schema: 1;
  courseId: string;
  version: string | null;
  questions: Record<string, QuestionState>;
  activities: Record<string, boolean>;
  assessments: Record<string, AssessmentState>;
  lessons: Record<string, boolean>;
  questionOrders: Record<string, string[]>;
  completedAt: string | null;
}

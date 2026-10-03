export type Check = {
  id: string;
  kind: "explanation" | "numeric" | "transfer" | "choice";
  prompt: string;
  answer: string;
  rubric: string[];
  value?: number;
  tolerance?: number;
  unit?: string;
  options?: { label: string; correct: boolean; feedback: string }[];
  misconception?: string;
};
export type Section = {
  title: string;
  paragraphs: string[];
  formula?: string;
  tag?: string;
  advanced?: boolean;
};
export type LearnableLessonId =
  "A01-A" | "A01-B" | "A02-A" | "A02-B" | "A03-A" | "A03-B";
export type Lesson = {
  id: LearnableLessonId;
  moduleId: string;
  title: string;
  centralQuestion: string;
  prerequisites: string[];
  sections: Section[];
  definitions: string[];
  modelTypeTags: string[];
  assumptions: string[];
  workedExample: string;
  labId: "LA01" | "LA02" | "LA03";
  checks: Check[];
  counterexample: string;
  recap: { must: string; later: string; returnAt: string };
  references: string[];
  status: "learnable";
};
export type PlannedLesson = {
  id: string;
  moduleId: string;
  title: string;
  status: "planned";
};
export type Term = {
  id: string;
  name: string;
  definition: string;
  lessonId: string;
  references: string[];
};
export type Source = { id: string; title: string; url: string; note: string };

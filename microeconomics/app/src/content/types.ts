export type LabId = 'ML01' | 'ML02' | 'ML03';
export type ReferenceId = 'MIC-MIT' | 'MIC-CORE';
export interface Section {
  id: string;
  title: string;
  paragraphs: string[];
  formula?: string;
  advanced?: boolean;
}
interface QuestionBase {
  id: string;
  prompt: string;
  answerBasis: string;
  feedback: string;
}
export interface ChoiceQuestion extends QuestionBase {
  kind: 'choice';
  options: { id: string; text: string; feedback: string }[];
  answer: string;
}
export type CalculationId = 'time-excess' | 'budget-balance' | 'utility-square' | 'mrs-cd' | 'choice-cd-x' | 'demand-cd-x';
export interface NumericQuestion extends QuestionBase {
  kind: 'numeric';
  calculation: CalculationId;
  unit: string;
  tolerance: number;
}
export interface SelfExplanationQuestion extends QuestionBase {
  kind: 'self-explanation';
  referenceAnswer: string;
  rubric: string[];
}
export type Question = ChoiceQuestion | NumericQuestion | SelfExplanationQuestion;
export interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  centralQuestion: string;
  prerequisites: string[];
  sections: Section[];
  definitions: string[];
  assumptions: string[];
  workedExample: string[];
  labId: LabId;
  checks: Question[];
  counterexample: string[];
  recap: string[];
  references: { id: ReferenceId; topic: string }[];
  status: 'available';
  knowledge: { mustUnderstand: string[]; acceptedForNow: string[]; returnLater: string[] };
}
export interface CatalogLesson {
  id: string;
  moduleId: string;
  title: string;
  summary: string;
  status: 'available' | 'planned';
}
export interface CourseModule {
  id: string;
  title: string;
  centralQuestion: string;
  prerequisites: string[];
  modelCard: {
    object: string;
    known: string[];
    unknown: string[];
    relations: string[];
    derivation: string[];
    counterexample: string[];
    uncertainty: string;
  };
}
export interface GlossaryEntry {
  id: string;
  term: string;
  english: string;
  object: string;
  definition: string;
  example: string;
  confusion: string;
  lessonIds: string[];
  relatedIds: string[];
}
export interface ReferenceEntry {
  id: ReferenceId;
  title: string;
  organization: string;
  url: string;
  edition: string;
  checkedAt: string;
  supports: string;
  readingRoute: string;
  licenseNote: string;
}

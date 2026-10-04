import { catalog, terms } from "./catalog";
import type { Lesson } from "./types";

export interface SearchResult { id: string; title: string; href: string; excerpt: string; score: number }
export function normalizeQuery(query: string) { return query.trim().normalize("NFKC").toLocaleLowerCase().slice(0, 100); }
function match(text: string, query: string) { return text.normalize("NFKC").toLocaleLowerCase().includes(query); }
function excerpt(text: string, query: string) {
  const pos = text.normalize("NFKC").toLocaleLowerCase().indexOf(query);
  const start = Math.max(0, pos - 40);
  return (start ? "…" : "") + text.slice(start, start + 160) + (text.length > start + 160 ? "…" : "");
}
export function searchCourse(raw: string, lessons: Lesson[] = []): SearchResult[] {
  const query = normalizeQuery(raw);
  if (!query) return [];
  const results = new Map<string, SearchResult>();
  for (const lesson of catalog) {
    if (match(lesson.title, query) || match(lesson.id, query) || match(lesson.summary, query)) {
      results.set(lesson.id, { id: lesson.id, title: `${lesson.id} · ${lesson.title}`, href: `#/lesson/${lesson.id}`, excerpt: lesson.summary, score: match(lesson.title, query) || match(lesson.id, query) ? 30 : 15 });
    }
  }
  for (const term of terms) {
    if (match(term.term, query) || match(term.id, query)) results.set(term.id, { id: term.id, title: term.term, href: `#/glossary/${term.id}`, excerpt: `概念词条；出现于 ${term.lessonIds.join("、")}`, score: 25 });
  }
  for (const lesson of lessons) {
    const text = [lesson.centralQuestion, ...lesson.assumptions, ...lesson.workedExample, ...lesson.counterexample, ...lesson.recap, ...lesson.sections.flatMap(s => [s.title, ...s.paragraphs, s.formula || ""]), ...lesson.checks.map(q => q.prompt)].find(text => match(text, query));
    if (text && !results.has(lesson.id)) results.set(lesson.id, { id: lesson.id, title: `${lesson.id} · ${lesson.title}`, href: `#/lesson/${lesson.id}`, excerpt: excerpt(text, query), score: 10 });
  }
  return [...results.values()].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

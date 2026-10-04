import { catalog } from "./catalog";
import type { GlossaryEntry, Lesson } from "./types";

const groups: Record<string, () => Promise<Lesson[]>> = {
  first: () => import("./lessons").then(m => m.lessons),
  middle: () => import("./modules04to06").then(m => m.lessonsM04M06),
  strategic: () => import("./modules07to09").then(m => m.lessonsM07M09),
  final: () => import("./modules10to12").then(m => m.lessonsM10M12),
};
const pending = new Map<string, Promise<Lesson[]>>();
function loadGroup(group: string) {
  if (!pending.has(group)) pending.set(group, groups[group]().catch(error => { pending.delete(group); throw error; }));
  return pending.get(group)!;
}
export async function loadLesson(id: string): Promise<Lesson | undefined> {
  if (!catalog.some(l => l.id === id && l.status === "available")) return undefined;
  const n = Number(id.slice(1, 3));
  const group = n <= 3 ? "first" : n <= 6 ? "middle" : n <= 9 ? "strategic" : "final";
  return (await loadGroup(group)).find(l => l.id === id);
}
export async function loadAllLessons(): Promise<Lesson[]> {
  return (await Promise.all(Object.keys(groups).map(loadGroup))).flat();
}
export async function loadGlossary(): Promise<GlossaryEntry[]> {
  return (await import("./glossary-data.json")).default as GlossaryEntry[];
}

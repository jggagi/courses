import { lessons as firstLessons } from "./lessons";
import { lessonsM04M06, glossaryM04M06 } from "./modules04to06";
import { lessonsM07M09, glossaryM07M09 } from "./modules07to09";
import { lessonsM10M12, glossaryM10M12 } from "./modules10to12";
import { glossary as firstGlossary } from "./glossary";
export const lessons = [...firstLessons, ...lessonsM04M06, ...lessonsM07M09, ...lessonsM10M12];
export const glossary = [...firstGlossary, ...glossaryM04M06, ...glossaryM07M09, ...glossaryM10M12];

export * from "./types";
export { catalog, modules } from "./catalog";
export { references } from "./glossary";

export const courseId = "microeconomics" as const;
export const labIds = ["ML01", "ML02", "ML03", "ML04", "ML05", "ML06", "ML07", "ML08", "ML09", "ML10", "ML11"] as const;
export function getLesson(id: string) {
  return lessons.find((lesson) => lesson.id === id);
}

export { getNumericAnswer } from "./answers";

import data from "./catalog-data.json";
import type { CatalogLesson, CourseModule } from "./types";

// This metadata is checked against the complete content in content.test.ts.
// Keep the directory independent of lesson bodies so the workbench stays small.
export const catalog = data.catalog as CatalogLesson[];
export const modules = data.modules as CourseModule[];
export const terms = data.terms;

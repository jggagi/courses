import type { Lesson } from "./types";
import { lessons as A10 } from "./modules/A10";
import { lessons as A11 } from "./modules/A11";
import { lessons as A12 } from "./modules/A12";

export const globalLessons: Lesson[] = [...A10, ...A11, ...A12];

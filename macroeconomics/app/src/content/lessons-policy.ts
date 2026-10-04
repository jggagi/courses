import type { Lesson } from "./types";
import { lessons as A07 } from "./modules/A07";
import { lessons as A08 } from "./modules/A08";
import { lessons as A09 } from "./modules/A09";

export const policyLessons: Lesson[] = [...A07, ...A08, ...A09];

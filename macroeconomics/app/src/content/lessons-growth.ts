import type { Lesson } from "./types";
import { lessons as A04 } from "./modules/A04";
import { lessons as A05 } from "./modules/A05";
import { lessons as A06 } from "./modules/A06";

export const growthLessons: Lesson[] = [...A04, ...A05, ...A06];

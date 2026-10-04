import type { Lesson, PlannedLesson } from "./types";
import { lessons as A01 } from "./modules/A01";
import { lessons as A02 } from "./modules/A02";
import { lessons as A03 } from "./modules/A03";
import { growthLessons } from "./lessons-growth";
import { policyLessons } from "./lessons-policy";
import { globalLessons } from "./lessons-global";

export const plannedLessons: PlannedLesson[] = [];
export const lessons: Lesson[] = [
  ...A01,
  ...A02,
  ...A03,
  ...growthLessons,
  ...policyLessons,
  ...globalLessons,
];

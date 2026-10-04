import type { Lesson } from "./types";
import { defaultPolicyParameters, simulatePolicy } from "../models/policy";
import {
  defaultSpendingParameters,
  simulateSpending,
} from "../models/spending";
import { defaultDebtParameters, simulateDebt } from "../models/debt";
import { defaultCreditState, replayCreditEvents } from "../models/credit";

export const demandFirst = simulatePolicy(defaultPolicyParameters()).periods[1];
export const spendingParameters = defaultSpendingParameters();
export const fiscalDelta =
  simulateSpending({ ...spendingParameters, G: 40 }).equilibrium.Y -
  simulateSpending(spendingParameters).equilibrium.Y;
export const debtFirst = simulateDebt(defaultDebtParameters()).periods[1];
export const creditFinal = replayCreditEvents(defaultCreditState(), [
  { id: "policy-content-loan", sequence: 1, type: "loan", amount: 10 },
  { id: "policy-content-payment", sequence: 2, type: "payment", amount: 7 },
  { id: "policy-content-repayment", sequence: 3, type: "repayment", amount: 3 },
  { id: "policy-content-loss", sequence: 4, type: "loss", amount: 8 },
]);

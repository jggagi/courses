import {
  computeAccounts,
  computePrices,
  defaultAccountsInput,
  defaultPriceInput,
  initialLedger,
  replayLedger,
} from "../models";

/** 客观题与实验复用同一纯函数结果，不从显示层已舍入的数读取答案。 */
const ledger = replayLedger(initialLedger(), [
  { id: "content-wage", sequence: 1, type: "wage", amount: 20 },
  { id: "content-service", sequence: 2, type: "service", amount: 10 },
  { id: "content-principal", sequence: 3, type: "repayment", amount: 5 },
]);
const accounts = computeAccounts({ ...defaultAccountsInput(), inventory: 20 });
const prices = computePrices(defaultPriceInput());

export const numericAnswers = {
  householdNetWorth: ledger.H.netWorth,
  firmNetWorth: ledger.F.netWorth,
  inventoryGDP: accounts.expenditure,
  // 储蓄定义不是LA02活动模型中的行为方程；按本课独立例的已知Y/C/G逐项相减。
  nationalSaving: 100 - 60 - 20,
  realOutput1: prices.periods[1].R,
  basketIndex2: prices.periods[2].L as number,
};

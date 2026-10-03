import { priceFixture } from "../data/synthetic";
import type { PriceInput, PriceResult, PriceResultPeriod } from "./types";
import { assertNumber, assertRecord } from "./validation";

export function defaultPriceInput(): PriceInput {
  return {
    periods: priceFixture.map((period) => ({ ...period })),
    priceBase: 0,
    basketBase: 0,
    normalization: 100,
  };
}

/** 每次获取预设返回独立输入，不污染A基准或其他预设。 */
export const pricePresets = {
  priceOnly: (): PriceInput => ({
    ...defaultPriceInput(),
    periods: [
      { px: 2, py: 4, qx: 10, qy: 5 },
      { px: 3, py: 5, qx: 10, qy: 5 },
      { px: 3.06, py: 5.1, qx: 10, qy: 5 },
    ],
  }),
  quantityOnly: (): PriceInput => ({
    ...defaultPriceInput(),
    periods: [
      { px: 2, py: 4, qx: 10, qy: 5 },
      { px: 2, py: 4, qx: 12, qy: 6 },
      { px: 2, py: 4, qx: 12, qy: 6 },
    ],
  }),
  composition: (): PriceInput => ({
    ...defaultPriceInput(),
    periods: [
      { px: 2, py: 4, qx: 10, qy: 5 },
      { px: 2, py: 4, qx: 12, qy: 4 },
      { px: 3.06, py: 5.1, qx: 12, qy: 4 },
    ],
  }),
  disinflation: defaultPriceInput,
};

function growth(
  current: number | null,
  previous: number | null,
): number | null {
  if (current === null || previous === null || previous === 0) return null;
  const value = current / previous - 1;
  if (!Number.isFinite(value))
    throw new Error("增长率超出有限数值范围，请调整原始价格或数量的量级。");
  return value;
}

function product(price: number, quantity: number): number {
  const value = price * quantity;
  if (!Number.isFinite(value) || (price > 0 && quantity > 0 && value === 0))
    throw new Error("价格与数量乘积超出数值精度，请调整原始数据的量级。");
  return value;
}

export function computePrices(input: PriceInput): PriceResult {
  assertRecord(input, "价格数量输入");
  if (
    !Array.isArray(input.periods) ||
    input.periods.length < 1 ||
    input.periods.length > 12
  )
    throw new Error("原始价格数量表必须包含1到12个合成时期。");
  for (let index = 0; index < input.periods.length; index++) {
    const item = input.periods[index];
    assertRecord(item, `第${index}期价格数量`);
    assertNumber(item.px, `第${index}期x价格`, { positive: true });
    assertNumber(item.py, `第${index}期y价格`, { positive: true });
    assertNumber(item.qx, `第${index}期x数量`);
    assertNumber(item.qy, `第${index}期y数量`);
  }
  for (const key of ["priceBase", "basketBase"] as const) {
    if (
      !Number.isSafeInteger(input[key]) ||
      input[key] < 0 ||
      input[key] >= input.periods.length
    )
      throw new Error(`${key}必须指向原始表中存在的合成时期。`);
  }
  if (input.normalization !== 100 && input.normalization !== 1000)
    throw new Error("指数归一化只能选择100或1000。");
  const prices = input.periods[input.priceBase];
  const basket = input.periods[input.basketBase];
  // 消费篮子的价格参照与其数量时期一致；实际产出的固定价格权重单独选择。
  const basketX = product(basket.px, basket.qx);
  const basketY = product(basket.py, basket.qy);
  const basketValue = basketX + basketY;
  const periods: PriceResultPeriod[] = [];
  input.periods.forEach((item, period) => {
    const nominalContributions = {
      x: product(item.px, item.qx),
      y: product(item.py, item.qy),
    };
    const realContributions = {
      x: product(prices.px, item.qx),
      y: product(prices.py, item.qy),
    };
    const basketContributions = {
      x: product(item.px, basket.qx),
      y: product(item.py, basket.qy),
    };
    const N = nominalContributions.x + nominalContributions.y;
    const R = realContributions.x + realContributions.y;
    const D = R === 0 ? null : (input.normalization * N) / R;
    const L =
      basketValue === 0
        ? null
        : (input.normalization *
            (basketContributions.x + basketContributions.y)) /
          basketValue;
    if (
      (D !== null && (!Number.isFinite(D) || D === 0)) ||
      (L !== null && (!Number.isFinite(L) || L === 0))
    )
      throw new Error(
        "价格指数超出有限数值范围或数值精度，请调整原始价格或数量的量级。",
      );
    const previous = periods[period - 1];
    periods.push({
      period,
      N,
      R,
      D,
      L,
      gN: previous ? growth(N, previous.N) : null,
      gR: previous ? growth(R, previous.R) : null,
      piD: previous ? growth(D, previous.D) : null,
      piL: previous ? growth(L, previous.L) : null,
      nominalContributions,
      realContributions,
      basketContributions,
      basketWeights:
        basketValue === 0
          ? { x: null, y: null }
          : { x: basketX / basketValue, y: basketY / basketValue },
    });
  });
  return {
    periods,
    basketValue,
    priceBase: input.priceBase,
    basketBase: input.basketBase,
    normalization: input.normalization,
  };
}

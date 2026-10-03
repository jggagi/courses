export const MAX_INPUT = 1_000_000_000;
export const EPSILON = 1e-8;

export function assertRecord(
  value: unknown,
  label: string,
): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`${label}必须是记录对象。`);
}

export function assertNumber(
  value: unknown,
  label: string,
  options: { positive?: boolean; signed?: boolean } = {},
): asserts value is number {
  const lower = options.signed ? -MAX_INPUT : 0;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < lower ||
    value > MAX_INPUT ||
    (options.positive && value <= 0)
  ) {
    throw new Error(
      `${label}必须是${options.positive ? "大于0且" : ""}有限数，范围${lower}到${MAX_INPUT}。`,
    );
  }
}

export function assertText(
  value: unknown,
  label: string,
): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.length > 200)
    throw new Error(`${label}必须是1到200字符的非空文字。`);
}

export function assertClose(
  left: number,
  right: number,
  message: string,
): void {
  if (
    !Number.isFinite(left) ||
    !Number.isFinite(right) ||
    Math.abs(left - right) > EPSILON
  )
    throw new Error(message);
}

export function moneyCents(
  value: unknown,
  label: string,
  options: { positive?: boolean; signed?: boolean } = {},
): number {
  assertNumber(value, label, options);
  const cents = Math.round(value * 100);
  if (Math.abs(value - cents / 100) > EPSILON)
    throw new Error(`${label}最多保留两位小数；账本按最小货币单位整数计算。`);
  if (options.positive && cents <= 0)
    throw new Error(`${label}必须至少为一个最小货币单位（0.01）。`);
  return cents;
}

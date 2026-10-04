export const formatNumber = (value: unknown, scale = 1) =>
  typeof value === "number" && Number.isFinite(value * scale)
    ? Number((value * scale).toFixed(8)).toString()
    : value === null
      ? "未定义"
      : String(value);

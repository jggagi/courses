import {
  advancedDefaults,
  validateAdvancedInput,
  ADVANCED_LAB_IDS,
  type AdvancedInputs,
} from "../models/advanced";
import {
  initialCapstone,
  validateCapstone,
  type CapstoneState,
} from "./capstone";
import {
  initialLedger,
  replayLedger,
  validateLedger,
  defaultAccountsInput,
  computeAccounts,
  defaultPriceInput,
  computePrices,
  type LedgerState,
  type LedgerEvent,
  type AccountsInput,
  type PriceInput,
} from "../models";

export const STORAGE_KEY = "courses:macroeconomics:v1";
/** A local export is deliberately bounded; it includes private notes. */
export const MAX_IMPORT_BYTES = 1_048_576;
export const LEARNABLE_LESSON_IDS = [
  "A01-A",
  "A01-B",
  "A02-A",
  "A02-B",
  "A03-A",
  "A03-B",
  "A04-A",
  "A04-B",
  "A05-A",
  "A05-B",
  "A06-A",
  "A06-B",
  "A07-A",
  "A07-B",
  "A08-A",
  "A08-B",
  "A09-A",
  "A09-B",
  "A10-A",
  "A10-B",
  "A11-A",
  "A11-B",
  "A12-A",
  "A12-B",
] as const;
const LEGACY_LESSON_IDS = LEARNABLE_LESSON_IDS.slice(0, 6);
export type LessonId = (typeof LEARNABLE_LESSON_IDS)[number];
export type LessonStatus =
  "not_started" | "in_progress" | "practiced" | "self_checked";
export interface LessonState {
  status: LessonStatus;
  confidence: number;
}
export interface Attempt {
  lessonId: LessonId;
  checkId: string;
  answer: string;
  correct: boolean;
  at: string;
}
export interface LedgerInput {
  initial: LedgerState;
  events: LedgerEvent[];
}
export interface LabState<Input> {
  input: Input;
  baseline: Input;
  prediction: string;
  skipped: boolean;
  hasRun: boolean;
  explanation: string;
}
export type AccountsLabState = LabState<AccountsInput> & {
  classifications?: Record<string, string>;
};
export interface LearningState {
  schemaVersion: 1;
  courseId: "macroeconomics";
  lastLessonId: LessonId;
  lessonStates: Record<LessonId, LessonState>;
  objectiveAttempts: Attempt[];
  selfChecks: Record<string, boolean>;
  notes: Record<string, string>;
  labStates: {
    LA01: LabState<LedgerInput>;
    LA02: AccountsLabState;
    LA03: LabState<PriceInput>;
    LA04: LabState<AdvancedInputs["LA04"]>;
    LA05: LabState<AdvancedInputs["LA05"]>;
    LA06: LabState<AdvancedInputs["LA06"]>;
    LA07: LabState<AdvancedInputs["LA07"]>;
    LA08: LabState<AdvancedInputs["LA08"]>;
    LA09: LabState<AdvancedInputs["LA09"]>;
  };
  capstone: CapstoneState;
  updatedAt: string;
}
export interface LocalStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export type StorageAccess = LocalStorageLike | null | undefined;
export interface LoadResult {
  state: LearningState;
  notice: string;
  protected: boolean;
}
export interface SaveResult {
  ok: boolean;
  notice: string;
}

const MEMORY_NOTICE =
  "浏览器存储不可用：记录仅保存在当前页面内存中，关闭页面后将丢失。";
const PROTECTED_NOTICE =
  "本课原记录未被自动覆盖。请显式导入有效的宏观文件，或确认后清空本课记录。";
const CONFLICT_NOTICE =
  "其他页面已修改本课记录，原记录未被覆盖。当前页面的修改仅保留在内存中。请先导出当前 JSON，再刷新以读取最新记录；核对两份记录后再决定是否导入替换。";
const MAX_TEXT_LENGTH = 20_000;
const MAX_AMOUNT = 1_000_000_000;
const fallbackByStorage = new WeakMap<LocalStorageLike, LearningState>();
const fallbackNoticeByStorage = new WeakMap<LocalStorageLike, string>();
/** Each page observes its own version; localStorage can change in another tab. */
const observedRawByStorage = new WeakMap<LocalStorageLike, string | null>();
const unreadableStorage = new WeakSet<LocalStorageLike>();
let fallbackWithoutStorage: LearningState | null = null;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function initialState(): LearningState {
  const ledger: LedgerInput = { initial: initialLedger(), events: [] };
  const accounts = defaultAccountsInput();
  const prices = defaultPriceInput();
  const extended = advancedDefaults();
  const lab = <T>(input: T): LabState<T> => ({
    input: clone(input),
    baseline: clone(input),
    prediction: "",
    skipped: false,
    hasRun: false,
    explanation: "",
  });
  return {
    schemaVersion: 1,
    courseId: "macroeconomics",
    lastLessonId: "A01-A",
    lessonStates: Object.fromEntries(
      LEARNABLE_LESSON_IDS.map((id) => [
        id,
        { status: "not_started", confidence: 0 },
      ]),
    ) as Record<LessonId, LessonState>,
    objectiveAttempts: [],
    selfChecks: {},
    notes: {},
    labStates: {
      LA01: lab(ledger),
      LA02: { ...lab(accounts), classifications: {} },
      LA03: lab(prices),
      LA04: lab(extended.LA04),
      LA05: lab(extended.LA05),
      LA06: lab(extended.LA06),
      LA07: lab(extended.LA07),
      LA08: lab(extended.LA08),
      LA09: lab(extended.LA09),
    },
    capstone: initialCapstone(),
    updatedAt: new Date().toISOString(),
  };
}

function fail(message: string): never {
  throw new Error(message);
}
function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    fail(`${label}必须是对象。`);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null)
    fail(`${label}必须是普通数据对象。`);
  return value as Record<string, unknown>;
}
function keys(
  value: unknown,
  expected: readonly string[],
  label: string,
): Record<string, unknown> {
  const record = object(value, label);
  const actual = Object.keys(record);
  if (
    actual.length !== expected.length ||
    actual.some((key) => !expected.includes(key))
  )
    fail(`${label}字段缺失或包含未知字段。`);
  return record;
}
function text(
  value: unknown,
  label: string,
  maximum = MAX_TEXT_LENGTH,
): string {
  if (typeof value !== "string" || value.length > maximum)
    fail(`${label}必须是长度不超过${maximum}的纯文本。`);
  return value;
}
function keyText(value: unknown, label: string): string {
  const result = text(value, label, 200);
  if (
    !result.trim() ||
    ["__proto__", "prototype", "constructor"].includes(result)
  )
    fail(`${label}不是合法标识。`);
  return result;
}
function number(
  value: unknown,
  label: string,
  minimum = 0,
  maximum = MAX_AMOUNT,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  )
    fail(`${label}必须是${minimum}至${maximum}之间的有限数值。`);
  return value;
}
function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") fail(`${label}必须是布尔值。`);
  return value;
}
function array(value: unknown, label: string, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length > maximum)
    fail(`${label}必须是长度不超过${maximum}的数组。`);
  return value;
}
function date(value: unknown, label: string): string {
  const result = text(value, label, 40);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(result) ||
    !Number.isFinite(Date.parse(result)) ||
    new Date(result).toISOString() !== result
  )
    fail(`${label}必须是有效的UTC时间。`);
  return result;
}
function lessonId(value: unknown, label: string): LessonId {
  if (
    typeof value !== "string" ||
    !LEARNABLE_LESSON_IDS.includes(value as LessonId)
  )
    fail(`${label}必须是本期已实现的宏观课ID。`);
  return value as LessonId;
}
function event(value: unknown): LedgerEvent {
  const source = keys(value, ["id", "sequence", "type", "amount"], "账本事件");
  const sequence = number(
    source.sequence,
    "事件顺序",
    1,
    Number.MAX_SAFE_INTEGER,
  );
  if (!Number.isSafeInteger(sequence))
    fail("事件顺序必须是从1开始的安全整数。");
  if (!["wage", "service", "repayment"].includes(source.type as string))
    fail("非法事件类型：只允许工资、服务购买和本金偿还。");
  const amount = number(source.amount, "事件金额");
  if (amount <= 0) fail("事件金额必须大于0。");
  return {
    id: keyText(source.id, "事件ID"),
    sequence,
    type: source.type as LedgerEvent["type"],
    amount,
  };
}
function balance(
  source: unknown,
  fields: readonly string[],
  signed: readonly string[],
  label: string,
): Record<string, number> {
  const record = keys(source, fields, label);
  return Object.fromEntries(
    fields.map((field) => [
      field,
      number(
        record[field],
        `${label}.${field}`,
        signed.includes(field) ? -MAX_AMOUNT : 0,
      ),
    ]),
  );
}
function ledgerInput(value: unknown, label: string): LedgerInput {
  const source = keys(value, ["initial", "events"], label);
  const initial = keys(
    source.initial,
    ["H", "F", "B", "flow", "events"],
    `${label}期初账表`,
  );
  const initialEvents = array(initial.events, "期初历史事件", 0);
  const cleanInitial: LedgerState = {
    H: balance(
      initial.H,
      ["deposit", "netWorth"],
      ["netWorth"],
      "家庭",
    ) as LedgerState["H"],
    F: balance(
      initial.F,
      ["deposit", "loan", "netWorth"],
      ["netWorth"],
      "企业",
    ) as LedgerState["F"],
    B: balance(
      initial.B,
      ["reserves", "loanAsset", "depositH", "depositF", "equity"],
      ["equity"],
      "银行",
    ) as LedgerState["B"],
    flow: balance(
      initial.flow,
      [
        "householdIncome",
        "householdConsumption",
        "firmRevenue",
        "firmWages",
        "principalRepaid",
      ],
      [],
      "期间流量",
    ) as LedgerState["flow"],
    events: initialEvents as LedgerEvent[],
  };
  if (Object.values(cleanInitial.flow).some((value) => value !== 0))
    fail(`${label}期初期间流量必须为0；本期收入和支出应由原始事件重放产生。`);
  const events = array(source.events, `${label}事件`, 1000).map(event);
  try {
    validateLedger(cleanInitial);
    replayLedger(cleanInitial, events);
  } catch (error) {
    fail(
      `${label}不能复算：${error instanceof Error ? error.message : "非法账表或事件。"}`,
    );
  }
  return { initial: cleanInitial, events };
}
function accountsInput(value: unknown, label: string): AccountsInput {
  const fields = [
    "inventory",
    "exports",
    "imports",
    "machine",
    "transfer",
    "stock",
    "secondhand",
    "oldInventorySale",
    "openingInventory",
  ];
  const source = keys(value, fields, label);
  const result = Object.fromEntries(
    fields.map((field) => [
      field,
      field === "machine"
        ? boolean(source[field], "机器生产选择")
        : number(source[field], `${label}.${field}`),
    ]),
  ) as unknown as AccountsInput;
  try {
    computeAccounts(result);
  } catch (error) {
    fail(
      `${label}不能复算：${error instanceof Error ? error.message : "非法生产记录。"}`,
    );
  }
  return result;
}
function priceInput(value: unknown, label: string): PriceInput {
  const source = keys(
    value,
    ["periods", "priceBase", "basketBase", "normalization"],
    label,
  );
  const periods = array(source.periods, `${label}时期表`, 12).map(
    (entry, index) => {
      const period = keys(entry, ["px", "py", "qx", "qy"], `第${index}期p/q`);
      const px = number(period.px, "x价格");
      const py = number(period.py, "y价格");
      if (px <= 0 || py <= 0) fail("价格必须大于0。");
      return {
        px,
        py,
        qx: number(period.qx, "x数量"),
        qy: number(period.qy, "y数量"),
      };
    },
  );
  const priceBase = number(
    source.priceBase,
    "实际价格基期",
    0,
    Math.max(0, periods.length - 1),
  );
  const basketBase = number(
    source.basketBase,
    "消费篮子基期",
    0,
    Math.max(0, periods.length - 1),
  );
  if (!Number.isInteger(priceBase) || !Number.isInteger(basketBase))
    fail("基期必须是合法时期整数。");
  if (source.normalization !== 100 && source.normalization !== 1000)
    fail("指数归一化只允许100或1000。");
  const result: PriceInput = {
    periods,
    priceBase,
    basketBase,
    normalization: source.normalization,
  };
  try {
    computePrices(result);
  } catch (error) {
    fail(
      `${label}不能复算：${error instanceof Error ? error.message : "非法p/q数据。"}`,
    );
  }
  return result;
}
function lab<Input>(
  value: unknown,
  validate: (value: unknown, label: string) => Input,
  label: string,
  allowClassifications = false,
): LabState<Input> & { classifications?: Record<string, string> } {
  const fields = [
    "input",
    "baseline",
    "prediction",
    "skipped",
    "hasRun",
    "explanation",
  ];
  if (
    allowClassifications &&
    Object.prototype.hasOwnProperty.call(
      object(value, label),
      "classifications",
    )
  )
    fields.push("classifications");
  const source = keys(value, fields, label);
  const result: LabState<Input> & { classifications?: Record<string, string> } =
    {
      input: validate(source.input, `${label}实验情景`),
      baseline: validate(source.baseline, `${label}A基准`),
      prediction: text(source.prediction, `${label}预测`),
      skipped: boolean(source.skipped, `${label}跳过预测`),
      hasRun: boolean(source.hasRun, `${label}运行状态`),
      explanation: text(source.explanation, `${label}结果解释`),
    };
  if (fields.includes("classifications"))
    result.classifications = dictionary(
      source.classifications,
      (value, label) => text(value, label, 100),
      `${label}分类判断`,
    );
  return result;
}
function dictionary<Value>(
  value: unknown,
  validate: (value: unknown, label: string) => Value,
  label: string,
): Record<string, Value> {
  const source = object(value, label);
  const entries = Object.entries(source);
  if (entries.length > 600) fail(`${label}最多保存600项。`);
  return Object.fromEntries(
    entries.map(([key, entry]) => [
      keyText(key, `${label}标识`),
      validate(entry, label),
    ]),
  );
}

/** Reconstruct only raw inputs; every experiment is checked by its calculation kernel. */
export function validateState(input: unknown): LearningState {
  const source = object(input, "学习记录");
  if (source.courseId !== "macroeconomics")
    fail("课程不匹配：只接受macroeconomics宏观课程文件，不能导入微观记录。");
  if (source.schemaVersion !== 1)
    fail("未知记录版本：本应用只支持schemaVersion 1。");
  const legacy = !Object.hasOwn(source, "capstone");
  keys(
    source,
    [
      "schemaVersion",
      "courseId",
      "lastLessonId",
      "lessonStates",
      "objectiveAttempts",
      "selfChecks",
      "notes",
      "labStates",
      "updatedAt",
      ...(legacy ? [] : ["capstone"]),
    ],
    "学习记录",
  );
  const lessons = keys(
    source.lessonStates,
    legacy ? LEGACY_LESSON_IDS : LEARNABLE_LESSON_IDS,
    "各课学习状态",
  );
  const lessonStates = Object.fromEntries(
    LEARNABLE_LESSON_IDS.map((id) => {
      if (legacy && !Object.hasOwn(lessons, id))
        return [id, { status: "not_started", confidence: 0 }];
      const entry = keys(
        lessons[id],
        ["status", "confidence"],
        `${id}学习状态`,
      );
      if (
        !["not_started", "in_progress", "practiced", "self_checked"].includes(
          entry.status as string,
        )
      )
        fail(`${id}学习状态不合法。`);
      return [
        id,
        {
          status: entry.status as LessonStatus,
          confidence: number(entry.confidence, "概念信心", 0, 5),
        },
      ];
    }),
  ) as Record<LessonId, LessonState>;
  const objectiveAttempts = array(
    source.objectiveAttempts,
    "客观题尝试",
    2000,
  ).map((value) => {
    const entry = keys(
      value,
      ["lessonId", "checkId", "answer", "correct", "at"],
      "客观题尝试",
    );
    if (legacy && !LEGACY_LESSON_IDS.includes(entry.lessonId as LessonId))
      fail("首期旧记录不能含扩展课程尝试。");
    return {
      lessonId: lessonId(entry.lessonId, "客观题课ID"),
      checkId: keyText(entry.checkId, "题目ID"),
      answer: text(entry.answer, "客观题回答"),
      correct: boolean(entry.correct, "客观题反馈"),
      at: date(entry.at, "尝试时间"),
    };
  });
  const labs = keys(
    source.labStates,
    legacy
      ? ["LA01", "LA02", "LA03"]
      : ["LA01", "LA02", "LA03", ...ADVANCED_LAB_IDS],
    "实验状态",
  );
  const defaults = initialState();
  if (legacy && !LEGACY_LESSON_IDS.includes(source.lastLessonId as LessonId))
    fail("首期旧记录的最近课ID不合法。");
  const result: LearningState = {
    schemaVersion: 1,
    courseId: "macroeconomics",
    lastLessonId: lessonId(source.lastLessonId, "最近课ID"),
    lessonStates,
    objectiveAttempts,
    selfChecks: dictionary(source.selfChecks, boolean, "主观自评"),
    notes: dictionary(source.notes, text, "纯文本笔记"),
    labStates: {
      LA01: lab(labs.LA01, ledgerInput, "LA01"),
      LA02: lab(labs.LA02, accountsInput, "LA02", true),
      LA03: lab(labs.LA03, priceInput, "LA03"),
      LA04: legacy
        ? defaults.labStates.LA04
        : lab(
            labs.LA04,
            (value) => validateAdvancedInput("LA04", value),
            "LA04",
          ),
      LA05: legacy
        ? defaults.labStates.LA05
        : lab(
            labs.LA05,
            (value) => validateAdvancedInput("LA05", value),
            "LA05",
          ),
      LA06: legacy
        ? defaults.labStates.LA06
        : lab(
            labs.LA06,
            (value) => validateAdvancedInput("LA06", value),
            "LA06",
          ),
      LA07: legacy
        ? defaults.labStates.LA07
        : lab(
            labs.LA07,
            (value) => validateAdvancedInput("LA07", value),
            "LA07",
          ),
      LA08: legacy
        ? defaults.labStates.LA08
        : lab(
            labs.LA08,
            (value) => validateAdvancedInput("LA08", value),
            "LA08",
          ),
      LA09: legacy
        ? defaults.labStates.LA09
        : lab(
            labs.LA09,
            (value) => validateAdvancedInput("LA09", value),
            "LA09",
          ),
    },
    capstone: legacy ? defaults.capstone : validateCapstone(source.capstone),
    updatedAt: date(source.updatedAt, "更新时间"),
  };
  if (
    new TextEncoder().encode(JSON.stringify(result)).byteLength >
    MAX_IMPORT_BYTES
  )
    fail("学习记录超过1 MiB。");
  return result;
}

function serializeValidatedState(canonical: LearningState): string {
  const readable = JSON.stringify(canonical, null, 2);
  if (new TextEncoder().encode(readable).byteLength <= MAX_IMPORT_BYTES)
    return readable;
  // Validation/import use compact UTF-8 size. Formatting must not make a valid
  // near-limit record impossible to save or export again.
  return JSON.stringify(canonical);
}

export function exportState(state: LearningState): string {
  return serializeValidatedState(validateState(state));
}

export function importState(json: string): LearningState {
  if (
    typeof json !== "string" ||
    new TextEncoder().encode(json).byteLength > MAX_IMPORT_BYTES
  )
    fail("导入文件超过1 MiB或不是JSON文本。");
  let value: unknown;
  try {
    value = JSON.parse(json) as unknown;
  } catch {
    fail("记录不是有效JSON；原记录未被修改。");
  }
  return validateState(value);
}

function fallback(storage: StorageAccess): LearningState {
  const saved = storage
    ? fallbackByStorage.get(storage)
    : fallbackWithoutStorage;
  return saved ? clone(saved) : initialState();
}
function remember(
  storage: StorageAccess,
  state: LearningState,
  notice = MEMORY_NOTICE,
): void {
  if (storage) {
    fallbackByStorage.set(storage, clone(state));
    fallbackNoticeByStorage.set(storage, notice);
  } else fallbackWithoutStorage = clone(state);
}

export function loadState(storage: StorageAccess): LoadResult {
  if (!storage)
    return {
      state: fallback(storage),
      notice: MEMORY_NOTICE,
      protected: false,
    };
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    unreadableStorage.add(storage);
    return {
      state: fallback(storage),
      notice: MEMORY_NOTICE,
      protected: false,
    };
  }
  if (raw === null) {
    if (!fallbackByStorage.has(storage)) {
      observedRawByStorage.set(storage, raw);
      unreadableStorage.delete(storage);
    }
    return {
      state: fallbackByStorage.has(storage)
        ? fallback(storage)
        : initialState(),
      notice: fallbackByStorage.has(storage)
        ? fallbackNoticeByStorage.get(storage) || MEMORY_NOTICE
        : "",
      protected: false,
    };
  }
  try {
    const state = importState(raw);
    if (!fallbackByStorage.has(storage)) {
      observedRawByStorage.set(storage, raw);
      unreadableStorage.delete(storage);
    }
    return {
      state: fallbackByStorage.has(storage) ? fallback(storage) : state,
      notice: fallbackByStorage.has(storage)
        ? fallbackNoticeByStorage.get(storage) || MEMORY_NOTICE
        : "",
      protected: false,
    };
  } catch (error) {
    return {
      state: initialState(),
      notice: `${error instanceof Error ? error.message : "本地记录损坏。"} ${PROTECTED_NOTICE}`,
      protected: true,
    };
  }
}

export function saveState(
  storage: StorageAccess,
  state: LearningState,
): SaveResult {
  let canonical: LearningState;
  let json: string;
  try {
    canonical = validateState(state);
    json = serializeValidatedState(canonical);
  } catch (error) {
    return {
      ok: false,
      notice:
        error instanceof Error ? error.message : "学习记录不合法，未保存。",
    };
  }
  if (!storage) {
    remember(storage, canonical);
    return { ok: false, notice: MEMORY_NOTICE };
  }
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    unreadableStorage.add(storage);
    remember(storage, canonical);
    return { ok: false, notice: MEMORY_NOTICE };
  }
  if (
    raw !== null &&
    (!observedRawByStorage.has(storage) ||
      observedRawByStorage.get(storage) !== raw)
  ) {
    try {
      importState(raw);
    } catch (error) {
      return {
        ok: false,
        notice: `${error instanceof Error ? error.message : "原记录损坏。"} ${PROTECTED_NOTICE}`,
      };
    }
  }
  if (
    (observedRawByStorage.has(storage) &&
      observedRawByStorage.get(storage) !== raw) ||
    (!observedRawByStorage.has(storage) &&
      unreadableStorage.has(storage) &&
      raw !== null)
  ) {
    remember(storage, canonical, CONFLICT_NOTICE);
    return { ok: false, notice: CONFLICT_NOTICE };
  }
  // A caller may save a valid record without first calling loadState. The first
  // successful read establishes its version; later writes must match it.
  observedRawByStorage.set(storage, raw);
  unreadableStorage.delete(storage);
  try {
    storage.setItem(STORAGE_KEY, json);
    observedRawByStorage.set(storage, json);
    fallbackByStorage.delete(storage);
    fallbackNoticeByStorage.delete(storage);
    return { ok: true, notice: "" };
  } catch {
    remember(storage, canonical);
    return { ok: false, notice: MEMORY_NOTICE };
  }
}

/** Only this course's namespace is removed. Confirmation belongs to the UI. */
export function clearState(storage: StorageAccess): SaveResult {
  if (storage) {
    fallbackByStorage.delete(storage);
    fallbackNoticeByStorage.delete(storage);
    observedRawByStorage.delete(storage);
    unreadableStorage.delete(storage);
  } else fallbackWithoutStorage = null;
  if (!storage) return { ok: false, notice: MEMORY_NOTICE };
  try {
    storage.removeItem(STORAGE_KEY);
    observedRawByStorage.set(storage, null);
    return { ok: true, notice: "" };
  } catch {
    return {
      ok: false,
      notice:
        "浏览器拒绝删除本课记录；原持久记录可能仍存在。当前内存记录已清空。",
    };
  }
}

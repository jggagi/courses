import { beforeEach, describe, expect, it } from "vitest";
import {
  clearState,
  exportState,
  importState,
  initialState,
  loadState,
  MAX_IMPORT_BYTES,
  saveState,
  STORAGE_KEY,
  validateState,
  type LearningState,
  type LocalStorageLike,
} from "../../src/persistence";
import { computeAccounts, computePrices, replayLedger } from "../../src/models";

class MemoryStorage implements LocalStorageLike {
  values = new Map<string, string>();
  writes = 0;
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.writes += 1;
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}
function alteredState(mutate: (state: LearningState) => void): string {
  const state = initialState();
  mutate(state);
  return JSON.stringify(state);
}

describe("宏观学习记录的原始输入与本地恢复", () => {
  beforeEach(() => {
    clearState(null);
  });

  it("刷新后恢复笔记、进度、预测、主观自评与每笔原始事件", () => {
    const storage = new MemoryStorage();
    const state = initialState();
    state.lastLessonId = "A01-B";
    state.lessonStates["A01-A"] = { status: "self_checked", confidence: 3 };
    state.notes["A01-A"] = "存款是时点存量；工资是每期流量。";
    state.notes["prediction:A01-A"] = "工资使家庭存款增加，但不增加总存款。";
    state.notes["response:A01-A-explain"] = "债务与赤字需要分开时期。";
    state.notes["card:A01"] = "对象：家庭、企业、银行。";
    state.selfChecks["A01-A-explain"] = true;
    state.objectiveAttempts.push({
      lessonId: "A01-A",
      checkId: "A01-A-numeric",
      answer: "110",
      correct: true,
      at: state.updatedAt,
    });
    state.labStates.LA01.prediction =
      "工资和消费只转移存款，本金偿还减少存款。";
    state.labStates.LA01.hasRun = true;
    state.labStates.LA01.input.events = [
      { id: "wage-1", sequence: 1, type: "wage", amount: 20 },
      { id: "service-2", sequence: 2, type: "service", amount: 10 },
      { id: "repayment-3", sequence: 3, type: "repayment", amount: 5 },
    ];
    expect(saveState(storage, state)).toEqual({ ok: true, notice: "" });
    const restored = loadState(storage);
    expect(restored.state).toEqual(state);
    expect(restored.protected).toBe(false);
    const result = replayLedger(
      restored.state.labStates.LA01.input.initial,
      restored.state.labStates.LA01.input.events,
    );
    expect(result.H.deposit).toBe(110);
    expect(result.F.loan).toBe(15);
    expect(result.B.depositH + result.B.depositF).toBe(135);
    expect(restored.state.labStates.LA01.baseline.events).toEqual([]);
  });

  it("JSON往返保留p/q、权重和活动，且复算三实验", () => {
    const state = initialState();
    state.labStates.LA02.input = {
      ...state.labStates.LA02.input,
      inventory: 10,
      exports: 20,
      imports: 30,
      machine: true,
      oldInventorySale: 20,
    };
    state.labStates.LA02.skipped = true;
    state.labStates.LA02.classifications = { transfer: "转移，不直接计入GDP" };
    state.labStates.LA03.input.normalization = 1000;
    state.labStates.LA03.input.priceBase = 1;
    const restored = importState(exportState(state));
    expect(restored).toEqual(state);
    expect(computeAccounts(restored.labStates.LA02.input).production).toBe(140);
    expect(computePrices(restored.labStates.LA03.input).periods[0].L).toBe(
      1000,
    );
    expect(restored.labStates.LA02.baseline.inventory).toBe(0);
    expect(restored.labStates.LA03.baseline.normalization).toBe(100);
  });

  it("空记录和多次initialState互相隔离，不共享A/B嵌套对象", () => {
    const first = initialState();
    first.labStates.LA01.input.initial.H.deposit = 999;
    first.labStates.LA03.input.periods[0].px = 900;
    expect(first.labStates.LA01.baseline.initial.H.deposit).toBe(100);
    expect(first.labStates.LA03.baseline.periods[0].px).toBe(2);
    expect(initialState().labStates.LA01.input.initial.H.deposit).toBe(100);
    expect(loadState(new MemoryStorage()).state.notes).toEqual({});
  });

  it.each([
    ["损坏JSON", "{bad json"],
    ["未知版本", JSON.stringify({ ...initialState(), schemaVersion: 9 })],
  ])("%s原记录受到保护", (_, raw) => {
    const storage = new MemoryStorage();
    storage.values.set(STORAGE_KEY, raw);
    const restored = loadState(storage);
    expect(restored.protected).toBe(true);
    expect(restored.notice).toContain("未被自动覆盖");
    expect(saveState(storage, initialState()).ok).toBe(false);
    expect(storage.values.get(STORAGE_KEY)).toBe(raw);
    expect(storage.writes).toBe(0);
  });

  it("拒绝另一门课文件，清空只删除宏观命名空间", () => {
    const storage = new MemoryStorage();
    storage.values.set("courses:microeconomics:v1", "private micro notes");
    expect(() =>
      importState(
        JSON.stringify({ ...initialState(), courseId: "microeconomics" }),
      ),
    ).toThrow(/课程不匹配/);
    saveState(storage, initialState());
    expect(clearState(storage).ok).toBe(true);
    expect(storage.values.get("courses:microeconomics:v1")).toBe(
      "private micro notes",
    );
    expect(storage.values.has(STORAGE_KEY)).toBe(false);
  });

  it("在显式清空后可以保存有效导入，原无效文件不会自行丢失", () => {
    const storage = new MemoryStorage();
    storage.values.set(STORAGE_KEY, "broken original");
    const restored = importState(exportState(initialState()));
    expect(saveState(storage, restored).ok).toBe(false);
    clearState(storage);
    expect(saveState(storage, restored).ok).toBe(true);
  });

  it("笔记按纯文本往返，用户脚本字符串不执行", () => {
    const state = initialState();
    state.notes["A01-A"] =
      "<script>globalThis.__macroExecuted = true</script><img src=x onerror=alert(1)>";
    const restored = importState(exportState(state));
    expect(restored.notes["A01-A"]).toBe(state.notes["A01-A"]);
    expect("__macroExecuted" in globalThis).toBe(false);
  });

  it("读写存储抛错时以内存回退，并提示未持久保存", () => {
    const broken: LocalStorageLike = {
      getItem() {
        throw new Error("disabled");
      },
      setItem() {
        throw new Error("disabled");
      },
      removeItem() {
        throw new Error("disabled");
      },
    };
    const state = initialState();
    state.notes["A01-A"] = "仅此页面内存";
    expect(loadState(broken).notice).toContain("内存");
    expect(saveState(broken, state)).toEqual({
      ok: false,
      notice: expect.stringContaining("关闭页面"),
    });
    expect(loadState(broken).state.notes["A01-A"]).toBe("仅此页面内存");
    expect(loadState(new MemoryStorage()).state.notes).toEqual({});
    expect(clearState(broken).ok).toBe(false);
    expect(loadState(broken).state.notes).toEqual({});
  });

  it("配额导致写失败时读取到本页面最新内存状态，而非旧持久记录", () => {
    const storage = new MemoryStorage();
    const prior = initialState();
    storage.values.set(STORAGE_KEY, exportState(prior));
    storage.setItem = () => {
      throw new Error("quota");
    };
    const current = initialState();
    current.notes["A01-B"] = "本页面仍可学习";
    expect(saveState(storage, current).notice).toContain("内存");
    expect(loadState(storage).state.notes["A01-B"]).toBe("本页面仍可学习");
    expect(loadState(storage).notice).toContain("关闭页面");
    expect(importState(storage.values.get(STORAGE_KEY)!).notes).toEqual({});
  });

  it("完全不可用的存储也支持本页面状态与显式内存清空", () => {
    const state = initialState();
    state.notes["prediction:A02-A"] = "增加值100";
    expect(saveState(null, state).notice).toContain("内存");
    expect(loadState(null).state.notes).toEqual(state.notes);
    clearState(null);
    expect(loadState(null).state.notes).toEqual({});
  });
});

describe("宏观导入结构与模型源记录校验", () => {
  it.each<[string, (state: LearningState) => void]>([
    [
      "非法事件类型",
      (state: LearningState) => {
        state.labStates.LA01.input.events = [
          { id: "evil", sequence: 1, type: "new-loan" as "wage", amount: 1 },
        ];
      },
    ],
    [
      "负金额",
      (state: LearningState) => {
        state.labStates.LA01.input.events = [
          { id: "bad", sequence: 1, type: "wage", amount: -1 },
        ];
      },
    ],
    [
      "超余额",
      (state: LearningState) => {
        state.labStates.LA01.input.events = [
          { id: "bad", sequence: 1, type: "wage", amount: 41 },
        ];
      },
    ],
    [
      "重复事件",
      (state: LearningState) => {
        state.labStates.LA01.input.events = [
          { id: "same", sequence: 1, type: "wage", amount: 1 },
          { id: "same", sequence: 2, type: "service", amount: 1 },
        ];
      },
    ],
    [
      "顺序重复",
      (state: LearningState) => {
        state.labStates.LA01.input.events = [
          { id: "a", sequence: 1, type: "wage", amount: 1 },
          { id: "b", sequence: 1, type: "service", amount: 1 },
        ];
      },
    ],
    [
      "账表不平衡",
      (state: LearningState) => {
        state.labStates.LA01.input.initial.F.loan = 19;
      },
    ],
    [
      "贷款双边失配",
      (state: LearningState) => {
        state.labStates.LA01.input.initial.B.loanAsset = 19;
        state.labStates.LA01.input.initial.B.equity = 39;
      },
    ],
    [
      "起始记录夹带事件",
      (state: LearningState) => {
        state.labStates.LA01.input.initial.events = [
          { id: "old", sequence: 1, type: "wage", amount: 1 },
        ];
      },
    ],
    [
      "期初伪造本期收入",
      (state: LearningState) => {
        state.labStates.LA01.input.initial.flow.householdIncome = 20;
      },
    ],
    [
      "当期库存加出口超产出",
      (state: LearningState) => {
        state.labStates.LA02.input.inventory = 80;
        state.labStates.LA02.input.exports = 30;
      },
    ],
    [
      "超额卖出前期存货",
      (state: LearningState) => {
        state.labStates.LA02.input.oldInventorySale = 21;
      },
    ],
    [
      "负价格",
      (state: LearningState) => {
        state.labStates.LA03.input.periods[1].px = -1;
      },
    ],
    [
      "负数量",
      (state: LearningState) => {
        state.labStates.LA03.input.periods[0].qy = -1;
      },
    ],
    [
      "非法基期",
      (state: LearningState) => {
        state.labStates.LA03.input.priceBase = 3;
      },
    ],
    [
      "非法刻度",
      (state: LearningState) => {
        state.labStates.LA03.input.normalization = 300 as 100;
      },
    ],
  ])("拒绝%s，不能以导入绕过模型", (_, mutate) => {
    expect(() => importState(alteredState(mutate))).toThrow();
  });

  it("A基准同样经过复算，不能成为非法输入的藏身处", () => {
    expect(() =>
      importState(
        alteredState((state) => {
          state.labStates.LA01.baseline.events = [
            { id: "bad", sequence: 1, type: "repayment", amount: 21 },
          ];
        }),
      ),
    ).toThrow();
    expect(() =>
      importState(
        alteredState((state) => {
          state.labStates.LA02.baseline.openingInventory = -1;
        }),
      ),
    ).toThrow();
  });

  it("非法新状态不会覆盖此前有效学习记录", () => {
    const storage = new MemoryStorage();
    const state = initialState();
    state.notes["A01-A"] = "有效笔记";
    saveState(storage, state);
    const raw = storage.values.get(STORAGE_KEY);
    state.labStates.LA01.input.events = [
      { id: "bad", sequence: 1, type: "wage", amount: 99 },
    ];
    expect(saveState(storage, state).ok).toBe(false);
    expect(storage.values.get(STORAGE_KEY)).toBe(raw);
  });

  it("非有限数及超范围金额均被拒绝", () => {
    const state = initialState();
    state.labStates.LA03.input.periods[0].px = Infinity;
    expect(() => validateState(state)).toThrow(/有限/);
    state.labStates.LA03.input.periods[0].px = NaN;
    expect(() => validateState(state)).toThrow(/有限/);
    state.labStates.LA03.input.periods[0].px = 1_000_000_001;
    expect(() => validateState(state)).toThrow(/有限/);
    expect(() =>
      importState(
        alteredState((s) => {
          s.labStates.LA01.input.events = [
            { id: "bad", sequence: 1, type: "wage", amount: Infinity },
          ];
        }),
      ),
    ).toThrow(/有限/);
  });

  it("拒绝未知字段、伪造缓存结果、非法课ID与危险对象键", () => {
    const state = initialState();
    expect(() => validateState({ ...state, cachedGDP: 100 })).toThrow(
      /未知字段/,
    );
    expect(() => validateState({ ...state, lastLessonId: "A13-A" })).toThrow(
      /已实现/,
    );
    const input = JSON.parse(exportState(state));
    input.labStates.LA02.input.cachedResult = { production: 100 };
    expect(() => validateState(input)).toThrow(/未知字段/);
    const prototypeFile = exportState(state).replace(
      '"notes": {}',
      '"notes": {"__proto__": "attack"}',
    );
    expect(() => importState(prototypeFile)).toThrow(/合法标识/);
  });

  it("限制UTF8字节、单条文本和数组大小", () => {
    expect(() => importState(" ".repeat(MAX_IMPORT_BYTES + 1))).toThrow(
      /1 MiB/,
    );
    expect(() =>
      importState("中".repeat(Math.ceil(MAX_IMPORT_BYTES / 3) + 1)),
    ).toThrow(/1 MiB/);
    expect(() =>
      importState(
        alteredState((state) => {
          state.notes["A01-A"] = "a".repeat(20_001);
        }),
      ),
    ).toThrow(/长度/);
    expect(() =>
      importState(
        alteredState((state) => {
          state.labStates.LA03.input.periods = [];
        }),
      ),
    ).toThrow();
    expect(() =>
      importState(
        alteredState((state) => {
          state.labStates.LA03.input.periods = Array.from(
            { length: 13 },
            () => ({ px: 2, py: 4, qx: 10, qy: 5 }),
          );
        }),
      ),
    ).toThrow(/12/);
  });

  it("零产量的未定义指标是合法边界，可保存并复算而非伪造成0", () => {
    const state = initialState();
    state.labStates.LA03.input.periods[0].qx = 0;
    state.labStates.LA03.input.periods[0].qy = 0;
    const restored = importState(exportState(state));
    const result = computePrices(restored.labStates.LA03.input);
    expect(result.periods[0].D).toBeNull();
    expect(result.periods[0].L).toBeNull();
    expect(result.periods[1].gN).toBeNull();
  });

  it("有限但极小的价格产生派生溢出时也拒绝导入，不把Infinity当结果", () => {
    const state = initialState();
    state.labStates.LA03.input.periods = [
      { px: Number.MIN_VALUE, py: 1, qx: 1, qy: 0 },
      { px: 1, py: 1, qx: 1, qy: 0 },
    ];
    expect(() => importState(JSON.stringify(state))).toThrow(/数值|有限|上溢/);
  });
});

import { describe, expect, it } from "vitest";
import {
  clearState,
  exportState,
  importState,
  initialState,
  loadState,
  MAX_IMPORT_BYTES,
  saveState,
  STORAGE_KEY,
  type LocalStorageLike,
} from "../../src/persistence";

class LocalMemory implements LocalStorageLike {
  values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe("PR review: near-limit records remain saveable and exportable", () => {
  it("round-trips a valid compact import whose indentation exceeds 1 MiB", () => {
    const state = initialState();
    for (let index = 0; index < 50; index++)
      state.notes[`synthetic-note-${index}`] = "a".repeat(20_000);
    state.notes["synthetic-boundary-note"] = "";
    const remaining =
      MAX_IMPORT_BYTES -
      new TextEncoder().encode(JSON.stringify(state)).byteLength -
      128;
    // Fill separate notes so each remains inside its own text limit.
    for (let index = 0, left = remaining; left > 0; index++) {
      const length = Math.min(19_900, left - 40);
      if (length <= 0) break;
      state.notes[`synthetic-extra-${index}`] = "a".repeat(length);
      left -= length + 40;
    }
    const compact = JSON.stringify(state);
    expect(new TextEncoder().encode(compact).byteLength).toBeLessThan(
      MAX_IMPORT_BYTES,
    );
    expect(
      new TextEncoder().encode(JSON.stringify(state, null, 2)).byteLength,
    ).toBeGreaterThan(MAX_IMPORT_BYTES);
    const imported = importState(compact);
    const exported = exportState(imported);
    expect(new TextEncoder().encode(exported).byteLength).toBeLessThanOrEqual(
      MAX_IMPORT_BYTES,
    );
    expect(importState(exported)).toEqual(imported);
    const storage = new LocalMemory();
    expect(saveState(storage, imported).ok).toBe(true);
    expect(storage.values.has(STORAGE_KEY)).toBe(true);
    expect(loadState(storage).state).toEqual(imported);
  });
});

/** Separate tab facades share one origin's persistent values, not their observers. */
function tabStorage(values: Map<string, string>): LocalStorageLike {
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

describe("PR review: concurrent pages preserve prior learning records", () => {
  it("refuses a stale tab's write and keeps both the new persistent record and its exportable draft", () => {
    const values = new Map([[STORAGE_KEY, exportState(initialState())]]);
    const tabA = tabStorage(values);
    const tabB = tabStorage(values);
    const stateA = loadState(tabA).state;
    const stateB = loadState(tabB).state;
    stateA.notes["note:A01-A"] = "合成甲页笔记：存量需要一个时点。";
    expect(saveState(tabA, stateA).ok).toBe(true);
    const savedA = values.get(STORAGE_KEY);
    stateB.notes["note:A01-B"] = "合成乙页笔记：存款有银行对手方。";
    const refused = saveState(tabB, stateB);
    expect(refused.ok).toBe(false);
    expect(refused.notice).toContain("其他页面");
    expect(refused.notice).toContain("先导出");
    expect(values.get(STORAGE_KEY)).toBe(savedA);
    expect(importState(exportState(stateB)).notes["note:A01-B"]).toContain(
      "乙页",
    );
    expect(loadState(tabB).state.notes).toEqual(stateB.notes);
    expect(loadState(tabB).notice).toContain("其他页面");
    stateB.notes["note:A01-B"] += "当前页可继续修改。";
    expect(saveState(tabB, stateB).ok).toBe(false);
    expect(values.get(STORAGE_KEY)).toBe(savedA);
    // A reload has a new page observer and reads the winning persistent version.
    expect(loadState(tabStorage(values)).state.notes).toEqual(stateA.notes);
  });

  it("allows sequential saves and the first direct save without a preceding load", () => {
    const values = new Map([[STORAGE_KEY, exportState(initialState())]]);
    const tab = tabStorage(values);
    const state = initialState();
    state.notes["note:A03-A"] = "合成首次直接保存。";
    expect(saveState(tab, state).ok).toBe(true);
    state.notes["note:A03-A"] += "再次保存同页的新增解释。";
    expect(saveState(tab, state).ok).toBe(true);
    expect(loadState(tab).state.notes).toEqual(state.notes);
  });

  it("also detects another page deleting the record, and explicit clearing permits a replacement", () => {
    const values = new Map([[STORAGE_KEY, exportState(initialState())]]);
    const tab = tabStorage(values);
    const state = loadState(tab).state;
    values.delete(STORAGE_KEY);
    state.notes["note:A02-A"] = "合成待导出草稿。";
    expect(saveState(tab, state).notice).toContain("其他页面");
    expect(values.has(STORAGE_KEY)).toBe(false);
    expect(clearState(tab).ok).toBe(true);
    expect(saveState(tab, state).ok).toBe(true);
    expect(loadState(tab).state.notes).toEqual(state.notes);
  });

  it("keeps malformed concurrent data under the existing damaged-record protection", () => {
    const values = new Map([[STORAGE_KEY, exportState(initialState())]]);
    const tab = tabStorage(values);
    const state = loadState(tab).state;
    values.set(STORAGE_KEY, "{broken original");
    expect(saveState(tab, state).notice).toContain("未被自动覆盖");
    expect(values.get(STORAGE_KEY)).toBe("{broken original");
    expect(loadState(tab).protected).toBe(true);
  });

  it("does not overwrite previously unreadable existing records when storage access recovers", () => {
    const values = new Map([[STORAGE_KEY, exportState(initialState())]]);
    let denied = true;
    const tab: LocalStorageLike = {
      ...tabStorage(values),
      getItem(key) {
        if (denied) throw new Error("disabled");
        return values.get(key) ?? null;
      },
    };
    const state = loadState(tab).state;
    state.notes["note:A12-A"] = "合成存储被禁时的临时草稿。";
    expect(saveState(tab, state).notice).toContain("内存");
    const original = values.get(STORAGE_KEY);
    denied = false;
    // A memory-mode read must not silently adopt the unseen persistent version.
    expect(loadState(tab).state.notes).toEqual(state.notes);
    expect(saveState(tab, state).notice).toContain("先导出");
    expect(values.get(STORAGE_KEY)).toBe(original);
  });
});

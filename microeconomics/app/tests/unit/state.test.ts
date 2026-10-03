import { describe, expect, it } from 'vitest';
import {
  createInitialState, createLearningStore, defaultLabParameters, MAX_IMPORT_BYTES, STORAGE_KEY,
  validateLearningState, type LearningState, type StorageLike,
} from '../../src/persistence/store';

const AT = '2026-10-03T08:00:00.000Z';
const LATER = '2026-10-03T08:01:00.000Z';

class FakeStorage implements StorageLike {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

function filledState(): LearningState {
  const state = createInitialState(AT);
  state.lastLessonId = 'M02-A';
  state.lessonStates['M01-A'] = 'self_checked';
  state.objectiveAttempts['M01-A-number'] = [{ answer: 7, correct: false, at: AT }, { answer: 6, correct: true, at: LATER }];
  state.selfChecks['M01-A-explain'] = { answer: '最好被放弃的选择也是成本。', rating: 'clear' };
  state.notes['M01-A'] = '暂不把时间与金钱相加。';
  state.notes['M02-A'] = '数值标签不同，排序相同。';
  state.conceptConfidence['M01-A'] = 4;
  state.labStates.ML01.scenario.px = 6;
  state.labStates.ML01.prediction = 'x 截距减半，y 截距不变。';
  state.labStates.ML01.revealed = true;
  state.labStates.ML02.scenario.representation = 'square';
  state.labStates.ML03.scenario.kind = 'complements';
  return state;
}

describe('local learning state', () => {
  it('creates separate valid default A/B experiment objects and honest lesson states', () => {
    const state = createInitialState(AT);
    expect(validateLearningState(state).ok).toBe(true);
    expect(Object.values(state.lessonStates)).toEqual(Array(6).fill('not_started'));
    expect(state.lastLessonId).toBeNull();
    expect(state.labStates.ML01.baseline).toMatchObject({ m: 120, px: 3, py: 2, x: 20, y: 30 });
    expect(defaultLabParameters('ML02')).toMatchObject({ x: 10, y: 10, secondX: 20, secondY: 5 });
    state.labStates.ML01.scenario.px = 6;
    expect(state.labStates.ML01.baseline.px).toBe(3);
    expect(state.labStates.ML03.scenario.px).toBe(3);
  });

  it('restores attempts, notes, confidence, prediction, reveal and A/B after a new store loads', () => {
    const storage = new FakeStorage();
    const first = createLearningStore({ storage, now: () => LATER });
    const result = first.save(filledState());
    expect(result.status).toBe('saved');
    expect(result.state.updatedAt).toBe(LATER);
    const refreshed = createLearningStore({ storage, now: () => LATER });
    expect(refreshed.load().state).toEqual(result.state);
    expect(refreshed.load().state.labStates.ML01).toMatchObject({
      baseline: { px: 3 }, scenario: { px: 6 }, prediction: 'x 截距减半，y 截距不变。', revealed: true,
    });
  });

  it('round trips explicit JSON export and import with every record intact', () => {
    const first = createLearningStore({ storage: new FakeStorage(), now: () => AT });
    first.save(filledState());
    const exported = first.exportJson();
    const second = createLearningStore({ storage: new FakeStorage(), now: () => LATER });
    expect(second.importJson(exported).ok).toBe(true);
    expect(second.load().state).toEqual(first.load().state);
  });

  it('rejects invalid JSON and cross-course import without modifying the current record', () => {
    const storage = new FakeStorage();
    const store = createLearningStore({ storage, now: () => AT });
    store.save(filledState());
    const before = storage.getItem(STORAGE_KEY);
    expect(store.importJson('{broken').ok).toBe(false);
    const other = { ...filledState(), courseId: 'macroeconomics' };
    expect(store.importJson(JSON.stringify(other))).toMatchObject({ ok: false, error: expect.stringContaining('课程不匹配') });
    expect(storage.getItem(STORAGE_KEY)).toBe(before);
    expect(store.load().state.notes['M01-A']).toBe('暂不把时间与金钱相加。');
  });

  it.each(['{broken', JSON.stringify({ ...createInitialState(AT), schemaVersion: 2 })])('protects unreadable originals and permits a recovery export (%s)', (raw) => {
    const storage = new FakeStorage();
    storage.setItem(STORAGE_KEY, raw);
    const store = createLearningStore({ storage, now: () => AT });
    expect(store.load()).toMatchObject({ status: 'recovery', ok: false, notice: expect.stringContaining('原记录已保留') });
    expect(store.exportOriginal()).toBe(raw);
    const next = store.load().state;
    next.notes['M01-A'] = '仍可在内存里学习。';
    expect(store.save(next).status).toBe('recovery');
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    expect(JSON.parse(store.exportJson()).notes['M01-A']).toBe('仍可在内存里学习。');
    expect(store.importJson(JSON.stringify(filledState())).status).toBe('saved');
    expect(store.exportOriginal()).toBeNull();
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).notes['M01-A']).toBe('暂不把时间与金钱相加。');
  });

  it('recovers from an explicitly cleared corrupt record without touching another course key', () => {
    const storage = new FakeStorage();
    storage.setItem(STORAGE_KEY, 'invalid');
    storage.setItem('courses:macroeconomics:v1', 'private-other-course');
    storage.setItem('unrelated', 'keep');
    const store = createLearningStore({ storage, now: () => AT });
    store.load();
    expect(store.reset()).toMatchObject({ ok: true, status: 'saved' });
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(storage.getItem('courses:macroeconomics:v1')).toBe('private-other-course');
    expect(storage.getItem('unrelated')).toBe('keep');
    expect(store.exportOriginal()).toBeNull();
  });

  it('resets a lesson independently of other lessons and shared experiment states', () => {
    const store = createLearningStore({ storage: new FakeStorage(), now: () => AT });
    store.save(filledState());
    const before = store.load().state;
    const result = store.resetLesson('M01-A');
    expect(result.state.lessonStates['M01-A']).toBe('not_started');
    expect(result.state.notes['M01-A']).toBeUndefined();
    expect(result.state.objectiveAttempts['M01-A-number']).toBeUndefined();
    expect(result.state.selfChecks['M01-A-explain']).toBeUndefined();
    expect(result.state.conceptConfidence['M01-A']).toBeNull();
    expect(result.state.notes['M02-A']).toBe(before.notes['M02-A']);
    expect(result.state.lastLessonId).toBe('M02-A');
    expect(result.state.labStates).toEqual(before.labStates);
    expect(store.resetLesson('M02-A').state.lastLessonId).toBeNull();
  });

  it('falls back to memory when read access is unavailable', () => {
    const denied: StorageLike = {
      getItem() { throw new Error('SecurityError'); },
      setItem() { throw new Error('SecurityError'); },
      removeItem() { throw new Error('SecurityError'); },
    };
    const store = createLearningStore({ storage: denied, now: () => AT });
    expect(store.load()).toMatchObject({ status: 'memory', notice: expect.stringContaining('关闭或刷新后可能丢失') });
    const result = store.save(filledState());
    expect(result.ok).toBe(true);
    expect(result.state.notes['M01-A']).toBe('暂不把时间与金钱相加。');
    expect(store.exportJson()).toContain('暂不把时间与金钱相加');
  });

  it('falls back to memory on quota errors without losing the active state', () => {
    const storage = new FakeStorage();
    storage.setItem = () => { throw new Error('QuotaExceededError'); };
    const store = createLearningStore({ storage, now: () => AT });
    expect(store.save(filledState())).toMatchObject({ ok: true, status: 'memory' });
    expect(store.load().state.labStates.ML01.revealed).toBe(true);
  });

  it('can explicitly delete a previously saved record after a write quota failure', () => {
    const storage = new FakeStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify(filledState()));
    storage.setItem('courses:macroeconomics:v1', 'keep');
    storage.setItem = () => { throw new Error('QuotaExceededError'); };
    const store = createLearningStore({ storage, now: () => AT });
    const next = store.load().state;
    next.notes['M01-A'] = 'Only held in memory now';
    expect(store.save(next).status).toBe('memory');
    expect(store.reset().ok).toBe(true);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(storage.getItem('courses:macroeconomics:v1')).toBe('keep');
  });

  it('reports a failed deletion and keeps the original record', () => {
    const storage = new FakeStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify(filledState()));
    storage.removeItem = () => { throw new Error('SecurityError'); };
    const store = createLearningStore({ storage, now: () => AT });
    expect(store.reset()).toMatchObject({ ok: false, error: expect.stringContaining('原记录仍保留') });
    expect(store.load().state.notes['M01-A']).toBe('暂不把时间与金钱相加。');
    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('keeps imported user text verbatim as data; it never evaluates HTML or scripts', () => {
    const malicious = '<script>globalThis.executed=true</script><img src=x onerror="globalThis.executed=true">';
    const candidate = filledState();
    candidate.notes['M01-A'] = malicious;
    candidate.selfChecks['M01-A-explain'].answer = malicious;
    candidate.labStates.ML01.prediction = malicious;
    const store = createLearningStore({ storage: new FakeStorage(), now: () => AT });
    expect(store.importJson(JSON.stringify(candidate)).ok).toBe(true);
    expect(store.load().state.notes['M01-A']).toBe(malicious);
    expect((globalThis as typeof globalThis & { executed?: boolean }).executed).toBeUndefined();
    // Browser E2E additionally verifies React renders these values as text.
  });

  it.each([
    ['unknown top-level field', (state: Record<string, unknown>) => { state.telemetry = true; }],
    ['missing field', (state: Record<string, unknown>) => { delete state.notes; }],
    ['wrong lesson state', (state: Record<string, unknown>) => { (state.lessonStates as Record<string, unknown>)['M01-A'] = 'mastered'; }],
    ['planned lesson', (state: Record<string, unknown>) => { state.lastLessonId = 'M04-A'; }],
    ['cross-course question', (state: Record<string, unknown>) => { state.objectiveAttempts = { 'A01-A-numeric': [] }; }],
    ['unknown attempt field', (state: Record<string, unknown>) => { state.objectiveAttempts = { 'M01-A-number': [{ answer: 2, correct: true, at: AT, score: 100 }] }; }],
    ['invalid answer', (state: Record<string, unknown>) => { state.objectiveAttempts = { 'M01-A-number': [{ answer: null, correct: true, at: AT }] }; }],
    ['invalid self rating', (state: Record<string, unknown>) => { state.selfChecks = { 'M01-A-explain': { answer: 'x', rating: 'scientifically_mastered' } }; }],
    ['unknown note lesson', (state: Record<string, unknown>) => { state.notes = { 'M12-B': 'not implemented' }; }],
    ['invalid confidence', (state: Record<string, unknown>) => { (state.conceptConfidence as Record<string, unknown>)['M01-A'] = 5.5; }],
    ['invalid timestamp', (state: Record<string, unknown>) => { state.updatedAt = '2026-02-30T00:00:00.000Z'; }],
    ['HTML is not an answer object', (state: Record<string, unknown>) => { state.notes = { 'M01-A': { html: '<b>x</b>' } }; }],
  ])('strictly rejects %s without writing', (_label, mutate) => {
    const candidate = createInitialState(AT) as unknown as Record<string, unknown>;
    mutate(candidate);
    const store = createLearningStore({ storage: new FakeStorage(), now: () => AT });
    const before = store.exportJson();
    expect(store.importJson(JSON.stringify(candidate)).ok).toBe(false);
    expect(store.exportJson()).toBe(before);
  });

  it.each([
    ['m', -1], ['px', 0], ['py', 21], ['alpha', 1], ['a', 0], ['x', -1],
    ['representation', 'log'], ['kind', 'imaginary'], ['revealed', 'yes'],
  ])('rejects an invalid experiment field %s=%s', (field, invalid) => {
    const candidate = createInitialState(AT);
    if (field === 'revealed') (candidate.labStates.ML01 as unknown as Record<string, unknown>)[field] = invalid;
    else (candidate.labStates.ML01.scenario as unknown as Record<string, unknown>)[field] = invalid;
    expect(validateLearningState(candidate).ok).toBe(false);
  });

  it('rejects cross-lab ranges and disabled ML03 linear coefficients', () => {
    const candidate = createInitialState(AT);
    candidate.labStates.ML03.scenario.m = 240;
    expect(validateLearningState(candidate).ok).toBe(false);
    candidate.labStates.ML03.scenario.m = 120;
    candidate.labStates.ML03.scenario.a = 2;
    expect(validateLearningState(candidate).ok).toBe(false);
    candidate.labStates.ML03.scenario.a = 1;
    candidate.labStates.ML02.scenario.x = 61;
    expect(validateLearningState(candidate).ok).toBe(false);
  });

  it('rejects oversized files, long text and non-finite numeric state', () => {
    const store = createLearningStore({ storage: new FakeStorage(), now: () => AT });
    expect(store.importJson(' '.repeat(MAX_IMPORT_BYTES + 1))).toMatchObject({ ok: false, error: expect.stringContaining('1 MiB') });
    const candidate = createInitialState(AT);
    candidate.notes['M01-A'] = '字'.repeat(20_001);
    expect(validateLearningState(candidate).ok).toBe(false);
    delete candidate.notes['M01-A'];
    candidate.labStates.ML01.scenario.x = Number.POSITIVE_INFINITY;
    expect(validateLearningState(candidate).ok).toBe(false);
  });

  it('enforces the total UTF-8 byte limit even when individual texts fit', () => {
    const candidate = createInitialState(AT);
    const largeAnswer = '字'.repeat(20_000);
    candidate.objectiveAttempts['M01-A-number'] = Array.from({ length: 20 }, () => ({ answer: largeAnswer, correct: false, at: AT }));
    expect(validateLearningState(candidate)).toMatchObject({ ok: false, error: expect.stringContaining('1 MiB') });
  });

  it('returns detached snapshots so outside mutation cannot alter unsaved state', () => {
    const store = createLearningStore({ storage: null, now: () => AT });
    const state = store.load().state;
    state.notes['M01-A'] = 'not saved';
    state.labStates.ML01.scenario.px = 6;
    expect(store.load().state.notes['M01-A']).toBeUndefined();
    expect(store.load().state.labStates.ML01.scenario.px).toBe(3);
    expect(store.load().status).toBe('memory');
  });
});

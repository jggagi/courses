import { initialLedgerFixture } from '../data/synthetic';
import type { LedgerEvent, LedgerState } from './types';
import { assertRecord, assertText, moneyCents } from './validation';

function cloneLedger(state: LedgerState): LedgerState {
  return { H: { ...state.H }, F: { ...state.F }, B: { ...state.B }, flow: { ...state.flow }, events: state.events.map(event => ({ ...event })) };
}

/** 金额输入至多两位小数，所有账本运算先转换为整数最小单位。 */
export function initialLedger(): LedgerState { return cloneLedger(initialLedgerFixture); }

function validateEvent(event: LedgerEvent): void {
  assertRecord(event, '交易事件');
  assertText(event.id, '事件ID');
  if (!Number.isSafeInteger(event.sequence) || event.sequence < 1) throw new Error('事件顺序必须是从1开始的正整数。');
  if (!['wage', 'service', 'repayment'].includes(event.type)) throw new Error('未知事件类型：仅支持工资、当期服务购买和本金偿还。');
  moneyCents(event.amount, '交易金额', { positive: true });
}

export function validateLedger(state: LedgerState): void {
  assertRecord(state, '账本');
  for (const key of ['H', 'F', 'B', 'flow'] as const) assertRecord(state[key], `账本${key}`);
  const h = moneyCents(state.H.deposit, '家庭存款');
  const hn = moneyCents(state.H.netWorth, '家庭净值', { signed: true });
  const f = moneyCents(state.F.deposit, '企业存款');
  const fl = moneyCents(state.F.loan, '企业贷款负债');
  const fn = moneyCents(state.F.netWorth, '企业净值', { signed: true });
  const br = moneyCents(state.B.reserves, '银行准备金');
  const bl = moneyCents(state.B.loanAsset, '银行贷款资产');
  const bh = moneyCents(state.B.depositH, '银行家庭存款负债');
  const bf = moneyCents(state.B.depositF, '银行企业存款负债');
  const be = moneyCents(state.B.equity, '银行权益', { signed: true });
  for (const key of ['householdIncome', 'householdConsumption', 'firmRevenue', 'firmWages', 'principalRepaid'] as const) moneyCents(state.flow[key], `本期流量${key}`);
  if (moneyCents(state.flow.householdIncome, '家庭收入') !== moneyCents(state.flow.firmWages, '企业工资')) throw new Error('收入费用双边不一致：家庭工资收入必须等于企业工资费用。');
  if (moneyCents(state.flow.householdConsumption, '家庭消费') !== moneyCents(state.flow.firmRevenue, '企业收入')) throw new Error('消费收入双边不一致：家庭服务消费必须等于企业服务收入。');
  if (h !== hn) throw new Error('家庭源账表不平衡：存款资产应等于净值。');
  if (f !== fl + fn) throw new Error('企业源账表不平衡：资产应等于负债加净值。');
  if (br + bl !== bh + bf + be) throw new Error('银行源账表不平衡：资产应等于负债加权益。');
  if (h !== bh || f !== bf) throw new Error('存款双边不一致：持有者资产必须与银行对应分户负债相等。');
  if (fl !== bl) throw new Error('贷款双边不一致：企业贷款负债必须与银行贷款资产相等。');
  if (!Array.isArray(state.events) || state.events.length > 10_000) throw new Error('事件日志必须是最多10000条的数组。');
  const seen = new Set<string>();
  let lastSequence = 0;
  for (const event of state.events) {
    validateEvent(event);
    if (seen.has(event.id)) throw new Error('事件ID重复，不能重复应用同一交易。');
    if (event.sequence <= lastSequence) throw new Error('事件顺序必须严格递增，不能重排或重复顺序。');
    seen.add(event.id); lastSequence = event.sequence;
  }
}

function add(value: number, amount: number): number { return (moneyCents(value, '账本金额', { signed: true }) + moneyCents(amount, '账本变动', { signed: true })) / 100; }

export function reduceLedger(state: LedgerState, event: LedgerEvent): LedgerState {
  validateLedger(state);
  validateEvent(event);
  if (state.events.some(previous => previous.id === event.id)) throw new Error('事件ID重复，不能重复应用同一交易。');
  if (state.events.length && event.sequence <= state.events[state.events.length - 1].sequence) throw new Error('事件顺序必须严格递增。');
  const next = cloneLedger(state);
  const amount = moneyCents(event.amount, '交易金额', { positive: true }) / 100;
  if (event.type === 'wage') {
    if (moneyCents(amount, '工资') > moneyCents(next.F.deposit, '企业存款')) throw new Error('工资超过企业可用存款，交易未执行。');
    next.H.deposit = add(next.H.deposit, amount); next.H.netWorth = add(next.H.netWorth, amount);
    next.F.deposit = add(next.F.deposit, -amount); next.F.netWorth = add(next.F.netWorth, -amount);
    next.B.depositH = add(next.B.depositH, amount); next.B.depositF = add(next.B.depositF, -amount);
    next.flow.householdIncome = add(next.flow.householdIncome, amount); next.flow.firmWages = add(next.flow.firmWages, amount);
  } else if (event.type === 'service') {
    if (moneyCents(amount, '消费') > moneyCents(next.H.deposit, '家庭存款')) throw new Error('服务消费超过家庭可用存款，交易未执行。');
    next.H.deposit = add(next.H.deposit, -amount); next.H.netWorth = add(next.H.netWorth, -amount);
    next.F.deposit = add(next.F.deposit, amount); next.F.netWorth = add(next.F.netWorth, amount);
    next.B.depositH = add(next.B.depositH, -amount); next.B.depositF = add(next.B.depositF, amount);
    next.flow.householdConsumption = add(next.flow.householdConsumption, amount); next.flow.firmRevenue = add(next.flow.firmRevenue, amount);
  } else {
    if (moneyCents(amount, '本金') > moneyCents(next.F.deposit, '企业存款')) throw new Error('偿还本金超过企业可用存款，交易未执行。');
    if (moneyCents(amount, '本金') > moneyCents(next.F.loan, '贷款')) throw new Error('偿还本金超过未偿贷款，交易未执行。');
    next.F.deposit = add(next.F.deposit, -amount); next.F.loan = add(next.F.loan, -amount);
    next.B.loanAsset = add(next.B.loanAsset, -amount); next.B.depositF = add(next.B.depositF, -amount);
    next.flow.principalRepaid = add(next.flow.principalRepaid, amount);
  }
  next.events.push({ ...event });
  validateLedger(next);
  return next;
}

/** 保留源事件顺序；撤销由调用方移除事件后重放，不反向猜测账户变动。 */
export function replayLedger(initial: LedgerState, events: LedgerEvent[]): LedgerState {
  validateLedger(initial);
  if (initial.events.length) throw new Error('重放初始账表不能包含已执行事件。');
  if (Object.values(initial.flow).some(value => value !== 0)) throw new Error('重放期初账表的本期流量必须为0，收入与支出应来自明确事件。');
  if (!Array.isArray(events) || events.length > 10_000) throw new Error('重放事件必须是最多10000条的数组。');
  return events.reduce(reduceLedger, cloneLedger(initial));
}

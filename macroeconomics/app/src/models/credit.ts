import { assertRecord, assertText, moneyCents } from "./validation";

export type CreditBankId = "A" | "B";
export type CreditCustomerId =
  | "historicalDepositorA"
  | "historicalBorrowerA"
  | "historicalDepositorB"
  | "historicalBorrowerB"
  | "newBorrower"
  | "recipient";

export interface CreditEvent {
  id: string;
  sequence: number;
  type: "loan" | "payment" | "repayment" | "loss";
  amount: number;
}

export interface CreditBank {
  reserves: number;
  loanAsset: number;
  depositLiability: number;
  equity: number;
  deposits: Record<string, number>;
  /** 各客户贷款的净账面资产；gross claim = loans + lossAllowances。 */
  loans: Record<string, number>;
  lossAllowances: Record<string, number>;
}

export interface CreditCustomer {
  bank: CreditBankId;
  deposit: number;
  /** 客户仍须偿还的合同本金；确认减值不是免除客户债务。 */
  loan: number;
  /** 期初明确给定的历史客户非金融资产，不用于事后补平账本。 */
  otherAssets: number;
  netWorth: number;
}

export interface CreditState {
  A: CreditBank;
  B: CreditBank;
  customers: Record<CreditCustomerId, CreditCustomer>;
  events: CreditEvent[];
}

export const creditCustomerIds: CreditCustomerId[] = [
  "historicalDepositorA", "historicalBorrowerA", "historicalDepositorB",
  "historicalBorrowerB", "newBorrower", "recipient",
];

/** 全部为教学合成账户；准备金发行方、银行股东在展开边界之外。 */
export function defaultCreditState(): CreditState {
  return {
    A: {
      reserves: 20, loanAsset: 80, depositLiability: 90, equity: 10,
      deposits: { historicalDepositorA: 90, historicalBorrowerA: 0, newBorrower: 0 },
      loans: { historicalDepositorA: 0, historicalBorrowerA: 80, newBorrower: 0 },
      lossAllowances: { historicalDepositorA: 0, historicalBorrowerA: 0, newBorrower: 0 },
    },
    B: {
      reserves: 20, loanAsset: 80, depositLiability: 90, equity: 10,
      deposits: { historicalDepositorB: 90, historicalBorrowerB: 0, recipient: 0 },
      loans: { historicalDepositorB: 0, historicalBorrowerB: 80, recipient: 0 },
      lossAllowances: { historicalDepositorB: 0, historicalBorrowerB: 0, recipient: 0 },
    },
    customers: {
      historicalDepositorA: { bank: "A", deposit: 90, loan: 0, otherAssets: 0, netWorth: 90 },
      historicalBorrowerA: { bank: "A", deposit: 0, loan: 80, otherAssets: 80, netWorth: 0 },
      historicalDepositorB: { bank: "B", deposit: 90, loan: 0, otherAssets: 0, netWorth: 90 },
      historicalBorrowerB: { bank: "B", deposit: 0, loan: 80, otherAssets: 80, netWorth: 0 },
      newBorrower: { bank: "A", deposit: 0, loan: 0, otherAssets: 0, netWorth: 0 },
      recipient: { bank: "B", deposit: 0, loan: 0, otherAssets: 0, netWorth: 0 },
    },
    events: [],
  };
}

function clone(state: CreditState): CreditState {
  return {
    A: { ...state.A, deposits: { ...state.A.deposits }, loans: { ...state.A.loans }, lossAllowances: { ...state.A.lossAllowances } },
    B: { ...state.B, deposits: { ...state.B.deposits }, loans: { ...state.B.loans }, lossAllowances: { ...state.B.lossAllowances } },
    customers: Object.fromEntries(creditCustomerIds.map((id) => [id, { ...state.customers[id] }])) as CreditState["customers"],
    events: state.events.map((event) => ({ ...event })),
  };
}

function validateEvent(event: CreditEvent): void {
  assertRecord(event, "信贷事件");
  assertText(event.id, "事件ID");
  if (!Number.isSafeInteger(event.sequence) || event.sequence < 1)
    throw new Error("事件顺序必须为正整数并严格递增。");
  if (!["loan", "payment", "repayment", "loss"].includes(event.type))
    throw new Error("未知信贷事件类型。");
  moneyCents(event.amount, "事件金额", { positive: true });
}

/** 独立验证客户资产、银行分户、贷款合同与减值，而非用余额差补权益。 */
export function validateCreditState(state: CreditState): void {
  assertRecord(state, "信贷账本");
  assertRecord(state.customers, "客户账户");
  if (Object.keys(state.customers).length !== creditCustomerIds.length)
    throw new Error("客户账户必须完整保留六个历史与操作客户。");
  for (const id of creditCustomerIds) {
    const customer = state.customers[id];
    assertRecord(customer, `客户${id}`);
    const expectedBank = ["historicalDepositorA", "historicalBorrowerA", "newBorrower"].includes(id) ? "A" : "B";
    if (customer.bank !== expectedBank) throw new Error("客户所属银行与实验账户不符。");
    const deposit = moneyCents(customer.deposit, "客户存款");
    const loan = moneyCents(customer.loan, "客户合同贷款");
    const assets = moneyCents(customer.otherAssets, "客户非金融资产");
    const worth = moneyCents(customer.netWorth, "客户净值", { signed: true });
    if (deposit + assets !== loan + worth) throw new Error("客户资产负债表不平衡。");
  }
  for (const bankId of ["A", "B"] as const) {
    const bank = state[bankId];
    assertRecord(bank, `银行${bankId}`);
    for (const key of ["deposits", "loans", "lossAllowances"] as const)
      assertRecord(bank[key], `银行${bankId}分户${key}`);
    const ids = creditCustomerIds.filter((id) => state.customers[id].bank === bankId);
    for (const map of [bank.deposits, bank.loans, bank.lossAllowances]) {
      if (Object.keys(map).length !== ids.length || Object.keys(map).some((id) => !ids.includes(id as CreditCustomerId)))
        throw new Error("银行分户账户不完整或存在未知客户。");
    }
    let deposits = 0;
    let loans = 0;
    for (const id of ids) {
      const deposit = moneyCents(bank.deposits[id], "存款分户负债");
      const claim = moneyCents(bank.loans[id], "贷款净账面资产");
      const allowance = moneyCents(bank.lossAllowances[id], "贷款损失准备");
      if (deposit !== moneyCents(state.customers[id].deposit, "客户存款"))
        throw new Error("客户存款与银行存款分户双边不一致。");
      if (claim + allowance !== moneyCents(state.customers[id].loan, "客户合同本金"))
        throw new Error("贷款双边不一致：净资产加减值应等于合同本金。");
      deposits += deposit;
      loans += claim;
    }
    const reserves = moneyCents(bank.reserves, "银行准备金");
    const totalLoans = moneyCents(bank.loanAsset, "银行贷款资产合计");
    const totalDeposits = moneyCents(bank.depositLiability, "银行存款负债合计");
    const equity = moneyCents(bank.equity, "银行权益", { signed: true });
    if (loans !== totalLoans || deposits !== totalDeposits)
      throw new Error("银行合计与客户分户不一致。");
    if (reserves + totalLoans !== totalDeposits + equity)
      throw new Error("银行资产应等于负债加权益。");
  }
  if (!Array.isArray(state.events) || state.events.length > 10_000)
    throw new Error("事件日志必须为最多10000条的数组。");
  let previous = 0;
  const seen = new Set<string>();
  for (const event of state.events) {
    validateEvent(event);
    if (seen.has(event.id)) throw new Error("事件ID重复，不能重复应用。");
    if (event.sequence <= previous) throw new Error("事件顺序必须严格递增。");
    seen.add(event.id);
    previous = event.sequence;
  }
}

function add(value: number, amount: number): number {
  return (moneyCents(value, "科目金额", { signed: true }) + moneyCents(amount, "科目变动", { signed: true })) / 100;
}

export function applyCreditEvent(state: CreditState, event: CreditEvent): CreditState {
  validateCreditState(state);
  validateEvent(event);
  if (state.events.some((previous) => previous.id === event.id)) throw new Error("事件ID重复，不能重复应用。");
  if (state.events.length && event.sequence <= state.events[state.events.length - 1].sequence)
    throw new Error("事件顺序必须严格递增。");
  const next = clone(state);
  const amount = moneyCents(event.amount, "事件金额", { positive: true }) / 100;
  const borrower = next.customers.newBorrower;
  if (event.type === "loan") {
    borrower.deposit = add(borrower.deposit, amount);
    borrower.loan = add(borrower.loan, amount);
    next.A.deposits.newBorrower = add(next.A.deposits.newBorrower, amount);
    next.A.loans.newBorrower = add(next.A.loans.newBorrower, amount);
    next.A.loanAsset = add(next.A.loanAsset, amount);
    next.A.depositLiability = add(next.A.depositLiability, amount);
  } else if (event.type === "payment") {
    if (moneyCents(amount, "付款金额") > moneyCents(borrower.deposit, "付款人存款"))
      throw new Error("跨行支付超过客户可用存款，交易未执行。");
    if (moneyCents(amount, "付款金额") > moneyCents(next.A.reserves, "准备金"))
      throw new Error("跨行支付超过A的准备金；本模型没有自动融资，交易未执行。");
    borrower.deposit = add(borrower.deposit, -amount);
    borrower.netWorth = add(borrower.netWorth, -amount);
    next.customers.recipient.deposit = add(next.customers.recipient.deposit, amount);
    next.customers.recipient.netWorth = add(next.customers.recipient.netWorth, amount);
    next.A.deposits.newBorrower = add(next.A.deposits.newBorrower, -amount);
    next.A.depositLiability = add(next.A.depositLiability, -amount);
    next.B.deposits.recipient = add(next.B.deposits.recipient, amount);
    next.B.depositLiability = add(next.B.depositLiability, amount);
    next.A.reserves = add(next.A.reserves, -amount);
    next.B.reserves = add(next.B.reserves, amount);
  } else if (event.type === "repayment") {
    if (moneyCents(amount, "本金") > moneyCents(borrower.deposit, "客户存款"))
      throw new Error("偿还本金超过客户可用存款，交易未执行。");
    if (moneyCents(amount, "本金") > moneyCents(borrower.loan, "未偿本金"))
      throw new Error("偿还本金超过客户贷款，交易未执行。");
    borrower.deposit = add(borrower.deposit, -amount);
    borrower.loan = add(borrower.loan, -amount);
    next.A.deposits.newBorrower = add(next.A.deposits.newBorrower, -amount);
    next.A.loans.newBorrower = add(next.A.loans.newBorrower, -amount);
    next.A.loanAsset = add(next.A.loanAsset, -amount);
    next.A.depositLiability = add(next.A.depositLiability, -amount);
  } else {
    if (moneyCents(amount, "损失") > moneyCents(next.A.loans.historicalBorrowerA, "历史贷款净账面余额"))
      throw new Error("损失超过被操作的历史债权净账面余额，交易未执行。");
    next.A.loans.historicalBorrowerA = add(next.A.loans.historicalBorrowerA, -amount);
    next.A.lossAllowances.historicalBorrowerA = add(next.A.lossAllowances.historicalBorrowerA, amount);
    next.A.loanAsset = add(next.A.loanAsset, -amount);
    next.A.equity = add(next.A.equity, -amount);
  }
  next.events.push({ ...event });
  validateCreditState(next);
  return next;
}

/** 撤销时移除源事件再重放。输入与此前冻结的A基准均不会被修改。 */
export function replayCreditEvents(initial: CreditState, events: CreditEvent[]): CreditState {
  validateCreditState(initial);
  if (initial.events.length) throw new Error("重放初始账表不能包含已执行事件。");
  if (!Array.isArray(events) || events.length > 10_000) throw new Error("重放事件必须为最多10000条的数组。");
  return events.reduce(applyCreditEvent, clone(initial));
}

/** 负权益是偿付能力风险；零准备金是本模型无融资时的支付约束，两者不等价。 */
export function creditRisk(state: CreditState): Record<CreditBankId, { negativeEquity: boolean; exhaustedReserves: boolean }> {
  validateCreditState(state);
  return {
    A: { negativeEquity: state.A.equity < 0, exhaustedReserves: state.A.reserves === 0 },
    B: { negativeEquity: state.B.equity < 0, exhaustedReserves: state.B.reserves === 0 },
  };
}

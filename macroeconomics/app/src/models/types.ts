/** 账本金额以教学货币单位输入（至多两位小数），内部整数分结算；输出不使用显示舍入值。 */
export interface LedgerEvent {
  id: string;
  sequence: number;
  type: 'wage' | 'service' | 'repayment';
  amount: number;
}

export interface LedgerState {
  H: { deposit: number; netWorth: number };
  F: { deposit: number; loan: number; netWorth: number };
  B: { reserves: number; loanAsset: number; depositH: number; depositF: number; equity: number };
  flow: {
    householdIncome: number;
    householdConsumption: number;
    firmRevenue: number;
    firmWages: number;
    principalRepaid: number;
  };
  events: LedgerEvent[];
}

export interface AccountsInput {
  inventory: number;
  exports: number;
  imports: number;
  machine: boolean;
  transfer: number;
  stock: number;
  secondhand: number;
  oldInventorySale: number;
  openingInventory: number;
}

export interface ProductionActivity {
  id: string;
  label: string;
  output: number;
  intermediate: number;
  wages: number;
  surplus: number;
}

export interface ProductionRow extends ProductionActivity {
  valueAdded: number;
  sourceIds: string[];
}

export interface ExpenditureRow {
  id: string;
  label: string;
  component: 'C' | 'I' | 'G' | 'X' | 'M';
  amount: number;
  sourceIds: string[];
  explanation: string;
}

export interface IncomeRow {
  id: string;
  label: string;
  wages: number;
  surplus: number;
  total: number;
  sourceIds: string[];
}

export interface ActivityRecord {
  id: string;
  label: string;
  period: 'current' | 'previous';
  origin: 'domestic' | 'foreign';
  use: 'intermediate' | 'final' | 'capital' | 'inventory' | 'financial' | 'transfer';
  kind: 'production' | 'final-use' | 'financial' | 'transfer';
  amount: number;
  explanation: string;
}

export interface AccountsResult {
  production: number;
  expenditure: number;
  income: number;
  components: { C: number; I: number; G: number; X: number; M: number };
  productionRows: ProductionRow[];
  expenditureRows: ExpenditureRow[];
  incomeRows: IncomeRow[];
  activities: ActivityRecord[];
  salesTotal: number;
  wages: number;
  surplus: number;
  closingInventory: number;
}

export interface PricePeriod { px: number; py: number; qx: number; qy: number }
export interface PriceInput {
  periods: PricePeriod[];
  priceBase: number;
  basketBase: number;
  normalization: 100 | 1000;
}

export interface PriceResultPeriod {
  period: number;
  N: number;
  R: number;
  D: number | null;
  L: number | null;
  gN: number | null;
  gR: number | null;
  piD: number | null;
  piL: number | null;
  nominalContributions: { x: number; y: number };
  realContributions: { x: number; y: number };
  basketContributions: { x: number; y: number };
  basketWeights: { x: number | null; y: number | null };
}

export interface PriceResult {
  periods: PriceResultPeriod[];
  basketValue: number;
  priceBase: number;
  basketBase: number;
  normalization: 100 | 1000;
}

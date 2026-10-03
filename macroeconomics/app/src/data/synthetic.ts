import type { LedgerState, PricePeriod, ProductionActivity } from '../models/types';

/** 确定性原创教学情景。没有现实国家、观察年份、随机数或外部数据请求。 */
export const syntheticMetadata = {
  dataKind: 'synthetic',
  label: '教学合成数据',
  modelIds: ['LA01', 'LA02', 'LA03'],
  periodLabels: ['第0期', '第1期', '第2期'],
  frequency: '每一步为一期；LA03默认一期为一年',
  units: {
    ledger: '教学货币单位；存量为时点值，流量为本期值',
    accounts: '教学货币单位/期，当前生产价格，毛值；金额至多两位小数、内部整数分汇总',
    price: '价格：教学货币单位/件；数量：件/期；指数：指数点；增长率：小数',
  },
  generationRules: {
    LA01: 'H/F/B初始三张平衡账表，工资、当期服务购买和本金偿还逐笔更新。准备金发行方在边界外。',
    LA02: '原料30→加工50→成品100；工资与毛盈余逐活动给定；可叠加指定最终使用事件。',
    LA03: '两种商品、三个合成时期的原始p/q表；固定价格权重与固定篮子分别计算。',
  },
  priceBasis: 'LA02当期价格；LA03名义为当期价、实际为所选基期价',
  seasonalAdjustment: '无',
  randomSeed: null,
  source: '原创教学构造；公式与oracle见本课程LABS.md',
} as const;

export const initialLedgerFixture: LedgerState = {
  H: { deposit: 100, netWorth: 100 },
  F: { deposit: 40, loan: 20, netWorth: 20 },
  B: { reserves: 160, loanAsset: 20, depositH: 100, depositF: 40, equity: 40 },
  flow: { householdIncome: 0, householdConsumption: 0, firmRevenue: 0, firmWages: 0, principalRepaid: 0 },
  events: [],
};

export const productionFixture: ProductionActivity[] = [
  { id: 'raw', label: '原料商', output: 30, intermediate: 0, wages: 20, surplus: 10 },
  { id: 'processor', label: '加工商', output: 50, intermediate: 30, wages: 15, surplus: 5 },
  { id: 'final', label: '成品商', output: 100, intermediate: 50, wages: 30, surplus: 20 },
];

export const priceFixture: PricePeriod[] = [
  { px: 2, py: 4, qx: 10, qy: 5 },
  { px: 3, py: 5, qx: 12, qy: 5 },
  { px: 3.06, py: 5.10, qx: 12, qy: 5 },
];

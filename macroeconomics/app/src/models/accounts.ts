import { productionFixture } from '../data/synthetic';
import type { AccountsInput, AccountsResult, ActivityRecord, ExpenditureRow, ProductionActivity } from './types';
import { assertClose, assertNumber, assertRecord, assertText, EPSILON } from './validation';

export function defaultAccountsInput(): AccountsInput {
  return { inventory: 0, exports: 0, imports: 0, machine: false, transfer: 0, stock: 0, secondhand: 0, oldInventorySale: 0, openingInventory: 20 };
}

/** 工资与毛营业盈余是明确源科目，不将差额自动填成“其他收入”。 */
export function validateProductionActivities(source: ProductionActivity[]): void {
  if (!Array.isArray(source) || source.length < 1 || source.length > 1000) throw new Error('生产源记录必须是1到1000条活动的数组。');
  const ids = new Set<string>();
  for (const activity of source) {
    assertRecord(activity, '生产源活动');
    assertText(activity.id, '生产活动ID'); assertText(activity.label, '生产者名称');
    if (ids.has(activity.id)) throw new Error('生产活动ID重复，不能重复计算同一生产。');
    ids.add(activity.id);
    for (const key of ['output', 'intermediate', 'wages', 'surplus'] as const) assertNumber(activity[key], `${activity.label}的${key}`);
    if (activity.intermediate > activity.output) throw new Error(`${activity.label}的中间投入超过产出，本教学模型不接受该源记录。`);
    assertClose(activity.output - activity.intermediate, activity.wages + activity.surplus, `${activity.label}源记录不平衡：增加值不等于工资加毛营业盈余；请检查源科目。`);
  }
}

export function computeAccounts(input: AccountsInput, source: ProductionActivity[] = productionFixture): AccountsResult {
  assertRecord(input, 'GDP活动选择');
  for (const key of ['inventory', 'exports', 'imports', 'transfer', 'stock', 'secondhand', 'oldInventorySale', 'openingInventory'] as const) assertNumber(input[key], `${key}金额`);
  if (typeof input.machine !== 'boolean') throw new Error('新增机器必须选择是或否。');
  if (input.inventory + input.exports > 100 + EPSILON) throw new Error('本期成品总值100，未售存货与出口之和不能超过100。');
  if (input.oldInventorySale > input.openingInventory) throw new Error('前期存货销售超过明确的期初库存，不能超额卖出。');
  validateProductionActivities(source);
  // 可选源记录供审查明确科目，不是任意生产网络接口；首期三活动的供应链固定。
  if (source.length !== productionFixture.length) throw new Error('源记录不平衡：首期教学生产链必须包含原料、加工、成品三项活动。');
  for (const expected of productionFixture) {
    const item = source.find(activity => activity.id === expected.id);
    if (!item) throw new Error('源记录不平衡：首期生产链缺少已定义的生产活动。');
    assertClose(item.output, expected.output, '源记录不平衡：首期教学生产链的产出必须为30、50、100，不能隐含未说明的最终使用。');
    assertClose(item.intermediate, expected.intermediate, '源记录不平衡：首期教学生产链的中间投入必须为0、30、50，须与上游供应对应。');
  }
  const sourceCopy = source.map(activity => ({ ...activity }));
  const reserved = ['machine', 'domestic-consumption', 'current-inventory', 'exports', 'imports', 'old-inventory-sale', 'transfer', 'stock', 'secondhand'];
  if (sourceCopy.some(activity => reserved.includes(activity.id))) throw new Error('生产源活动ID与情景事件ID冲突。');
  if (input.machine) sourceCopy.push({ id: 'machine', label: '新增机器生产者', output: 40, intermediate: 0, wages: 25, surplus: 15 });

  const productionRows = sourceCopy.map(activity => ({ ...activity, valueAdded: activity.output - activity.intermediate, sourceIds: [activity.id] }));
  const incomeRows = sourceCopy.map(activity => ({ id: `income-${activity.id}`, label: activity.label, wages: activity.wages, surplus: activity.surplus, total: activity.wages + activity.surplus, sourceIds: [activity.id] }));
  const domesticConsumption = 100 - input.inventory - input.exports;
  const activities: ActivityRecord[] = sourceCopy.map(activity => ({
    id: activity.id, label: activity.label, period: 'current', origin: 'domestic',
    use: activity.id === 'machine' ? 'capital' : activity.id === 'final' ? 'final' : 'intermediate',
    kind: 'production', amount: activity.output,
    explanation: `本国当期生产：产出${activity.output}减中间投入${activity.intermediate}得到增加值${activity.output - activity.intermediate}；工资${activity.wages}和毛营业盈余${activity.surplus}来自此活动的明确科目。`,
  }));
  activities.push(
    { id: 'domestic-consumption', label: '本期成品国内消费', period: 'current', origin: 'domestic', use: 'final', kind: 'final-use', amount: domesticConsumption, explanation: '当期成品100扣除本期未售存货与出口后，进入国内最终消费。' },
    { id: 'current-inventory', label: '本期生产未售存货', period: 'current', origin: 'domestic', use: 'inventory', kind: 'final-use', amount: input.inventory, explanation: '当期已经生产；未售部分从消费转为正存货投资，不能在成品消费100之外再次加上。' },
    { id: 'exports', label: '本期成品出口', period: 'current', origin: 'domestic', use: 'final', kind: 'final-use', amount: input.exports, explanation: '本国当期生产由国外最终使用；国内消费相应减少，出口增加。' },
    { id: 'imports', label: '进口最终消费品', period: 'current', origin: 'foreign', use: 'final', kind: 'final-use', amount: input.imports, explanation: '消费包含境外产品，C和M同时增加。本情景无新增本国分销服务，进口不直接增加本国生产；此记账不等于现实因果结论。' },
    { id: 'old-inventory-sale', label: '销售前期已生产存货', period: 'previous', origin: 'domestic', use: 'inventory', kind: 'final-use', amount: input.oldInventorySale, explanation: `期初库存${input.openingInventory}；销售额进入本期C，并从本期存货投资I中扣除相同金额。没有当期新增生产，避免跨期重复计入。` },
    { id: 'transfer', label: '政府向家庭转移', period: 'current', origin: 'domestic', use: 'transfer', kind: 'transfer', amount: input.transfer, explanation: '纯转移没有商品服务的对价，因此本身不是政府购买G。本实验不模拟可能引发的后续消费。' },
    { id: 'stock', label: '购买已有股票', period: 'previous', origin: 'domestic', use: 'financial', kind: 'financial', amount: input.stock, explanation: '已有金融资产所有权转移，没有当期资本形成；GDP中的投资I不是所有理财投资。本情景无新增经纪服务费。' },
    { id: 'secondhand', label: '无服务费的二手商品转卖', period: 'previous', origin: 'domestic', use: 'final', kind: 'financial', amount: input.secondhand, explanation: '旧商品以前已经生产，单纯转卖不是当期新增产出。本情景无新增中介服务。' },
  );
  const row = (id: string, label: string, component: ExpenditureRow['component'], amount: number, sourceIds: string[], explanation: string): ExpenditureRow => ({ id, label, component, amount, sourceIds, explanation });
  const expenditureRows: ExpenditureRow[] = [
    row('C-domestic', '本期成品国内消费', 'C', domesticConsumption, ['domestic-consumption'], '100−本期未售−出口。'),
    row('C-import', '进口品消费', 'C', input.imports, ['imports'], '境外最终品计入消费，再以进口项冲销境外生产。'),
    row('C-previous', '前期库存的本期消费', 'C', input.oldInventorySale, ['old-inventory-sale'], '消费增加，存货变化同额减少。'),
    row('I-inventory', '本期新增存货', 'I', input.inventory, ['current-inventory'], '未售不等于未生产。'),
    row('I-previous', '前期库存减少', 'I', -input.oldInventorySale, ['old-inventory-sale'], '减少存货与消费增加抵消，不再次计算以前生产。'),
    row('G', '政府购买', 'G', 0, ['transfer'], '本实验只有纯转移，没有政府购买新商品或服务。'),
    row('X', '出口', 'X', input.exports, ['exports'], '本国成品的境外最终使用。'),
    row('M', '进口', 'M', input.imports, ['imports'], 'M为正数，在支出总式中扣除，避免境外生产混入GDP。'),
  ];
  if (input.machine) expenditureRows.push(row('I-machine', '本国新机器资本形成', 'I', 40, ['machine'], '新生产机器用于资本形成，生产与收入记录同时新增。'));
  const components = { C: 0, I: 0, G: 0, X: 0, M: 0 };
  for (const item of expenditureRows) components[item.component] += item.amount;
  const production = productionRows.reduce((sum, item) => sum + item.valueAdded, 0);
  const income = incomeRows.reduce((sum, item) => sum + item.total, 0);
  const expenditure = components.C + components.I + components.G + components.X - components.M;
  assertClose(production, income, '源记录不平衡：生产增加值与明确收入科目不一致。');
  assertClose(production, expenditure, '源记录不平衡：生产与最终使用不一致；不能自动添加调整项。');
  return {
    production, expenditure, income, components, productionRows, expenditureRows, incomeRows, activities,
    salesTotal: productionRows.reduce((sum, item) => sum + item.output, 0),
    wages: incomeRows.reduce((sum, item) => sum + item.wages, 0),
    surplus: incomeRows.reduce((sum, item) => sum + item.surplus, 0),
    closingInventory: input.openingInventory + input.inventory - input.oldInventorySale,
  };
}

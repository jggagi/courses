import { useEffect, useRef, useState } from 'react';
import type { LearningState } from '../persistence';
import { computeAccounts, computePrices, defaultAccountsInput, defaultPriceInput, initialLedger, pricePresets, replayLedger, validateLedger } from '../models';
import type { AccountsInput, AccountsResult, ActivityRecord, LedgerEvent, LedgerState, PriceInput } from '../models';
import { ActivityFlow, SeriesChart, type FlowRow } from './Charts';

type LedgerInput = { initial: LedgerState; events: LedgerEvent[] };
type Common<Input> = { input: Input; baseline: Input; prediction: string; skipped: boolean; hasRun: boolean; explanation: string };
type LabId = 'LA01' | 'LA02' | 'LA03';
type Errors = Record<string, string>;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const numberText = (value: number | null) => value === null ? '未定义' : Number.isFinite(value) ? Number(value.toFixed(6)).toString() : '未定义';
const percentText = (value: number | null) => value === null ? '未定义' : !Number.isFinite(value * 100) ? '超出数值范围' : `${numberText(value * 100)}%`;
const relative = (value: number | null, baseline: number | null) => { if (value === null || baseline === null || baseline === 0) return null; const ratio = value / baseline - 1; return Number.isFinite(ratio) ? ratio : null; };
const message = (error: unknown) => error instanceof Error ? error.message : '输入无法计算，请检查参数。';
const canRun = (value: Common<unknown>) => value.prediction.trim() !== '' || value.skipped;
function calculate<T>(fn: () => T): { result?: T; error?: string } {
  try { return { result: fn() }; } catch (error) { return { error: message(error) }; }
}

function NumberControl({ name, value, min = 0, max, positive = false, onChange, onError }: { name: string; value: number; min?: number; max?: number; positive?: boolean; onChange: (value: number) => void; onError: (error: string | null) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  return <label>{name}<input type="number" step="any" min={min} max={max} value={draft} onChange={event => {
    const text = event.currentTarget.value;
    setDraft(text);
    const parsed = Number(text);
    if (!text.trim() || !Number.isFinite(parsed)) return onError(`${name}必须填写有限数字。`);
    if ((positive && parsed <= 0) || parsed < min || (max !== undefined && parsed > max)) return onError(`${name}须${positive ? '大于0' : `不少于${min}`}${max !== undefined ? `，且不大于${max}` : ''}。`);
    onError(null);
    onChange(parsed);
  }} /></label>;
}

function ErrorsNotice({ errors, calculationError }: { errors: Errors; calculationError?: string }) {
  const all = [...Object.values(errors), ...(calculationError ? [calculationError] : [])];
  return all.length ? <div className="error" role="alert">{all.map(error => <p key={error}>{error}</p>)}</div> : null;
}

function Prediction<Input>({ value, onChange }: { value: Common<Input>; onChange: (next: Common<Input>) => void }) {
  const [draft, setDraft] = useState(value.prediction);
  useEffect(() => { setDraft(value.prediction); }, [value.prediction]);
  return <div className="panel">
    <h3>先预测，再运行</h3>
    <label>实验预测与理由<textarea value={draft} placeholder="你预计什么会改变？为什么？有什么不确定？" onChange={event => setDraft(event.currentTarget.value)} /></label>
    <div className="button-row">
      <button type="button" disabled={!draft.trim()} onClick={() => onChange({ ...value, prediction: draft, skipped: false, hasRun: false })}>保存实验预测</button>
      <button type="button" onClick={() => onChange({ ...value, prediction: '', skipped: true, hasRun: false })}>跳过预测</button>
    </div>
    <p className="muted" role="status">{value.skipped ? '已记录：本次跳过预测，可以运行。' : value.prediction ? '预测已保存，可以运行；可修改后重新保存。' : '预测未保存。也可以点击“跳过预测”继续。'}</p>
  </div>;
}

function Explanation<Input>({ value, onChange }: { value: Common<Input>; onChange: (next: Common<Input>) => void }) {
  return <div className="panel"><h3>运行后重建解释</h3>
    <label>实验解释<textarea value={value.explanation} placeholder="对照预测，说明变化、机制与条件；记录仍不确定的地方。" onChange={event => onChange({ ...value, explanation: event.currentTarget.value })} /></label>
    <p className="muted">解释按纯文本保存在本地；由你对照账表与模型边界自评，不自动判分。</p>
  </div>;
}

function CompareControls<Input>({ value, defaultInput, onChange, clearErrors, invalid = false }: { value: Common<Input>; defaultInput: () => Input; onChange: (next: Common<Input>) => void; clearErrors: () => void; invalid?: boolean }) {
  return <div className="button-row">
    <button type="button" disabled={invalid} onClick={() => { onChange({ ...value, baseline: clone(value.input) }); }}>设 A 为当前情景</button>
    <button type="button" onClick={() => { clearErrors(); onChange({ ...value, input: clone(value.baseline), hasRun: false }); }}>将 B 还原为 A</button>
    <button type="button" onClick={() => { clearErrors(); const input = defaultInput(); onChange({ ...value, input, baseline: clone(input), hasRun: false }); }}>重置实验</button>
  </div>;
}

const eventNames = { wage: '支付工资', service: '购买当期服务', repayment: '偿还贷款本金' };
const counterparties = { wage: '企业 F → 家庭 H；银行存款分户转移', service: '家庭 H → 企业 F；银行存款分户转移', repayment: '企业 F ↔ 银行 B；贷款资产／负债与存款同减' };
const defaultLedgerInput = (): LedgerInput => ({ initial: initialLedger(), events: [] });

function LedgerLab({ value, onChange }: { value: Common<LedgerInput>; onChange: (next: Common<LedgerInput>) => void }) {
  const [type, setType] = useState<LedgerEvent['type']>('wage');
  const [amount, setAmount] = useState(20);
  const [errors, setErrors] = useState<Errors>({});
  const [actionError, setActionError] = useState<string>();
  const [resetKey, setResetKey] = useState(0);
  const check = calculate(() => replayLedger(value.input.initial, value.input.events));
  const a = calculate(() => replayLedger(value.baseline.initial, value.baseline.events));
  const b = value.hasRun && canRun(value) && !Object.keys(errors).length ? check.result : undefined;
  const clearErrors = () => { setErrors({}); setActionError(undefined); setResetKey(key => key + 1); };
  const updateEvents = (events: LedgerEvent[], reveal = false) => {
    const validated = calculate(() => replayLedger(value.input.initial, events));
    if (validated.error) return setActionError(validated.error);
    setActionError(undefined);
    onChange({ ...value, input: { ...value.input, events }, hasRun: reveal && canRun(value) });
  };
  const newEvent = (eventType: LedgerEvent['type'], eventAmount: number, sequence: number): LedgerEvent => ({ id: `event-${crypto.randomUUID()}`, sequence, type: eventType, amount: eventAmount });
  const run = () => {
    if (!canRun(value)) return setActionError('请先保存预测，或明确选择跳过预测。');
    if (Object.keys(errors).length) return setActionError('请先修正标出的金额，再运行实验。');
    if (check.error) return setActionError(check.error);
    setActionError(undefined);
    onChange({ ...value, hasRun: true });
  };
  const rows = b && a.result ? [
    ['H 存款资产', value.input.initial.H.deposit, b.H.deposit, a.result.H.deposit],
    ['H 净值', value.input.initial.H.netWorth, b.H.netWorth, a.result.H.netWorth],
    ['F 存款资产', value.input.initial.F.deposit, b.F.deposit, a.result.F.deposit],
    ['F 贷款负债', value.input.initial.F.loan, b.F.loan, a.result.F.loan],
    ['F 净值', value.input.initial.F.netWorth, b.F.netWorth, a.result.F.netWorth],
    ['B 准备金资产', value.input.initial.B.reserves, b.B.reserves, a.result.B.reserves],
    ['B 贷款资产', value.input.initial.B.loanAsset, b.B.loanAsset, a.result.B.loanAsset],
    ['B 对 H 存款负债', value.input.initial.B.depositH, b.B.depositH, a.result.B.depositH],
    ['B 对 F 存款负债', value.input.initial.B.depositF, b.B.depositF, a.result.B.depositF],
    ['B 存款负债总额', value.input.initial.B.depositH + value.input.initial.B.depositF, b.B.depositH + b.B.depositF, a.result.B.depositH + a.result.B.depositF],
    ['B 权益', value.input.initial.B.equity, b.B.equity, a.result.B.equity],
  ] as const : [];
  return <section className="panel" aria-label="LA01 事件驱动账本">
    <h2>LA01 · 交易、存量与资产负债表</h2>
    <p className="notice">教学合成数据（synthetic） · 第0期期初 → 第1期期末 · 金额为货币单位，收入／支出为货币单位／期。</p>
    <p>对象：家庭 H、企业 F、银行 B。外生输入是期初账表及事件类型、金额、顺序；存款、贷款、收入支出和净值由逐笔记账内生计算。准备金发行方在边界之外；本期没有利息、税、重估或新增信贷。资产＝负债＋净值是核算恒等式，不能据此推断行为。</p>
    <details className="details" open><summary>期初账表：预测所需的已知条件</summary><div className="table-scroll" tabIndex={0}><table><caption>第0期期初存量（货币单位）；由保存的期初账表读取</caption><thead><tr><th>部门</th><th>资产</th><th>负债</th><th>净值／权益</th></tr></thead><tbody><tr><th>家庭 H</th><td>存款 {numberText(value.input.initial.H.deposit)}</td><td>0</td><td>{numberText(value.input.initial.H.netWorth)}</td></tr><tr><th>企业 F</th><td>存款 {numberText(value.input.initial.F.deposit)}</td><td>贷款 {numberText(value.input.initial.F.loan)}</td><td>{numberText(value.input.initial.F.netWorth)}</td></tr><tr><th>银行 B</th><td>准备金 {numberText(value.input.initial.B.reserves)}；贷款 {numberText(value.input.initial.B.loanAsset)}</td><td>H 存款 {numberText(value.input.initial.B.depositH)}；F 存款 {numberText(value.input.initial.B.depositF)}</td><td>{numberText(value.input.initial.B.equity)}</td></tr></tbody></table></div></details>
    <Prediction value={value} onChange={onChange} />
    <h3>B · 事件输入</h3>
    <div className="controls">
      <label>交易类型<select value={type} onChange={event => { const next = event.currentTarget.value as LedgerEvent['type']; setType(next); setAmount(next === 'wage' ? 20 : next === 'service' ? 10 : 5); setErrors({}); setResetKey(key => key + 1); }}>
        <option value="wage">企业支付工资</option><option value="service">家庭购买当期服务</option><option value="repayment">企业偿还贷款本金</option>
      </select></label>
      <NumberControl key={`amount-${resetKey}`} name="事件金额" value={amount} positive onChange={setAmount} onError={error => setErrors(error ? { amount: error } : {})} />
    </div>
    <div className="button-row">
      <button type="button" onClick={() => { if (Object.keys(errors).length) return setActionError('请填写合法事件金额。'); const sequence = Math.max(0, ...value.input.events.map(event => event.sequence)) + 1; updateEvents([...value.input.events, newEvent(type, amount, sequence)]); }}>添加事件</button>
      <button type="button" onClick={() => { if (!canRun(value)) return setActionError('请先保存预测，或明确选择跳过预测，再执行默认三步。'); clearErrors(); updateEvents([newEvent('wage', 20, 1), newEvent('service', 10, 2), newEvent('repayment', 5, 3)], true); }}>执行默认三步（20 / 10 / 5）</button>
      <button type="button" disabled={!value.input.events.length} onClick={() => updateEvents(value.input.events.slice(0, -1), value.hasRun)}>撤销最后事件</button>
      <button type="button" onClick={run}>运行实验</button>
    </div>
    <ErrorsNotice errors={errors} calculationError={actionError ?? check.error ?? a.error} />
    <p className="muted">输入与事件日志可先检查；只有运行后揭示账表。A 保存独立副本，B 的操作不会更改它。</p>
    <CompareControls value={value} onChange={onChange} defaultInput={defaultLedgerInput} clearErrors={clearErrors} invalid={!!check.error || !!Object.keys(errors).length} />
    <h3>原始事件日志</h3>
    {!value.input.events.length ? <p>当前没有事件。添加事件或载入三步情景。</p> : <ol>{value.input.events.map(event => <li key={event.id}><strong>顺序 {event.sequence} · {eventNames[event.type]} {numberText(event.amount)}</strong> · {counterparties[event.type]}<br /><small>唯一事件 ID：{event.id}</small></li>)}</ol>}
    {b && a.result && <div data-testid="ledger-results">
      {JSON.stringify(value.input.initial) !== JSON.stringify(value.baseline.initial) && <p className="notice">A 与 B 的期初账表不同；期末差异同时包含初始条件与本期事件，不能全部归因于某一笔交易。</p>}
      <h3>期初—变化—期末 · A/B 账表</h3>
      <div className="table-scroll" tabIndex={0} aria-label="三部门账表，可横向滚动"><table><caption>存量为时点货币单位；变化来自本期事件</caption><thead><tr><th>部门／科目</th><th>B 期初</th><th>B 变化</th><th>B 期末</th><th>A 期末</th></tr></thead><tbody>{rows.map(([label, initial, end, baseline]) => <tr key={label}><th>{label}</th><td>{numberText(initial)}</td><td>{numberText(end - initial)}</td><td>{numberText(end)}</td><td>{numberText(baseline)}</td></tr>)}</tbody></table></div>
      <p className="notice">双边核对通过：H 存款 {numberText(b.H.deposit)}＝B 对 H 负债 {numberText(b.B.depositH)}；F 存款 {numberText(b.F.deposit)}＝B 对 F 负债 {numberText(b.B.depositF)}；F 贷款 {numberText(b.F.loan)}＝B 贷款资产 {numberText(b.B.loanAsset)}。</p>
      <div className="table-scroll" tabIndex={0}><table><caption>资产＝负债＋净值；每步均由事件重放验证</caption><thead><tr><th>时点／步骤</th><th>H</th><th>F</th><th>B</th><th>总存款</th></tr></thead><tbody>{[0, ...value.input.events.map((_, index) => index + 1)].map(count => {
        const step = replayLedger(value.input.initial, value.input.events.slice(0, count)); validateLedger(step);
        return <tr key={count}><th>{count === 0 ? '期初' : `第${count}步`}</th><td>{numberText(step.H.deposit)}＝0＋{numberText(step.H.netWorth)}</td><td>{numberText(step.F.deposit)}＝{numberText(step.F.loan)}＋{numberText(step.F.netWorth)}</td><td>{numberText(step.B.reserves + step.B.loanAsset)}＝{numberText(step.B.depositH + step.B.depositF)}＋{numberText(step.B.equity)}</td><td>{numberText(step.B.depositH + step.B.depositF)}</td></tr>;
      })}</tbody></table></div>
      <div className="table-scroll" tabIndex={0}><table><caption>本期收入／支出与净值变化（货币单位／期）</caption><thead><tr><th>H 工资收入</th><th>H 服务消费</th><th>H 储蓄</th><th>F 服务收入</th><th>F 工资费用</th><th>本金偿还</th></tr></thead><tbody><tr><td>{numberText(b.flow.householdIncome)}</td><td>{numberText(b.flow.householdConsumption)}</td><td>{numberText(b.flow.householdIncome - b.flow.householdConsumption)}</td><td>{numberText(b.flow.firmRevenue)}</td><td>{numberText(b.flow.firmWages)}</td><td>{numberText(b.flow.principalRepaid)}</td></tr></tbody></table></div>
      <p>工资和服务购买是持有者之间的存款转移，也改变各自的收入、费用与净值。本金偿还使企业与银行的贷款两侧同减，银行存款负债也减少；它不是企业的消费费用，在这些假设下不改变双方净值。</p>
      <Explanation value={value} onChange={onChange} />
    </div>}
  </section>;
}

const classifications = [
  ['intermediate', '当期本国中间产品'], ['current', '当期本国最终产品／使用'], ['capital', '当期本国资本形成'], ['inventory', '本期生产未售存货'], ['import', '进口消费：C 与 M 同增'], ['previous', '前期库存销售：C 增、I 减'], ['financial', '旧资产／金融交易'], ['transfer', '纯转移'],
] as const;
function classification(activity: ActivityRecord): string {
  if (activity.kind === 'transfer') return 'transfer';
  if (activity.kind === 'financial') return 'financial';
  if (activity.period === 'previous') return 'previous';
  if (activity.origin === 'foreign') return 'import';
  if (activity.use === 'intermediate') return 'intermediate';
  if (activity.use === 'capital') return 'capital';
  if (activity.use === 'inventory') return 'inventory';
  return 'current';
}
function activityFlowRows(result: AccountsResult): FlowRow[] {
  return result.activities.filter(activity => (activity.kind !== 'production' || activity.use === 'capital') && activity.amount > 0).map(activity => ({
    id: activity.id, label: activity.label, amount: activity.amount, note: activity.explanation,
    source: activity.kind === 'transfer' ? '政府' : activity.kind === 'financial' ? '旧资产持有人' : activity.period === 'previous' ? '期初存货（前期生产）' : activity.origin === 'foreign' ? '境外生产者' : '本国当期生产者',
    destination: activity.period === 'previous' && activity.kind === 'final-use' ? '家庭最终消费' : activity.use === 'inventory' ? '期末存货' : activity.use === 'capital' ? '资本形成' : activity.kind === 'transfer' ? '家庭' : activity.kind === 'financial' ? '资产受让人' : activity.id.includes('export') ? '国外最终使用' : '最终使用者',
  }));
}

type AccountsLabValue = Common<AccountsInput> & { classifications?: Record<string, string> };
function AccountsLab({ value, onChange }: { value: AccountsLabValue; onChange: (next: AccountsLabValue) => void }) {
  const [errors, setErrors] = useState<Errors>({});
  const [actionError, setActionError] = useState<string>();
  const [resetKey, setResetKey] = useState(0);
  const chosen = value.classifications ?? {};
  const check = calculate(() => computeAccounts(value.input));
  const a = calculate(() => computeAccounts(value.baseline));
  const b = value.hasRun && canRun(value) && !Object.keys(errors).length ? check.result : undefined;
  const pendingActivities = check.result?.activities.filter(activity => activity.amount > 0) ?? [];
  const clearErrors = () => { setErrors({}); setActionError(undefined); setResetKey(key => key + 1); };
  const setInput = (patch: Partial<AccountsInput>) => { setActionError(undefined); onChange({ ...value, input: { ...value.input, ...patch }, hasRun: false }); };
  const setFieldError = (key: string, error: string | null) => setErrors(previous => { const next = { ...previous }; if (error) next[key] = error; else delete next[key]; return next; });
  const run = () => {
    if (!canRun(value)) return setActionError('请先保存预测，或明确选择跳过预测。');
    if (Object.keys(errors).length) return setActionError('请先修正标出的数值。');
    if (check.error) return setActionError(check.error);
    if (pendingActivities.some(activity => !chosen[activity.id])) return setActionError('请先为每条活动选择自己的分类，再运行并对照反馈。分类可以修改，不按成绩限制学习。');
    setActionError(undefined); onChange({ ...value, hasRun: true });
  };
  const numericControls: { key: 'inventory' | 'exports' | 'imports'; name: string; max?: number }[] = [
    { key: 'inventory', name: '本期未售存货', max: 100 }, { key: 'exports', name: '出口', max: 100 }, { key: 'imports', name: '进口' },
  ];
  const toggles: { key: 'machine' | 'transfer' | 'stock' | 'secondhand' | 'oldInventorySale'; label: string; amount: number }[] = [
    { key: 'machine', label: '新增本国机器 40', amount: 40 }, { key: 'transfer', label: '政府转移 10', amount: 10 }, { key: 'stock', label: '购买已有股票 50', amount: 50 }, { key: 'secondhand', label: '二手商品转卖 20（无服务费）', amount: 20 }, { key: 'oldInventorySale', label: '销售前期存货 20', amount: 20 },
  ];
  return <section className="panel" aria-label="LA02 GDP三种视角">
    <h2>LA02 · 生产活动与最终使用</h2>
    <p className="notice">教学合成数据（synthetic） · 第1期 · 货币单位／期；期初存货来自第0期，本例期初价值 {numberText(value.input.openingInventory)}。</p>
    <p>外生输入是生产链与活动选择；生产、最终使用、收入分项由同一活动记录派生。假定无税、补贴、折旧调整、持有收益、渠道加价或新增分销服务；工资与毛营业盈余覆盖每家的增加值。三法相等是核算关系，不是因果模型。转移与资产交易引发的后续行为在边界之外。</p>
    <details className="details" open><summary>生产活动原始记录：预测所需的已知条件</summary>{check.result && <div className="table-scroll" tabIndex={0}><table><caption>本国当期生产源记录（货币单位／期）；先自行判断如何消除中间投入</caption><thead><tr><th>生产者</th><th>产出</th><th>中间投入</th><th>工资</th><th>毛营业盈余</th></tr></thead><tbody>{check.result.productionRows.map(row => <tr key={row.id}><th>{row.label}</th><td>{numberText(row.output)}</td><td>{numberText(row.intermediate)}</td><td>{numberText(row.wages)}</td><td>{numberText(row.surplus)}</td></tr>)}</tbody></table></div>}</details>
    <Prediction value={value} onChange={onChange} />
    <h3>B · 活动选择</h3>
    <div className="controls">{numericControls.map(control => <NumberControl key={`${control.key}-${resetKey}`} name={control.name} value={value.input[control.key]} max={control.max} onChange={number => setInput({ [control.key]: number })} onError={error => setFieldError(control.key, error)} />)}</div>
    <p className="muted">s＋x 不得超过本期成品产出100；新增进口消费同时进入 C 和 M。期初存货下限约束独立于本期未售存货。</p>
    <div className="controls">{toggles.map(toggle => <label key={toggle.key}><input type="checkbox" aria-label={toggle.key === 'machine' ? '机器生产' : toggle.label} checked={toggle.key === 'machine' ? value.input.machine : value.input[toggle.key] !== 0} onChange={event => setInput({ [toggle.key]: toggle.key === 'machine' ? event.currentTarget.checked : event.currentTarget.checked ? toggle.amount : 0 })} /> {toggle.label}</label>)}</div>
    <ErrorsNotice errors={errors} calculationError={actionError ?? check.error ?? a.error} />
    <h3>先给活动分类</h3>
    <p>每条活动请选择你认为的口径。运行后显示来源、正确分类与原因；不同活动可能抵消，不能只看支付金额。</p>
    <div className="controls">{pendingActivities.map(activity => <label key={activity.id}>{activity.label} · {numberText(activity.amount)}<select aria-label={`${activity.label} 分类`} value={chosen[activity.id] ?? ''} onChange={event => { setActionError(undefined); onChange({ ...value, classifications: { ...chosen, [activity.id]: event.currentTarget.value }, hasRun: false }); }}>
      <option value="">请选择你的分类</option>{classifications.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select></label>)}</div>
    <div className="button-row"><button type="button" onClick={run}>运行实验</button></div>
    <CompareControls value={value} onChange={next => onChange({ ...next, classifications: next.input === value.input ? chosen : {} })} defaultInput={defaultAccountsInput} clearErrors={clearErrors} invalid={!!check.error || !!Object.keys(errors).length} />
    {b && a.result && <div data-testid="accounts-results">
      <h3>同一生产过程 · 三种核算</h3>
      <div className="table-scroll" tabIndex={0}><table><caption>同口径的 A/B 结果（货币单位／期）</caption><thead><tr><th>方法／分项</th><th>A 基准</th><th>B 实验</th></tr></thead><tbody>{([
        ['生产法 GDP', a.result.production, b.production], ['支出法 GDP', a.result.expenditure, b.expenditure], ['收入法 GDP', a.result.income, b.income],
        ['C 消费', a.result.components.C, b.components.C], ['I 资本形成与净存货变化', a.result.components.I, b.components.I], ['G 政府购买', a.result.components.G, b.components.G], ['X 出口', a.result.components.X, b.components.X], ['M 进口（扣除项）', a.result.components.M, b.components.M],
      ] as const).map(([label, av, bv]) => <tr key={label}><th>{label}</th><td>{numberText(av)}</td><td>{numberText(bv)}</td></tr>)}</tbody></table></div>
      <p className="notice">生产 {numberText(b.production)}＝最终支出 {numberText(b.expenditure)}＝工资 {numberText(b.wages)}＋毛营业盈余 {numberText(b.surplus)}。各生产者产出总值 {numberText(b.salesTotal)} 包含中间投入与当期未售产出，不能直接相加作为 GDP；期末存货为 {numberText(b.closingInventory)}。</p>
      <div className="table-scroll" tabIndex={0}><table><caption>生产侧：逐家消除中间投入</caption><thead><tr><th>生产者</th><th>当期产出</th><th>中间投入</th><th>增加值</th><th>来源</th></tr></thead><tbody>{b.productionRows.map(row => <tr key={row.id}><th>{row.label}</th><td>{numberText(row.output)}</td><td>{numberText(row.intermediate)}</td><td>{numberText(row.valueAdded)}</td><td>{row.sourceIds.map(id => <a key={id} href={`#activity-${id}`} onClick={event => { event.preventDefault(); document.getElementById(`activity-${id}`)?.scrollIntoView({ block: 'center' }); }}>{id} </a>)}</td></tr>)}</tbody></table></div>
      <div className="table-scroll" tabIndex={0}><table><caption>最终使用侧：Y＝C＋I＋G＋X−M</caption><thead><tr><th>活动／分项</th><th>金额</th><th>记账解释／来源</th></tr></thead><tbody>{b.expenditureRows.map(row => <tr key={row.id}><th>{row.label} · {row.component}</th><td>{numberText(row.amount)}</td><td>{row.explanation} {row.sourceIds.map(id => <a key={id} href={`#activity-${id}`} onClick={event => { event.preventDefault(); document.getElementById(`activity-${id}`)?.scrollIntoView({ block: 'center' }); }}>{id} </a>)}</td></tr>)}</tbody></table></div>
      <div className="table-scroll" tabIndex={0}><table><caption>收入侧：来自生产者的明确科目</caption><thead><tr><th>生产者</th><th>工资</th><th>毛营业盈余</th><th>合计</th><th>来源</th></tr></thead><tbody>{b.incomeRows.map(row => <tr key={row.id}><th>{row.label}</th><td>{numberText(row.wages)}</td><td>{numberText(row.surplus)}</td><td>{numberText(row.total)}</td><td>{row.sourceIds.map(id => <a key={id} href={`#activity-${id}`} onClick={event => { event.preventDefault(); document.getElementById(`activity-${id}`)?.scrollIntoView({ block: 'center' }); }}>{id} </a>)}</td></tr>)}</tbody></table></div>
      <ActivityFlow rows={activityFlowRows(b)} />
      <h3>活动来源与分类反馈</h3>
      <div className="table-scroll" tabIndex={0}><table><caption>每个结果可追溯至原始活动（箭头的数字替代表）</caption><thead><tr><th>活动／金额</th><th>时期／来源／性质</th><th>你的分类与反馈</th><th>原因</th></tr></thead><tbody>{b.activities.map(activity => <tr id={`activity-${activity.id}`} key={activity.id}><th>{activity.label}<br />{numberText(activity.amount)}<br /><small>{activity.id}</small></th><td>{activity.period === 'current' ? '当期' : '前期'}／{activity.origin === 'domestic' ? '本国' : '国外'}／{({ intermediate: '中间使用', final: '最终使用', capital: '资本形成', inventory: '存货', financial: '金融／旧资产', transfer: '转移' })[activity.use]}</td><td>{chosen[activity.id] ? (chosen[activity.id] === classification(activity) ? '分类一致。' : `请修正：${classifications.find(([key]) => key === classification(activity))?.[1]}。`) : '生产来源记录。'}</td><td>{activity.explanation}</td></tr>)}</tbody></table></div>
      <p>进口消费同时加到 C 与 M，避免把境外生产算入本国 GDP。前期库存销售的 C 与 I 抵消；新机器对应本期资本形成，股票是金融权利转手。转移本身没有新生产，但可能影响后续选择，这个实验没有模拟那一机制。</p>
      <Explanation value={value} onChange={onChange} />
    </div>}
  </section>;
}

function PriceLab({ value, onChange }: { value: Common<PriceInput>; onChange: (next: Common<PriceInput>) => void }) {
  const [errors, setErrors] = useState<Errors>({});
  const [actionError, setActionError] = useState<string>();
  const [resetKey, setResetKey] = useState(0);
  const [view, setView] = useState<'level' | 'growth'>('level');
  const check = calculate(() => computePrices(value.input));
  // A 的原始情景始终冻结；共同显示刻度只改表示，不修改保存的基准。
  const a = calculate(() => computePrices({ ...value.baseline, normalization: value.input.normalization }));
  const b = value.hasRun && canRun(value) && !Object.keys(errors).length ? check.result : undefined;
  const clearErrors = () => { setErrors({}); setActionError(undefined); setResetKey(key => key + 1); };
  const setInput = (input: PriceInput) => { setActionError(undefined); onChange({ ...value, input, hasRun: false }); };
  const setFieldError = (key: string, error: string | null) => setErrors(previous => { const next = { ...previous }; if (error) next[key] = error; else delete next[key]; return next; });
  const run = () => {
    if (!canRun(value)) return setActionError('请先保存预测，或明确选择跳过预测。');
    if (Object.keys(errors).length) return setActionError('请先修正标出的价格／数量，结果不会使用非法值。');
    if (check.error) return setActionError(check.error);
    setActionError(undefined); onChange({ ...value, hasRun: true });
  };
  const keys: { key: keyof PriceInput['periods'][number]; label: string; positive: boolean }[] = [{ key: 'px', label: 'x价格', positive: true }, { key: 'py', label: 'y价格', positive: true }, { key: 'qx', label: 'x数量', positive: false }, { key: 'qy', label: 'y数量', positive: false }];
  const differentWeights = value.input.priceBase !== value.baseline.priceBase || value.input.basketBase !== value.baseline.basketBase;
  const metrics: { key: 'N' | 'R' | 'D' | 'L'; growth: 'gN' | 'gR' | 'piD' | 'piL'; label: string; unit: string }[] = [
    { key: 'N', growth: 'gN', label: 'N 名义产出', unit: '当期价货币单位／期' }, { key: 'R', growth: 'gR', label: 'R 固定价格实际产出', unit: '基期价货币单位／期' },
    { key: 'D', growth: 'piD', label: 'D 产出平减指数', unit: `指数点，基准 ${value.input.normalization}` }, { key: 'L', growth: 'piL', label: 'L 固定篮子价格指数', unit: `指数点，基准 ${value.input.normalization}` },
  ];
  return <section className="panel" aria-label="LA03 价格数量与指数">
    <h2>LA03 · 价格、数量与指数</h2>
    <p className="notice">教学合成数据（synthetic） · {value.input.periods.map((_, index) => `第${index}期`).join('／')}，每期一年，无季调或年化 · 价格：货币单位／件；数量：件／期。</p>
    <p>外生输入是两种本国产品的原始 p/q、价格权重基期、消费篮子基期与显示刻度。N、R、D、L 及同比增长由同一表内生计算。本例两种产品也构成消费篮子；现实 GDP 与 CPI 覆盖范围不同。质量变化、链式指数、替代和数据修订不在模型内。</p>
    <Prediction value={value} onChange={onChange} />
    <h3>B · 原始价格与数量</h3>
    <div className="table-scroll" tabIndex={0}><table><caption>价格必须大于0，数量不能小于0。结果使用原始数值而不是显示舍入值。</caption><thead><tr><th>合成时期</th><th>x 价格</th><th>y 价格</th><th>x 数量</th><th>y 数量</th></tr></thead><tbody>{value.input.periods.map((period, index) => <tr key={index}><th>第{index}期</th>{keys.map(({ key, label, positive }) => <td key={key}><NumberControl key={`${index}-${key}-${resetKey}`} name={`第${index}期 ${label}`} value={period[key]} positive={positive} onChange={number => setInput({ ...value.input, periods: value.input.periods.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: number } : row) })} onError={error => setFieldError(`${index}-${key}`, error)} /></td>)}</tr>)}</tbody></table></div>
    <div className="button-row">
      <button type="button" onClick={() => { clearErrors(); setInput(clone(pricePresets.priceOnly())); }}>预设：只涨价</button>
      <button type="button" onClick={() => { clearErrors(); setInput(clone(pricePresets.quantityOnly())); }}>预设：只增产</button>
      <button type="button" onClick={() => { clearErrors(); setInput(clone(pricePresets.composition())); }}>预设：改变组合</button>
      <button type="button" onClick={() => { clearErrors(); setInput(defaultPriceInput()); }}>预设：通胀放缓但价格继续上升</button>
    </div>
    <div className="controls">
      <label>指数显示刻度<select value={value.input.normalization} onChange={event => setInput({ ...value.input, normalization: Number(event.currentTarget.value) as 100 | 1000 })}><option value="100">100</option><option value="1000">1000</option></select></label>
      <label>实际产出的价格权重基期<select value={value.input.priceBase} onChange={event => setInput({ ...value.input, priceBase: Number(event.currentTarget.value) })}>{value.input.periods.map((_, index) => <option key={index} value={index}>第{index}期价格</option>)}</select></label>
      <label>固定消费篮子的数量基期<select value={value.input.basketBase} onChange={event => setInput({ ...value.input, basketBase: Number(event.currentTarget.value) })}>{value.input.periods.map((_, index) => <option key={index} value={index}>第{index}期数量</option>)}</select></label>
    </div>
    <p className="muted">换100／1000只改变指数表示，两条情景共用显示刻度；更换价格／篮子权重改变度量规则，可能改变聚合增长。</p>
    <ErrorsNotice errors={errors} calculationError={actionError ?? check.error ?? a.error} />
    <div className="button-row"><button type="button" onClick={run}>运行实验</button></div>
    <CompareControls value={value} onChange={onChange} defaultInput={defaultPriceInput} clearErrors={clearErrors} invalid={!!check.error || !!Object.keys(errors).length} />
    {b && a.result && <div data-testid="price-results">
      {value.input.periods.length !== value.baseline.periods.length && <p className="notice">A 有 {value.baseline.periods.length} 个时期，B 有 {value.input.periods.length} 个时期。图与表以 B 的时期为轴，仅共同存在的时期可作 A/B 比较；缺少的 A 观察显示未定义，A 其余原始时期仍保存在基准中。</p>}
      {differentWeights && <p className="notice">A 与 B 的权重基期不同：A 价格／篮子基期为 {value.baseline.priceBase}／{value.baseline.basketBase}，B 为 {value.input.priceBase}／{value.input.basketBase}。实际值和指数的差异同时含度量变化，不能全部解释成经济冲击。</p>}
      <p>定义：N＝Σpₜqₜ；R＝Σp基期qₜ；D＝刻度×N／R；L＝刻度×Σpₜq篮子／Σp篮子基期q篮子。价格基期第{b.priceBase}期，篮子数量基期第{b.basketBase}期，基准篮子价值 {numberText(b.basketValue)}。增长＝本期／上期−1；一年一期，因此这里的同比也等于相邻期变化。</p>
      <fieldset className="controls"><legend>图表口径</legend><label><input type="radio" name="price-view" value="level" checked={view === 'level'} onChange={() => setView('level')} />水平</label><label><input type="radio" name="price-view" value="growth" checked={view === 'growth'} onChange={() => setView('growth')} />增长／通胀</label></fieldset>
      <div className="grid">{metrics.map(metric => <SeriesChart key={metric.key} title={`${metric.label}${view === 'growth' ? '的同比增长／通胀' : '水平'}`} unit={view === 'growth' ? '%' : metric.unit} periods={b.periods.map(period => `第${period.period}期`)} series={[
        { label: 'A 基准（虚线）', style: 'dashed', values: b.periods.map((_, index) => { const period = a.result!.periods[index]; return !period ? null : view === 'level' ? period[metric.key] : period[metric.growth] === null ? null : period[metric.growth]! * 100; }) },
        { label: 'B 实验（实线）', style: 'solid', values: b.periods.map(period => view === 'level' ? period[metric.key] : period[metric.growth] === null ? null : period[metric.growth]! * 100) },
      ]} />)}</div>
      <div className="table-scroll" tabIndex={0}><table><caption>B 实验结果：名义／实际／两种指数及同比（指数共用显示刻度）</caption><thead><tr><th>时期</th><th>N 名义</th><th>R 实际</th><th>D 平减指数</th><th>L 固定篮子指数</th><th>名义同比</th><th>实际同比</th><th>D 通胀</th><th>L 通胀</th></tr></thead><tbody>{b.periods.map(period => <tr key={period.period} data-testid={`price-row-${period.period}`}><th>第{period.period}期</th><td>{numberText(period.N)}</td><td>{numberText(period.R)}</td><td>{numberText(period.D)}</td><td>{numberText(period.L)}</td><td>{percentText(period.gN)}</td><td>{percentText(period.gR)}</td><td>{percentText(period.piD)}</td><td>{percentText(period.piL)}</td></tr>)}</tbody></table></div>
      <div className="table-scroll" tabIndex={0}><table><caption>N／R／D／L 四个分离指标的数字替代表：A/B 水平与同指标同比</caption><thead><tr><th>时期</th><th>指标</th><th>A 水平</th><th>B 水平</th><th>A 同比</th><th>B 同比</th><th>B 相对 A 水平</th></tr></thead><tbody>{b.periods.flatMap((period, index) => metrics.map(metric => {
        const baseline = a.result!.periods[index];
        return <tr key={`${period.period}-${metric.key}`}><th>第{period.period}期</th><th>{metric.label}</th><td>{numberText(baseline?.[metric.key] ?? null)}</td><td>{numberText(period[metric.key])}</td><td>{percentText(baseline?.[metric.growth] ?? null)}</td><td>{percentText(period[metric.growth])}</td><td>{percentText(relative(period[metric.key], baseline?.[metric.key] ?? null))}</td></tr>;
      }))}</tbody></table></div>
      <div className="table-scroll" tabIndex={0}><table><caption>单品贡献与篮子基期支出权重（货币单位；权重为百分比）</caption><thead><tr><th>时期</th><th>x 的 N／R／篮子支出贡献</th><th>y 的 N／R／篮子支出贡献</th><th>篮子 x／y 权重</th></tr></thead><tbody>{b.periods.map(period => <tr key={period.period}><th>第{period.period}期</th><td>{numberText(period.nominalContributions.x)}／{numberText(period.realContributions.x)}／{numberText(period.basketContributions.x)}</td><td>{numberText(period.nominalContributions.y)}／{numberText(period.realContributions.y)}／{numberText(period.basketContributions.y)}</td><td>{percentText(period.basketWeights.x)}／{percentText(period.basketWeights.y)}</td></tr>)}</tbody></table></div>
      <p>未定义不是0：实际产出为0时 D 无定义，基准篮子价值为0时 L 无定义；前期水平为0时增长率无定义。图上留缺口，表中写“未定义”。</p>
      <p>平减指数满足精确乘法关系：1＋名义增长＝(1＋实际增长)×(1＋D 通胀)。通胀率下降而仍为正，表示价格继续上涨；指数刻度与百分比、百分点是不同单位。</p>
      <Explanation value={value} onChange={onChange} />
    </div>}
  </section>;
}

export default function Labs({ id, state, onChange }: { id: LabId; state: LearningState['labStates']; onChange: (next: LearningState['labStates']) => void }) {
  const expectedState = useRef(state);
  const restoredVersion = useRef(0);
  // 显式导入／整课清空是外部替换；同时清除尚未写入状态的非法数字草稿与错误。
  if (expectedState.current !== state) { expectedState.current = state; restoredVersion.current += 1; }
  const change = (next: LearningState['labStates']) => { expectedState.current = next; onChange(next); };
  const key = `${id}-${restoredVersion.current}`;
  if (id === 'LA01') return <LedgerLab key={key} value={state.LA01} onChange={next => change({ ...state, LA01: next })} />;
  if (id === 'LA02') return <AccountsLab key={key} value={state.LA02} onChange={next => change({ ...state, LA02: next })} />;
  return <PriceLab key={key} value={state.LA03} onChange={next => change({ ...state, LA03: next })} />;
}

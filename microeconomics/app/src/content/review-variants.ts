import type { NumericQuestion, Question } from "./types";
import { evaluateBundle, mrs, representedUtility, solveChoice } from "../models/economics";
import { advancedLabDefinitions, runAdvancedLab, type AdvancedLabId } from "../models/advanced";

const number = (value: number) => Number(value.toPrecision(12)).toString();
const shown = (parameters: Record<string, number>) => Object.entries(parameters).map(([key, value]) => `${key}=${number(value)}`).join("，");

function basicVariant(question: NumericQuestion, seed: number): NumericQuestion {
  const alpha = .4 + (seed % 4) * .05;
  const m = 140 + seed * 10, px = 4 + seed % 3, py = 3 + seed % 2;
  let parameters: Record<string, number>, prompt: string, feedback: string, metric: string;
  let labId: "ML01" | "ML02" | "ML03";
  switch (question.calculation) {
    case "time-excess": {
      const total = 8 + seed % 6, x = 4 + seed % 3, y = total - x + 2 + seed % 4;
      parameters = { m: total, px: 1, py: 1, x, y };
      const excess = -evaluateBundle(parameters as { m: number; px: number; py: number }, { x, y }).balance;
      prompt = `synthetic 新日程：今天可支配 ${total} 小时，两项活动分别需要 ${x}、${y} 小时，其他用时为零。这个方案超出可用时间多少？输入非负小时数。`;
      feedback = `${x}+${y}=${x + y} 小时；超出 ${total} 小时约束的部分为 ${number(excess)} 小时。可行约束是 x+y≤${total}，不能把两项活动的用时分别与总时间比较。`;
      labId = "ML01"; metric = "excess"; break;
    }
    case "budget-balance": {
      const x = 8 + seed % 8, y = 12 + seed % 6;
      parameters = { m, px, py, x, y };
      const result = evaluateBundle({ m, px, py }, { x, y });
      prompt = `synthetic 新采购：预算 m=${m}，单价 px=${px}、py=${py}，购买 x=${x}、y=${y} 单位，均无其他费用。预算余额是多少？若超支则保留负号。`;
      feedback = `支出 ${px}×${x}+${py}×${y}=${number(result.spending)}，余额 ${m}−${number(result.spending)}=${number(result.balance)}。价格是每单位货币额，须先乘以数量。`;
      labId = "ML01"; metric = "balance"; break;
    }
    case "utility-square": {
      const x = 14 + 2 * seed, y = x;
      parameters = { alpha: .5, x, y };
      const preference = { kind: "cd" as const, alpha: .5, a: 1, b: 1 };
      const value = representedUtility(preference, { x, y }, "u2");
      prompt = `synthetic 新组合：CD 表示 u(x,y)=√(xy)，数量 x=${x}、y=${y}。在非负域改用 v=u² 后，这个组合的 v 值是多少？这里求表示标签，不能据此比较幸福倍数。`;
      feedback = `u=√(${x}×${y})=${x}，v=u²=${number(value)}。这是同一确定性组合的数值表示变化，不是商品数量、偏好或幸福的变化。`;
      labId = "ML02"; metric = "u2"; break;
    }
    case "mrs-cd": {
      const x = 10 + seed % 7, y = 3 + seed % 5;
      parameters = { alpha, x, y };
      const result = mrs({ kind: "cd", alpha, a: 1, b: 1 }, { x, y });
      if (!result.defined || result.value === null) throw new Error("复习 MRS 必须位于正商品内点。");
      prompt = `synthetic 新偏好与组合：u=x^α·y^(1−α)，α=${number(alpha)}，x=${x}、y=${y}。求该点的正 MRS，单位为 y/x；此处未给市场价格。`;
      feedback = `MRS=[α/(1−α)]·y/x=[${number(alpha)}/${number(1 - alpha)}]×${y}/${x}=${number(result.value)}。它是该偏好下愿意的局部交换率，不是市场价格比；x、y 均为正使公式适用。`;
      labId = "ML02"; metric = "mrs"; break;
    }
    case "choice-cd-x":
    case "demand-cd-x": {
      const baselinePx = 2 + seed % 3;
      const finalPx = question.calculation === "choice-cd-x" ? px : baselinePx + 2;
      parameters = { m, px: finalPx, py, alpha };
      const preference = { kind: "cd" as const, alpha, a: 1, b: 1 };
      const result = solveChoice({ m, px: finalPx, py }, preference);
      if (result.kind !== "unique") throw new Error("复习 CD 选择应有唯一解。");
      prompt = question.calculation === "choice-cd-x"
        ? `synthetic 新消费问题：m=${m}，px=${finalPx}、py=${py}，u=x^α·y^(1−α)，α=${number(alpha)}。商品可分割且无其他约束。最优 x 数量是多少？`
        : `synthetic 新价格冲击：m=${m}、py=${py}、CD α=${number(alpha)} 保持不变，px 从 ${baselinePx} 升为 ${finalPx}。在新价格下重新优化，x 的最优数量是多少？`;
      const baseline = alpha * m / baselinePx;
      feedback = `正预算、正价格、0<α<1 下，x*=αm/px=${number(alpha)}×${m}/${finalPx}=${number(result.point.x)}；y*=${number(result.point.y)}，支出仍为 ${m}。${question.calculation === "demand-cd-x" ? `基准 x*=${number(baseline)}，价格变动后必须重新求解；这段总变化未经补偿，不能全部称作替代效应。` : "相切条件在这个光滑内点例子适用，不能据此忽略其他偏好的角点与多解。"}`;
      labId = "ML03"; metric = "x"; break;
    }
    default: throw new Error("该数值题不是基础复习模型。");
  }
  return { ...question, prompt, model: { labId, parameters, metric }, answerBasis: "按此新情境的完整参数调用与实验相同的计算内核；原题的数值不再适用。", feedback };
}

function advancedVariant(question: NumericQuestion, seed: number): NumericQuestion {
  if (!question.model) throw new Error("数值复习题缺少模型参数。");
  const id = question.model.labId as AdvancedLabId;
  const p = { ...question.model.parameters };
  // Vary economic conditions, not an unshown answer. All parameters below are
  // displayed in the prompt and recomputed by the original lab kernel.
  switch (id) {
    case "ML04":
      p.F += 7 + seed * 2; p.c += .5 + (seed % 4) * .5;
      p.d *= 1 + (seed % 3) * .25; p.p += 2 + seed % 3;
      p.A += 15 + seed * 3; p.B += .5 + seed % 3; p.n += 1 + seed % 4;
      break;
    case "ML05":
      p.A += 20 + seed * 3; p.C += 2 + seed % 4;
      p.B *= 1 + (seed % 3) * .25; p.D *= 1 + (seed % 4) * .2;
      p.tau = p.tau === 0 ? 0 : Math.min(p.tau + 3 + seed, (p.A - p.C) * .6);
      p.legalPayer ??= 0; break;
    case "ML06":
      p.a += 13 + seed * 2; p.c += 2 + seed % 4;
      p.b *= 1 + (seed % 3) * .25; p.F += 9 + seed * 3; break;
    case "ML07":
      // Positive affine transformations preserve each player's best responses.
      // The new matrix is shown; unchanged equilibrium counts are intentional.
      for (const key of Object.keys(p)) p[key] = p[key] * (2 + seed % 3) + (key[0] === "r" ? seed + 1 : seed + 3);
      break;
    case "ML08":
      p.A += 17 + seed * 3; p.C += 2 + seed % 5;
      p.B *= 1 + (seed % 3) * .25; p.D *= 1 + (seed % 4) * .2;
      p.e *= 1 + (seed % 3) * .3; p.tau = Math.min(p.tau, (p.A - p.C) * .6); break;
    case "ML09": {
      const factor = 1.25 + seed * .1;
      for (const key of ["sL", "sH", "vL", "vH", "certificationFee"]) p[key] *= factor;
      p.theta = .15 + (seed % 8) * .025; break;
    }
    case "ML10":
      p.wLow += 4 * seed; p.wHigh += 25 + seed * 7; p.probHigh = .25 + (seed % 7) * .05;
      p.y1 += 7 + seed * 3; p.y2 += 13 + seed * 5; p.r += .02 + (seed % 4) * .02;
      p.beta *= 1 + (seed % 3) * .1;
      p.T += 2 + seed % 4; p.wage += 1 + seed % 3;
      p.nonLabor += 12 + seed * 2;
      // noBorrow is a binary economic constraint, never multiplied by a scale.
      break;
    case "ML11": {
      p.laborA += 12 + seed * 3; p.laborB += 9 + seed * 4;
      const lower = Math.min(p.ax / p.ay, p.bx / p.by), upper = Math.max(p.ax / p.ay, p.bx / p.by);
      p.price = lower + (upper - lower) * (.2 + (seed % 7) * .08);
      const aExports = p.ax / p.ay <= p.bx / p.by;
      const max = aExports ? Math.min(p.laborA / p.ax, p.laborB / p.by / p.price) : Math.min(p.laborB / p.bx, p.laborA / p.ay / p.price);
      p.tradeX = (aExports ? 1 : -1) * max * (.25 + (seed % 4) * .1); break;
    }
    default: throw new Error("复习题模型不可用。");
  }
  const result = runAdvancedLab(id, p), metric = question.model.metric;
  const answer = result.metrics[metric];
  if (typeof answer !== "number" || !Number.isFinite(answer)) throw new Error("新复习情境没有有限答案。");
  const definition = advancedLabDefinitions.find(item => item.id === id)!;
  const label = result.rows.find(row => row.key === metric || row.key.endsWith(`-${metric}`))?.label || metric;
  const parameters = definition.fields.map(field => `${field.label} ${field.key}=${number(p[field.key])}（${field.unit}）`).join("；");
  const matrix = id === "ML07" ? `收益按（玩家1，玩家2）列出：00=(${p.r00},${p.c00})，01=(${p.r01},${p.c01})，10=(${p.r10},${p.c10})，11=(${p.r11},${p.c11})。` : "";
  const formula: Partial<Record<AdvancedLabId, () => string>> = {
    ML04: () => `先求企业 q=max(0,(p−c)/d)=${number(result.metrics.q as number)}；利润=pq−F−cq−dq²/2；市场价=(dA+nc)/(n+dB)，检查需求最高愿付价 A/B>c。`,
    ML05: () => `q0=(A−C)/(B+D)=${number(result.metrics.q0 as number)}，q=max(0,(A−C−τ)/(B+D))=${number(result.metrics.q as number)}。弹性=−Pb/(Bq)，DWL=(B+D)(q0−q)²/2；税收是转移。`,
    ML06: () => `MR=a−2bQ；Qm=(a−c)/(2b)=${number(result.metrics.monopolyQ as number)}，Qc=(a−c)/b=${number(result.metrics.competitiveQ as number)}；DWL=b(Qc−Qm)²/2。数量条件于运营，F 不进入 MR。`,
    ML07: () => "逐列比较玩家1收益、逐行比较玩家2收益；两位玩家同时处于最佳回应的格才是纯策略 Nash 均衡。新矩阵对每位玩家作正仿射收益变换，因此最佳回应和均衡数量保持，但仍须检查四格。",
    ML08: () => `qs=(A−C)/(B+D+e)=${number(result.metrics.socialQ as number)}，纠正税=e·qs=${number(result.metrics.correctiveTax as number)}。税率与总税收不是同一对象；社会基准假设损害准确已知且执行无成本。`,
    ML09: () => `初价=(1−θ)vL+θvH=${number(result.metrics.initialPrice as number)}；按报价≥保留价值接受，拒绝类型退出后重算剩余池。最终报价=${number(result.metrics.finalPrice as number)}，最终高质量参与代码=${result.metrics.highParticipates}，低质量参与代码=${result.metrics.lowParticipates}。这是指定更新规则，不是一般唯一性证明。`,
    ML10: () => `风险：EW=${number(result.metrics.expectedWealth as number)}，EU=${number(result.metrics.expectedUtility as number)}，CE=EU²=${number(result.metrics.certaintyEquivalent as number)}，RP=EW−CE。跨期：W=y1+y2/(1+r)=${number(result.metrics.presentWealth as number)}，自由候选 c1=W/(1+β)，禁借款时另检验 c1≤y1。劳动：闲暇=min(T,α(nonLabor+wage·T)/wage)，劳动=T−闲暇。三个面板相互独立。`,
    ML11: () => `tradeY=price·tradeX=${number(p.price)}×${number(p.tradeX)}=${number(result.metrics.tradeY as number)}；这笔 y 在一方是进口、另一方是出口。双方消费逐项相加等于世界产量，给定交易量处于共同可行上限 ${number(result.metrics.maxTradeX as number)} 内。`,
  };
  return { ...question, model: { labId: id, parameters: p, metric },
    prompt: `synthetic 新情境 · ${definition.title}。沿用本课模型条件，完整参数为：${parameters}。${matrix}求${label}，单位：${question.unit}。${id === "ML10" ? "风险、跨期、劳动面板独立，只求指定指标。" : ""}`,
    answerBasis: `用 ${id} 的同一计算内核与以上参数计算 ${metric}，有效域和假设见本课；不沿用原题数字。`,
    feedback: `${label}=${number(answer)}（${question.unit}）。${formula[id]?.()} 新参数：${shown(p)}。`,
  };
}

/** Deterministic, local review variants. The source question is never mutated. */
export function getReviewVariant(question: Question, variant: number): Question {
  if (!Number.isSafeInteger(variant) || variant < 0) throw new Error("复习情境编号必须为非负安全整数。");
  const seed = variant % 23 + 1;
  if (question.kind === "numeric") return question.calculation === "advanced-lab" ? advancedVariant(question, seed) : basicVariant(question, seed);
  if (question.kind === "choice") {
    const shift = question.options.length > 1 ? seed % (question.options.length - 1) + 1 : 0;
    return { ...question, options: [...question.options.slice(shift), ...question.options.slice(0, shift)].map(option => ({ ...option })) };
  }
  return { ...question, prompt: `${question.prompt}\n\n复习迁移：先独立回答原问题，再为一个相关的新情境指出一项可能失效的假设。参考解释覆盖原问题；新增情境由你对照 rubric 自评。`, rubric: [...question.rubric, "我在一个新情境中说明至少一项模型条件，且没有把模型反事实当作现实证据。"] };
}

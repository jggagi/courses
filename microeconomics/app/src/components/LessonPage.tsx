import { useEffect, useState, type ReactNode } from "react";
import { catalog as lessons, modules, terms as glossary } from "../content/catalog";
import { getNumericAnswer } from "../content/answers";
import type { Lesson, Question } from "../content/types";
import type { LearningState, LessonId } from "../persistence/store";
import { queueReview } from "../persistence/learning-tools";
import { Lab } from "./Lab";
import { AdvancedLab } from "./AdvancedLab";
import { LabHistoryPanel } from "./ExperimentHistory";
import type { AdvancedLabId } from "../models/advanced";
import { Plot, fmt } from "./Charts";
import { budgetGeometry, evaluateBundle } from "../models/economics";
import { downloadText, printCurrentPage } from "../utils/export";

const statusLabels = { not_started: "未开始", in_progress: "学习中", practiced: "已练习", self_checked: "已自评" };
function Paragraphs({ items }: { items: string[] }) {
  return (
    <>
      {items.map((text, i) => (
        <p key={i}>{text}</p>
      ))}
    </>
  );
}
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
export default function LessonPage({
  lesson,
  state,
  save,
  onReset,
}: {
  lesson: Lesson;
  state: LearningState;
  save: (s: LearningState) => void;
  onReset: () => void;
}) {
  const [actionError, setActionError] = useState("");
  const id = lesson.id as LessonId,
    index = lessons.findIndex((l) => l.id === id),
    module = modules.find((m) => m.id === lesson.moduleId)!;
  const objective = lesson.checks.filter((q) => q.kind !== "self-explanation"),
    subjective = lesson.checks.filter((q) => q.kind === "self-explanation");
  const hasPractice = objective.every(
    (q) => state.objectiveAttempts[q.id]?.length,
  );
  const hasSelfCheck = subjective.every((q) =>
    state.selfChecks[q.id]?.answer.trim(),
  );
  const attempt = (qid: string, answer: number | string, correct: boolean) => {
    try {
    const attempts = {
      ...state.objectiveAttempts,
      [qid]: [
        ...(state.objectiveAttempts[qid] || []),
        { answer, correct, at: new Date().toISOString() },
      ],
    };
    const practiced = objective.every((q) => attempts[q.id]?.length);
    const next = correct ? state : queueReview(state, qid, "incorrect", new Date().toISOString());
    save({
      ...next,
      objectiveAttempts: attempts,
      lessonStates: {
        ...state.lessonStates,
        [id]:
          state.lessonStates[id] === "self_checked"
            ? "self_checked"
            : practiced
              ? "practiced"
              : "in_progress",
      },
    });
    setActionError("");
    } catch (error) { setActionError(error instanceof Error ? error.message : "记录未更新，请先导出备份。"); }
  };
  return (
    <article>
      <div className="eyebrow">
        {lesson.id} · {module.title} · {statusLabels[state.lessonStates[id]]}
      </div>
      <h1>{lesson.title}</h1>
      {actionError && <p role="alert">{actionError} 原记录保留；可先在本地记录导出备份。</p>}
      <p className="lead">{lesson.centralQuestion}</p>
      <p className="small">
        前置：
        {lesson.prerequisites.length
          ? lesson.prerequisites.join("、")
          : "无系统经济学前置"}
        。可跳读，难点可以记在下方。
      </p>
      <label className="notes-label">
        开场预测与学习笔记
        <textarea
          aria-label="本节学习笔记"
          value={state.notes[id] || ""}
          maxLength={10000}
          placeholder="先写我的预测、理由和不确定之处；阅读后可以修改。"
          onChange={(e) =>
            save({ ...state, notes: { ...state.notes, [id]: e.target.value } })
          }
        />
      </label>
      <div className="knowledge">
        <div>
          <strong>现在必须理解</strong>
          <Paragraphs items={lesson.knowledge.mustUnderstand} />
        </div>
        <div>
          <strong>本节暂不要求</strong>
          <Paragraphs items={lesson.knowledge.acceptedForNow} />
        </div>
        <div>
          <strong>以后回来</strong>
          <Paragraphs items={lesson.knowledge.returnLater} />
        </div>
      </div>
      <Panel title="对象、定义与假设">
        <div className="concept-index">
          {lesson.definitions.map((term) => (
            <a key={term} href={`#/glossary/${term}`}>
              {glossary.find((g) => g.id === term)?.term}
            </a>
          ))}
        </div>
        <Paragraphs items={lesson.assumptions} />
      </Panel>
      {lesson.sections.map((section) => (
        <div key={section.id}>
          {section.advanced ? (
            <details className="advanced">
              <summary>{section.title} · 按需展开</summary>
              <Paragraphs items={section.paragraphs} />
              {section.formula && (
                <div className="formula">{section.formula}</div>
              )}
            </details>
          ) : (
            <section className="prose">
              <h2>{section.title}</h2>
              <Paragraphs items={section.paragraphs} />
              {section.formula && (
                <div className="formula">{section.formula}</div>
              )}
            </section>
          )}
          {section.id === "experiment" && (
            <>
              <Panel title="用具体数字走一遍">
                <Paragraphs items={lesson.workedExample} />
                {id === "M01-A" && <TimeExample />}
              </Panel>
              {lesson.labId === "ML01" || lesson.labId === "ML02" || lesson.labId === "ML03" ? <Lab
                id={lesson.labId}
                onExplain={() => {
                  const notes = document.querySelector<HTMLTextAreaElement>(
                    'textarea[aria-label="本节学习笔记"]',
                  );
                  notes?.scrollIntoView({ block: "center" });
                  notes?.focus();
                }}
                state={state.labStates[lesson.labId]}
                update={(lab) =>
                  save({
                    ...state,
                    labStates: { ...state.labStates, [lesson.labId]: lab },
                  })
                }
              /> : <AdvancedLab
                id={lesson.labId as AdvancedLabId}
                value={state.advancedLabStates[lesson.labId as AdvancedLabId]}
                onChange={(lab) => save({ ...state, advancedLabStates: { ...state.advancedLabStates, [lesson.labId]: lab } })}
              />}
              <LabHistoryPanel labId={lesson.labId} state={state} save={save} />
            </>
          )}
        </div>
      ))}
      {({ "M03-B": "MX01", "M04-B": "MX02", "M05-B": "MX02", "M08-B": "MX03" } as Record<string, string>)[id] && <Panel title="继续做进阶实验"><p>保留同一模型的 A/B 比较，进一步检验补偿、长期进入或策略支持条件。</p><a href={`#/extensions/${({ "M03-B": "MX01", "M04-B": "MX02", "M05-B": "MX02", "M08-B": "MX03" } as Record<string, string>)[id]}`}>打开对应进阶实验 →</a></Panel>}
      <Panel title="反例与失效边界">
        <Paragraphs items={lesson.counterexample} />
      </Panel>
      <section className="checks">
        <h2>重建与迁移 · 理解检查</h2>
        <p>
          客观题记录尝试，自由解释由你对照参考与 rubric 自评，不使用关键词判卷。
        </p>
        {lesson.checks.map((q) => (
          <Check
            key={q.id}
            question={q}
            state={state}
            attempt={attempt}
            selfCheck={(answer, rating) => {
              try {
              const next = answer.trim() && rating !== "clear" ? queueReview(state, q.id, "uncertain", new Date().toISOString()) : state;
              save({ ...next, selfChecks: { ...state.selfChecks, [q.id]: { answer, rating } } });
              setActionError("");
              } catch (error) { setActionError(error instanceof Error ? error.message : "自评未更新，请先导出备份。"); }
            }}
          />
        ))}
      </section>
      <Panel title="回看与模型卡">
        <Paragraphs items={lesson.recap} />
        <details>
          <summary>
            {module.id} 模型卡 · 对象 / 条件 / 待求 / 关系 / 推导 / 反例
          </summary>
          <p>
            <strong>对象：</strong>
            {module.modelCard.object}
          </p>
          {(
            [
              "known",
              "unknown",
              "relations",
              "derivation",
              "counterexample",
            ] as const
          ).map((key, i) => (
            <div key={key}>
              <h3>{["已知条件", "待求变量", "核心关系", "推导", "反例"][i]}</h3>
              <Paragraphs items={module.modelCard[key]} />
            </div>
          ))}
          <p>
            <strong>仍可追问：</strong>
            {module.modelCard.uncertainty}
          </p>
          <p>把你仍不确定的地方写在本节笔记中；可随时修改。</p>
        </details>
        <label>
          本节概念信心（自报，不是客观成绩）
          <select
            aria-label="概念信心"
            value={state.conceptConfidence[id] ?? ""}
            onChange={(e) =>
              save({
                ...state,
                conceptConfidence: {
                  ...state.conceptConfidence,
                  [id]: e.target.value
                    ? (Number(e.target.value) as 1 | 2 | 3 | 4 | 5)
                    : null,
                },
              })
            }
          >
            <option value="">未填写</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} / 5
              </option>
            ))}
          </select>
        </label>
        <div className="actions">
          <button
            disabled={!hasPractice || !hasSelfCheck}
            onClick={() =>
              save({
                ...state,
                lessonStates: { ...state.lessonStates, [id]: "self_checked" },
              })
            }
          >
            记录本节已自评
          </button>
          <button className="secondary" onClick={() => {
            const card = module.modelCard;
            const text = [lesson.id + " · " + lesson.title, "本节笔记", state.notes[id] || "未填写", "模型卡 · " + module.title, "对象：" + card.object,
              ...(["known", "unknown", "relations", "derivation", "counterexample"] as const).flatMap((key, i) => [["已知条件", "待求变量", "核心关系", "推导", "反例"][i], ...card[key]]), "仍可追问：" + card.uncertainty].join("\n\n");
            downloadText(text, `microeconomics-${id}-notes.txt`);
          }}>导出本节笔记与模型卡</button>
          <button className="secondary" onClick={printCurrentPage}>打印本节与笔记</button>
          <button className="secondary" onClick={onReset}>
            重置本节记录
          </button>
        </div>
        <p className="small">
          导出包含个人笔记，请勿提交公开仓库。“已自评”表示已尝试客观题并留下主观自评，允许仍有疑问；不代表通过或完全掌握。
        </p>
      </Panel>
      <p>
        逐课参考：
        {lesson.references.map((ref) => (
          <a key={ref.id + ref.topic} href="#/references">
            {ref.id} · {ref.topic}；{" "}
          </a>
        ))}
      </p>
      {lesson.id === "M12-B" && <Panel title="把分析变成可审查的终课作品"><p>保存模型、两次反事实、反例和证据边界，导出时与实验参数一起保留。各评价维度独立，不合成掌握率。</p><a className="button" href="#/capstone">编写终课作品 →</a> <a href="#/review">先做跨模块复习</a></Panel>}
      <nav className="lesson-next" aria-label="课程前后导航">
        {index > 0 ? (
          <a href={`#/lesson/${lessons[index - 1].id}`}>
            ← 上一节 {lessons[index - 1].id}
          </a>
        ) : (
          <a href="#/">← 工作台</a>
        )}
        {index < lessons.length - 1 ? (
          <a href={`#/lesson/${lessons[index + 1].id}`}>
            下一节 {lessons[index + 1].id} →
          </a>
        ) : (
          <a href="#/capstone">完成 M12-B · 进入终课作品 →</a>
        )}
      </nav>
    </article>
  );
}
function Check({
  question: q,
  state,
  attempt,
  selfCheck,
}: {
  question: Question;
  state: LearningState;
  attempt: (qid: string, answer: number | string, correct: boolean) => void;
  selfCheck: (
    answer: string,
    rating: "needs_review" | "partial" | "clear",
  ) => void;
}) {
  const last = state.objectiveAttempts[q.id]?.at(-1),
    [answer, setAnswer] = useState(String(last?.answer ?? "")),
    [message, setMessage] = useState("");
  useEffect(() => {
    setAnswer(String(last?.answer ?? ""));
    setMessage("");
  }, [last?.at, last?.answer]);
  const check = state.selfChecks[q.id];
  return (
    <section className="check" aria-label={q.prompt}>
      <h3>{q.prompt}</h3>
      {q.kind === "self-explanation" ? (
        <>
          <label>
            我的解释
            <textarea
              aria-label={q.prompt}
              value={check?.answer || ""}
              maxLength={10000}
              onChange={(e) =>
                selfCheck(e.target.value, check?.rating || "needs_review")
              }
            />
          </label>
          <details>
            <summary>参考解释与自评 rubric</summary>
            <p>{q.referenceAnswer}</p>
            <ul>
              {q.rubric.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p>{q.answerBasis}</p>
          </details>
          <label>
            对照后的自评
            <select
              aria-label={`${q.id} 自评`}
              value={check?.rating || "needs_review"}
              onChange={(e) =>
                selfCheck(
                  check?.answer || "",
                  e.target.value as "needs_review" | "partial" | "clear",
                )
              }
            >
              <option value="needs_review">需要回看</option>
              <option value="partial">部分说清，仍有疑问</option>
              <option value="clear">能说清对象、机制与条件</option>
            </select>
          </label>
          <p className="small">{q.feedback}</p>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (q.kind === "numeric") {
              const n = Number(answer);
              if (!answer.trim() || !Number.isFinite(n)) {
                setMessage("请输入有限数值。");
                return;
              }
              attempt(
                q.id,
                n,
                Math.abs(n - getNumericAnswer(q)) <= q.tolerance,
              );
            } else attempt(q.id, answer, answer === q.answer);
            setMessage("");
          }}
        >
          {q.kind === "choice" ? (
            <fieldset>
              <legend>选择最符合条件的一项</legend>
              {q.options.map((option) => (
                <label className="radio" key={option.id}>
                  <input
                    type="radio"
                    name={q.id}
                    value={option.id}
                    checked={answer === option.id}
                    onChange={() => setAnswer(option.id)}
                  />
                  {option.text}
                </label>
              ))}
            </fieldset>
          ) : (
            <label>
              数值答案（{q.unit}，绝对容差 {q.tolerance}）
              <input
                aria-label={q.prompt}
                type="number"
                step="any"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
              />
            </label>
          )}
          <button disabled={!answer} type="submit">
            检查答案
          </button>
          {message && <p role="alert">{message}</p>}
          {last && (
            <div className="feedback" role="status">
              <strong>
                {last.correct ? "本次答案符合模型。" : "本次答案需要修正。"}
              </strong>
              <p>
                {q.kind === "choice"
                  ? q.options.find((o) => o.id === last.answer)?.feedback
                  : q.feedback}
              </p>
              <p>
                {q.answerBasis}
                {q.kind === "numeric" &&
                  `；同一计算内核给出的参考值：${fmt(getNumericAnswer(q))} ${q.unit}。`}
              </p>
              <small>
                已记录 {state.objectiveAttempts[q.id].length} 次客观尝试。
              </small>
            </div>
          )}
        </form>
      )}
    </section>
  );
}

function TimeExample() {
  const budget = { m: 6, px: 1, py: 1 },
    points = [
      { x: 2, y: 4 },
      { x: 2, y: 3 },
      { x: 3, y: 4 },
    ];
  return (
    <>
      <Plot
        title="六小时日程的可行集：货币模型之前，先核对时间单位"
        legend="none"
        curves={[
          {
            points: budgetGeometry(budget).vertices,
            label: "时间约束",
            color: "#1a7965",
            fill: true,
          },
        ]}
        xMax={7}
        yMax={7}
        xLabel="阅读 x（小时）"
        yLabel="制作 y（小时）"
      />
      <table>
        <caption>时间例子的数字检查，与预算模型使用同一可行性内核</caption>
        <thead>
          <tr>
            <th>日程(x,y)</th>
            <th>用时</th>
            <th>剩余</th>
            <th>可行？</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => {
            const r = evaluateBundle(budget, point);
            return (
              <tr key={point.x + "," + point.y}>
                <th>
                  ({point.x}, {point.y})
                </th>
                <td>{fmt(r.spending)} 小时</td>
                <td>{fmt(r.balance)} 小时</td>
                <td>{r.feasible ? "可行" : "不可行"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="small">
        下方 ML01 切换到货币预算；关系结构相同，但商品单位与小时不要混相加。
      </p>
    </>
  );
}

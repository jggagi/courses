import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { lessonCatalog as lessons, loadLesson } from "./content/catalog";
import { terms } from "./content/terms";
import { sources } from "./content/sources";
import Formula from "./components/Formula";
import { deriveLessonStatus } from "./persistence/progress";
import { assessObjective } from "./persistence/review";
import { readRoute } from "./routing";
import type { Check, Lesson } from "./content/types";
const Labs = lazy(() => import("./components/Labs"));
const AdvancedLabs = lazy(() => import("./components/AdvancedLabs"));
const Capstone = lazy(() => import("./components/Capstone"));
const Review = lazy(() => import("./components/Review"));
import {
  labNames,
  ADVANCED_LAB_IDS,
  type AdvancedLabId,
} from "./models/advanced";
import {
  loadState,
  saveState,
  initialState,
  importState,
  exportState,
  clearState,
  STORAGE_KEY,
  MAX_IMPORT_BYTES,
} from "./persistence";
import type { LearningState } from "./persistence";

const storage = {
  getItem: (key: string) => window.localStorage.getItem(key),
  setItem: (key: string, value: string) =>
    window.localStorage.setItem(key, value),
  removeItem: (key: string) => window.localStorage.removeItem(key),
};
const statuses = {
  not_started: "未开始",
  in_progress: "学习中",
  practiced: "已练习",
  self_checked: "已自评",
};
const stamp = () => new Date().toISOString();
function route() {
  return readRoute(window.location.hash);
}
function download(text: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function Question({
  check,
  lesson,
  state,
  change,
}: {
  check: Check;
  lesson: Lesson;
  state: LearningState;
  change: (next: LearningState) => void;
}) {
  const key = `response:${check.id}`;
  const answer = state.notes[key] || "";
  const attempts = state.objectiveAttempts.filter(
    (a) => a.checkId === check.id && a.lessonId === lesson.id,
  );
  const last = attempts.at(-1);
  const [feedback, setFeedback] = useState("");
  const write = (text: string) => {
    setFeedback("");
    const next = {
      ...state,
      notes: { ...state.notes, [key]: text },
      selfChecks: { ...state.selfChecks, [check.id]: false },
    };
    change({
      ...next,
      lessonStates: {
        ...next.lessonStates,
        [lesson.id]: {
          ...next.lessonStates[lesson.id],
          status: deriveLessonStatus(lesson, next),
        },
      },
    });
  };
  const objective = check.kind === "numeric" || check.kind === "choice";
  function submit() {
    const assessment = assessObjective(check, answer);
    if (assessment.status === "unavailable") {
      setFeedback(assessment.feedback);
      return;
    }
    const correct = assessment.status === "correct";
    setFeedback("");
    const next = {
      ...state,
      objectiveAttempts: [
        ...state.objectiveAttempts,
        {
          lessonId: lesson.id,
          checkId: check.id,
          answer,
          correct,
          at: stamp(),
        },
      ].slice(-1000),
    };
    change({
      ...next,
      lessonStates: {
        ...next.lessonStates,
        [lesson.id]: {
          ...next.lessonStates[lesson.id],
          status: deriveLessonStatus(lesson, next),
        },
      },
    });
  }
  useEffect(() => {
    if (!last) setFeedback("");
  }, [last]);
  function selfCheck(checked: boolean) {
    const selfChecks = { ...state.selfChecks, [check.id]: checked };
    const next = { ...state, selfChecks };
    change({
      ...next,
      lessonStates: {
        ...next.lessonStates,
        [lesson.id]: {
          ...next.lessonStates[lesson.id],
          status: deriveLessonStatus(lesson, next),
        },
      },
    });
  }
  return (
    <article
      id={`check-${check.id}`}
      tabIndex={-1}
      className="question panel"
      data-testid={`check-${check.id}`}
    >
      <p className="eyebrow">
        {check.kind === "numeric"
          ? "数值核对"
          : check.kind === "choice"
            ? "辨认误解"
            : check.kind === "transfer"
              ? "反例与迁移"
              : "解释与重建"}
      </p>
      <h3>{check.prompt}</h3>
      {check.kind === "numeric" ? (
        <>
          <label>
            数值答案（{check.unit}；容差 ±{check.tolerance}）
            <input
              aria-label={`${check.id} 数值答案`}
              type="number"
              step="any"
              value={answer}
              onChange={(e) => write(e.target.value)}
            />
          </label>
        </>
      ) : check.kind === "choice" ? (
        <fieldset>
          <legend>选择一个解释</legend>
          {check.options?.map((o, i) => (
            <label className="choice" key={i}>
              <input
                type="radio"
                name={check.id}
                checked={answer === String(i)}
                onChange={() => write(String(i))}
              />
              {o.label}
            </label>
          ))}
        </fieldset>
      ) : (
        <label>
          用自己的话解释（只在本机保存）
          <textarea
            aria-label={`${check.id} 我的解释`}
            value={answer}
            onChange={(e) => write(e.target.value)}
            maxLength={10000}
          />
        </label>
      )}
      {objective ? (
        <>
          <button onClick={submit}>提交检查</button>
          <p aria-live="polite">
            {feedback ||
              (last
                ? (() => {
                    const assessment = assessObjective(check, last.answer);
                    const detail = `${check.kind === "numeric" && assessment.status === "incorrect" ? "请重算：" : ""}${assessment.feedback}`;
                    return `${last.answer !== answer ? "上次提交：" : ""}${detail}`;
                  })()
                : "")}
          </p>
        </>
      ) : (
        <>
          <details>
            <summary>参考解释与自评标准</summary>
            <p>{check.answer}</p>
            <ul>
              {check.rubric.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </details>
          <label className="choice">
            <input
              type="checkbox"
              checked={!!state.selfChecks[check.id]}
              onChange={(e) => selfCheck(e.target.checked)}
            />
            对照标准后，我已自行检查这段解释
          </label>
          <p className="muted">自由回答由你自评；应用不会自动判定理解程度。</p>
        </>
      )}
    </article>
  );
}

export default function App() {
  const [loaded] = useState(() => loadState(storage));
  const [state, setState] = useState<LearningState>(loaded.state);
  const [protectedRecord, setProtectedRecord] = useState(loaded.protected);
  const [notice, setNotice] = useState(loaded.notice || "");
  const [current, setCurrent] = useState(route);
  const [message, setMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [lesson, setLesson] = useState<Lesson>();
  const [lessonError, setLessonError] = useState("");
  const lessonId = current.startsWith("lesson/")
    ? current.split("/")[1]
    : undefined;
  useEffect(() => {
    let live = true;
    setLesson(undefined);
    setLessonError("");
    if (lessonId && lessons.some((item) => item.id === lessonId)) {
      loadLesson(lessonId)
        .then((value) => {
          if (live) setLesson(value);
        })
        .catch(() => {
          if (live) setLessonError("课程暂时未能加载，请重新载入页面。");
        });
    }
    return () => {
      live = false;
    };
  }, [lessonId]);
  useEffect(() => {
    if (lessonId && !lesson) return;
    const parts = current.split("/");
    const target =
      parts[2] === "check"
        ? document.getElementById(`check-${parts[3]}`)
        : parts[2] === "card"
          ? document.getElementById(`card-${lesson?.moduleId}`)
          : null;
    if (target instanceof HTMLDetailsElement) target.open = true;
    if (target) {
      target.focus();
      target.scrollIntoView({ block: "start" });
    }
  }, [current, lesson]);
  useEffect(() => {
    const onHash = () => {
      setCurrent(route());
      setMenuOpen(false);
      window.scrollTo(0, 0);
      document.getElementById("main")?.focus({ preventScroll: true });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    if (protectedRecord) return;
    const result = saveState(storage, state);
    setNotice(
      result.ok
        ? ""
        : result.notice || "当前使用内存，刷新后可能丢失，请导出。",
    );
  }, [state, protectedRecord]);
  const change = (next: LearningState) =>
    setState({ ...next, updatedAt: stamp() });
  useEffect(() => {
    if (lesson)
      setState((s) =>
        s.lastLessonId === lesson.id
          ? s
          : { ...s, lastLessonId: lesson.id, updatedAt: stamp() },
      );
  }, [lesson?.id]);
  const labId = current.startsWith("lab/") ? current.slice(4) : null;
  const started = Object.values(state.lessonStates).filter(
    (s) => s.status !== "not_started",
  ).length;
  function resetLesson(l: Lesson) {
    if (
      !confirm(
        "重置本课的预测、回答、笔记、信心和练习记录？实验与模块模型卡会保留。",
      )
    )
      return;
    const notes = { ...state.notes };
    delete notes[`prediction:${l.id}`];
    delete notes[`note:${l.id}`];
    for (const c of l.checks) delete notes[`response:${c.id}`];
    const selfChecks = { ...state.selfChecks };
    for (const c of l.checks) delete selfChecks[c.id];
    change({
      ...state,
      notes,
      selfChecks,
      objectiveAttempts: state.objectiveAttempts.filter(
        (a) => a.lessonId !== l.id,
      ),
      lessonStates: {
        ...state.lessonStates,
        [l.id]: { status: "not_started", confidence: 0 },
      },
    });
  }
  function clear() {
    if (
      !confirm(
        "清空本课程全部个人记录？包括笔记、预测、练习、模型卡和实验。只清除宏观课程，建议先导出。",
      )
    )
      return;
    const cleared = clearState(storage);
    const next = initialState();
    const saved = saveState(storage, next);
    setProtectedRecord(!cleared.ok && protectedRecord);
    change(next);
    setNotice(saved.notice);
    setMessage(
      saved.ok
        ? "宏观课程记录已清空。"
        : "当前页面记录已清空；浏览器记录未能更新，请查看存储提示。",
    );
  }
  async function restore(file?: File) {
    if (!file) return;
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error("文件过大，拒绝导入。");
      const next = importState(await file.text());
      if (!confirm("导入将替换本课程当前个人记录，是否继续？")) return;
      const cleared = clearState(storage);
      const saved = saveState(storage, next);
      setProtectedRecord(!cleared.ok && protectedRecord);
      change(next);
      setNotice(saved.notice);
      setMessage(
        saved.ok
          ? "导入成功，已校验课程、结构与模型输入。"
          : "已在当前页面导入；浏览器记录未能更新，请查看存储提示。",
      );
    } catch (e) {
      setMessage(
        `导入失败：${e instanceof Error ? e.message : "无法读取文件"}`,
      );
    }
  }
  const writeNote = (key: string, value: string) => {
    const next = {
      ...state,
      notes: { ...state.notes, [key]: value },
      selfChecks: key.startsWith("card:")
        ? { ...state.selfChecks, [`review:card:${key.split(":")[1]}`]: false }
        : state.selfChecks,
    };
    if (
      lesson &&
      (key === `note:${lesson.id}` || key === `prediction:${lesson.id}`)
    ) {
      next.lessonStates = {
        ...next.lessonStates,
        [lesson.id]: {
          ...next.lessonStates[lesson.id],
          status: deriveLessonStatus(lesson, next),
        },
      };
    }
    change(next);
  };
  function exportRecords() {
    try {
      download(exportState(state), "macroeconomics-private-learning.json");
    } catch (error) {
      setMessage(
        `无法导出：${error instanceof Error ? error.message : "请先修正实验输入。"}`,
      );
    }
  }
  return (
    <div className="workspace">
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main")?.focus();
          document.getElementById("main")?.scrollIntoView();
        }}
      >
        跳到学习正文
      </a>
      <aside className="sidebar">
        <a href="#/home" className="brand">
          <span className="brand-symbol">∑</span>
          <span>
            经济学学习工作台<small>MACROECONOMICS · 12 MODULES</small>
          </span>
        </a>
        <button
          className="menu-toggle secondary"
          aria-expanded={menuOpen}
          aria-controls="course-navigation"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          课程与实验目录
        </button>
        <div id="course-navigation" data-open={menuOpen}>
          <p className="sidebar-intro">先把世界看清，再写公式。</p>
          <nav aria-label="课程目录">
            <p className="eyebrow">完整课程 · 24节可学课程</p>
            {lessons.map((l) => (
              <a
                aria-current={lesson?.id === l.id ? "page" : undefined}
                key={l.id}
                href={`#/lesson/${l.id}`}
                className="lesson-link"
              >
                <span className="lesson-id">{l.id}</span>
                <span>
                  {l.title}
                  <small>
                    {
                      statuses[
                        state.lessonStates[l.id]?.status || "not_started"
                      ]
                    }
                  </small>
                </span>
              </a>
            ))}
          </nav>
          <nav aria-label="实验目录" className="lab-nav">
            <p className="eyebrow">可复现实验</p>
            {(["LA01", "LA02", "LA03", ...ADVANCED_LAB_IDS] as const).map(
              (id, i) => (
                <a
                  key={id}
                  href={`#/lab/${id}`}
                  aria-current={labId === id ? "page" : undefined}
                >
                  {id} · {labNames[i]}
                </a>
              ),
            )}
          </nav>
          <details className="concept-nav">
            <summary>概念导航 · {terms.length} 个词条</summary>
            {terms.map((t) => (
              <a key={t.id} href={`#/term/${t.id}`}>
                {t.name}
              </a>
            ))}
          </details>
          <a href="#/review" className="records-link">
            复习 · 错题、迁移与模型卡
          </a>
          <a href="#/capstone" className="records-link">
            终课作品 · 宏观诊断
          </a>
          <a href="#/records" className="records-link">
            个人记录与导入 / 导出
          </a>
          <a href="#/sources" className="records-link">
            参考来源与数据说明
          </a>
          <p className="privacy">
            仅本机保存 · 无账号 · 无遥测
            <br />
            教学合成数据 synthetic
          </p>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>宏观经济学</span>
          <span>24 节课程 · 9 个实验</span>
        </header>
        {notice && (
          <div role="alert" className="notice">
            <p>{notice}</p>
            {protectedRecord && (
              <>
                <p>原始记录已保护。本次修改暂不覆盖原记录。</p>
                <button
                  onClick={() => {
                    try {
                      download(
                        storage.getItem(STORAGE_KEY) || "",
                        "macroeconomics-damaged-record.json",
                      );
                    } catch {
                      setMessage("无法读取原始记录。");
                    }
                  }}
                >
                  下载原始记录
                </button>
                <button
                  onClick={() => {
                    if (
                      confirm(
                        "放弃损坏记录并开始新记录？此操作只删除本课程的存储键。",
                      )
                    ) {
                      clearState(storage);
                      setProtectedRecord(false);
                      setNotice("");
                      change(state);
                    }
                  }}
                >
                  放弃损坏记录并恢复保存
                </button>
              </>
            )}
          </div>
        )}
        <main id="main" tabIndex={-1}>
          <RouteBoundary key={current}>
            <Suspense fallback={<p role="status">正在加载学习内容…</p>}>
              {lessonId &&
                !lesson &&
                lessons.some((item) => item.id === lessonId) && (
                  <p role="status">
                    {lessonError || "正在加载本模块课程…"}
                    {lessonError && (
                      <button onClick={() => window.location.reload()}>
                        重新载入
                      </button>
                    )}
                  </p>
                )}
              {current === "home" && (
                <>
                  <p className="eyebrow">完整课程 / 01—12</p>
                  <h1>
                    从一笔交易，
                    <br />
                    读懂一个经济体。
                  </h1>
                  <p className="lead">
                    从收入、账本与测量开始，理解增长、需求、通胀、银行、财政与开放经济。用九个可复现实验比较机制与反例，最后写一份有证据和不确定性清单的宏观诊断。
                  </p>
                  <div className="button-row">
                    <a
                      className="button"
                      href={`#/lesson/${state.lastLessonId}`}
                    >
                      {started ? "继续学习" : "从 A01-A 开始"}
                    </a>
                    <a className="button secondary" href="#/lab/LA01">
                      打开交易账本
                    </a>
                  </div>
                  <div className="overview grid">
                    {[
                      ["01", "对象与账本", "A01 · 存量、流量、资产与负债"],
                      ["02", "同一生产的三侧", "A02 · 增加值与国民核算"],
                      ["03", "价格和数量分开", "A03 · 实际产出与价格指数"],
                      ["04", "增长与资本积累", "A04 · 稳态与过渡动态"],
                      ["05", "技术、人口与分配", "A05 · 生产率与受益机制"],
                      ["06", "支出与收入反馈", "A06 · 需求、存货与乘数"],
                      ["07", "就业、通胀与预期", "A07 · 劳动口径与冲击"],
                      ["08", "银行与货币政策", "A08 · 信贷、支付与传导"],
                      ["09", "财政与公共债务", "A09 · 赤字、利息与债务率"],
                      ["10", "开放经济与汇率", "A10 · 经常账户与外部资产"],
                      ["11", "危机与金融反馈", "A11 · 杠杆、流动性与偿付"],
                      ["12", "证据与宏观诊断", "A12 · 模型比较与终课作品"],
                    ].map(([n, t, d]) => (
                      <a
                        className="panel module-card"
                        key={n}
                        href={`#/lesson/A${n}-A`}
                      >
                        <span className="module-number">{n}</span>
                        <h2>{t}</h2>
                        <p>{d}</p>
                      </a>
                    ))}
                  </div>
                  <section className="panel">
                    <h2>你在这里留下的是学习证据</h2>
                    <p>
                      先写预测，再改变一个因素，比较结果并解释原因。客观题尝试与主观自评分开记录；阅读和点击下一节不会自动变成“掌握”。可以跳读，也可以带着明确的问题继续。
                    </p>
                    <p>{started} 节有学习记录；这不是掌握率。</p>
                  </section>
                  <section className="panel">
                    <h2>把模型带到新问题</h2>
                    <p>
                      完成24节课程后，比较至少两个模型，复算名义—实际与账表，做一次参数敏感性检验，再写出支持、反对和仍不知道的证据。
                    </p>
                    <a className="button secondary" href="#/capstone">
                      打开终课作品工作台
                    </a>
                  </section>
                </>
              )}
              {lesson && (
                <>
                  <p className="eyebrow">
                    {lesson.id} / {lesson.modelTypeTags.join(" · ")}
                  </p>
                  <h1>{lesson.title}</h1>
                  <p className="lead">{lesson.centralQuestion}</p>
                  <div className="knowledge grid">
                    <p>
                      <strong>现在必须理解</strong>
                      {lesson.recap.must}
                    </p>
                    <p>
                      <strong>本节暂不要求</strong>
                      {lesson.recap.later}
                    </p>
                    <p>
                      <strong>以后在哪里回来</strong>
                      {lesson.recap.returnAt}
                    </p>
                  </div>
                  <section className="panel prediction">
                    <h2>先预测，写下理由和不确定之处</h2>
                    <label>
                      我的开场预测
                      <textarea
                        aria-label="我的开场预测"
                        value={state.notes[`prediction:${lesson.id}`] || ""}
                        onChange={(e) =>
                          writeNote(`prediction:${lesson.id}`, e.target.value)
                        }
                        maxLength={10000}
                      />
                    </label>
                    <button
                      onClick={() => {
                        change({
                          ...state,
                          lessonStates: {
                            ...state.lessonStates,
                            [lesson.id]: {
                              ...state.lessonStates[lesson.id],
                              status: deriveLessonStatus(lesson, {
                                ...state,
                                lessonStates: {
                                  ...state.lessonStates,
                                  [lesson.id]: {
                                    ...state.lessonStates[lesson.id],
                                    status: "in_progress",
                                  },
                                },
                              }),
                            },
                          },
                        });
                        setMessage("开场预测已记录。");
                      }}
                    >
                      保存开场预测
                    </button>
                    <p className="muted">也可继续阅读，预测并不锁住课程。</p>
                  </section>
                  <p className="muted">
                    前置：{lesson.prerequisites.join("、")}。模型假设：
                    {lesson.assumptions.join("；")}。
                  </p>
                  <article className="lesson-body">
                    {lesson.sections.map((s, i) =>
                      s.advanced ? (
                        <details key={i}>
                          <summary>{s.title}</summary>
                          {s.paragraphs.map((p, j) => (
                            <p key={j}>{p}</p>
                          ))}
                          {s.formula && <Formula text={s.formula} />}
                        </details>
                      ) : (
                        <section key={i}>
                          <h2>{s.title}</h2>
                          {s.tag && <span className="tag">{s.tag}</span>}
                          {s.paragraphs.map((p, j) => (
                            <p key={j}>{p}</p>
                          ))}
                          {s.formula && <Formula text={s.formula} />}
                        </section>
                      ),
                    )}
                  </article>
                  <section className="panel">
                    <h2>走一遍具体例子</h2>
                    <p>{lesson.workedExample}</p>
                    <h3>反例与边界</h3>
                    <p>{lesson.counterexample}</p>
                    <a className="button" href={`#/lab/${lesson.labId}`}>
                      打开 {lesson.labId}，先预测再实验
                    </a>
                  </section>
                  <section>
                    <h2>理解检查</h2>
                    {lesson.checks.map((c) => (
                      <Question
                        key={c.id}
                        check={c}
                        lesson={lesson}
                        state={state}
                        change={change}
                      />
                    ))}
                  </section>
                  <section className="panel">
                    <h2>本课笔记与概念信心</h2>
                    <label>
                      学习笔记
                      <textarea
                        aria-label="学习笔记"
                        value={state.notes[`note:${lesson.id}`] || ""}
                        onChange={(e) =>
                          writeNote(`note:${lesson.id}`, e.target.value)
                        }
                        maxLength={10000}
                      />
                    </label>
                    <label>
                      我的概念信心（与客观题记录分开）
                      <select
                        value={state.lessonStates[lesson.id]?.confidence || 0}
                        onChange={(e) =>
                          change({
                            ...state,
                            lessonStates: {
                              ...state.lessonStates,
                              [lesson.id]: {
                                ...state.lessonStates[lesson.id],
                                confidence: Number(e.target.value),
                              },
                            },
                          })
                        }
                      >
                        <option value="0">尚未自评</option>
                        <option value="1">仍不确定</option>
                        <option value="2">能解释部分机制</option>
                        <option value="3">能重建并指出边界</option>
                        <option value="4">能迁移到新情景并核对证据</option>
                        <option value="5">很有信心，仍保留可修正意见</option>
                      </select>
                    </label>
                    <button
                      className="secondary"
                      onClick={() => resetLesson(lesson)}
                    >
                      重置本课进度
                    </button>
                  </section>
                  <ModelCard
                    moduleId={lesson.moduleId}
                    state={state}
                    write={writeNote}
                  />
                  <section>
                    <h2>本课概念</h2>
                    <div className="terms">
                      {lesson.definitions.map((id) => {
                        const t = terms.find((t) => t.id === id);
                        return (
                          t && (
                            <details key={id}>
                              <summary>{t.name}</summary>
                              <p>{t.definition}</p>
                              <a href={`#/term/${id}`}>词条与来源</a>
                            </details>
                          )
                        );
                      })}
                    </div>
                    <References ids={lesson.references} />
                  </section>
                  <div className="button-row">
                    {lessons.findIndex((l) => l.id === lesson.id) <
                      lessons.length - 1 && (
                      <a
                        className="button secondary"
                        href={`#/lesson/${lessons[lessons.findIndex((l) => l.id === lesson.id) + 1].id}`}
                      >
                        继续下一节（不会自动标记掌握）
                      </a>
                    )}
                    <a href="#/home">回课程目录</a>
                  </div>
                </>
              )}
              {labId &&
                (["LA01", "LA02", "LA03"].includes(labId) ? (
                  <>
                    <p className="eyebrow">可控实验 / {labId}</p>
                    <h1>
                      {labId} ·{" "}
                      {
                        [
                          "交易、存量与资产负债表",
                          "GDP 三种视角",
                          "价格、数量与指数",
                        ][["LA01", "LA02", "LA03"].indexOf(labId)]
                      }
                    </h1>
                    <Labs
                      id={labId as "LA01" | "LA02" | "LA03"}
                      state={state.labStates}
                      onChange={(labStates) => change({ ...state, labStates })}
                    />
                    <a
                      href={`#/lesson/${lessons.find((l) => l.labId === labId)?.id}`}
                    >
                      返回对应课程
                    </a>
                  </>
                ) : ADVANCED_LAB_IDS.includes(labId as AdvancedLabId) ? (
                  <>
                    <p className="eyebrow">可控实验 / {labId}</p>
                    <h1>
                      {labId} · {labNames[Number(labId.slice(2)) - 1]}
                    </h1>
                    <AdvancedLabs
                      key={labId}
                      id={labId as AdvancedLabId}
                      state={state.labStates}
                      onChange={(labStates) => change({ ...state, labStates })}
                    />
                    <a
                      href={`#/lesson/${lessons.find((l) => l.labId === labId)?.id}`}
                    >
                      返回对应课程
                    </a>
                  </>
                ) : (
                  <p>
                    实验不存在。<a href="#/home">返回目录</a>
                  </p>
                ))}
              {current === "review" && <Review state={state} change={change} />}
              {current === "capstone" && (
                <Capstone
                  value={state.capstone}
                  onChange={(capstone) => change({ ...state, capstone })}
                />
              )}
              {current.startsWith("term/") &&
                (() => {
                  const term = terms.find((t) => t.id === current.slice(5));
                  return term ? (
                    <>
                      <p className="eyebrow">局部概念导航</p>
                      <h1>{term.name}</h1>
                      <p className="lead">{term.definition}</p>
                      <a className="button" href={`#/lesson/${term.lessonId}`}>
                        回到 {term.lessonId} 的对象与推导
                      </a>
                      <References ids={term.references} />
                    </>
                  ) : (
                    <p>
                      未找到词条。<a href="#/home">返回目录</a>
                    </p>
                  );
                })()}
              {current === "sources" && (
                <>
                  <h1>参考来源与数据说明</h1>
                  <p className="lead">
                    全部实验数据为确定性教学合成数据
                    synthetic，以第0期起的合成时期表示。默认一步为一期，价格实验一步为一年；无季调、年化或真实经济体校准。
                  </p>
                  <p>
                    原创文案、题目与 SVG；外链只在你主动打开时访问。LA01
                    的准备金发行方在边界之外；LA02 不模拟行为响应；LA03
                    为固定基年与固定篮子演示，不复现官方链式与质量调整方法。LA04–LA09分别建模增长、支出、滞后政策、银行事件、债务与开放经济；这些简化机制没有现实校准，也不是政策或投资预测。
                  </p>
                  <References ids={sources.map((s) => s.id)} />
                </>
              )}
              {current === "records" && (
                <>
                  <h1>个人学习记录</h1>
                  <p className="lead">
                    保存预测、笔记、练习尝试、自评和实验原始输入。只在当前浏览器保存，没有后台或自动上传。
                  </p>
                  <p>导出的 JSON 含私人笔记，请保管好，不要提交公开仓库。</p>
                  <div className="button-row">
                    <button onClick={exportRecords}>导出本课 JSON</button>
                    <label className="button secondary import-label">
                      导入本课 JSON
                      <input
                        aria-label="导入本课 JSON"
                        type="file"
                        accept="application/json,.json"
                        onChange={(e) => {
                          void restore(e.target.files?.[0]);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <button className="danger" onClick={clear}>
                      清空本课全部记录
                    </button>
                  </div>
                  <h2>学习证据</h2>
                  <div
                    className="table-scroll"
                    tabIndex={0}
                    role="region"
                    aria-label="学习证据数字表，可横向滚动"
                  >
                    <table>
                      <thead>
                        <tr>
                          <th scope="col">课程</th>
                          <th scope="col">学习状态</th>
                          <th scope="col">客观题尝试</th>
                          <th scope="col">主观自评</th>
                          <th scope="col">信心</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lessons.map((l) => (
                          <tr key={l.id}>
                            <th scope="col">
                              <a href={`#/lesson/${l.id}`}>{l.id}</a>
                            </th>
                            <td>
                              {
                                statuses[
                                  state.lessonStates[l.id]?.status ||
                                    "not_started"
                                ]
                              }
                            </td>
                            <td>
                              {
                                state.objectiveAttempts.filter(
                                  (a) => a.lessonId === l.id,
                                ).length
                              }
                            </td>
                            <td>
                              {
                                l.subjectiveCheckIds.filter(
                                  (id) => state.selfChecks[id],
                                ).length
                              }
                            </td>
                            <td>
                              {state.lessonStates[l.id]?.confidence || "未自评"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="muted">
                    这些是你做过的操作与自评，不合成为科学掌握率。导入会重新验证账本、活动和价格表，拒绝另一门课、未知版本或非法模型数据。
                  </p>
                </>
              )}
              {!lesson &&
                !labId &&
                !["home", "records", "sources", "capstone", "review"].includes(
                  current,
                ) &&
                !(lessonId && lessons.some((item) => item.id === lessonId)) &&
                !current.startsWith("term/") && (
                  <p>
                    此页面不存在或尚未实现。<a href="#/home">回到目录</a>
                  </p>
                )}
            </Suspense>
          </RouteBoundary>
        </main>
        <footer>
          宏观经济学完整课程 · 对象 → 预测 → 实验 → 解释 → 反例 → 学习记录
        </footer>
        <div
          role="status"
          aria-live="polite"
          className={`toast ${message ? "visible" : ""}`}
        >
          {message}
          {message && (
            <button aria-label="关闭提示" onClick={() => setMessage("")}>
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function References({ ids }: { ids: string[] }) {
  return (
    <section className="references">
      <h2>来源与继续阅读</h2>
      {ids.map((id) => {
        const s = sources.find((s) => s.id === id);
        return (
          s && (
            <p key={id}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {id} · {s.title}
              </a>
              <small>{s.note}</small>
            </p>
          )
        );
      })}
    </section>
  );
}
function ModelCard({
  moduleId,
  state,
  write,
}: {
  moduleId: string;
  state: LearningState;
  write: (k: string, v: string) => void;
}) {
  return (
    <details className="panel" id={`card-${moduleId}`} tabIndex={-1}>
      <summary>{moduleId} 模型卡 · 不看原文，重建一次</summary>
      <p>同一模块的两节课共用这张本地模型卡，记录你仍不确定的地方。</p>
      {[
        "研究对象",
        "已知条件",
        "待求变量",
        "核心关系",
        "推导",
        "反例",
        "我仍不确定的地方",
      ].map((label) => (
        <label key={label}>
          {label}
          <textarea
            aria-label={`${moduleId} 模型卡 ${label}`}
            maxLength={10000}
            value={state.notes[`card:${moduleId}:${label}`] || ""}
            onChange={(e) => write(`card:${moduleId}:${label}`, e.target.value)}
          />
        </label>
      ))}
    </details>
  );
}

class RouteBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <section role="alert">
        <h1>此页面暂时未能加载</h1>
        <p>当前学习记录仍在本机。请重新载入页面。</p>
        <button onClick={() => window.location.reload()}>重新载入</button>
      </section>
    ) : (
      this.props.children
    );
  }
}

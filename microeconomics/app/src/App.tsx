import { useEffect, useState, type ReactNode } from "react";
import {
  lessons,
  catalog,
  modules,
  glossary,
  references,
  getLesson,
  getNumericAnswer,
  type Lesson,
  type Question,
} from "./content";
import {
  createLearningStore,
  MAX_IMPORT_BYTES,
  type LearningState,
  type LessonId,
  type StoreResult,
} from "./persistence/store";
import { Lab } from "./components/Lab";
import { AdvancedLab } from "./components/AdvancedLab";
import { CapstonePage, ReviewPage } from "./components/CourseCompletion";
import type { AdvancedLabId } from "./models/advanced";
import { Plot, fmt } from "./components/Charts";
import { budgetGeometry, evaluateBundle } from "./models/economics";

const store = createLearningStore();
const statusLabels = {
  not_started: "未开始",
  in_progress: "学习中",
  practiced: "已练习",
  self_checked: "已自评",
};
function download(text: string, filename: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
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
export default function App() {
  const [record, setRecord] = useState<StoreResult>(() => store.load());
  const [route, setRoute] = useState(() => location.hash.slice(1) || "/");
  const [dialog, setDialog] = useState<"all" | "lesson" | null>(null);
  const [error, setError] = useState("");
  const state = record.state;
  const save = (next: LearningState) => {
    const result = store.save(next);
    setRecord(result);
    if (!result.ok) setError(result.error || "记录未保存。");
  };
  useEffect(() => {
    const onHash = () => {
      setRoute(location.hash.slice(1) || "/");
      window.scrollTo(0, 0);
    };
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);
  const lesson = route.startsWith("/lesson/")
    ? getLesson(route.split("/")[2])
    : undefined;
  useEffect(() => {
    if (!lesson) return;
    const latest = store.load().state,
      id = lesson.id as LessonId;
    if (latest.lastLessonId !== id || latest.lessonStates[id] === "not_started")
      save({
        ...latest,
        lastLessonId: id,
        lessonStates: {
          ...latest.lessonStates,
          [id]:
            latest.lessonStates[id] === "not_started"
              ? "in_progress"
              : latest.lessonStates[id],
        },
      });
  }, [lesson?.id]);
  const importFile = async (file?: File) => {
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setError("文件超出 1 MiB 限制；记录未覆盖。");
      return;
    }
    try {
      const result = store.importJson(await file.text());
      if (result.ok) {
        setRecord(result);
        setError("已导入本课记录。");
      } else setError(result.error || "导入失败，记录未覆盖。");
    } catch {
      setError("无法读取文件，记录未覆盖。");
    }
  };
  return (
    <div className="workbench">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        跳到正文
      </a>
      <header>
        <a className="brand" href="#/">
          微观经济学<span>从选择，到市场与制度</span>
        </a>
        <nav aria-label="工具导航">
          <a href="#/glossary">概念词条</a>
          <a href="#/references">参考资料</a>
          <a href="#/review">跨模块复习</a>
          <a href="#/capstone">终课作品</a>
          <a href="#/records">本地记录</a>
        </nav>
      </header>
      <aside aria-label="课程目录">
        <a className="course-home" href="#/">
          学习工作台 · 完整课程
        </a>
        <p className="small">
          24 节课程 / 11 个可复现实验
          <br />
          无强制解锁，允许跳读
        </p>
        {modules.map((module) => (
          <details
            key={module.id}
            open={module.id === lesson?.moduleId || ["M01", "M02", "M03"].includes(module.id)}
          >
            <summary>
              {module.id} · {module.title}
            </summary>
            {catalog
              .filter((item) => item.moduleId === module.id)
              .map((item) =>
                item.status === "available" ? (
                  <a
                    className={
                      lesson?.id === item.id
                        ? "lesson-link active"
                        : "lesson-link"
                    }
                    href={`#/lesson/${item.id}`}
                    key={item.id}
                    aria-current={lesson?.id === item.id ? "page" : undefined}
                  >
                    <span>
                      {item.id} · {item.title}
                    </span>
                    <small>
                      {statusLabels[state.lessonStates[item.id as LessonId]]}
                    </small>
                  </a>
                ) : (
                  <div className="planned" key={item.id}>
                    <strong>
                      {item.id} · {item.title}
                    </strong>
                    <small>已规划，未实现</small>
                    <p>{item.summary}</p>
                  </div>
                ),
              )}
          </details>
        ))}
      </aside>
      <main id="main-content" tabIndex={-1}>
        {record.notice && (
          <div className="storage-notice" role="status">
            {record.notice}
            {record.status === "recovery" && (
              <p>
                <button
                  className="secondary"
                  onClick={() => {
                    const original = store.exportOriginal();
                    if (original !== null)
                      download(
                        original,
                        "microeconomics-original-learning-record.json",
                      );
                  }}
                >
                  备份原始记录
                </button>{" "}
                <a href="#/records">管理恢复与清空</a>
              </p>
            )}
          </div>
        )}
        {error && (
          <div role="alert" className="storage-notice">
            {error}
            <button className="text-button" onClick={() => setError("")}>
              关闭提示
            </button>
          </div>
        )}
        {lesson ? (
          <LessonPage
            key={lesson.id}
            lesson={lesson}
            state={state}
            save={save}
            onReset={() => setDialog("lesson")}
          />
        ) : route === "/" ? (
          <>
            <div className="eyebrow">学习工作台 · 先看对象，再写公式</div>
            <h1>从选择，到市场与制度。</h1>
            <p className="lead">
              用 24 节课程与 11 个可复现实验，从约束和偏好推导选择，分析企业、市场、策略、制度与证据。
            </p>
            <a
              className="button"
              href={`#/lesson/${state.lastLessonId || "M01-A"}`}
            >
              {state.lastLessonId
                ? `继续学习 ${state.lastLessonId}`
                : "开始第一课 M01-A"}{" "}
              →
            </a>
            <Panel title="十二个模块，十二张模型卡">
              <div className="module-grid">
                {modules.map((module) => (
                  <a
                    className="module-card"
                    key={module.id}
                    href={`#/lesson/${module.id}-A`}
                  >
                    <span className="eyebrow">{module.id}</span>
                    <h3>{module.title}</h3>
                    <p>{module.centralQuestion}</p>
                    <span>进入课程 →</span>
                  </a>
                ))}
              </div>
            </Panel>
            <Panel title="概念依赖地图">
              <div className="concept-map">
                <a href="#/glossary/feasible-set">资源与可行集</a>
                <span>→</span>
                <a href="#/glossary/preference">偏好与序数表示</a>
                <span>→</span>
                <a href="#/glossary/demand">最优选择与需求</a>
              </div>
              <p>
                约束决定可行方案，偏好与技术推出个体选择；市场检查计划是否兼容，制度改变激励与信息，最后用证据审查机制。
              </p>
            </Panel>
            <Panel title="把选择连接到互动与证据">
              <div className="concept-map"><a href="#/lesson/M04-A">技术与成本</a><span>→</span><a href="#/lesson/M05-A">市场均衡</a><span>→</span><a href="#/lesson/M06-B">税负与福利</a></div>
              <div className="concept-map"><a href="#/lesson/M07-A">市场力量</a><span>→</span><a href="#/lesson/M08-A">策略与规则</a><span>→</span><a href="#/lesson/M09-A">外部性与制度</a></div>
              <div className="concept-map"><a href="#/lesson/M10-A">风险与信息</a><span>→</span><a href="#/lesson/M11-B">劳动与时间</a><span>→</span><a href="#/lesson/M12-B">贸易与证据</a></div>
              <p><a href="#/review">用新情境跨模块复习</a>，再<a href="#/capstone">编写终课作品</a>。允许按问题跳读，概念依赖以每节前置条件为准。</p>
            </Panel>
            <Panel title="记录理解，而非假装掌握">
              <p>
                每节分别保存客观题尝试、主观自评与概念信心。阅读、翻页和停留时长不会被计为掌握率。全部默认数字均为
                synthetic 教学数据，结论只在列出的假设内成立。
              </p>
              <p>
                本地记录仅在这个浏览器保存；导出包含个人笔记，请勿提交公开
                GitHub。
              </p>
            </Panel>
          </>
        ) : route === "/capstone" ? (
          <CapstonePage state={state} save={save} />
        ) : route === "/review" ? (
          <ReviewPage state={state} save={save} />
        ) : route.startsWith("/glossary") ? (
          <>
            <div className="eyebrow">对象 · 例子 · 混淆 · 出现位置</div>
            <h1>概念词条</h1>
            <div className="concept-index">
              {glossary.map((entry) => (
                <a href={`#/glossary/${entry.id}`} key={entry.id}>
                  {entry.term}
                </a>
              ))}
            </div>
            {glossary
              .filter(
                (entry) =>
                  !route.split("/")[2] || entry.id === route.split("/")[2],
              )
              .map((entry) => (
                <Panel
                  key={entry.id}
                  title={`${entry.term} · ${entry.english}`}
                >
                  <p>
                    <strong>对象：</strong>
                    {entry.object}
                  </p>
                  <p>{entry.definition}</p>
                  <p>
                    <strong>例子：</strong>
                    {entry.example}
                  </p>
                  <p>
                    <strong>常见混淆：</strong>
                    {entry.confusion}
                  </p>
                  <p>
                    出现于{" "}
                    {entry.lessonIds.map((id) => (
                      <a key={id} href={`#/lesson/${id}`}>
                        {id}{" "}
                      </a>
                    ))}
                  </p>
                  <p>
                    相关概念：
                    {entry.relatedIds.map((id) => (
                      <a key={id} href={`#/glossary/${id}`}>
                        {glossary.find((g) => g.id === id)?.term}{" "}
                      </a>
                    ))}
                  </p>
                </Panel>
              ))}
          </>
        ) : route === "/references" ? (
          <>
            <h1>参考资料与阅读路线</h1>
            <p>
              课程文案、图形与情景为原创。外部资料由你主动打开，应用不预取链接；来源入口在
              2026-10-03 核验。
            </p>
            {references.map((ref) => (
              <Panel key={ref.id} title={`${ref.id} · ${ref.title}`}>
                <p>
                  {ref.organization} · {ref.edition} · 核验 {ref.checkedAt}
                </p>
                <p>{ref.supports}</p>
                <p>{ref.readingRoute}</p>
                <p className="small">{ref.licenseNote}</p>
                <a href={ref.url} target="_blank" rel="noreferrer">
                  打开官方参考资料 ↗
                </a>
              </Panel>
            ))}
          </>
        ) : route === "/records" ? (
          <>
            <h1>本地学习记录</h1>
            <p>
              命名空间仅为本课程。无登录、遥测或自动云同步。导出含个人笔记，勿提交公开
              GitHub；导入会替换本课程当前记录，请先导出备份。
            </p>
            <div className="actions">
              <button
                onClick={() =>
                  download(
                    store.exportJson(),
                    "microeconomics-learning-record.json",
                  )
                }
              >
                导出 JSON
              </button>
              <label className="file-input">
                导入 JSON
                <input
                  aria-label="导入 JSON 文件"
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => {
                    void importFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              <button className="danger" onClick={() => setDialog("all")}>
                清空本课程记录
              </button>
            </div>
            <table>
              <caption>客观尝试和主观自评分开保留，不合成掌握率</caption>
              <thead>
                <tr>
                  <th>课程</th>
                  <th>学习状态</th>
                  <th>客观尝试</th>
                  <th>主观自评</th>
                </tr>
              </thead>
              <tbody>
                {lessons.map((l) => (
                  <tr key={l.id}>
                    <th>
                      <a href={`#/lesson/${l.id}`}>{l.id}</a>
                    </th>
                    <td>
                      {statusLabels[state.lessonStates[l.id as LessonId]]}
                    </td>
                    <td>
                      {Object.entries(state.objectiveAttempts)
                        .filter(([id]) => id.startsWith(l.id + "-"))
                        .reduce((n, [, list]) => n + list.length, 0)}{" "}
                      次
                    </td>
                    <td>
                      {
                        Object.keys(state.selfChecks).filter((id) =>
                          id.startsWith(l.id + "-"),
                        ).length
                      }{" "}
                      项
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="small">
              支持 schemaVersion 2，旧版 1 自动迁移并保留记录；其他课程、未知版本、错误
              JSON、无效字段或超出 1 MiB
              的文件会拒绝，原记录保留。损坏记录可以先备份，再明确清空。
            </p>
          </>
        ) : (
          <Panel title="没有可学习的这节课">
            <p>
              请从目录选择 M01-A 至 M12-B，或返回工作台查看完整课程。
            </p>
            <a href="#/">回到学习工作台</a>
          </Panel>
        )}
        <footer>
          microeconomics · 24 节完整课程 · 合成教学模型 · 只在本机保存学习记录
        </footer>
      </main>
      {dialog && (
        <div className="dialog-backdrop">
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            onKeyDown={(e) => {
              if (e.key === "Escape") setDialog(null);
              if (e.key === "Tab") {
                const buttons =
                  e.currentTarget.querySelectorAll<HTMLButtonElement>("button");
                if (e.shiftKey && document.activeElement === buttons[0]) {
                  e.preventDefault();
                  buttons[buttons.length - 1].focus();
                } else if (
                  !e.shiftKey &&
                  document.activeElement === buttons[buttons.length - 1]
                ) {
                  e.preventDefault();
                  buttons[0].focus();
                }
              }
            }}
          >
            <h2 id="confirm-title">
              {dialog === "all"
                ? "清空本课程的全部个人记录？"
                : `重置 ${lesson?.id} 的个人记录？`}
            </h2>
            <p>
              {dialog === "all"
                ? "将删除本课程进度、笔记、预测与实验状态；另一门课的记录保留。请先导出需要的备份。"
                : "将清除本节状态、客观尝试、自评、笔记和信心；共享实验单独重置。"}
            </p>
            <div className="actions">
              <button
                className="secondary"
                autoFocus
                onClick={() => setDialog(null)}
              >
                取消
              </button>
              <button
                className="danger"
                onClick={() => {
                  const result =
                    dialog === "all"
                      ? store.reset()
                      : store.resetLesson(lesson!.id as LessonId);
                  setRecord(result);
                  setError(
                    result.ok ? "记录已重置。" : result.error || "重置失败。",
                  );
                  setDialog(null);
                }}
              >
                确认清空
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
function LessonPage({
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
    const attempts = {
      ...state.objectiveAttempts,
      [qid]: [
        ...(state.objectiveAttempts[qid] || []),
        { answer, correct, at: new Date().toISOString() },
      ],
    };
    const practiced = objective.every((q) => attempts[q.id]?.length);
    save({
      ...state,
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
  };
  return (
    <article>
      <div className="eyebrow">
        {lesson.id} · {module.title} · {statusLabels[state.lessonStates[id]]}
      </div>
      <h1>{lesson.title}</h1>
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
            </>
          )}
        </div>
      ))}
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
            selfCheck={(answer, rating) =>
              save({
                ...state,
                selfChecks: { ...state.selfChecks, [q.id]: { answer, rating } },
              })
            }
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
          <button className="secondary" onClick={onReset}>
            重置本节记录
          </button>
        </div>
        <p className="small">
          “已自评”表示已尝试客观题并留下主观自评，允许仍有疑问；不代表通过或完全掌握。
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

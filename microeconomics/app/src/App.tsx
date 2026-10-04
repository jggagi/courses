import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { catalog, modules } from "./content/catalog";
import { references } from "./content/glossary";
import { loadLesson } from "./content/loaders";
import type { Lesson } from "./content/types";
import {
  createLearningStore,
  MAX_IMPORT_BYTES,
  type LearningState,
  type LessonId,
  type StoreResult,
} from "./persistence/store";
import { printCurrentPage } from "./utils/export";
import type { ExtensionLabId } from "./models/extensions";
const LessonPage = lazy(() => import("./components/LessonPage"));
const GlossaryPage = lazy(() => import("./components/GlossaryPage"));
const SearchPage = lazy(() => import("./components/SearchPage"));
const CapstonePage = lazy(() => import("./components/CourseCompletion").then(m => ({ default: m.CapstonePage })));
const ReviewPage = lazy(() => import("./components/CourseCompletion").then(m => ({ default: m.ReviewPage })));
const ReviewQueuePage = lazy(() => import("./components/ReviewQueue").then(m => ({ default: m.ReviewQueuePage })));
const ExperimentHistoryPage = lazy(() => import("./components/ExperimentHistory").then(m => ({ default: m.ExperimentHistoryPage })));
const LabHistoryPanel = lazy(() => import("./components/ExperimentHistory").then(m => ({ default: m.LabHistoryPanel })));
const ExtensionLabsPage = lazy(() => import("./components/ExtensionLabs").then(m => ({ default: m.ExtensionLabsPage })));
const RealCasesPage = lazy(() => import("./components/RealCases").then(m => ({ default: m.RealCasesPage })));

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
  const lessonId = route.startsWith("/lesson/") ? route.split("/")[2] : undefined;
  const [loadedLesson, setLoadedLesson] = useState<Lesson>();
  const [lessonError, setLessonError] = useState("");
  useEffect(() => {
    let alive = true;
    setLessonError("");
    if (lessonId) loadLesson(lessonId).then(value => { if (alive) setLoadedLesson(value); }).catch(() => { if (alive) setLessonError("课程暂时无法加载，请刷新重试。"); });
    return () => { alive = false; };
  }, [lessonId]);
  const lesson = loadedLesson?.id === lessonId ? loadedLesson : undefined;
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
          <a href="#/search">搜索</a>
          <a href="#/practice">复习队列</a>
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
          24 节课程 / 11 个基础实验 + 3 个进阶实验
          <br />
          无强制解锁，允许跳读
        </p>
        <nav className="learning-tools-nav" aria-label="学习工具"><a href="#/history">实验历史</a><a href="#/extensions">进阶实验 · MX01–MX03</a><a href="#/cases">历史数据案例</a></nav>
        {modules.map((module) => (
          <details
            key={module.id}
            open={module.id === lessonId?.slice(0, 3) || ["M01", "M02", "M03"].includes(module.id)}
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
                      lessonId === item.id
                        ? "lesson-link active"
                        : "lesson-link"
                    }
                    href={`#/lesson/${item.id}`}
                    key={item.id}
                    aria-current={lessonId === item.id ? "page" : undefined}
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
        <div className="page-tools"><button className="secondary" onClick={printCurrentPage}>打印当前页 / 保存 PDF</button></div>
        <Suspense fallback={<p role="status">正在加载课程工具…</p>}>
        {lesson ? (
          <LessonPage
            key={lesson.id}
            lesson={lesson}
            state={state}
            save={save}
            onReset={() => setDialog("lesson")}
          />
        ) : lessonId && catalog.some(item => item.id === lessonId) ? (
          <p role={lessonError ? "alert" : "status"}>{lessonError || "正在加载课程…"}</p>
        ) : route === "/" ? (
          <>
            <div className="eyebrow">学习工作台 · 先看对象，再写公式</div>
            <h1>从选择，到市场与制度。</h1>
            <p className="lead">
              用 24 节课程、11 个基础实验与 3 个进阶实验，从约束和偏好推导选择，分析企业、市场、策略、制度与证据。
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
            <Panel title="把课程继续用于自己的问题"><div className="concept-map"><a href="#/practice">错题与间隔复习</a><a href="#/history">保存实验对照</a><a href="#/extensions">3 个进阶实验</a><a href="#/cases">2 个历史数据案例</a></div><p>用<a href="#/search">课程搜索</a>找回概念，打印正文与笔记，或导出模型卡和终课作品。历史案例另列观测时期、来源和证据边界。</p></Panel>
            <Panel title="记录理解，而非假装掌握">
              <p>
                每节分别保存客观题尝试、主观自评与概念信心。阅读、翻页和停留时长不会被计为掌握率。全部默认数字均为
                synthetic 教学模型参数，结论只在列出的假设内成立；历史案例另列观测来源与时期。
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
        ) : route === "/search" ? (<SearchPage />
        ) : route === "/practice" ? (<ReviewQueuePage state={state} save={save} />
        ) : route === "/history" ? (<ExperimentHistoryPage state={state} save={save} />
        ) : route === "/extensions" || route.startsWith("/extensions/") ? (
          <ExtensionLabsPage state={state} save={save} id={route.split("/")[2] as ExtensionLabId | undefined} renderSnapshot={id => <LabHistoryPanel labId={id} state={state} save={save} />} />
        ) : route === "/cases" ? (<RealCasesPage state={state} save={save} />
        ) : route.startsWith("/glossary") ? (<GlossaryPage id={route.split("/")[2]} />
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
                {catalog.map((l) => (
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
              支持 schemaVersion 3，旧版 1 / 2 自动迁移并保留记录；其他课程、未知版本、错误
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
        </Suspense>
        <footer>
          microeconomics · 24 节完整课程 · 实验为合成模型，历史案例单列来源 · 只在本机保存学习记录
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
                ? "将删除本课程进度、笔记、预测、复习队列、实验历史与终课引用；另一门课的记录保留。请先导出需要的备份。"
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

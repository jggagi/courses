import { useEffect, useRef, useState } from "react";
import type { LearningState } from "../persistence/store";
import { dueReviewEntries, gradeReview, type ReviewEntry, type ReviewGrade } from "../persistence/learning-tools";
import { catalog } from "../content/catalog";
import { loadLesson } from "../content/loaders";
import { getNumericAnswer } from "../content/answers";
import { getReviewVariant } from "../content/review-variants";
import type { Question } from "../content/types";
import "./review-queue.css";

type PageProps = { state: LearningState; save: (state: LearningState) => void };
type SelectedReview = { entry: ReviewEntry; question?: Question };
const dateLabel = (iso: string) => new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
const fmt = (value: number) => Number(value.toPrecision(12)).toString();

export function ReviewQueuePage({ state, save }: PageProps) {
  const [now, setNow] = useState(() => new Date().toISOString());
  const [dueOnly, setDueOnly] = useState(true);
  const [selected, setSelected] = useState<SelectedReview | null>(null);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [comparison, setComparison] = useState<string | null>(null);
  const requestNumber = useRef(0);
  const panel = useRef<HTMLElement>(null);
  const due = dueReviewEntries(state, now);
  const entries = Object.values(state.reviewQueue).sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.questionId.localeCompare(b.questionId));
  const visible = dueOnly ? due : entries;
  const next = entries.find(entry => entry.dueAt > now);
  const activeQuestion = selected?.question;
  const correctChoice = activeQuestion?.kind === "choice" ? activeQuestion.options.find(option => option.id === activeQuestion.answer) : undefined;

  useEffect(() => { if (selected) panel.current?.focus(); }, [selected?.entry.questionId]);
  useEffect(() => () => { requestNumber.current += 1; }, []);

  const start = async (entry: ReviewEntry) => {
    const request = ++requestNumber.current;
    setLoading(entry.questionId); setError(""); setNotice(""); setSelected(null);
    setAnswer(""); setRevealed(false); setComparison(null);
    try {
      const lesson = await loadLesson(entry.lessonId);
      if (request !== requestNumber.current) return;
      if (!lesson) throw new Error("找不到这节课程，请回到课程目录。");
      const original = lesson.checks.find(question => question.id === entry.questionId);
      if (!original && !/^M12-B-review-(cost|tax|game|risk)$/.test(entry.questionId)) throw new Error("找不到这道练习。记录仍保留，请回到原课程检查。");
      const question = original ? getReviewVariant(original, entry.variant) : undefined;
      setSelected({ entry, question });
      if (question?.kind === "self-explanation") setAnswer(state.selfChecks[entry.questionId]?.answer || "");
    } catch (cause) {
      if (request === requestNumber.current) setError(cause instanceof Error ? cause.message : "无法打开复习题，请重试。");
    } finally { if (request === requestNumber.current) setLoading(""); }
  };

  const check = () => {
    if (!selected?.question) return;
    setError("");
    const question = selected.question;
    try {
      if (question.kind === "numeric") {
        if (answer.trim() === "" || !Number.isFinite(Number(answer))) {
          setError("请输入有限数值后再核对；若仍无法作答，可以展开参考。"); return;
        }
        const expected = getNumericAnswer(question), correct = Math.abs(Number(answer) - expected) <= question.tolerance;
        setComparison(`${correct ? "这次数值与模型一致" : "这次数值需回看"}。你的回答 ${answer}；模型结果 ${fmt(expected)} ${question.unit}，绝对容差 ${question.tolerance}。`);
      } else if (question.kind === "choice") {
        if (!answer) { setError("请选择一项后再核对；也可以先展开参考。"); return; }
        const option = question.options.find(item => item.id === answer);
        setComparison(`${answer === question.answer ? "这次选择正确" : "这次选择需回看"}。${option?.feedback || "请检查你的选项。"}`);
      }
      setRevealed(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "计算失败，请回看模型条件。"); }
  };

  const rate = (grade: ReviewGrade) => {
    if (!selected || !revealed) return;
    try {
      const at = new Date().toISOString();
      let nextState = state;
      if (selected.question?.kind === "self-explanation") {
        nextState = { ...nextState, selfChecks: { ...nextState.selfChecks,
          [selected.entry.questionId]: { answer, rating: grade === "again" ? "needs_review" : grade === "hard" ? "partial" : "clear" } } };
      }
      nextState = gradeReview(nextState, selected.entry.questionId, grade, at);
      const updated = nextState.reviewQueue[selected.entry.questionId];
      save(nextState); setNow(at); setSelected(null); setAnswer(""); setRevealed(false); setComparison(null); setError("");
      setNotice(`已记录本次自评。下次建议复习：${dateLabel(updated.dueAt)}；可随时从“全部队列”提前练习。`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "复习记录未更新，请重试。"); }
  };

  const draft = (text: string) => {
    setAnswer(text);
    if (!selected || selected.question?.kind !== "self-explanation") return;
    const previous = state.selfChecks[selected.entry.questionId];
    save({ ...state, selfChecks: { ...state.selfChecks,
      [selected.entry.questionId]: { answer: text, rating: previous?.rating || "needs_review" } } });
  };

  return <article className="review-queue-page">
    <div className="eyebrow">本地记录 · 新数字 · 间隔复习</div>
    <h1>错题与间隔复习</h1>
    <p className="lead">把答错的练习和仍有疑问的解释留到下一次，再用新数字检验理解。</p>
    <p>数值题使用新参数；选择题调整选项顺序；自由回答由你对照参考与 rubric 自评。复习不覆盖原题的客观尝试，不合成掌握率。日期只是本地学习建议，不发送邮件或云端提醒。</p>
    <p><a href="#/review">跨模块复习</a> · <a href="#/records">备份与恢复本地记录</a></p>
    <section className="panel" aria-labelledby="queue-title">
      <h2 id="queue-title">我的复习队列</h2>
      <p><strong>当前到期 {due.length} 道</strong> · 待后续复习 {entries.length - due.length} 道 · 全部 {entries.length} 道</p>
      {next && <p>下一次到期：{dateLabel(next.dueAt)}。</p>}
      <div className="review-queue-actions">
        <button className={dueOnly ? "" : "secondary"} aria-pressed={dueOnly} onClick={() => setDueOnly(true)}>只看到期</button>
        <button className={dueOnly ? "secondary" : ""} aria-pressed={!dueOnly} onClick={() => setDueOnly(false)}>全部队列</button>
        <button className="secondary" onClick={() => setNow(new Date().toISOString())}>刷新到期时间</button>
      </div>
      <p className="small">列表按 {dateLabel(now)} 判断到期。即使尚未到期，也可主动提前复习。</p>
      {entries.length === 0 ? <p>队列为空。逐课答错的客观题，以及“需要回看”或“部分说清”的自评会加入这里；可以照常跳读课程。</p>
        : visible.length === 0 ? <p>当前没有到期题目。可打开“全部队列”提前练习，或继续学习。</p>
          : <ul className="review-queue-list">{visible.map(entry => <li key={entry.questionId}>
            <div><strong>{entry.questionId}</strong> · <a href={`#/lesson/${entry.lessonId}`}>{catalog.find(lesson => lesson.id === entry.lessonId)?.title || entry.lessonId}</a>
              <p className="small">{entry.reason === "incorrect" ? "原题回答有误" : "解释仍有疑问"} · {entry.dueAt <= now ? "已到期" : "尚未到期"} · {dateLabel(entry.dueAt)} · 上次间隔 {entry.intervalDays} 天</p>
            </div>
            <button className="secondary" disabled={Boolean(loading)} onClick={() => void start(entry)}>{loading === entry.questionId ? "正在打开…" : entry.dueAt <= now ? "开始复习" : "提前复习"}</button>
          </li>)}</ul>}
    </section>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {selected && <section className="panel review-question" tabIndex={-1} ref={panel} aria-labelledby="active-review-title">
      <h2 id="active-review-title">正在复习 · {selected.entry.questionId}</h2>
      {selected.entry.dueAt > now && <p>这是主动提前复习；下一次间隔将从本次自评时间重新计算。</p>}
      {selected.question ? <>
        <p className="review-prompt">{selected.question.prompt}</p>
        {selected.question.kind === "numeric" && <label>我的数值回答（{selected.question.unit}）
          <input type="number" step="any" inputMode="decimal" aria-label="复习数值回答" value={answer} onChange={event => { setAnswer(event.target.value); setRevealed(false); setComparison(null); }} />
        </label>}
        {selected.question.kind === "choice" && <fieldset><legend>先独立选择</legend>{selected.question.options.map(option => <label className="review-choice" key={option.id}>
          <input type="radio" name={`review-${selected.question!.id}`} value={option.id} checked={answer === option.id} onChange={() => { setAnswer(option.id); setRevealed(false); setComparison(null); }} />{option.text}
        </label>)}</fieldset>}
        {selected.question.kind === "self-explanation" && <label>我的解释（自动保存在本机，不自动评分）
          <textarea aria-label="复习我的解释" rows={6} maxLength={20000} value={answer} onChange={event => draft(event.target.value)} />
        </label>}
        <div className="review-queue-actions">
          {selected.question.kind !== "self-explanation" && <button onClick={check}>核对本次回答</button>}
          <button className="secondary" onClick={() => { setError(""); setRevealed(true); }}>展开参考与自评</button>
          <button className="secondary" onClick={() => { setSelected(null); setError(""); }}>返回队列</button>
        </div>
        {revealed && <div className="review-feedback" aria-live="polite">
          {comparison && <p>{comparison}</p>}
          <h3>参考与依据</h3><p>{selected.question.answerBasis}</p><p>{selected.question.feedback}</p>
          {selected.question.kind === "choice" && <p>参考选项：{correctChoice?.text}</p>}
          {selected.question.kind === "self-explanation" && <><p>{selected.question.referenceAnswer}</p><ul>{selected.question.rubric.map(item => <li key={item}>{item}</li>)}</ul></>}
          <p><a href={`#/lesson/${selected.entry.lessonId}`}>回到原课程看推导与边界</a></p>
        </div>}
      </> : <>
        <p>这道跨模块解释题请在原复习页完成。它连接多个模型，不用单一数值或关键词代替你的解释。</p>
        <p><a href="#/review">打开跨模块复习原题</a></p>
        <button className="secondary" onClick={() => setRevealed(true)}>我已对照原题参考，安排下次复习</button>
      </>}
      {revealed && <section aria-labelledby="review-rating-title">
        <h3 id="review-rating-title">对照后，由我安排下次复习</h3>
        <p className="small">这三个选项记录你的判断。答对一次不等于已经掌握；不确定时选“再练”。</p>
        <div className="review-queue-actions">
          <button className="secondary" onClick={() => rate("again")}>再练 · 1 天后</button>
          <button className="secondary" onClick={() => rate("hard")}>吃力 · 3 天后</button>
          <button onClick={() => rate("good")}>能解释 · 延长间隔</button>
        </div>
      </section>}
    </section>}
  </article>;
}

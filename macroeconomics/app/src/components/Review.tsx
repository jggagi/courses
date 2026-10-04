import { useMemo, useRef, useState } from "react";
import { lessons } from "../content";
import { transferReviews } from "../content/review";
import type { LearningState } from "../persistence";
import {
  buildReviewQueue,
  lessonCheckHref,
  modelCardFields,
  modelCardFilledFields,
  recordReviewAttempt,
  writeReviewNote,
  type ReviewItem,
} from "../persistence/review";
import "./Review.css";

type Props = { state: LearningState; change: (next: LearningState) => void };

function answerLabel(item: ReviewItem, answer: string): string {
  if (item.check.kind === "choice" && /^(0|[1-9]\d*)$/.test(answer))
    return item.check.options?.[Number(answer)]?.label || answer;
  return `${answer || "（空答案）"}${item.check.kind === "numeric" ? ` ${item.check.unit || ""}` : ""}`;
}

function MistakeReview({
  item,
  state,
  change,
  onResult,
  resolved = false,
}: Props & {
  item: ReviewItem;
  onResult: (result: string) => void;
  resolved?: boolean;
}) {
  const { lesson, check, assessment } = item;
  const retryKey = `review:retry:${check.id}`;
  const reflectionKey = `review:mistake:${check.id}`;
  const answer = state.notes[retryKey] || "";
  const [error, setError] = useState("");
  const writeRetry = (value: string) => {
    setError("");
    change({ ...state, notes: { ...state.notes, [retryKey]: value } });
  };
  function retry() {
    try {
      const next = recordReviewAttempt(
        state,
        lesson,
        check,
        answer,
        new Date().toISOString(),
      );
      change(next.state);
      setError("");
      onResult(
        next.assessment.status === "correct"
          ? `${check.id} 重做核对正确，已移出待复习；历史仍保留。这不是掌握程度的判定。`
          : `${check.id} 仍需再练习。${next.assessment.feedback}`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "请检查答案格式。");
    }
  }
  return (
    <article
      className="panel review-question"
      data-testid={`review-${check.id}`}
    >
      <p className="eyebrow">
        {lesson.id} · {check.kind === "numeric" ? "数值核对" : "辨认误解"}
      </p>
      <h3>{check.prompt}</h3>
      <p>
        {resolved ? "最新重做答案" : "最近一次答案"}：
        <strong>{answerLabel(item, item.attempt.answer)}</strong>
      </p>
      <p className="review-feedback">{assessment.feedback}</p>
      <a href={lessonCheckHref(lesson, check)}>回到 {lesson.id} 的这道题</a>
      {!resolved && (
        <details className="review-retry">
          <summary>先独立重算，再提交一次</summary>
          {check.kind === "numeric" ? (
            <label>
              新答案（{check.unit}；容差 ±{check.tolerance}）
              <input
                aria-label={`${check.id} 复习数值答案`}
                type="number"
                step="any"
                value={answer}
                onChange={(event) => writeRetry(event.target.value)}
              />
            </label>
          ) : (
            <fieldset>
              <legend>重新选择一个解释</legend>
              {check.options?.map((option, index) => (
                <label className="choice" key={index}>
                  <input
                    type="radio"
                    name={`review-${check.id}`}
                    checked={answer === String(index)}
                    onChange={() => writeRetry(String(index))}
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>
          )}
          <button onClick={retry}>提交复习检查</button>
          {error && <p role="alert">{error}</p>}
        </details>
      )}
      <details>
        <summary>用自己的话解释这次误解</summary>
        <label>
          我错把什么当成了什么？下次先检查哪个条件？
          <textarea
            aria-label={`${check.id} 误解复习笔记`}
            maxLength={10000}
            value={state.notes[reflectionKey] || ""}
            onChange={(event) =>
              change(writeReviewNote(state, reflectionKey, event.target.value))
            }
          />
        </label>
        <label className="choice">
          <input
            type="checkbox"
            checked={!!state.selfChecks[reflectionKey]}
            onChange={(event) =>
              change({
                ...state,
                selfChecks: {
                  ...state.selfChecks,
                  [reflectionKey]: event.target.checked,
                },
              })
            }
          />
          对照反馈后，我已自行检查这段解释
        </label>
        <p className="muted">
          这项自评不会移除待复习题。改写解释后，请重新对照检查。
        </p>
      </details>
      <details>
        <summary>这道题的尝试历史（{item.history.length} 次）</summary>
        <ol className="review-history">
          {item.history.slice(-10).map((entry, index) => (
            <li key={`${entry.attempt.at}-${index}`}>
              <time dateTime={entry.attempt.at}>{entry.attempt.at}</time>
              <span>
                {answerLabel(item, entry.attempt.answer)} · 当前题目核对：
                {entry.assessment.status === "correct"
                  ? "正确"
                  : entry.assessment.status === "incorrect"
                    ? "需再练习"
                    : "无法核实"}
              </span>
            </li>
          ))}
        </ol>
        <p className="muted">
          这里展示最近10次；导出保留记录范围内的原始尝试。按追加顺序取最新答案，时间戳不改变顺序。
        </p>
      </details>
    </article>
  );
}

export default function Review({ state, change }: Props) {
  const review = useMemo(
    () => buildReviewQueue(state.objectiveAttempts, lessons),
    [state.objectiveAttempts],
  );
  const [message, setMessage] = useState("");
  const queueHeading = useRef<HTMLHeadingElement>(null);
  const modules = Array.from(
    { length: 12 },
    (_, index) => `A${String(index + 1).padStart(2, "0")}`,
  );
  const onResult = (result: string) => {
    setMessage(result);
    queueHeading.current?.focus();
  };
  return (
    <div className="review-workbench" data-testid="review-workbench">
      <p className="eyebrow">本地复习 / 错题 · 迁移 · 模型卡</p>
      <h1>把解释带到新的问题。</h1>
      <p className="lead">
        先找出需要重做的客观题，再跨模块比较机制，最后重建自己的模型卡。所有笔记仍只在本机保存；自评与数值核对分开记录。
      </p>
      <section aria-labelledby="review-mistakes-title">
        <h2 id="review-mistakes-title" tabIndex={-1} ref={queueHeading}>
          错题与误解回看
        </h2>
        <p>
          待复习 {review.pending.length}{" "}
          题。按每题最新答案与当前题目重新核对，正确重做后移出；旧记录保留。这是复习清单，不是掌握率。
        </p>
        <p className="review-status" role="status">
          {message}
        </p>
        {review.reconciledCount > 0 && (
          <p className="notice">
            {review.reconciledCount}{" "}
            条历史记录的原正确标记与当前答案核对不一致。清单以当前题目与原始答案为准，未修改导入的历史标记；旧版题目可能已经调整，请回课核实。
          </p>
        )}
        {review.pending.length === 0 ? (
          <div className="panel">
            <p>
              目前没有可核对的待复习客观题。可以先做课程练习，或直接完成下面的迁移解释；空清单不代表已经掌握。
            </p>
            <a href={`#/lesson/${state.lastLessonId}`}>回到最近学习的课程</a>
          </div>
        ) : (
          review.pending.map((item) => (
            <MistakeReview
              key={item.check.id}
              item={item}
              state={state}
              change={change}
              onResult={onResult}
            />
          ))
        )}
        {review.resolved.length > 0 && (
          <details className="panel">
            <summary>
              已正确重做，保留误解与历史（{review.resolved.length} 题）
            </summary>
            {review.resolved.map((item) => (
              <MistakeReview
                key={item.check.id}
                item={item}
                state={state}
                change={change}
                onResult={onResult}
                resolved
              />
            ))}
          </details>
        )}
        {review.unmatched.length > 0 && (
          <details className="panel">
            <summary>
              无法归入当前题目的历史（{review.unmatched.length} 条）
            </summary>
            <p>
              这些记录仍在本地导出中，未用来判断复习结果。可回原课重新作答。
            </p>
            <ul>
              {review.unmatched.slice(-20).map((entry, index) => (
                <li key={`${entry.attempt.checkId}-${index}`}>
                  <strong>
                    {entry.attempt.lessonId} · {entry.attempt.checkId}
                  </strong>
                  ：{entry.reason}{" "}
                  {lessons.some(
                    (lesson) => lesson.id === entry.attempt.lessonId,
                  ) && (
                    <a href={`#/lesson/${entry.attempt.lessonId}`}>
                      回原课核实
                    </a>
                  )}
                </li>
              ))}
            </ul>
            <p className="muted">
              这里展示最近20条；不自动删除或猜测旧题的含义。
            </p>
          </details>
        )}
      </section>
      <section aria-labelledby="review-transfer-title">
        <h2 id="review-transfer-title">六个跨模块迁移练习</h2>
        <p>
          六个新情景覆盖A01–A12，数字均为教学合成。先写自己的解释，再展开参考与标准。应用不会给自由回答自动判分。
        </p>
        {transferReviews.map((exercise) => {
          const key = `review:transfer:${exercise.id}`;
          return (
            <details
              className="panel review-transfer"
              key={exercise.id}
              data-testid={`review-transfer-${exercise.id}`}
            >
              <summary>
                {exercise.modules.join(" + ")} · {exercise.title}
              </summary>
              {exercise.prompt.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              <label>
                我的解释与仍不确定的地方
                <textarea
                  aria-label={`${exercise.id} 迁移解释`}
                  maxLength={10000}
                  value={state.notes[key] || ""}
                  onChange={(event) =>
                    change(writeReviewNote(state, key, event.target.value))
                  }
                />
              </label>
              <details className="review-reference">
                <summary>参考解释与自评标准</summary>
                {exercise.reference.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                <ul>
                  {exercise.rubric.map((criterion) => (
                    <li key={criterion}>{criterion}</li>
                  ))}
                </ul>
              </details>
              <label className="choice">
                <input
                  type="checkbox"
                  checked={!!state.selfChecks[key]}
                  onChange={(event) =>
                    change({
                      ...state,
                      selfChecks: {
                        ...state.selfChecks,
                        [key]: event.target.checked,
                      },
                    })
                  }
                />
                对照以上标准后，我已自行检查当前解释
              </label>
              <p className="muted">
                改写回答会取消这项自评；请对照新版回答重新检查。
              </p>
              <div
                className="review-links"
                aria-label={`${exercise.title} 相关课程`}
              >
                {exercise.lessons.map((id) => (
                  <a href={`#/lesson/${id}`} key={id}>
                    {id} · {lessons.find((lesson) => lesson.id === id)?.title}
                  </a>
                ))}
              </div>
            </details>
          );
        })}
      </section>
      <section aria-labelledby="review-cards-title">
        <h2 id="review-cards-title">十二张模型卡，七个重建问题</h2>
        <p>
          这里直接编辑课程原有的模型卡。已填字段只提示哪里有文字，不表示理解或完成；“仍不确定”也可以是诚实的暂时答案。
        </p>
        {modules.map((moduleId) => {
          const filled = modelCardFilledFields(state.notes, moduleId);
          const selfCheckKey = `review:card:${moduleId}`;
          return (
            <details
              className="panel review-card"
              key={moduleId}
              data-testid={`review-card-${moduleId}`}
            >
              <summary>
                {moduleId} ·{" "}
                {lessons.find((lesson) => lesson.moduleId === moduleId)?.title}{" "}
                · 已填 {filled.length}/7 字段
              </summary>
              <p>
                <a href={`#/lesson/${moduleId}-A`}>回看 {moduleId}-A</a>
                {" · "}
                <a href={`#/lesson/${moduleId}-B/card`}>
                  回看 {moduleId}-B 与原模型卡
                </a>
              </p>
              {modelCardFields.map((field) => {
                const key = `card:${moduleId}:${field}`;
                return (
                  <label key={field}>
                    {field}
                    <textarea
                      aria-label={`${moduleId} 复习模型卡 ${field}`}
                      maxLength={10000}
                      value={state.notes[key] || ""}
                      onChange={(event) =>
                        change(
                          writeReviewNote(
                            state,
                            key,
                            event.target.value,
                            selfCheckKey,
                          ),
                        )
                      }
                    />
                  </label>
                );
              })}
              <label className="choice">
                <input
                  type="checkbox"
                  checked={!!state.selfChecks[selfCheckKey]}
                  onChange={(event) =>
                    change({
                      ...state,
                      selfChecks: {
                        ...state.selfChecks,
                        [selfCheckKey]: event.target.checked,
                      },
                    })
                  }
                />
                我已用这张卡讲清对象、条件、机制与至少一个边界
              </label>
              <p className="muted">
                这是你的明确自评，独立于课程状态；补写字段后请重新检查。
              </p>
            </details>
          );
        })}
      </section>
      <section className="panel">
        <h2>下一次先解决哪个问题？</h2>
        <label>
          保留一个具体问题、回看的课程或需要的证据
          <textarea
            aria-label="下次复习的问题"
            maxLength={10000}
            value={state.notes["review:next-question"] || ""}
            onChange={(event) =>
              change({
                ...state,
                notes: {
                  ...state.notes,
                  "review:next-question": event.target.value,
                },
              })
            }
          />
        </label>
        <p>
          <a href="#/records">去学习记录页显式导出、导入或查看本地保存说明</a>
        </p>
      </section>
    </div>
  );
}

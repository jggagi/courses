import { useEffect, useState } from "react";
import { terms } from "../content/catalog";
import { loadGlossary } from "../content/loaders";
import type { GlossaryEntry } from "../content/types";

export default function GlossaryPage({ id }: { id?: string }) {
  const [entries, setEntries] = useState<GlossaryEntry[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { let alive = true; loadGlossary().then(items => { if (alive) setEntries(items); }).catch(() => { if (alive) setError("词条暂时无法加载，请刷新重试。"); }); return () => { alive = false; }; }, []);
  return <article>
    <div className="eyebrow">对象 · 例子 · 混淆 · 出现位置</div><h1>概念词条</h1>
    <div className="concept-index">{terms.map(entry => <a href={`#/glossary/${entry.id}`} key={entry.id}>{entry.term}</a>)}</div>
    {error && <p role="alert">{error}</p>}
    {!entries.length && !error && <p role="status">正在加载词条…</p>}
    {id && !terms.some(e => e.id === id) && <p>没有这个词条，请从目录选择。</p>}
    {entries.filter(entry => !id || entry.id === id).map(entry => <section className="panel" key={entry.id}>
      <h2>{entry.term} · {entry.english}</h2><p><strong>对象：</strong>{entry.object}</p><p>{entry.definition}</p>
      <p><strong>例子：</strong>{entry.example}</p><p><strong>常见混淆：</strong>{entry.confusion}</p>
      <p>出现于 {entry.lessonIds.map(lesson => <a key={lesson} href={`#/lesson/${lesson}`}>{lesson} </a>)}</p>
      <p>相关概念：{entry.relatedIds.map(term => <a key={term} href={`#/glossary/${term}`}>{terms.find(g => g.id === term)?.term} </a>)}</p>
    </section>)}
  </article>;
}

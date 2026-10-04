import { useState } from "react";
import { loadAllLessons } from "../content/loaders";
import { normalizeQuery, searchCourse } from "../content/search";
import type { Lesson } from "../content/types";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [scope, setScope] = useState("directory");
  const [bodies, setBodies] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const results = searchCourse(submitted, scope === "full" ? bodies : []);
  return <article><div className="eyebrow">在本课程中查找对象、机制与条件</div><h1>课程搜索</h1>
    <p>目录与概念可直接检索；选择全文后，会加载本地 24 节正文。搜索不会读取或上传你的笔记。</p>
    <form onSubmit={async event => {
      event.preventDefault();
      if (!normalizeQuery(query)) { setSubmitted(""); return; }
      setError(""); setLoading(true);
      try { if (scope === "full" && !bodies.length) setBodies(await loadAllLessons()); setSubmitted(query); }
      catch { setError("正文暂时无法加载，请刷新后重试。"); }
      finally { setLoading(false); }
    }}>
      <label>搜索词<input aria-label="搜索词" type="search" value={query} maxLength={100} onChange={e => setQuery(e.target.value)} placeholder="例如：收入效应、停产、M08" /></label>
      <label>检索范围<select aria-label="检索范围" value={scope} onChange={e => { setScope(e.target.value); setSubmitted(""); }}><option value="directory">目录与概念</option><option value="full">全部课程正文</option></select></label>
      <button disabled={loading || !normalizeQuery(query)}>搜索</button>
    </form>
    {loading && <p role="status">正在加载并检索正文…</p>}{error && <p role="alert">{error}</p>}
    {submitted && !loading && <section aria-label="搜索结果"><h2>“{submitted}” · {results.length} 项结果</h2>
      {!results.length && <p>没有找到匹配内容。试试更短的词，或切换到全文搜索。</p>}
      {results.map(result => <section className="panel" key={result.id}><h3><a href={result.href}>{result.title}</a></h3><p>{result.excerpt}</p></section>)}
    </section>}
  </article>;
}

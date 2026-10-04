import type { ReactNode } from "react";

type FormulaToken = { kind: "text" | "sub" | "sup"; text: string };
/** Only explicit notation is typeset; nested exponent parentheses stay together. */
export function formulaTokens(line: string): FormulaToken[] {
  const result: FormulaToken[] = [];
  let plain = "";
  for (let i = 0; i < line.length; i++) {
    const mark = line[i];
    if (mark !== "_" && mark !== "^") {
      plain += mark;
      continue;
    }
    const start = i + 1;
    let end = start;
    let token = "";
    if (line[start] === "(") {
      let depth = 1;
      end = start + 1;
      while (end < line.length && depth > 0) {
        if (line[end] === "(") depth++;
        if (line[end] === ")") depth--;
        end++;
      }
      if (depth === 0) token = line.slice(start + 1, end - 1);
    } else {
      while (end < line.length && /[a-zA-Zα-ω0-9]/.test(line[end])) end++;
      token = line.slice(start, end);
    }
    if (!token) {
      plain += mark;
      continue;
    }
    if (plain) {
      result.push({ kind: "text", text: plain });
      plain = "";
    }
    result.push({ kind: mark === "_" ? "sub" : "sup", text: token });
    i = end - 1;
  }
  if (plain) result.push({ kind: "text", text: plain });
  return result;
}

/** A readable original formula remains the accessible name. No runtime font/CDN. */
export default function Formula({ text }: { text: string }) {
  return (
    <div className="formula" role="math" aria-label={text}>
      {text.split("；").map((line, index) => (
        <span className="formula-line" aria-hidden="true" key={index}>
          {formulaTokens(line).map((part, i): ReactNode =>
            part.kind === "sub" ? (
              <sub key={i}>{part.text}</sub>
            ) : part.kind === "sup" ? (
              <sup key={i}>{part.text}</sup>
            ) : (
              <span key={i}>{part.text}</span>
            ),
          )}
        </span>
      ))}
    </div>
  );
}

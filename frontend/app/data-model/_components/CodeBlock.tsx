"use client";

import { useMemo, useState, type ReactNode } from "react";

type Language = "graphql" | "json" | "typescript" | "plain";

type CodeBlockProps = {
  code: string;
  language?: Language;
  filename?: string;
  copyLabel?: string;
  maxHeight?: string;
  /** Optional node rendered to the right of the filename/language label in the header. */
  headerExtra?: ReactNode;
};

const GRAPHQL_KEYWORDS = [
  "type",
  "enum",
  "scalar",
  "interface",
  "union",
  "input",
  "directive",
  "extend",
  "schema",
  "on",
  "query",
  "mutation",
  "subscription",
  "fragment"
];

const TS_KEYWORDS = [
  "export",
  "import",
  "from",
  "const",
  "let",
  "var",
  "type",
  "interface",
  "function",
  "return",
  "if",
  "else",
  "for",
  "while",
  "class",
  "extends",
  "implements",
  "new",
  "enum",
  "null",
  "undefined",
  "true",
  "false",
  "as",
  "default"
];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function tokenizeGraphQL(code: string): string {
  const escaped = escapeHtml(code);
  return escaped
    .replace(/(&quot;&quot;&quot;[\s\S]*?&quot;&quot;&quot;)/g, (m) =>
      `<span class="text-slate-400 italic">${m}</span>`
    )
    .replace(/(#[^\n]*)/g, '<span class="text-slate-400 italic">$1</span>')
    .replace(/(@[A-Za-z_][A-Za-z0-9_]*)/g, '<span class="text-fuchsia-600">$1</span>')
    .replace(/(&quot;[^&]*?&quot;)/g, '<span class="text-amber-600">$1</span>')
    .replace(
      new RegExp(`\\b(${GRAPHQL_KEYWORDS.join("|")})\\b`, "g"),
      '<span class="text-sky-700 font-semibold">$1</span>'
    )
    .replace(/\b(ID|String|Int|Float|Boolean)\b/g, '<span class="text-emerald-700">$1</span>');
}

function tokenizeJson(code: string): string {
  let out = "";
  let i = 0;
  const n = code.length;

  while (i < n) {
    const ch = code[i];

    if (ch === '"') {
      let j = i + 1;
      while (j < n) {
        if (code[j] === "\\" && j + 1 < n) {
          j += 2;
          continue;
        }
        if (code[j] === '"') {
          j += 1;
          break;
        }
        j += 1;
      }
      const literal = code.slice(i, j);
      let k = j;
      while (k < n && (code[k] === " " || code[k] === "\t")) k += 1;
      const isKey = k < n && code[k] === ":";
      const color = isKey ? "text-sky-700" : "text-amber-600";
      out += `<span class="${color}">${escapeHtml(literal)}</span>`;
      i = j;
      continue;
    }

    if (ch === "-" || (ch >= "0" && ch <= "9")) {
      const prev = i > 0 ? code[i - 1] : "";
      const isStart =
        i === 0 ||
        prev === ":" ||
        prev === "," ||
        prev === "[" ||
        prev === " " ||
        prev === "\n" ||
        prev === "\t";
      if (isStart) {
        let j = i + 1;
        while (
          j < n &&
          ((code[j] >= "0" && code[j] <= "9") ||
            code[j] === "." ||
            code[j] === "e" ||
            code[j] === "E" ||
            code[j] === "+" ||
            code[j] === "-")
        ) {
          j += 1;
        }
        out += `<span class="text-emerald-700">${escapeHtml(code.slice(i, j))}</span>`;
        i = j;
        continue;
      }
    }

    if (
      (ch === "t" && code.startsWith("true", i)) ||
      (ch === "f" && code.startsWith("false", i)) ||
      (ch === "n" && code.startsWith("null", i))
    ) {
      const word =
        ch === "t" ? "true" : ch === "f" ? "false" : "null";
      const before = i === 0 ? "" : code[i - 1];
      const after = code[i + word.length] ?? "";
      const isBoundary =
        /[^A-Za-z_]/.test(before || " ") && /[^A-Za-z_]/.test(after || " ");
      if (isBoundary) {
        out += `<span class="text-fuchsia-600">${word}</span>`;
        i += word.length;
        continue;
      }
    }

    if (ch === "{" || ch === "}" || ch === "[" || ch === "]") {
      out += `<span class="text-slate-500">${ch}</span>`;
      i += 1;
      continue;
    }

    if (ch === "," || ch === ":") {
      out += `<span class="text-slate-500">${ch}</span>`;
      i += 1;
      continue;
    }

    out += escapeHtml(ch);
    i += 1;
  }

  return out;
}

function tokenizeTypescript(code: string): string {
  const escaped = escapeHtml(code);
  return escaped
    .replace(/(\/\/[^\n]*)/g, '<span class="text-slate-400 italic">$1</span>')
    .replace(/(&#39;[^&]*?&#39;|&quot;[^&]*?&quot;|`[^`]*?`)/g, '<span class="text-amber-600">$1</span>')
    .replace(
      new RegExp(`\\b(${TS_KEYWORDS.join("|")})\\b`, "g"),
      '<span class="text-sky-700 font-semibold">$1</span>'
    )
    .replace(/\b([A-Z][A-Za-z0-9_]+)\b/g, '<span class="text-emerald-700">$1</span>');
}

function tokenize(code: string, language: Language): string {
  switch (language) {
    case "graphql":
      return tokenizeGraphQL(code);
    case "json":
      return tokenizeJson(code);
    case "typescript":
      return tokenizeTypescript(code);
    default:
      return escapeHtml(code);
  }
}

export function CodeBlock({
  code,
  language = "plain",
  filename,
  copyLabel = "Copy",
  maxHeight,
  headerExtra
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const highlighted = useMemo(() => tokenize(code, language), [code, language]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-[11px] font-semibold text-slate-500">
          {filename ? (
            <>
              <span className="material-symbols-outlined text-[16px] text-slate-400">
                description
              </span>
              <span className="truncate font-mono">{filename}</span>
            </>
          ) : (
            <span className="uppercase tracking-wider">{language}</span>
          )}
          {headerExtra ? (
            <div className="ml-auto flex min-w-0 items-center gap-2">
              {headerExtra}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100"
          aria-label="Copy code"
          style={{ margin: 0 }}
        >
          <span className="material-symbols-outlined text-[14px]">
            {copied ? "check" : "content_copy"}
          </span>
          {copied ? "Copied" : copyLabel}
        </button>
      </div>
      <pre
        className="overflow-auto px-4 py-3 font-mono text-[12.5px] leading-relaxed text-slate-800"
        style={maxHeight ? { maxHeight } : undefined}
      >
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  );
}

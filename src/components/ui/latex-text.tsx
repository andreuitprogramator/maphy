"use client";

import * as React from "react";
import katex from "katex";

// ---------------------------------------------------------------------------
// Bare-LaTeX preprocessing
// Wraps \command sequences that aren't already inside $...$ in $...$
// ---------------------------------------------------------------------------

/**
 * Starting at `start` (which must be a `\` character), extracts the full
 * LaTeX expression by tracking balanced braces. Returns the end position.
 */
function extractMathExpr(text: string, start: number): { end: number } | null {
  let i = start;
  let braceDepth = 0;

  if (text[i] !== "\\") return null;
  i++;
  // consume command name (e.g. "frac", "alpha", "sin")
  while (i < text.length && /[a-zA-Z*]/.test(text[i])) i++;
  if (i === start + 1) return null; // lone backslash with no letters

  let lastGoodPos = i;

  while (i < text.length) {
    const ch = text[i];

    if (ch === "{") {
      braceDepth++;
      i++;
    } else if (ch === "}") {
      if (braceDepth === 0) break; // unmatched close brace — stop
      braceDepth--;
      i++;
      if (braceDepth === 0) lastGoodPos = i;
    } else if (braceDepth > 0) {
      // Inside braces: consume everything, including nested commands
      if (ch === "\\") {
        i++;
        while (i < text.length && /[a-zA-Z*]/.test(text[i])) i++;
      } else {
        i++;
      }
    } else {
      // Top-level (braceDepth === 0)
      if (ch === "\\" && /[a-zA-Z]/.test(text[i + 1] ?? "")) {
        i++;
        while (i < text.length && /[a-zA-Z*]/.test(text[i])) i++;
        lastGoodPos = i;
      } else if (/[+\-=^_<>!*/]/.test(ch)) {
        i++;
        lastGoodPos = i;
      } else if (/[\d.]/.test(ch)) {
        i++;
        lastGoodPos = i;
      } else if (ch === "(" || ch === ")") {
        i++;
        lastGoodPos = i;
      } else if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
        // Peek ahead: continue only if clearly more math follows
        let j = i + 1;
        while (j < text.length && (text[j] === " " || text[j] === "\t" || text[j] === "\n" || text[j] === "\r")) j++;
        if (j < text.length) {
          const next = text[j];
          if (next === "\\" || /[+\-=^_<>!*/\d{]/.test(next)) {
            i = j; // consume whitespace/newlines and keep going
          } else {
            break; // prose follows
          }
        } else {
          break;
        }
      } else {
        break; // punctuation, letters without math context, etc.
      }
    }
  }

  return lastGoodPos > start ? { end: lastGoodPos } : null;
}

/** Wraps bare `\command` sequences (not already in $...$) with $...$. */
function wrapBareMath(text: string): string {
  const out: string[] = [];
  let i = 0;

  while (i < text.length) {
    // Pass through existing $...$ / $$...$$ regions unchanged
    if (text[i] === "$") {
      const isDouble = text.slice(i, i + 2) === "$$";
      const delim = isDouble ? "$$" : "$";
      const close = text.indexOf(delim, i + delim.length);
      if (close !== -1) {
        out.push(text.slice(i, close + delim.length));
        i = close + delim.length;
        continue;
      }
    }

    // Detect bare \command
    if (text[i] === "\\" && i + 1 < text.length && /[a-zA-Z]/.test(text[i + 1])) {
      const result = extractMathExpr(text, i);
      if (result) {
        const expr = text.slice(i, result.end).trim();
        if (expr) {
          out.push(`$${expr}$`);
          i = result.end;
          continue;
        }
      }
    }

    out.push(text[i]);
    i++;
  }

  return out.join("");
}

// ---------------------------------------------------------------------------
// Segment parser (handles $...$ and $$...$$)
// ---------------------------------------------------------------------------

type Segment =
  | { type: "text"; value: string }
  | { type: "display"; value: string }
  | { type: "inline"; value: string };

function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  const re = /(\$\$[\s\S]+?\$\$|\$[^$]{1,500}?\$)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segments.push({ type: "text", value: text.slice(last, m.index) });
    const raw = m[0];
    if (raw.startsWith("$$")) {
      segments.push({ type: "display", value: raw.slice(2, -2).trim() });
    } else {
      segments.push({ type: "inline", value: raw.slice(1, -1).trim() });
    }
    last = m.index + raw.length;
  }
  if (last < text.length) segments.push({ type: "text", value: text.slice(last) });
  return segments;
}

// ---------------------------------------------------------------------------
// KaTeX renderer
// ---------------------------------------------------------------------------

// Macros for commands the AI might use that aren't in KaTeX's default set
const KATEX_MACROS: Record<string, string> = {
  "\\degree": "^{\\circ}",      // 45\degree → 45°
  "\\deg": "^{\\circ}",
  "\\degr": "^{\\circ}",
  "\\grade": "^{\\circ}",      // Romanian: "grade" = degrees
  "\\grád": "^{\\circ}",
  "\\lb": "\\{",                // left brace shorthand
  "\\llb": "^{\\circ}",        // AI sometimes invents this for degrees
  "\\mbox": "\\text",           // \mbox → \text
  "\\hspace": "\\;",
  "\\vspace": "",
};

function renderMath(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      output: "html",
      macros: KATEX_MACROS,
    });
  } catch {
    return tex;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function TextSegment({ value }: { value: string }) {
  const lines = value.split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          {i > 0 && <br />}
          {line}
        </React.Fragment>
      ))}
    </>
  );
}

export function LatexText({ children, className }: { children: string; className?: string }) {
  const segments = React.useMemo(
    () => parseSegments(wrapBareMath(children)),
    [children],
  );
  return (
    <span className={className}>
      {segments.map((seg, i) => {
        if (seg.type === "text") return <TextSegment key={i} value={seg.value} />;
        return (
          <span
            key={i}
            dangerouslySetInnerHTML={{ __html: renderMath(seg.value, seg.type === "display") }}
          />
        );
      })}
    </span>
  );
}

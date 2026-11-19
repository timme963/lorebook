/**
 * Formulas in study content: LaTeX between \( … \) (inline) and \[ … \] (display).
 * No $ delimiters, so amounts of money in business texts are not taken for formulas.
 */

export const MATH_RE = /\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g;

export const hasMath = (s: string): boolean => /\\\(|\\\[/.test(s);

export type Part = { math: false; text: string } | { math: true; tex: string; display: boolean };

export function splitMath(s: string): Part[] {
  const parts: Part[] = [];
  let last = 0;
  for (const m of s.matchAll(MATH_RE)) {
    if (m.index > last) parts.push({ math: false, text: s.slice(last, m.index) });
    parts.push(
      m[1] !== undefined ? { math: true, tex: m[1], display: false } : { math: true, tex: m[2] ?? '', display: true },
    );
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push({ math: false, text: s.slice(last) });
  return parts;
}

/** Formula as readable text – shown while KaTeX loads, and used for read-aloud. */
export function texToPlain(tex: string): string {
  let t = tex;
  for (let i = 0; i < 3; i++) {
    t = t.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)').replace(/\\sqrt\{([^{}]*)\}/g, '√($1)');
  }
  const sym: Record<string, string> = {
    cdot: '·',
    times: '×',
    div: '÷',
    pm: '±',
    le: '≤',
    leq: '≤',
    ge: '≥',
    geq: '≥',
    neq: '≠',
    ne: '≠',
    approx: '≈',
    sum: 'Σ',
    prod: 'Π',
    int: '∫',
    infty: '∞',
    alpha: 'α',
    beta: 'β',
    gamma: 'γ',
    delta: 'δ',
    Delta: 'Δ',
    epsilon: 'ε',
    lambda: 'λ',
    mu: 'μ',
    pi: 'π',
    rho: 'ρ',
    sigma: 'σ',
    Sigma: 'Σ',
    theta: 'θ',
    phi: 'φ',
    omega: 'ω',
    rightarrow: '→',
    to: '→',
    Rightarrow: '⇒',
    leftarrow: '←',
    in: '∈',
    partial: '∂',
    ldots: '…',
    dots: '…',
    percent: '%',
  };
  t = t.replace(
    /\\([a-zA-Z]+)/g,
    (_, name: string) =>
      sym[name] ??
      (/^(left|right|mathrm|text|operatorname|mathit|mathbf|quad|qquad|displaystyle)$/.test(name) ? '' : name),
  );
  return t
    .replace(/\\%/g, '%')
    .replace(/\\[,;: ]/g, ' ')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Whole text with formulas as readable text */
export function stripMath(s: string): string {
  if (!hasMath(s)) return s;
  return splitMath(s)
    .map((p) => (p.math ? texToPlain(p.tex) : p.text))
    .join('');
}

// ---------------------------------------------------------------- Repair on import

/**
 * AI models often forget to double backslashes in JSON. "\(" is no valid JSON escape → parse error.
 * Invalid escapes become a literal backslash.
 */
export function fixInvalidEscapes(json: string): string {
  return json.replace(/\\(.)/gs, (m, c: string) => ('"\\/bfnrtu'.includes(c) ? m : `\\\\${c}`));
}

/**
 * Restores valid but unintended escapes inside formulas: "\frac" parses to form feed + "rac",
 * "\times" to tab + "imes", "\beta" to backspace, "\rho" to CR, "\nu" to newline.
 */
function repairMathString(s: string): string {
  if (!hasMath(s)) return s;
  return s.replace(MATH_RE, (seg) =>
    seg
      .replaceAll('\f', '\\f')
      .replaceAll('\t', '\\t')
      .replaceAll('\b', '\\b')
      .replaceAll('\r', '\\r')
      .replaceAll('\n', '\\n'),
  );
}

export function repairMath<T>(value: T): { value: T; changed: boolean } {
  let changed = false;
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') {
      const r = repairMathString(v);
      if (r !== v) changed = true;
      return r;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return { value: walk(value) as T, changed };
}

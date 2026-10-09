// Safe arithmetic expression evaluator (no eval).
// Supports: + - * / ^, parentheses, unary minus, numbers (incl. 1e-3, 5%),
// variables, and functions: sqrt, ln, log, exp, abs, min, max, pow, round.

const FUNCS = {
  sqrt: Math.sqrt, ln: Math.log, log: Math.log10, exp: Math.exp, abs: Math.abs,
  min: Math.min, max: Math.max, pow: Math.pow,
  round: (x, d = 0) => { const f = 10 ** d; return Math.round(x * f) / f; },
};

function tokenize(src) {
  const t = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      if (/[eE]/.test(src[j] || '') && /[-+0-9]/.test(src[j + 1] || '')) {
        j++; if (/[-+]/.test(src[j])) j++;
        while (j < src.length && /[0-9]/.test(src[j])) j++;
      }
      let v = parseFloat(src.slice(i, j));
      if (src[j] === '%') { v /= 100; j++; }
      t.push({ k: 'num', v }); i = j; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      t.push({ k: 'id', v: src.slice(i, j) }); i = j; continue;
    }
    if ('+-*/^(),'.includes(c)) { t.push({ k: 'op', v: c }); i++; continue; }
    throw new Error(`Unexpected character "${c}"`);
  }
  return t;
}

export function evaluate(src, vars = {}) {
  const toks = tokenize(String(src));
  let p = 0;
  const peek = () => toks[p];
  const eat = (v) => {
    const t = toks[p];
    if (!t || t.v !== v) throw new Error(`Expected "${v}"`);
    p++;
  };
  function expr() {
    let v = term();
    while (peek() && (peek().v === '+' || peek().v === '-')) {
      const op = toks[p++].v; const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  function term() {
    let v = unary();
    while (peek() && (peek().v === '*' || peek().v === '/')) {
      const op = toks[p++].v; const r = unary();
      v = op === '*' ? v * r : v / r;
    }
    return v;
  }
  function unary() {
    if (peek() && peek().v === '-') { p++; return -unary(); }
    if (peek() && peek().v === '+') { p++; return unary(); }
    return power();
  }
  function power() {
    const b = atom();
    if (peek() && peek().v === '^') { p++; return b ** unary(); } // right-assoc
    return b;
  }
  function atom() {
    const t = toks[p++];
    if (!t) throw new Error('Unexpected end of expression');
    if (t.k === 'num') return t.v;
    if (t.k === 'id') {
      if (peek() && peek().v === '(') {
        const f = FUNCS[t.v.toLowerCase()];
        if (!f) throw new Error(`Unknown function ${t.v}`);
        p++; const args = [];
        if (peek() && peek().v !== ')') {
          args.push(expr());
          while (peek() && peek().v === ',') { p++; args.push(expr()); }
        }
        eat(')');
        return f(...args);
      }
      if (t.v in vars) return Number(vars[t.v]);
      if (t.v === 'pi') return Math.PI;
      if (t.v === 'e') return Math.E;
      throw new Error(`Unknown variable ${t.v}`);
    }
    if (t.v === '(') { const v = expr(); eat(')'); return v; }
    throw new Error(`Unexpected "${t.v}"`);
  }
  const v = expr();
  if (p < toks.length) throw new Error('Unexpected trailing input');
  return v;
}

// Parse what a learner types: "8.5", "8.5%", "1,250", "$1,250.40"
export function parseAnswer(s) {
  if (s == null) return NaN;
  const clean = String(s).replace(/[$,\s£€₦]/g, '');
  if (clean === '') return NaN;
  const pct = clean.endsWith('%');
  const n = parseFloat(pct ? clean.slice(0, -1) : clean);
  return n;
}

// Compare learner answer with expected. `unit` "%": expected is stored as a
// decimal (0.085) but learners may type 8.5 or 8.5% or 0.085.
export function isClose(input, expected, unit = '', tol = 0.005) {
  const raw = parseAnswer(input);
  if (!isFinite(raw) || !isFinite(expected)) return false;
  const near = (a, b) => {
    const scale = Math.max(Math.abs(b), 1e-9);
    return Math.abs(a - b) / scale <= tol || Math.abs(a - b) < 1e-6;
  };
  if (unit === '%') return near(raw, expected * 100) || near(raw, expected);
  return near(raw, expected);
}

export function formatValue(v, unit = '', decimals = 2) {
  if (!isFinite(v)) return '—';
  if (unit === '%') return `${(v * 100).toFixed(decimals)}%`;
  const s = Number(v).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  if (unit === '$') return `$${s}`;
  return unit ? `${s} ${unit}` : s;
}

// Roll variables for a calc question. random=false gives the defaults.
export function rollVars(variables = {}, random = false) {
  const out = {};
  for (const [name, spec] of Object.entries(variables)) {
    if (!random || spec.min == null || spec.max == null) { out[name] = spec.value; continue; }
    const step = spec.step || 1;
    const n = Math.floor((spec.max - spec.min) / step);
    const v = spec.min + step * Math.floor(Math.random() * (n + 1));
    out[name] = Number(v.toFixed(10));
  }
  return out;
}

// Evaluate all steps of a calc. Each step's result becomes a variable named step.id.
export function solveCalc(calc, vars) {
  const scope = { ...vars };
  const results = [];
  for (const step of calc.steps || []) {
    const v = evaluate(step.expr, scope);
    scope[step.id] = v;
    results.push(v);
  }
  return { scope, results };
}

// Fill "{name}" placeholders in prompt text. "{name|%}" formats as percent.
export function fillTemplate(text, vars, varSpecs = {}) {
  return String(text || '').replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (m, name) => {
    if (!(name in vars)) return m;
    const spec = varSpecs[name] || {};
    const d = spec.decimals ?? (Number.isInteger(vars[name]) ? 0 : 2);
    return formatValue(vars[name], spec.unit || '', d);
  });
}

// Check that a calc question is sound with defaults and with a few random rolls.
export function validateCalc(calc) {
  try {
    const tries = [rollVars(calc.variables, false), rollVars(calc.variables, true), rollVars(calc.variables, true)];
    let randomOk = true;
    for (let i = 0; i < tries.length; i++) {
      const { results } = solveCalc(calc, tries[i]);
      const bad = results.some((r) => !isFinite(r));
      if (bad && i === 0) return { ok: false, randomOk: false };
      if (bad) randomOk = false;
    }
    return { ok: true, randomOk };
  } catch (e) {
    return { ok: false, randomOk: false, error: e.message };
  }
}

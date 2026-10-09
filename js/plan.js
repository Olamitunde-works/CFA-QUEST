// Study plan generator. Pure functions: inputs -> plan. Different goals,
// timelines, hours and starting points produce different plans.
import { TOPICS, RECOMMENDED_ORDER, topicById, MODULES, moduleKey } from './data.js';
import { todayKey, addDays } from './store.js';

export const STATUS = {
  new:   { label: 'Not started',      mult: 1.0 },
  rusty: { label: 'Read it, rusty',   mult: 0.55 },
  solid: { label: 'Fairly confident', mult: 0.3 },
  done:  { label: 'Mastered',         mult: 0.1 },
};

export const GOALS = {
  pass:   { label: 'Just pass',            mult: 0.9,  review: 0.18, mocks: 3 },
  margin: { label: 'Pass with a margin',   mult: 1.0,  review: 0.22, mocks: 4 },
  ace:    { label: 'Ace it (top decile)',  mult: 1.2,  review: 0.25, mocks: 6 },
};

export const ORDERS = {
  story:  'Build the picture (tools → company → securities → toolkit → ethics)',
  weight: 'Heaviest topics first',
  light:  'Quick wins first (lighter topics for momentum)',
};

export function defaultInputs() {
  const status = {};
  for (const t of TOPICS) status[t.id] = 'new';
  return {
    examDate: '2027-05-15', startDate: todayKey(), weekdayHours: 1.5, weekendHours: 3,
    restDay: 'none', goal: 'margin', order: 'story', firstTopic: '', sessionMinutes: 30, status, doneModules: {}, reminderHour: 19,
  };
}

const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function dayHours(key, inp) {
  const d = new Date(key + 'T12:00:00').getDay();
  if (inp.restDay !== 'none' && DOW[d] === inp.restDay) return 0;
  return d === 0 || d === 6 ? Number(inp.weekendHours) : Number(inp.weekdayHours);
}

function orderTopics(inp) {
  let ids;
  if (inp.order === 'weight') ids = [...TOPICS].sort((a, b) => b.weight[1] - a.weight[1]).map((t) => t.id);
  else if (inp.order === 'light') ids = [...TOPICS].sort((a, b) => a.hours - b.hours).map((t) => t.id);
  else ids = [...RECOMMENDED_ORDER];
  if (inp.firstTopic) ids = [inp.firstTopic, ...ids.filter((i) => i !== inp.firstTopic)];
  // Mastered topics go last; they mostly need review.
  const done = ids.filter((i) => inp.status[i] === 'done');
  return [...ids.filter((i) => inp.status[i] !== 'done'), ...done];
}

export function buildPlan(inp) {
  const start = inp.startDate || todayKey();
  const exam = inp.examDate;
  const days = [];
  for (let k = start; k < exam; k = addDays(k, 1)) days.push(k);
  if (!days.length) return { error: 'The exam date must be after the start date.' };

  const goal = GOALS[inp.goal] || GOALS.margin;
  const totalAvail = days.reduce((s, k) => s + dayHours(k, inp), 0);
  if (totalAvail <= 0) return { error: 'Add some study hours per day.' };

  const order = orderTopics(inp);
  const done = inp.doneModules || {};
  // Queue of learning modules in study order, each with an hour budget.
  const queue = [];
  const need = {};
  for (const id of order) {
    const mods = MODULES[id] || [];
    const per = (topicById(id).hours / Math.max(mods.length, 1)) * (STATUS[inp.status[id]]?.mult ?? 1) * goal.mult;
    need[id] = 0;
    mods.forEach((name, mi) => {
      const h = per * (done[moduleKey(id, mi)] ? 0.15 : 1);
      queue.push({ topicId: id, mi, hours: h });
      need[id] += h;
    });
  }
  const learnNeed = queue.reduce((a, q) => a + q.hours, 0);

  // Review phase: a share of total time plus mock exams (~3h each + review).
  const mockHours = goal.mocks * 5;
  const reviewNeed = Math.max(goal.review * (learnNeed + mockHours) + mockHours, 30);
  const totalNeed = learnNeed + reviewNeed;
  const feasible = totalAvail >= totalNeed * 0.95;

  // If short of time, compress learning proportionally (review shrinks less).
  const learnScale = feasible ? 1 : Math.max(0.35, (totalAvail - Math.min(reviewNeed, totalAvail * 0.18)) / learnNeed);
  for (const q of queue) q.hours *= learnScale;
  const learnHours = learnNeed * learnScale;

  // Walk the calendar, filling modules in sequence.
  const modSegments = [];
  const daily = {}; // date -> { hours, phase, topics: [{topicId, mi, hours}] }
  let qi = 0, left = queue[0]?.hours || 0, cur = null, used = 0;
  let reviewStart = null;
  for (const k of days) {
    let h = dayHours(k, inp);
    if (h === 0) { daily[k] = { hours: 0, phase: 'rest' }; continue; }
    if (used >= learnHours - 1e-6 || qi >= queue.length) {
      if (!reviewStart) reviewStart = k;
      daily[k] = { hours: h, phase: 'review' };
      continue;
    }
    const today = [];
    while (h > 1e-6 && qi < queue.length) {
      const q = queue[qi];
      const take = Math.min(h, left);
      today.push({ topicId: q.topicId, mi: q.mi, hours: take });
      if (!cur || cur.q !== q) { cur = { q, topicId: q.topicId, mi: q.mi, start: k, end: k, hours: 0 }; modSegments.push(cur); }
      cur.end = k; cur.hours += take;
      h -= take; left -= take; used += take;
      if (left <= 1e-6) { qi++; left = qi < queue.length ? queue[qi].hours : 0; }
    }
    daily[k] = { hours: dayHours(k, inp), phase: today.length ? 'learn' : 'review', topics: today };
    if (h > 1e-6 && qi >= queue.length && !reviewStart) reviewStart = addDays(k, 1);
  }
  modSegments.forEach((m) => delete m.q);
  // Topic-level segments from module segments.
  const segments = [];
  for (const m of modSegments) {
    const last = segments[segments.length - 1];
    if (last && last.topicId === m.topicId) { last.end = m.end; last.hours += m.hours; last.modules.push(m); }
    else segments.push({ topicId: m.topicId, start: m.start, end: m.end, hours: m.hours, modules: [m] });
  }
  reviewStart = reviewStart || exam;

  // Weekly summary for the timeline.
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    const slice = days.slice(i, i + 7);
    const w = { start: slice[0], hours: 0, topics: {}, review: 0 };
    for (const k of slice) {
      const d = daily[k];
      w.hours += d.hours;
      if (d.phase === 'review') w.review += d.hours;
      let learned = 0;
      for (const t of d.topics || []) { w.topics[t.topicId] = (w.topics[t.topicId] || 0) + t.hours; learned += t.hours; }
      if (d.phase === 'learn' && d.hours - learned > 1e-6) w.review += d.hours - learned;
    }
    weeks.push(w);
  }

  const weeksLeft = days.length / 7;
  return {
    start, exam, order, segments, modSegments, weeks, daily, reviewStart,
    totalAvail: round(totalAvail), totalNeed: round(totalNeed), learnNeed: round(learnNeed), reviewNeed: round(reviewNeed),
    feasible, compressed: !feasible, learnScale,
    neededPerWeek: round(totalNeed / weeksLeft), availPerWeek: round(totalAvail / weeksLeft),
    mocks: goal.mocks, sessionMinutes: inp.sessionMinutes,
    advice: advise(inp, { feasible, totalAvail, totalNeed, weeksLeft, order }),
  };
}

function advise(inp, r) {
  const tips = [];
  if (!r.feasible) {
    const extra = (r.totalNeed - r.totalAvail) / r.weeksLeft;
    tips.push(`You are about ${Math.round(r.totalNeed - r.totalAvail)} hours short. Adding ~${extra.toFixed(1)} hours a week closes the gap, or consider a later exam window.`);
  } else if (r.totalAvail > r.totalNeed * 1.4) {
    tips.push('You have plenty of runway. Use the spare time for extra review rounds and more mock exams rather than slowing down.');
  }
  if (inp.status.ethics !== 'done') tips.push('Ethics is the heaviest topic (15–20%). Even before you reach it in the plan, do a few Ethics review items each week.');
  if (inp.status.quant === 'rusty') tips.push('Quant is marked rusty: test first with the review queue and only re-read what you miss.');
  if (Number(inp.sessionMinutes) <= 30) tips.push(`Short ${inp.sessionMinutes}-minute sessions suit a mission-at-a-time rhythm. Two sessions with a break beat one long one.`);
  return tips;
}

const round = (x) => Math.round(x * 10) / 10;

export function todayFromPlan(plan, key = todayKey()) {
  if (!plan?.result?.daily) return null;
  return plan.result.daily[key] || null;
}

export function moduleLabel(item) {
  const t = topicById(item.topicId);
  const name = (MODULES[item.topicId] || [])[item.mi] || '';
  return { topic: t, num: item.mi + 1, name, text: `${t.short} · M${item.mi + 1} ${name}` };
}

// Upcoming study days (for the plan view, emails and calendar export).
export function upcoming(plan, from = todayKey(), n = 7) {
  const out = [];
  if (!plan?.result?.daily) return out;
  for (let k = from, i = 0; i < 400 && out.length < n && k < plan.result.exam; i++, k = addDays(k, 1)) {
    const d = plan.result.daily[k];
    if (d) out.push({ date: k, ...d });
  }
  return out;
}

export function dayText(d) {
  if (!d || d.phase === 'rest') return { title: 'Rest day', lines: ['Recharge. A 5-minute review keeps your streak alive.'] };
  if (d.phase === 'review') return { title: `${fmtH(d.hours)} review & mock exams`, lines: ['Clear your review queue, then work timed practice or a mock exam.'] };
  const lines = d.topics.map((t) => `${moduleLabel(t).text} (${fmtH(t.hours)})`);
  const learned = d.topics.reduce((a, t) => a + t.hours, 0);
  if (d.hours - learned > 0.05) lines.push(`Review & practice (${fmtH(d.hours - learned)})`);
  return { title: `${fmtH(d.hours)} of study`, lines };
}
const fmtH = (h) => (h >= 1 ? `${Math.round(h * 4) / 4}h` : `${Math.round(h * 60)} min`);

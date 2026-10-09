// Spaced repetition (Leitner boxes). Items reference a question or field-manual card in a level.
import { state, save, todayKey, addDays } from './store.js';

const INTERVALS = [0, 1, 3, 7, 14, 30, 60]; // days by box

const key = (levelId, kind, ref) => `${levelId}::${kind}::${ref}`;

export function enrollLevel(level) {
  // Called when a level is first studied: enroll its questions and cards (due in 1 day).
  const srs = state.progress.srs;
  const due = addDays(todayKey(), 1);
  const all = [...level.missions.map((m) => m.check).filter(Boolean), ...level.boss];
  for (const q of all) {
    const k = key(level.id, 'q', q.id);
    if (!srs[k]) srs[k] = { levelId: level.id, kind: 'q', ref: q.id, box: 1, due, losId: q.losId };
  }
  level.fieldManual.forEach((c, i) => {
    const k = key(level.id, 'card', String(i));
    if (!srs[k]) srs[k] = { levelId: level.id, kind: 'card', ref: String(i), box: 1, due };
  });
  save('progress');
}

export function grade(itemKey, correct) {
  const it = state.progress.srs[itemKey];
  if (!it) return;
  it.box = correct ? Math.min(it.box + 1, INTERVALS.length - 1) : 1;
  it.due = addDays(todayKey(), correct ? INTERVALS[it.box] : 1);
  it.lapses = (it.lapses || 0) + (correct ? 0 : 1);
  save('progress');
}

// Mark a wrong answer seen inside a level: bring it back tomorrow.
export function recordMiss(levelId, q) {
  const k = key(levelId, 'q', q.id);
  const srs = state.progress.srs;
  srs[k] = { ...(srs[k] || { levelId, kind: 'q', ref: q.id, losId: q.losId }), box: 1, due: addDays(todayKey(), 1) };
  save('progress');
}

// Practice-question misses from the CFA portal: make every item for that LOS due today.
export function flagLos(levelId, losId, note = '') {
  const t = todayKey();
  let n = 0;
  for (const it of Object.values(state.progress.srs)) {
    if (it.levelId === levelId && it.losId === losId) { it.due = t; it.box = 1; n++; }
  }
  state.progress.misses.push({ date: t, levelId, losId, note });
  save('progress');
  return n;
}

export function dueItems(limit = 30) {
  const t = todayKey();
  return Object.entries(state.progress.srs)
    .filter(([, it]) => it.due <= t && state.levels[it.levelId])
    .sort((a, b) => a[1].box - b[1].box || a[1].due.localeCompare(b[1].due))
    .slice(0, limit)
    .map(([k, it]) => ({ key: k, ...it }));
}

export function dueCount() {
  const t = todayKey();
  return Object.values(state.progress.srs).filter((it) => it.due <= t && state.levels[it.levelId]).length;
}

export function resolveItem(item) {
  const level = state.levels[item.levelId];
  if (!level) return null;
  if (item.kind === 'card') return { level, card: level.fieldManual[Number(item.ref)] };
  const q = [...level.missions.map((m) => m.check).filter(Boolean), ...level.boss].find((x) => x.id === item.ref);
  return q ? { level, question: q } : null;
}

export function masteryForLevel(levelId) {
  const items = Object.values(state.progress.srs).filter((it) => it.levelId === levelId);
  if (!items.length) return 0;
  return items.reduce((s, it) => s + Math.min(it.box - 1, 4) / 4, 0) / items.length;
}

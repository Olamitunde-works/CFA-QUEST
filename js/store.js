// Persistence: IndexedDB key-value store, loaded into memory at startup.
import { DEMO_LEVEL } from './data.js';

const DB = 'cfa-quest';
const STORE = 'kv';
let db;

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function idb(mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const r = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(r && r.result);
    tx.onerror = () => reject(tx.error);
  });
}
const get = (k) => idb('readonly', (s) => s.get(k));
const put = (k, v) => idb('readwrite', (s) => s.put(v, k));

const fallback = new Map(); // used if IndexedDB is unavailable (private mode etc.)

export const state = {
  settings: null, // { name, world, accessCode, onboarded, dailyGoal }
  levels: {},     // id -> level
  progress: null, // xp, streak, levelState, srs, log, misses
  plan: null,     // { inputs, result }
};

function defaultProgress() {
  return { xp: 0, streak: { count: 0, last: null }, levelState: {}, srs: {}, days: {}, misses: [] };
}

export async function load() {
  try { db = await open(); } catch { db = null; }
  const read = async (k) => (db ? get(k) : fallback.get(k));
  state.settings = (await read('settings')) || { onboarded: false, dailyGoal: 100 };
  state.levels = (await read('levels')) || {};
  state.progress = { ...defaultProgress(), ...((await read('progress')) || {}) };
  state.plan = (await read('plan')) || null;
  if (!state.levels[DEMO_LEVEL.id] && !state.settings.demoRemoved) state.levels[DEMO_LEVEL.id] = DEMO_LEVEL;
  else if (state.levels[DEMO_LEVEL.id]) state.levels[DEMO_LEVEL.id] = DEMO_LEVEL; // keep demo current
}

export async function save(...keys) {
  for (const k of keys) {
    const v = JSON.parse(JSON.stringify(state[k]));
    try { if (db) await put(k, v); else fallback.set(k, v); } catch (e) { console.error('save failed', k, e); }
  }
}

export function exportData() {
  return JSON.stringify({ app: 'cfa-quest', version: 1, exportedAt: new Date().toISOString(),
    settings: { ...state.settings, accessCode: undefined }, levels: state.levels, progress: state.progress, plan: state.plan }, null, 1);
}

export async function importData(json) {
  const d = JSON.parse(json);
  if (d.app !== 'cfa-quest') throw new Error('This file is not a CFA Quest backup.');
  const code = state.settings?.accessCode;
  state.settings = { ...d.settings, accessCode: code };
  state.levels = d.levels || {};
  state.progress = { ...defaultProgress(), ...(d.progress || {}) };
  state.plan = d.plan || null;
  await save('settings', 'levels', 'progress', 'plan');
}

export async function resetProgress() {
  state.progress = defaultProgress();
  await save('progress');
}

// ---------- dates ----------
export const todayKey = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};
export const addDays = (key, n) => {
  const d = new Date(key + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return todayKey(d);
};

// ---------- XP + streak ----------
export function awardXP(amount) {
  const p = state.progress;
  const t = todayKey();
  p.xp += amount;
  p.days[t] = (p.days[t] || 0) + amount;
  if (p.streak.last !== t) {
    p.streak.count = p.streak.last === addDays(t, -1) ? p.streak.count + 1 : 1;
    p.streak.last = t;
  }
  save('progress');
}

export function currentStreak() {
  const s = state.progress.streak;
  const t = todayKey();
  if (s.last === t || s.last === addDays(t, -1)) return s.count;
  return 0;
}

export function levelState(id) {
  const ls = state.progress.levelState;
  if (!ls[id]) ls[id] = { missionsDone: [], sectionsDone: [], bossBest: null, bossPassed: false, startedAt: todayKey() };
  if (!ls[id].sectionsDone) ls[id].sectionsDone = [];
  return ls[id];
}

export function levelCompletion(level) {
  const s = state.progress.levelState[level.id];
  if (!s) return 0;
  if (level.slides?.length) {
    const seen = ((s.slideMax ?? -1) + 1) / level.slides.length;
    return Math.min(1, seen) * 0.8 + (s.bossPassed ? 0.2 : 0);
  }
  if (level.map?.sections?.length) {
    const total = level.map.sections.length + 1;
    return ((s.sectionsDone || []).length + (s.bossPassed ? 1 : 0)) / total;
  }
  const total = level.missions.length + 1;
  return (s.missionsDone.length + (s.bossPassed ? 1 : 0)) / total;
}

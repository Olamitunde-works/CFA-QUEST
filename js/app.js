import { state, load, save, awardXP, currentStreak, levelState, levelCompletion, todayKey, exportData, importData, resetProgress } from './store.js';
import { TOPICS, LENSES, WORLDS, MODULES, moduleKey, topicById, rankFor, personalize, DEMO_LEVEL } from './data.js';
import { rollVars, solveCalc, fillTemplate, isClose, formatValue } from './expr.js';
import { enrollLevel, grade, recordMiss, flagLos, dueItems, dueCount, resolveItem, masteryForLevel } from './srs.js';
import { buildPlan, defaultInputs, STATUS, GOALS, ORDERS, todayFromPlan, moduleLabel, upcoming, dayText } from './plan.js';
import { syncReminders, unsubscribeReminders, downloadICS } from './reminders.js';
import { callClaude, generateLevel, coachSystem } from './ai.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const app = $('#app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const P = (t) => personalize(t, state.settings.world);
const LETTERS = ['A', 'B', 'C', 'D', 'E'];

// ---------------- markdown-lite ----------------
function inline(s) {
  return s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
}
function md(src) {
  const text = esc(P(src || ''));
  const parts = text.split(/```(\w*)\n?([\s\S]*?)```/g);
  let out = '';
  for (let i = 0; i < parts.length; i++) {
    if (i % 3 === 1) continue;
    if (i % 3 === 2) { out += `<div class="formula">${parts[i].trim()}</div>`; continue; }
    const lines = parts[i].split('\n');
    let para = [], list = [];
    const flushP = () => { if (para.length) out += `<p>${inline(para.join(' '))}</p>`; para = []; };
    const flushL = () => { if (list.length) out += `<ul>${list.map((l) => `<li>${inline(l)}</li>`).join('')}</ul>`; list = []; };
    for (const raw of lines) {
      const l = raw.trim();
      if (!l) { flushP(); flushL(); continue; }
      const h = l.match(/^#{1,4}\s+(.*)/);
      if (h) { flushP(); flushL(); out += `<h4>${inline(h[1])}</h4>`; continue; }
      const b = l.match(/^(?:[-*•]|\d+[.)])\s+(.*)/);
      if (b) { flushP(); list.push(b[1]); continue; }
      flushL(); para.push(l);
    }
    flushP(); flushL();
  }
  return out;
}

// ---------------- feedback: toasts, XP, confetti ----------------
function toast(msg, cls = '') {
  const t = document.createElement('div');
  t.className = `toast ${cls}`; t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 3300);
}
function gainXP(n, why = '') {
  const before = rankFor(state.progress.xp).name;
  awardXP(n);
  toast(`+${n} XP${why ? ' · ' + why : ''}`, 'xp');
  const after = rankFor(state.progress.xp).name;
  if (after !== before) { setTimeout(() => toast(`🎖 Promoted to ${after}!`), 500); confetti(); }
  renderHUD();
}
function confetti() {
  const c = $('#confetti'), ctx = c.getContext('2d');
  c.width = innerWidth; c.height = innerHeight;
  const colors = ['#CCF5AC', '#6A8E7F', '#C29979', '#E8836A', '#F6F2EA'];
  const ps = Array.from({ length: 140 }, () => ({ x: innerWidth / 2, y: innerHeight / 3, vx: (Math.random() - .5) * 14, vy: Math.random() * -12 - 4, r: Math.random() * 6 + 3, c: colors[Math.floor(Math.random() * colors.length)], a: Math.random() * 6 }));
  let f = 0;
  (function tick() {
    ctx.clearRect(0, 0, c.width, c.height);
    for (const p of ps) { p.vy += .35; p.x += p.vx; p.y += p.vy; p.a += .2; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * .6); ctx.restore(); }
    if (++f < 120) requestAnimationFrame(tick); else ctx.clearRect(0, 0, c.width, c.height);
  })();
}
function modal(html, onMount) {
  const m = $('#modal');
  m.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  m.hidden = false;
  const close = () => { m.hidden = true; m.innerHTML = ''; };
  onMount?.(m, close);
  return close;
}

// ---------------- HUD ----------------
function renderHUD() {
  const p = state.progress, r = rankFor(p.xp);
  const today = p.days[todayKey()] || 0, goal = state.settings.dailyGoal || 100;
  $('#hud').innerHTML = `
    <span class="hud-chip" title="Rank">🎖 <b>${esc(r.name)}</b><span class="xpbar"><i style="width:${Math.round(r.pct * 100)}%"></i></span></span>
    <span class="hud-chip" title="Day streak">🔥 <b>${currentStreak()}</b></span>
    <span class="hud-chip" title="Today's XP vs daily goal">⚡ <b>${today}</b>/${goal}</span>
    <button class="hud-chip btn-focus" id="hudFocus" style="cursor:pointer" title="Start a focus session">⏱ Focus</button>`;
  $('#hudFocus').onclick = () => startFocus();
  const d = dueCount();
  $('#dueBadge').textContent = d ? String(d) : '';
}

// ---------------- focus timer ----------------
let focusTimer = null;
function startFocus(minutes) {
  minutes = minutes || state.plan?.inputs?.sessionMinutes || 25;
  clearInterval(focusTimer);
  const end = Date.now() + minutes * 60000;
  const box = $('#focus'); box.hidden = false;
  const tick = () => {
    const left = Math.max(0, end - Date.now());
    const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
    $('#focusTime').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    if (left <= 0) { clearInterval(focusTimer); box.hidden = true; confetti(); toast('⏱ Focus session complete — take a 5-minute break!'); gainXP(15, 'focus session'); }
  };
  tick(); focusTimer = setInterval(tick, 1000);
  toast(`⏱ ${minutes}-minute focus session started`);
}
$('#focusClose').onclick = () => { clearInterval(focusTimer); $('#focus').hidden = true; };

// ---------------- router ----------------
const routes = { '': viewHome, level: viewLevel, topic: viewTopic, review: viewReview, plan: viewPlan, add: viewAdd, settings: viewSettings };
let coachCtx = {};
function route() {
  const [path, qs] = location.hash.replace(/^#\/?/, '').split('?');
  const [name, id] = path.split('/');
  const params = Object.fromEntries(new URLSearchParams(qs || ''));
  $$('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.nav === (name || 'home')));
  coachCtx = {};
  updateCoachCtx();
  (routes[name] || viewHome)(id, params);
  window.scrollTo(0, 0);
  renderHUD();
}
window.addEventListener('hashchange', route);

// ---------------- helpers ----------------
const levelsFor = (topicId) => Object.values(state.levels).filter((l) => l.topicId === topicId)
  .sort((a, b) => (a.source === 'demo') - (b.source === 'demo') || (a.createdAt || '').localeCompare(b.createdAt || ''));
function levelForModule(topicId, mi) {
  return Object.values(state.levels).find((l) => l.topicId === topicId && l.moduleIdx === mi);
}
function topicProgress(topicId) {
  const ls = levelsFor(topicId);
  if (!ls.length) return 0;
  return ls.reduce((s, l) => s + levelCompletion(l), 0) / ls.length;
}
function ring(pct, color) {
  const r = 18, c = 2 * Math.PI * r;
  return `<svg class="ring" viewBox="0 0 44 44" style="--tc:${color}"><circle class="bg" cx="22" cy="22" r="${r}"/><circle class="fg" cx="22" cy="22" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"/><text x="22" y="26" text-anchor="middle">${Math.round(pct * 100)}%</text></svg>`;
}
function fmtDate(k) { return new Date(k + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }

// ---------------- HOME ----------------
function viewHome() {
  const p = state.progress, r = rankFor(p.xp);
  const today = p.days[todayKey()] || 0, goal = state.settings.dailyGoal || 100;
  const allLevels = Object.values(state.levels);
  const cleared = allLevels.filter((l) => state.progress.levelState[l.id]?.bossPassed).length;
  const due = dueCount();
  const inProgress = allLevels.find((l) => { const s = p.levelState[l.id]; return s && !s.bossPassed; });
  const tp = todayFromPlan(state.plan);
  const quests = [];
  if (due) quests.push({ href: '#/review', ico: '🔁', t: `Clear ${due} review item${due > 1 ? 's' : ''}`, s: 'Spaced repetition keeps old topics alive' });
  if (inProgress) quests.push({ href: `#/level/${inProgress.id}`, ico: topicById(inProgress.topicId).icon, t: `Continue: ${inProgress.title}`, s: `${Math.round(levelCompletion(inProgress) * 100)}% complete` });
  if (tp?.phase === 'learn' && tp.topics?.length) {
    const first = tp.topics[0], lab = moduleLabel(first);
    const lvl = levelForModule(first.topicId, first.mi);
    quests.push({ href: lvl ? `#/level/${lvl.id}` : `#/add?topic=${first.topicId}&mod=${first.mi}`, ico: '🗓', t: `Today: ${lab.topic.short} M${lab.num} · ${lab.name}`, s: `${tp.hours}h on your plan${tp.topics.length > 1 ? ` · +${tp.topics.length - 1} more` : ''}${lvl ? '' : ' · tap to add this reading'}` });
  } else if (tp?.phase === 'review') quests.push({ href: '#/review', ico: '🗓', t: 'Plan: review & mock exam phase', s: `${tp.hours}h today` });
  else if (tp?.phase === 'rest') quests.push({ href: '#/plan', ico: '🌴', t: 'Rest day on your plan', s: 'Recharge — the streak survives a light review' });
  else if (!state.plan) quests.push({ href: '#/plan', ico: '🗓', t: 'Build your study plan', s: 'Exam date + hours → a schedule that fits' });
  if (!allLevels.some((l) => l.source !== 'demo')) quests.push({ href: '#/add', ico: '📸', t: 'Add your first reading', s: 'Upload screenshots, get a playable level' });
  if (!quests.length) quests.push({ href: '#/add', ico: '📸', t: 'Add your next reading', s: 'Keep the story moving' });

  app.innerHTML = `
  <section class="hero">
    <div class="card hero-main">
      <div class="kicker">${esc(state.settings.world?.company || '')} · Level I</div>
      <h1>${greeting()}, ${esc(state.settings.name || 'Candidate')}</h1>
      <div class="rank">🎖 ${esc(r.name)}${r.next ? ` → ${esc(r.next.name)}` : ''}</div>
      <div class="bigbar"><i style="width:${Math.round(r.pct * 100)}%"></i></div>
      <small>${p.xp.toLocaleString()} XP${r.next ? ` · ${(r.next.xp - p.xp).toLocaleString()} to promotion` : ''}</small>
      <div class="stats">
        <div class="stat"><b>🔥 ${currentStreak()}</b><span>day streak</span></div>
        <div class="stat"><b>${today}/${goal}</b><span>XP today</span></div>
        <div class="stat"><b>${cleared}</b><span>levels cleared</span></div>
        <div class="stat"><b>${due}</b><span>reviews due</span></div>
      </div>
    </div>
    <div class="card">
      <div class="spread"><h3 style="margin:0">Today's quests</h3><button class="btn small ghost" id="qFocus">⏱ Focus</button></div>
      <div class="quests" style="margin-top:12px">
        ${quests.slice(0, 4).map((q) => `<a class="quest" href="${q.href}"><span class="quest-ico">${q.ico}</span><span><b>${esc(q.t)}</b><small>${esc(q.s)}</small></span><span class="go">→</span></a>`).join('')}
      </div>
    </div>
  </section>
  ${LENSES.map((lens) => `
    <section class="lens">
      <div class="lens-head"><h3>${esc(lens.name)}</h3><small>${esc(lens.sub)}</small></div>
      <div class="tiles">
        ${TOPICS.filter((t) => t.lens === lens.id).map((t) => {
          const n = levelsFor(t.id).length;
          return `<a class="tile" href="#/topic/${t.id}" style="--tc:${t.color}">
            ${ring(topicProgress(t.id), t.color)}
            <div class="tile-ico">${t.icon}</div>
            <h4>${esc(t.name)}</h4>
            <p>${esc(t.blurb)}</p>
            <div class="tile-foot"><span>${n} reading${n === 1 ? '' : 's'}</span><span>${t.weight[0]}–${t.weight[1]}% of exam</span></div>
          </a>`;
        }).join('')}
      </div>
    </section>`).join('')}`;
  $('#qFocus').onclick = () => startFocus();
}
function greeting() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; }

// ---------------- TOPIC ----------------
function viewTopic(id) {
  const t = topicById(id);
  if (!t) return viewHome();
  const extra = levelsFor(id).filter((l) => l.moduleIdx == null);
  app.innerHTML = `
    <a href="#/" class="muted" style="text-decoration:none">← Map</a>
    <div class="card topic-hero" style="--tc:${t.color};margin-top:12px">
      <div class="spread">
        <div><div class="kicker">${t.weight[0]}–${t.weight[1]}% of the exam · ~${t.hours}h first pass</div><h1 style="margin:0">${t.icon} ${esc(t.name)}</h1></div>
        <a class="btn primary" href="#/add?topic=${t.id}">📸 Add a reading</a>
      </div>
      <p class="muted" style="margin:10px 0 0">${esc(t.blurb)}</p>
    </div>
    <h3 style="margin-top:22px">Learning modules</h3>
    <div class="level-list">
      ${(MODULES[id] || []).map((name, mi) => {
        const l = levelForModule(id, mi);
        if (!l) return `<a class="level-row locked" href="#/add?topic=${id}&mod=${mi}"><span class="level-num" style="color:${t.color}">${mi + 1}</span><span class="meta"><b>${esc(name)}</b><small>Not built yet · tap to add this reading</small></span><span class="go muted">📸</span></a>`;
        return levelRow(l, String(mi + 1), t);
      }).join('')}
      ${extra.length ? `<h3 style="margin:14px 0 0">Other levels</h3>${extra.map((l) => levelRow(l, '★', t)).join('')}` : ''}
    </div>`;
}

function levelRow(l, num, t) {
  const pct = levelCompletion(l), mast = masteryForLevel(l.id);
  const s = state.progress.levelState[l.id];
  return `<a class="level-row" href="#/level/${l.id}">
    <span class="level-num" style="color:${t.color}">${s?.bossPassed ? '★' : num}</span>
    <span class="meta"><b>${esc(l.title)}</b><small>${l.missions.length} missions · ${l.boss.length}-question boss${l.source === 'demo' ? ' · demo' : ''} · mastery ${Math.round(mast * 100)}%</small>
    <div class="progress"><i style="width:${Math.round(pct * 100)}%"></i></div></span>
    <span class="go muted">→</span></a>`;
}

// ---------------- QUESTION WIDGET ----------------
// Renders an MCQ or calc. onAnswer(correct) fires once on first attempt. onContinue fires when the learner moves on.
function renderQuestion(el, q, { randomize = false, tag = 'CHECK', onAnswer, onContinue, continueLabel = 'Continue →' } = {}) {
  let answered = false;
  const fire = (ok) => { if (!answered) { answered = true; onAnswer?.(ok); } };
  const contBtn = () => onContinue ? `<div class="row" style="margin-top:14px"><button class="btn primary" data-cont>${continueLabel}</button></div>` : '';
  const bindCont = () => { const b = $('[data-cont]', el); if (b) b.onclick = () => onContinue(); };

  if (q.type === 'mcq') {
    el.innerHTML = `<div class="q"><span class="q-tag">${tag}</span><div class="q-prompt">${md(q.prompt)}</div>
      <div class="opts">${q.options.map((o, i) => `<button class="opt" data-i="${i}"><span class="letter">${LETTERS[i]}</span><span>${esc(P(o))}</span></button>`).join('')}</div><div data-fb></div></div>`;
    $$('.opt', el).forEach((b) => b.onclick = () => {
      const i = Number(b.dataset.i), ok = i === q.answer;
      $$('.opt', el).forEach((x) => { x.disabled = true; if (Number(x.dataset.i) === q.answer) x.classList.add('right'); });
      if (!ok) { b.classList.add('wrong'); el.querySelector('.q').classList.add('shake'); }
      $('[data-fb]', el).innerHTML = `<div class="feedback ${ok ? 'good' : 'bad'}"><b>${ok ? '✅ Correct.' : `❌ Not quite — the answer is ${LETTERS[q.answer]}.`}</b> ${md(q.explanation)}${q.trap ? `<div class="trap">⚠ Exam trap: ${esc(P(q.trap))}</div>` : ''}</div>${contBtn()}`;
      bindCont(); fire(ok);
    });
    return;
  }

  // calc
  const vars = rollVars(q.variables, randomize);
  let solved;
  try { solved = solveCalc(q, vars); } catch (e) { el.innerHTML = `<div class="q">This calculation could not be rendered (${esc(e.message)}).</div>${contBtn()}`; bindCont(); return; }
  const specs = q.variables || {};
  let tries = 0;
  el.innerHTML = `<div class="q"><span class="q-tag">🧮 ${tag}</span><div class="q-prompt">${md(fillTemplate(P(q.prompt), vars, specs))}</div>
    ${randomize && Object.values(specs).some((s) => s.min != null) ? '<div class="vars"><span>🎲 fresh numbers this time</span></div>' : ''}
    <div class="steps">${q.steps.map((s, i) => `<div class="step" data-s="${i}">
      <div class="lab"><b>${i + 1}. ${esc(P(s.label))}</b><small>${s.unit === '%' ? 'in % (e.g. 8.25)' : s.unit === '$' ? 'in $' : 'number'}</small></div>
      <input inputmode="decimal" autocomplete="off" placeholder="${s.unit === '%' ? '%' : '0.00'}" aria-label="${esc(s.label)}" />
      <span class="res"></span></div>`).join('')}</div>
    <div class="row" style="margin-top:12px"><button class="btn green" data-check>Check</button><button class="btn ghost small" data-hint>💡 Hint</button><button class="btn ghost small" data-show>Show solution</button></div>
    <div data-fb></div></div>`;
  const reveal = (ok) => {
    $$('.step', el).forEach((row, i) => { const s = q.steps[i]; $('.res', row).textContent = formatValue(solved.results[i], s.unit, s.decimals ?? 2); $('input', row).disabled = true; });
    $('[data-check]', el).remove(); $('[data-show]', el).remove(); $('[data-hint]', el).remove();
    $('[data-fb]', el).innerHTML = `<div class="feedback ${ok ? 'good' : 'bad'}"><b>${ok ? '✅ Nailed it.' : '📘 Worked solution:'}</b> ${md(q.explanation)}
      ${q.keystrokes?.length ? `<div class="keys">${q.keystrokes.map((k) => `<div>${esc(k)}</div>`).join('')}</div>${randomize ? '<small>Keystrokes shown for the original numbers — same sequence, your numbers.</small>' : ''}` : ''}</div>${contBtn()}`;
    bindCont();
  };
  $('[data-hint]', el).onclick = () => {
    const firstOpen = $$('.step', el).findIndex((r) => !r.classList.contains('ok'));
    const s = q.steps[Math.max(0, firstOpen)];
    toast(`💡 ${P(s.hint || s.label)}`);
  };
  $('[data-check]', el).onclick = () => {
    tries++;
    let all = true;
    $$('.step', el).forEach((row, i) => {
      const s = q.steps[i];
      const ok = isClose($('input', row).value, solved.results[i], s.unit, 0.0075);
      row.classList.toggle('ok', ok); row.classList.toggle('no', !ok);
      if (!ok) all = false;
    });
    if (all) { fire(tries === 1); reveal(true); }
    else {
      if (tries === 1) fire(false);
      el.querySelector('.q').classList.remove('shake'); void el.offsetWidth; el.querySelector('.q').classList.add('shake');
      $('[data-fb]', el).innerHTML = `<div class="feedback bad">Red steps are off. Fix them and check again, or reveal the solution.</div>`;
    }
  };
  $('[data-show]', el).onclick = () => { fire(false); reveal(false); };
  $$('.step input', el).forEach((inp) => inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('[data-check]', el)?.click(); }));
}

// ---------------- LEVEL ----------------
function viewLevel(id, params) {
  const level = state.levels[id];
  if (!level) { app.innerHTML = '<div class="card empty">Level not found. <a href="#/">Back to the map</a></div>'; return; }
  const t = topicById(level.topicId);
  const ls = levelState(level.id);
  if (!ls.enrolled) { enrollLevel(level); ls.enrolled = true; save('progress'); }
  let tab = params.tab || (ls.missionsDone.length ? 'missions' : 'brief');
  let mi = Math.min(level.missions.findIndex((m) => !ls.missionsDone.includes(m.id)), level.missions.length - 1);
  if (mi < 0) mi = 0;

  const draw = () => {
    coachCtx = { level, mission: tab === 'missions' ? level.missions[mi] : null };
    updateCoachCtx();
    const pct = levelCompletion(level);
    app.innerHTML = `
      <a href="#/topic/${t.id}" class="muted" style="text-decoration:none">← ${esc(t.name)}</a>
      <div class="level-top" style="margin-top:10px">
        <div style="flex:1;min-width:240px"><div class="kicker" style="color:${t.color}">${t.icon} ${esc(t.short)}${level.module ? ' · ' + esc(level.module) : ''}</div><h1 style="margin:0">${esc(level.title)}</h1></div>
        <div style="min-width:160px"><small>${Math.round(pct * 100)}% complete</small><div class="progress"><i style="width:${pct * 100}%"></i></div></div>
      </div>
      <div class="tabs" role="tablist">
        ${[['brief', '🎬 Briefing'], ['missions', `🗺 Missions ${ls.missionsDone.length}/${level.missions.length}`], ['manual', '📘 Field Manual'], ['boss', `👹 Boss${ls.bossPassed ? ' ★' : ''}`], ['los', '✅ LOS']]
          .map(([k, l]) => `<button role="tab" class="${tab === k ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('')}
      </div>
      <div id="pane"></div>`;
    $$('[data-tab]').forEach((b) => b.onclick = () => { tab = b.dataset.tab; draw(); });
    const pane = $('#pane');
    ({ brief: paneBrief, missions: paneMissions, manual: paneManual, boss: paneBoss, los: paneLos })[tab](pane);
  };

  function paneBrief(pane) {
    const b = level.briefing || {};
    pane.innerHTML = `
      <div class="scene"><h2>${esc(P(b.headline || level.title))}</h2><div class="prose">${md(b.story)}</div></div>
      ${b.stakes ? `<div class="alert warn"><b>Stakes:</b> ${esc(P(b.stakes))}</div>` : ''}
      <div class="card" style="margin-top:16px"><h3>What you'll be able to do</h3>
        <ul class="los-list">${level.los.map((l) => `<li><span class="chk">${esc(l.id)}</span>${esc(l.text)}</li>`).join('')}</ul></div>
      ${level.source === 'demo' ? `<div class="alert ok" style="margin-top:16px">This is a <b>demo level</b> written to show how the app works. Your own levels are built from your curriculum screenshots.</div>` : ''}
      <div class="row" style="margin-top:18px"><button class="btn primary" id="go">Start mission ${mi + 1} →</button><button class="btn ghost" id="focusGo">⏱ Start a focus session too</button></div>`;
    $('#go').onclick = () => { tab = 'missions'; draw(); };
    $('#focusGo').onclick = () => { startFocus(); tab = 'missions'; draw(); };
  }

  function paneMissions(pane) {
    const m = level.missions[mi];
    if (!m) { pane.innerHTML = '<div class="card empty">This level has no missions.</div>'; return; }
    const done = ls.missionsDone.includes(m.id);
    pane.innerHTML = `
      <div class="path">${level.missions.map((x, i) => `${i ? '<span class="link"></span>' : ''}<button class="node ${ls.missionsDone.includes(x.id) ? 'done' : ''} ${i === mi ? 'current' : ''}" data-m="${i}" title="${esc(P(x.title))}">${ls.missionsDone.includes(x.id) ? '✓' : i + 1}</button>`).join('')}<span class="link"></span><button class="node boss ${ls.bossPassed ? 'done' : ''}" data-boss title="Boss fight">👹</button></div>
      <div class="kicker">Mission ${mi + 1} of ${level.missions.length} · LOS ${esc((m.losIds || []).join(', '))}</div>
      <h2>${esc(P(m.title))}</h2>
      <div class="scene"><div class="prose">${md(m.scene)}</div></div>
      <div class="card prose">${md(m.concept)}</div>
      ${m.keyPoints?.length ? `<div class="keypoints"><h4>🎯 Lock these in</h4><ul>${m.keyPoints.map((k) => `<li>${esc(P(k))}</li>`).join('')}</ul></div>` : ''}
      <div id="check" style="margin-top:16px"></div>
      <div class="row" style="margin-top:12px">
        <button class="btn ghost small" id="askCoach">💬 I don't get this — ask Coach</button>
        ${done ? '<span class="tag">✓ completed</span>' : ''}
      </div>`;
    $$('[data-m]', pane).forEach((b) => b.onclick = () => { mi = Number(b.dataset.m); draw(); });
    $('[data-boss]', pane).onclick = () => { tab = 'boss'; draw(); };
    $('#askCoach').onclick = () => openCoach(`Explain "${P(m.title)}" again in a different way, with a new scenario.`);
    const finish = (correct) => {
      if (!ls.missionsDone.includes(m.id)) {
        ls.missionsDone.push(m.id); save('progress');
        gainXP(20 + (correct ? 10 : 0), 'mission complete');
      }
    };
    const next = () => {
      const nxt = level.missions.findIndex((x) => !ls.missionsDone.includes(x.id));
      if (nxt === -1) { tab = 'boss'; toast('All missions done — the boss awaits 👹'); }
      else mi = nxt;
      draw();
    };
    const lastLabel = level.missions.every((x) => x.id === m.id || ls.missionsDone.includes(x.id)) ? 'Face the boss →' : 'Next mission →';
    if (m.check) {
      renderQuestion($('#check', pane), m.check, {
        randomize: done, tag: 'DECISION POINT', continueLabel: lastLabel,
        onAnswer: (ok) => { if (!ok) recordMiss(level.id, m.check); else if (done) gainXP(5); finish(ok); },
        onContinue: next,
      });
    } else {
      $('#check', pane).innerHTML = `<button class="btn primary">Mark complete · ${lastLabel}</button>`;
      $('#check button', pane).onclick = () => { finish(false); next(); };
    }
  }

  function paneManual(pane) {
    pane.innerHTML = `<div class="spread" style="margin-bottom:12px"><p class="muted" style="margin:0">Every term and formula in this reading, exam-ready. These also appear as flashcards in your review queue.</p></div>
      <div class="fm">${level.fieldManual.map((f) => `<div class="fm-card"><h4>${esc(P(f.term))}</h4><p>${esc(P(f.definition))}</p>${f.formula ? `<div class="formula">${esc(f.formula)}</div>` : ''}${f.trap ? `<div class="trap">⚠ ${esc(P(f.trap))}</div>` : ''}</div>`).join('') || '<div class="empty">No entries.</div>'}</div>`;
  }

  function paneBoss(pane) {
    const qs = level.boss;
    if (!qs.length) { pane.innerHTML = '<div class="card empty">No boss questions in this level.</div>'; return; }
    const maxHearts = qs.length - Math.ceil(qs.length * 0.7) + 1; // losing them all = below 70%
    let qi = -1, correct = 0, hearts = maxHearts;
    const bossName = ['The Skeptical Board', 'The Exam Examiner', 'The Rival Analyst', 'The Activist Investor'][level.title.length % 4];
    const intro = () => {
      pane.innerHTML = `<div class="boss-arena"><div class="kicker">Boss fight</div><h2>👹 ${bossName}</h2>
        <p>${qs.length} exam-style questions across every LOS. Score <b>70%+</b> to clear the level. You have ${'❤️'.repeat(maxHearts)} credibility — lose it all and the boss wins.</p>
        ${ls.bossBest != null ? `<p class="muted">Best so far: ${Math.round(ls.bossBest * 100)}%</p>` : ''}
        <button class="btn primary" id="fight">Start the fight ⚔</button></div>`;
      $('#fight').onclick = () => { qi = 0; step(); };
    };
    const step = () => {
      if (qi >= qs.length || hearts <= 0) return end();
      const hp = 1 - correct / qs.length;
      pane.innerHTML = `<div class="boss-arena"><div class="spread"><b>👹 ${bossName}</b><span class="hearts">${'❤️'.repeat(hearts)}${'🖤'.repeat(maxHearts - hearts)}</span></div>
        <div class="hp" style="margin-top:10px"><i style="width:${hp * 100}%"></i></div><small>Question ${qi + 1} of ${qs.length}</small></div><div id="bq"></div>`;
      renderQuestion($('#bq', pane), qs[qi], {
        randomize: ls.bossBest != null, tag: `Q${qi + 1}`, continueLabel: qi + 1 < qs.length ? 'Next →' : 'See result →',
        onAnswer: (ok) => {
          if (ok) { correct++; toast('💥 Hit!'); } else { hearts--; recordMiss(level.id, qs[qi]); }
          const bar = $('.hp i', pane); if (bar) bar.style.width = `${(1 - correct / qs.length) * 100}%`;
          const h = $('.hearts', pane); if (h) h.textContent = '❤️'.repeat(Math.max(hearts, 0)) + '🖤'.repeat(maxHearts - Math.max(hearts, 0));
        },
        onContinue: () => { qi++; step(); },
      });
    };
    const end = () => {
      const score = correct / qs.length, passed = score >= 0.7 && hearts > 0;
      const first = passed && !ls.bossPassed;
      ls.bossBest = Math.max(ls.bossBest ?? 0, score);
      if (passed) ls.bossPassed = true;
      save('progress');
      gainXP(correct * 15 + (first ? 100 : 0), passed ? 'boss defeated' : 'boss fight');
      if (passed) confetti();
      pane.innerHTML = `<div class="boss-arena" style="text-align:center"><h2>${passed ? '🏆 Boss defeated!' : '💀 The boss won this round'}</h2>
        <p style="font-size:22px;font-family:var(--display)">${correct}/${qs.length} · ${Math.round(score * 100)}%</p>
        <p class="muted">${passed ? (first ? 'Level cleared. +100 XP bonus. Missed questions are queued for review.' : 'Cleared again — nice.') : 'Missed questions are now in your review queue. Rematches use fresh numbers.'}</p>
        <div class="row" style="justify-content:center"><button class="btn primary" id="again">${passed ? 'Rematch' : 'Try again'}</button><a class="btn" href="#/review">Go to review</a><a class="btn ghost" href="#/topic/${t.id}">Back to ${esc(t.short)}</a></div></div>`;
      $('#again').onclick = () => { qi = 0; correct = 0; hearts = maxHearts; step(); };
    };
    intro();
  }

  function paneLos(pane) {
    pane.innerHTML = `<div class="card"><h3>LOS coverage</h3><p class="muted">Every Learning Outcome Statement and where it's covered. Missed a practice question on the CFA portal? Flag the LOS and its items jump to the front of your review queue.</p>
      <ul class="los-list">${level.los.map((l) => {
        const inM = level.missions.filter((m) => (m.losIds || []).includes(l.id)).length;
        const inB = level.boss.filter((q) => q.losId === l.id).length;
        return `<li><span class="chk ${inM ? 'on' : ''}">${inM ? '✓' : '!'}</span><span style="flex:1"><b>${esc(l.id)}.</b> ${esc(l.text)}<br><small>${inM} mission${inM === 1 ? '' : 's'} · ${inB} boss question${inB === 1 ? '' : 's'}</small></span><button class="btn small" data-flag="${esc(l.id)}">Missed a practice Q</button></li>`;
      }).join('')}</ul></div>
      ${level.source === 'ai' ? `<div class="card"><h3>Something look off?</h3><p class="muted">AI can make mistakes. If a mission disagrees with the curriculum, ask Coach to check it against your source notes.</p><button class="btn small" id="reportOff">Ask Coach to double-check this level</button></div>` : ''}`;
    $$('[data-flag]', pane).forEach((b) => b.onclick = () => {
      const n = flagLos(level.id, b.dataset.flag);
      toast(n ? `🔁 ${n} item${n > 1 ? 's' : ''} for LOS ${b.dataset.flag} moved to today's review` : 'Logged. Study this LOS again in the missions.');
      renderHUD();
    });
    const r = $('#reportOff', pane);
    if (r) r.onclick = () => openCoach('Something in this level might not match my curriculum. Which statements in the field manual or missions are you least sure about, compared to the source notes? Check the formulas especially.');
  }

  draw();
}

// ---------------- REVIEW ----------------
function viewReview(_, params) {
  let items = dueItems(25);
  let practice = false;
  if (!items.length && params.practice) {
    practice = true;
    items = Object.entries(state.progress.srs).filter(([, it]) => state.levels[it.levelId]).sort(() => Math.random() - .5).slice(0, 10).map(([k, it]) => ({ key: k, ...it }));
  }
  if (!items.length) {
    const any = Object.keys(state.progress.srs).length;
    app.innerHTML = `<div class="card empty"><h2>🌤 All clear</h2><p>No reviews due right now.${any ? ' Items come back on a schedule — 1, 3, 7, 14, 30 days — as you get them right.' : ' Play a level and its questions join your review queue.'}</p>
      <div class="row" style="justify-content:center">${any ? '<a class="btn primary" href="#/review?practice=1">Practice 10 random items anyway</a>' : ''}<a class="btn" href="#/">Back to map</a></div></div>`;
    return;
  }
  let i = 0, right = 0;
  const next = () => {
    if (i >= items.length) {
      confetti();
      app.innerHTML = `<div class="card empty"><h2>✨ Review complete</h2><p>${right}/${items.length} correct. ${practice ? '' : 'Missed items come back tomorrow; the rest move further out.'}</p><a class="btn primary" href="#/">Back to map</a></div>`;
      renderHUD(); return;
    }
    const it = items[i];
    const r = resolveItem(it);
    if (!r) { i++; return next(); }
    const t = topicById(r.level.topicId);
    app.innerHTML = `<div class="spread" style="margin-bottom:12px"><div><div class="kicker">${practice ? 'Practice' : 'Review'} · ${i + 1} of ${items.length}</div><h2 style="margin:0">${t.icon} ${esc(r.level.title)}</h2></div><div class="progress" style="width:160px"><i style="width:${(i / items.length) * 100}%"></i></div></div><div id="rv"></div>`;
    const el = $('#rv');
    coachCtx = { level: r.level }; updateCoachCtx();
    if (r.card) {
      const c = r.card;
      el.innerHTML = `<div class="flash"><div class="flash-inner" id="fi">
        <div class="flash-face"><h3>${esc(P(c.term))}</h3><p class="muted" style="text-align:center">Say the definition${c.formula ? ' and formula' : ''} out loud, then tap to flip.</p></div>
        <div class="flash-face flash-back"><p>${esc(P(c.definition))}</p>${c.formula ? `<div class="formula">${esc(c.formula)}</div>` : ''}${c.trap ? `<div class="trap" style="color:var(--red);font-size:14px">⚠ ${esc(P(c.trap))}</div>` : ''}</div>
      </div></div><div class="row" id="fbtn" style="margin-top:14px;justify-content:center"><button class="btn" id="flip">Flip card</button></div>`;
      $('#fi').onclick = $('#flip').onclick = () => {
        $('#fi').classList.add('flipped');
        $('#fbtn').innerHTML = `<button class="btn danger" id="again">Again</button><button class="btn green" id="got">Got it</button>`;
        $('#again').onclick = () => { if (!practice) grade(it.key, false); i++; next(); };
        $('#got').onclick = () => { if (!practice) grade(it.key, true); right++; gainXP(3); i++; next(); };
      };
    } else {
      renderQuestion(el, r.question, {
        randomize: true, tag: 'REVIEW', continueLabel: 'Next →',
        onAnswer: (ok) => { if (!practice) grade(it.key, ok); if (ok) { right++; gainXP(5); } },
        onContinue: () => { i++; next(); },
      });
    }
  };
  next();
}

// ---------------- PLAN ----------------
function viewPlan() {
  const inp = { ...defaultInputs(), ...(state.plan?.inputs || {}) };
  inp.status = { ...defaultInputs().status, ...(inp.status || {}) };
  const opt = (obj, cur) => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${esc(typeof v === 'string' ? v : v.label)}</option>`).join('');
  app.innerHTML = `
    <h1>🗓 Study plan</h1>
    <p class="muted">Tell it your exam date, your hours and where you stand on each topic. Different goals and timelines get different plans — share the site and your friends get their own.</p>
    <form class="card" id="planForm">
      <div class="form-grid">
        <div><label>Exam date</label><input type="date" name="examDate" value="${inp.examDate}" required></div>
        <div><label>Start date</label><input type="date" name="startDate" value="${inp.startDate || todayKey()}"></div>
        <div><label>Weekday hours / day</label><input type="number" step="0.25" min="0" max="12" name="weekdayHours" value="${inp.weekdayHours}"></div>
        <div><label>Weekend hours / day</label><input type="number" step="0.25" min="0" max="16" name="weekendHours" value="${inp.weekendHours}"></div>
        <div><label>Rest day</label><select name="restDay">${opt({ none: 'No rest day', sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday' }, inp.restDay)}</select></div>
        <div><label>Goal</label><select name="goal">${opt(GOALS, inp.goal)}</select></div>
        <div><label>Order</label><select name="order">${opt(ORDERS, inp.order)}</select></div>
        <div><label>Start with topic (optional)</label><select name="firstTopic"><option value="">— use the order —</option>${TOPICS.map((t) => `<option value="${t.id}" ${t.id === inp.firstTopic ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div>
        <div><label>Focus session length</label><select name="sessionMinutes">${opt({ 20: '20 minutes', 25: '25 minutes', 30: '30 minutes', 45: '45 minutes', 60: '60 minutes' }, String(inp.sessionMinutes))}</select></div>
      </div>
      <h3 style="margin-top:22px">Where you stand</h3>
      <div class="status-grid">${TOPICS.map((t) => `<div class="status-row"><span>${t.icon} ${esc(t.short)}</span><select name="st_${t.id}">${opt(STATUS, inp.status[t.id])}</select></div>`).join('')}</div>
      <div class="row" style="margin-top:18px"><button class="btn primary" type="submit">Build my plan</button></div>
    </form>
    <div id="planOut" style="margin-top:18px"></div>`;
  const form = $('#planForm');
  form.onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const n = { ...inp, status: {} };
    for (const [k, v] of fd.entries()) { if (k.startsWith('st_')) n.status[k.slice(3)] = v; else n[k] = v; }
    n.sessionMinutes = Number(n.sessionMinutes);
    const result = buildPlan(n);
    if (result.error) { $('#planOut').innerHTML = `<div class="alert err">${esc(result.error)}</div>`; return; }
    state.plan = { inputs: n, result, createdAt: todayKey() };
    save('plan');
    showPlan(result);
    toast('🗓 Plan saved');
    if (state.settings.reminders?.token) syncReminders().then(() => toast('📧 Reminder emails updated')).catch(() => {});
  };
  if (state.plan?.result) showPlan(state.plan.result);
}
function showPlan(r) {
  const tp = todayFromPlan(state.plan);
  const inputs = state.plan.inputs;
  const done = inputs.doneModules || {};
  const legend = r.order.map((id) => { const t = topicById(id); return `<span style="--c:${t.color}">${esc(t.short)}</span>`; }).join('') + '<span style="--c:#6A8E7F">Review & mocks</span>';
  const maxW = Math.max(...r.weeks.map((w) => w.hours), 1);
  const rem = state.settings.reminders || {};
  const days = upcoming(state.plan, todayKey(), 7);
  const dayHtml = (d) => {
    const dt = dayText(d);
    const isToday = d.date === todayKey();
    return `<div class="day ${isToday ? 'today' : ''}"><div><b>${isToday ? 'Today' : new Date(d.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' })}</b><br><small>${fmtDate(d.date)}</small></div>
      <div><b>${esc(dt.title)}</b>${(d.topics || []).map((t) => { const lab = moduleLabel(t); const lvl = levelForModule(t.topicId, t.mi); return `<div><span style="color:${lab.topic.color}">●</span> ${esc(lab.topic.short)} · M${lab.num} ${esc(lab.name)} <small>(${t.hours >= 1 ? t.hours.toFixed(1) + 'h' : Math.round(t.hours * 60) + ' min'})</small> ${lvl ? `<a href="#/level/${lvl.id}" style="color:var(--lime)">play →</a>` : `<a href="#/add?topic=${t.topicId}&mod=${t.mi}" style="color:var(--tan)">add reading</a>`}</div>`; }).join('') || `<div class="muted">${esc(dt.lines[0])}</div>`}</div></div>`;
  };
  $('#planOut').innerHTML = `
    <div class="alert ${r.feasible ? 'ok' : 'warn'}">${r.feasible
      ? `✅ This fits. You have ~${r.totalAvail}h available and the plan needs ~${r.totalNeed}h (${r.learnNeed}h across ${r.modSegments.length} modules + ${r.reviewNeed}h review and ${r.mocks} mock exams).`
      : `⚠ Tight. You have ~${r.totalAvail}h but this goal needs ~${r.totalNeed}h. The plan below compresses learning to fit — about ${r.neededPerWeek}h/week would fully cover it (you have ${r.availPerWeek}h/week).`}</div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr));margin-top:16px">
      <div class="card"><h3>Next 7 days</h3><div class="day-list">${days.map(dayHtml).join('') || '<p class="muted">Plan starts later.</p>'}</div>
        <p class="muted" style="margin-top:10px">Review phase starts <b>${fmtDate(r.reviewStart)}</b>. Exam: <b>${fmtDate(r.exam)}</b>.</p></div>
      <div class="stack">
        <div class="card"><h3>📧 Reminders</h3>
          <p class="muted">Get an email with the day's modules at a time you choose. Or add every study session to your calendar.</p>
          <div class="form-grid" style="grid-template-columns:1fr 130px">
            <div><label>Email</label><input id="remEmail" type="email" placeholder="you@example.com" value="${esc(rem.email || '')}"></div>
            <div><label>Time</label><select id="remHour">${Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${h === (rem.hour ?? 7) ? 'selected' : ''}>${new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' })}</option>`).join('')}</select></div>
          </div>
          <div class="row" style="margin-top:12px">
            <button class="btn primary small" id="remOn">${rem.token ? 'Update reminders' : 'Email me reminders'}</button>
            ${rem.token ? '<button class="btn small danger" id="remOff">Stop emails</button>' : ''}
            <button class="btn small" id="ics">📅 Add to calendar (.ics)</button>
          </div>
          ${rem.token ? `<p class="muted" style="margin:10px 0 0">✅ Daily emails to ${esc(rem.email)}. Rebuilding the plan updates them automatically.</p>` : ''}
        </div>
        <div class="card"><h3>Coach's notes</h3><ul style="margin:0;padding-left:18px">${r.advice.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>
      </div>
    </div>
    <div class="card"><h3>Module schedule</h3><p class="muted">Tap a topic to see its modules. Tick modules you've already finished — the plan re-balances around them.</p>
      <div class="seg-list">${r.segments.map((sg) => { const t = topicById(sg.topicId); return `<details class="topic-mods"><summary><i style="background:${t.color}"></i><span>${t.icon} ${esc(t.name)}</span><small>${fmtDate(sg.start)} → ${fmtDate(sg.end)} · ${sg.hours.toFixed(0)}h</small></summary>
        ${sg.modules.map((m) => { const k = moduleKey(m.topicId, m.mi); const lvl = levelForModule(m.topicId, m.mi); return `<div class="mod-row ${done[k] ? 'done' : ''}"><input type="checkbox" data-done="${k}" ${done[k] ? 'checked' : ''} aria-label="Mark module done"><span>M${m.mi + 1} · ${esc(MODULES[m.topicId][m.mi])}</span><small>${fmtDate(m.start)}${m.end !== m.start ? ' → ' + fmtDate(m.end) : ''} · ${m.hours >= 1 ? m.hours.toFixed(1) + 'h' : Math.round(m.hours * 60) + 'm'}</small>${lvl ? `<a href="#/level/${lvl.id}">play →</a>` : `<a href="#/add?topic=${m.topicId}&mod=${m.mi}">📸 add</a>`}</div>`; }).join('')}</details>`; }).join('')}
      <div class="seg"><i style="background:#6A8E7F"></i><span>🔁 Review, practice & ${r.mocks} mock exams</span><small>${fmtDate(r.reviewStart)} → ${fmtDate(r.exam)}</small></div></div></div>
    <div class="card"><div class="spread"><h3 style="margin:0">Week by week</h3><div class="legend">${legend}</div></div>
      <div class="timeline">${r.weeks.map((w) => `<div class="wk"><small>${fmtDate(w.start)}</small><div class="wk-bar" style="width:${(w.hours / maxW) * 100}%">${Object.entries(w.topics).map(([id, h]) => `<i style="width:${(h / w.hours) * 100}%;background:${topicById(id).color}" title="${topicById(id).short}: ${h.toFixed(1)}h"></i>`).join('')}${w.review ? `<i class="rev" style="width:${(w.review / w.hours) * 100}%" title="Review: ${w.review.toFixed(1)}h"></i>` : ''}</div><small>${w.hours.toFixed(1)}h</small></div>`).join('')}</div></div>`;

  $$('[data-done]').forEach((cb) => cb.onchange = async () => {
    const dm = { ...(state.plan.inputs.doneModules || {}) };
    if (cb.checked) dm[cb.dataset.done] = true; else delete dm[cb.dataset.done];
    state.plan.inputs.doneModules = dm;
    state.plan.result = buildPlan(state.plan.inputs);
    await save('plan');
    if (state.settings.reminders?.token) syncReminders().catch(() => {});
    if (cb.checked) gainXP(10, 'module ticked off');
    const open = $$('details.topic-mods').map((d) => d.open);
    showPlan(state.plan.result);
    $$('details.topic-mods').forEach((d, i) => { d.open = !!open[i]; });
  });
  $('#ics').onclick = () => downloadICS(state.plan, Number($('#remHour').value));
  $('#remOn').onclick = async () => {
    const email = $('#remEmail').value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('Enter a valid email'); return; }
    state.settings.reminders = { ...(state.settings.reminders || {}), email, hour: Number($('#remHour').value) };
    await save('settings');
    try { await syncReminders(); toast('📧 Reminders on — check your inbox for a confirmation'); showPlan(state.plan.result); }
    catch (e) { toast(`❌ ${e.message}`); }
  };
  const off = $('#remOff');
  if (off) off.onclick = async () => {
    try { await unsubscribeReminders(); toast('Reminders stopped'); showPlan(state.plan.result); } catch (e) { toast(`❌ ${e.message}`); }
  };
}

// ---------------- ADD READING ----------------
let pendingFiles = [];
let notesCache = { key: '', notes: '' }; // screenshots already read, reused if a build is retried
function viewAdd(_, params) {
  const topicId = params.topic || '';
  app.innerHTML = `
    <h1>📸 Add a reading</h1>
    <p class="muted">Screenshot every page of one reading (one Learning Module), starting with the LOS page. The AI reads them in order, keeps every detail, and builds a level set in your story world. Bigger readings take a few minutes.</p>
    <div class="card stack">
      <div class="form-grid">
        <div><label>Topic</label><select id="topic">${TOPICS.map((t) => `<option value="${t.id}" ${t.id === topicId ? 'selected' : ''}>${t.icon} ${esc(t.name)}</option>`).join('')}</select></div>
        <div><label>Learning module</label><select id="mod"></select></div>
        <div id="titleWrap" hidden><label>Reading title</label><input id="title" placeholder="e.g. Capital Structure"></div>
      </div>
      <div class="drop" id="drop" tabindex="0" role="button"><div style="font-size:30px">🖼</div><b>Drop screenshots here or tap to choose</b><br><small>PNG or JPG · up to 60 pages · they're ordered by file name — reorder below if needed</small></div>
      <input type="file" id="files" accept="image/*" multiple hidden>
      <div class="thumbs" id="thumbs"></div>
      <div class="row"><button class="btn primary" id="gen" disabled>✨ Build level</button><button class="btn ghost" id="clear">Clear</button><span class="muted" id="count"></span></div>
    </div>
    <div id="genOut"></div>`;
  const fillMods = () => {
    const tid = $('#topic').value;
    $('#mod').innerHTML = (MODULES[tid] || []).map((n, i) => `<option value="${i}" ${String(i) === String(params.mod) && tid === topicId ? 'selected' : ''}>M${i + 1} · ${esc(n)}${levelForModule(tid, i) ? ' ✓ built' : ''}</option>`).join('') + '<option value="other">Other / not listed…</option>';
    $('#titleWrap').hidden = $('#mod').value !== 'other';
  };
  $('#topic').onchange = fillMods;
  fillMods();
  $('#mod').onchange = () => { $('#titleWrap').hidden = $('#mod').value !== 'other'; };
  const drop = $('#drop'), input = $('#files');
  const addFiles = (fl) => {
    const imgs = [...fl].filter((f) => f.type.startsWith('image/'));
    pendingFiles = [...pendingFiles, ...imgs].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).slice(0, 60);
    drawThumbs();
  };
  const drawThumbs = () => {
    $('#thumbs').innerHTML = pendingFiles.map((f, i) => `<div class="thumb"><span class="n">${i + 1}</span><img alt="page ${i + 1}" src="${URL.createObjectURL(f)}"><div class="ctl"><button data-up="${i}" aria-label="Move up">◀</button><button data-del="${i}" aria-label="Remove">✕</button><button data-dn="${i}" aria-label="Move down">▶</button></div></div>`).join('');
    $('#count').textContent = pendingFiles.length ? `${pendingFiles.length} page${pendingFiles.length > 1 ? 's' : ''}` : '';
    $('#gen').disabled = !pendingFiles.length;
    $$('[data-del]').forEach((b) => b.onclick = () => { pendingFiles.splice(Number(b.dataset.del), 1); drawThumbs(); });
    $$('[data-up]').forEach((b) => b.onclick = () => { const i = Number(b.dataset.up); if (i > 0) { [pendingFiles[i - 1], pendingFiles[i]] = [pendingFiles[i], pendingFiles[i - 1]]; drawThumbs(); } });
    $$('[data-dn]').forEach((b) => b.onclick = () => { const i = Number(b.dataset.dn); if (i < pendingFiles.length - 1) { [pendingFiles[i + 1], pendingFiles[i]] = [pendingFiles[i], pendingFiles[i + 1]]; drawThumbs(); } });
  };
  drop.onclick = () => input.click();
  drop.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') input.click(); };
  input.onchange = () => { addFiles(input.files); input.value = ''; };
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); addFiles(e.dataTransfer.files); };
  $('#clear').onclick = () => { pendingFiles = []; drawThumbs(); };
  drawThumbs();

  $('#gen').onclick = async () => {
    const out = $('#genOut');
    const ctrl = new AbortController();
    out.innerHTML = `<div class="card" style="margin-top:16px"><div class="spread"><h3 style="margin:0"><span class="spinner"></span> Building your level…</h3><button class="btn small ghost" id="cancel">Cancel</button></div><p class="muted">Keep this tab open. You can start a focus timer or review while you wait.</p><div class="gen-log" id="log"></div></div>`;
    $('#gen').disabled = true;
    $('#cancel').onclick = () => ctrl.abort();
    const log = (m) => { const d = document.createElement('div'); d.textContent = m; $('#log')?.appendChild(d); };
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    addEventListener('beforeunload', warn);
    try {
      const tid = $('#topic').value, modVal = $('#mod').value;
      const mi = modVal === 'other' ? null : Number(modVal);
      const title = mi == null ? $('#title').value.trim() : MODULES[tid][mi];
      const fileKey = pendingFiles.map((f) => `${f.name}:${f.size}`).join('|');
      const cached = notesCache.key === fileKey ? notesCache.notes : null;
      const { level, report } = await generateLevel({ files: pendingFiles, topicId: tid, title, onLog: log, signal: ctrl.signal, notes: cached, onNotes: (n) => { notesCache = { key: fileKey, notes: n }; } });
      notesCache = { key: '', notes: '' };
      if (mi != null) { level.moduleIdx = mi; level.title = title; }
      state.levels[level.id] = level;
      await save('levels');
      pendingFiles = [];
      gainXP(25, 'new level unlocked');
      confetti();
      out.innerHTML = `<div class="card" style="margin-top:16px"><h2>🎉 Level ready: ${esc(level.title)}</h2>
        <p>${level.missions.length} missions · ${level.boss.length}-question boss · ${level.fieldManual.length} field-manual entries</p>
        <ul class="los-list">${report.coverage.map((c) => `<li><span class="chk ${c.inMission && c.inBoss ? 'on' : ''}">${c.inMission && c.inBoss ? '✓' : '!'}</span>${esc(c.id)}. ${esc(c.text)}</li>`).join('')}</ul>
        ${report.issues.length ? `<div class="alert warn" style="margin-top:12px"><b>Heads-up:</b><ul style="margin:6px 0 0;padding-left:18px">${report.issues.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '<div class="alert ok" style="margin-top:12px">Every LOS is covered by a mission and the boss fight.</div>'}
        <div class="row" style="margin-top:14px"><a class="btn primary" href="#/level/${level.id}">Play it →</a></div></div>`;
    } catch (e) {
      out.innerHTML = `<div class="alert err" style="margin-top:16px"><b>Couldn't build the level.</b> ${esc(e.name === 'AbortError' ? 'Cancelled.' : e.message)}${notesCache.notes ? '<br><small>Your screenshots are already read — press <b>Build level</b> again and it will skip straight to building (faster and cheaper).</small>' : ''}</div>`;
      $('#gen').disabled = false;
    } finally { removeEventListener('beforeunload', warn); }
  };
}

// ---------------- SETTINGS ----------------
function viewSettings() {
  const s = state.settings;
  const custom = Object.values(state.levels).filter((l) => l.source !== 'demo');
  app.innerHTML = `
    <h1>⚙ Settings</h1>
    <div class="card stack">
      <h3>You & your story</h3>
      <div class="form-grid">
        <div><label>Your name</label><input id="sName" value="${esc(s.name || '')}"></div>
        <div><label>Company name in the story</label><input id="sCompany" value="${esc(s.world?.company || '')}"></div>
        <div><label>Daily XP goal</label><input id="sGoal" type="number" min="20" step="10" value="${s.dailyGoal || 100}"></div>
      </div>
      <div><label>Story world</label><select id="sWorld">${WORLDS.map((w) => `<option value="${w.id}" ${w.id === s.world?.id ? 'selected' : ''}>${esc(w.company)} — ${esc(w.industry)}</option>`).join('')}</select><small>Switching worlds affects new levels and the demo. Existing levels keep their story.</small></div>
      <label class="switch"><input type="checkbox" id="sMotion" ${s.calm ? '' : 'checked'}> Animated background (turn off if it distracts you)</label>
      <h3>AI access</h3>
      <div><label>Access code</label><input id="sCode" type="password" value="${esc(s.accessCode || '')}" placeholder="The code set on the Netlify site"><small>Needed for the Coach and for building levels, if the site owner set one.</small></div>
      <div class="row"><button class="btn primary" id="sSave">Save</button><button class="btn" id="sTest">Test AI connection</button></div>
    </div>
    <div class="card stack">
      <h3>Backup</h3>
      <p class="muted">Progress lives in this browser. Export a backup to move it to another device or keep it safe.</p>
      <div class="row"><button class="btn" id="exp">⬇ Export backup</button><label class="btn" style="margin:0;color:var(--text)">⬆ Import backup<input type="file" id="imp" accept="application/json" hidden></label></div>
    </div>
    <div class="card stack">
      <h3>Your levels</h3>
      ${custom.length ? `<ul class="los-list">${custom.map((l) => `<li><span style="flex:1">${topicById(l.topicId).icon} ${esc(l.title)}</span><button class="btn small danger" data-del="${l.id}">Delete</button></li>`).join('')}</ul>` : '<p class="muted">No uploaded levels yet.</p>'}
      <div class="row">${state.levels[DEMO_LEVEL.id] ? '<button class="btn small" id="rmDemo">Remove demo level</button>' : '<button class="btn small" id="addDemo">Restore demo level</button>'}<button class="btn small danger" id="reset">Reset all progress</button></div>
    </div>`;
  $('#sSave').onclick = async () => {
    const w = WORLDS.find((x) => x.id === $('#sWorld').value);
    const world = w.id === s.world?.id ? { ...s.world } : JSON.parse(JSON.stringify(w));
    world.company = $('#sCompany').value.trim() && w.id === s.world?.id ? $('#sCompany').value.trim() : world.company;
    s.calm = !$('#sMotion').checked; applyCalm();
    Object.assign(s, { name: $('#sName').value.trim(), dailyGoal: Number($('#sGoal').value) || 100, accessCode: $('#sCode').value.trim(), world });
    await save('settings'); toast('Saved'); renderHUD(); viewSettings();
  };
  $('#sTest').onclick = async () => {
    state.settings.accessCode = $('#sCode').value.trim();
    toast('Testing…');
    try { const { text } = await callClaude({ system: 'Reply with exactly: connected', messages: [{ role: 'user', content: 'ping' }], maxTokens: 10 }); toast(`✅ AI ${text.trim() || 'connected'}`); }
    catch (e) { toast(`❌ ${e.message}`); }
  };
  $('#exp').onclick = () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `cfa-quest-backup-${todayKey()}.json`; a.click();
  };
  $('#imp').onchange = async (e) => {
    try { await importData(await e.target.files[0].text()); toast('Backup restored'); route(); } catch (err) { toast(`❌ ${err.message}`); }
  };
  $$('[data-del]').forEach((b) => b.onclick = async () => {
    if (!confirm('Delete this level and its review items?')) return;
    delete state.levels[b.dataset.del];
    for (const [k, it] of Object.entries(state.progress.srs)) if (it.levelId === b.dataset.del) delete state.progress.srs[k];
    await save('levels', 'progress'); viewSettings();
  });
  const rm = $('#rmDemo'); if (rm) rm.onclick = async () => { delete state.levels[DEMO_LEVEL.id]; state.settings.demoRemoved = true; await save('levels', 'settings'); viewSettings(); };
  const ad = $('#addDemo'); if (ad) ad.onclick = async () => { state.levels[DEMO_LEVEL.id] = DEMO_LEVEL; state.settings.demoRemoved = false; await save('levels', 'settings'); viewSettings(); };
  $('#reset').onclick = async () => { if (confirm('Reset XP, streaks, level progress and review queue? Levels are kept.')) { await resetProgress(); toast('Progress reset'); route(); } };
}

// ---------------- COACH ----------------
const chat = [];
function updateCoachCtx() {
  const el = $('#coachCtx');
  if (!el) return;
  el.textContent = coachCtx.level ? `On: ${coachCtx.level.title}${coachCtx.mission ? ' › ' + P(coachCtx.mission.title) : ''}` : 'General questions';
}
function drawChat() {
  const log = $('#coachLog');
  log.innerHTML = chat.length ? chat.map((m) => `<div class="msg ${m.role === 'user' ? 'user' : 'bot'}">${m.role === 'user' ? esc(m.content) : md(m.content) || '<span class="spinner"></span>'}</div>`).join('')
    : `<div class="msg bot"><p>Hi${state.settings.name ? ' ' + esc(state.settings.name) : ''}! Ask me anything you didn't get — I'll explain it with a scenario, then give you the exact exam version.</p><p class="muted">Try: “Why does a higher beta raise the cost of equity?”</p></div>`;
  log.scrollTop = log.scrollHeight;
}
function openCoach(prefill) {
  $('#coach').hidden = false; $('#coachFab').hidden = true;
  updateCoachCtx(); drawChat();
  if (prefill) { $('#coachInput').value = prefill; }
  $('#coachInput').focus();
}
$('#coachFab').onclick = () => openCoach();
$('#coachClose').onclick = () => { $('#coach').hidden = true; $('#coachFab').hidden = false; };
$('#coachInput').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#coachForm').requestSubmit(); } });
$('#coachForm').onsubmit = async (e) => {
  e.preventDefault();
  const text = $('#coachInput').value.trim();
  if (!text) return;
  $('#coachInput').value = '';
  chat.push({ role: 'user', content: text });
  const reply = { role: 'assistant', content: '' };
  chat.push(reply); drawChat();
  try {
    await callClaude({
      system: coachSystem(coachCtx), maxTokens: 1800,
      messages: chat.slice(-12, -1).map((m) => ({ role: m.role, content: m.content })),
      onText: (_, full) => { reply.content = full; drawChat(); },
    });
  } catch (err) { reply.content = `⚠ ${err.message}`; drawChat(); }
};

// ---------------- ONBOARDING ----------------
function onboarding() {
  let pick = WORLDS[0].id;
  modal(`
    <div class="kicker">Welcome to</div><h1>▲ CFA Quest</h1>
    <p>Every reading becomes a story mission inside one company you follow through all 10 topics — then a boss fight, then a review queue that won't let you forget.</p>
    <label>Your name</label><input id="obName" placeholder="First name">
    <label style="margin-top:16px">Pick your story world</label>
    <div class="world-pick">${WORLDS.map((w) => `<button class="world-opt ${w.id === pick ? 'sel' : ''}" data-w="${w.id}"><b>${esc(w.company)}</b><small>${esc(w.industry)}</small></button>`).join('')}</div>
    <label>Access code (optional — from whoever runs this site)</label><input id="obCode" type="password" placeholder="Leave blank if you don't have one">
    <div class="row" style="margin-top:20px"><button class="btn primary" id="obGo">Start playing →</button></div>`, (m, close) => {
    $$('[data-w]', m).forEach((b) => b.onclick = () => { pick = b.dataset.w; $$('[data-w]', m).forEach((x) => x.classList.toggle('sel', x === b)); });
    $('#obGo', m).onclick = async () => {
      Object.assign(state.settings, { name: $('#obName', m).value.trim(), accessCode: $('#obCode', m).value.trim(), world: JSON.parse(JSON.stringify(WORLDS.find((w) => w.id === pick))), onboarded: true });
      await save('settings'); close(); route(); toast('🎬 Your story begins');
    };
  });
}

// ---------------- animated background ----------------
function initGlyphs() {
  const c = $('#glyphs'); if (!c) return;
  const ctx = c.getContext('2d');
  const chars = ['β', 'σ', '∑', '%', '$', 'Δ', 'μ', 'π', '√', 'r', '∫', '₦', '£', '€', '¥', '↗', '✦'];
  const colors = ['#CCF5AC', '#6A8E7F', '#C29979', '#F6F2EA'];
  let W, H, items = [];
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight; c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(34, (W * H) / 38000));
    items = Array.from({ length: n }, () => spawn(true));
  };
  const spawn = (anywhere) => ({
    x: Math.random() * W, y: anywhere ? Math.random() * H : H + 30,
    s: 12 + Math.random() * 22, v: .15 + Math.random() * .35, sway: Math.random() * Math.PI * 2,
    ch: chars[Math.floor(Math.random() * chars.length)], col: colors[Math.floor(Math.random() * colors.length)],
    a: .05 + Math.random() * .12, rot: (Math.random() - .5) * .6,
  });
  resize(); addEventListener('resize', resize);
  (function frame(t) {
    if (!document.body.classList.contains('calm') && !document.hidden) {
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < items.length; i++) {
        const g = items[i];
        g.y -= g.v; g.sway += .01;
        if (g.y < -40) items[i] = spawn(false);
        ctx.save(); ctx.globalAlpha = g.a; ctx.fillStyle = g.col; ctx.font = `600 ${g.s}px 'Space Grotesk', sans-serif`;
        ctx.translate(g.x + Math.sin(g.sway) * 18, g.y); ctx.rotate(g.rot); ctx.fillText(g.ch, 0, 0); ctx.restore();
      }
    }
    requestAnimationFrame(frame);
  })();
}
function applyCalm() { document.body.classList.toggle('calm', !!state.settings.calm); }

// ---------------- boot ----------------
(async function boot() {
  await load();
  if (!state.settings.world) state.settings.world = JSON.parse(JSON.stringify(WORLDS[0]));
  applyCalm();
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) initGlyphs();
  route();
  if (!state.settings.onboarded) onboarding();
})();

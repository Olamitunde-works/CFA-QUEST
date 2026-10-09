// AI client: talks to the Netlify edge function at /api/claude (which holds the API key).
import { state } from './store.js';
import { topicById, worldText } from './data.js';
import { validateCalc } from './expr.js';

const ENDPOINT = '/api/claude';

export async function callClaude({ system, messages, maxTokens = 4000, onText, signal }) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-access-code': state.settings.accessCode || '' },
    body: JSON.stringify({ system, messages, max_tokens: maxTokens }),
    signal,
  });
  if (!res.ok) {
    let msg = await res.text().catch(() => '');
    try { msg = JSON.parse(msg).error?.message || JSON.parse(msg).error || msg; } catch {}
    if (res.status === 401) throw new Error('Access code missing or wrong. Add it in Settings.');
    if (res.status === 404) throw new Error('AI server not found. The AI features only work on the deployed Netlify site (or with `netlify dev`).');
    throw new Error(`AI request failed (${res.status}): ${String(msg).slice(0, 300)}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '', text = '', stop = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      let ev; try { ev = JSON.parse(data); } catch { continue; }
      if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
        text += ev.delta.text; onText?.(ev.delta.text, text);
      } else if (ev.type === 'message_delta') stop = ev.delta?.stop_reason || stop;
      else if (ev.type === 'error') throw new Error(ev.error?.message || 'AI stream error');
    }
  }
  return { text, stop };
}

// ---------- images ----------
export async function fileToJpegBase64(file, maxW = 1568) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxW / bmp.width);
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const url = c.toDataURL('image/jpeg', 0.85);
  return url.split(',')[1];
}

function parseJSON(text) {
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s < 0 || e < 0) throw new Error('No JSON found in AI response');
  return JSON.parse(text.slice(s, e + 1));
}

const TOKEN_CEILING = 32000;
async function callJSON(opts, stage = 'a step') {
  let maxTokens = opts.maxTokens || 8000;
  let lastErr;
  for (let a = 0; a < 3; a++) {
    const { text, stop } = await callClaude({ ...opts, maxTokens });
    try { return parseJSON(text); } catch (e) {
      if (stop === 'max_tokens' && maxTokens < TOKEN_CEILING) {
        maxTokens = Math.min(maxTokens * 2, TOKEN_CEILING); // give it more room and retry
        lastErr = new Error(`AI response for ${stage} was cut off, even at the maximum length.`);
      } else {
        lastErr = new Error(`AI returned malformed JSON for ${stage}.`);
      }
    }
  }
  throw lastErr;
}

// Plain-text call that keeps going if the output is cut off.
async function callText(opts, maxRounds = 3) {
  let { text, stop } = await callClaude(opts);
  let rounds = 1;
  while (stop === 'max_tokens' && rounds < maxRounds) {
    const more = await callClaude({ ...opts, messages: [...opts.messages, { role: 'assistant', content: text }, { role: 'user', content: 'Continue exactly where you stopped. Do not repeat anything.' }] });
    text += more.text; stop = more.stop; rounds++;
  }
  return text;
}

// ---------- prompts ----------
const FIDELITY = `Fidelity rules (very important):
- The learner is preparing for the CFA Level I exam and wants EVERY testable detail. Do not drop or oversimplify concepts, conditions, exceptions, or formulas.
- Paraphrase explanatory prose in your own words; do not copy long passages. Formulas, LOS text, defined terms and numbers may be reproduced exactly.
- Never invent content that is not supported by the source notes. If something is unclear in the source, say so rather than guess.`;

const EXTRACT_SYSTEM = `You are extracting study notes from screenshots of a CFA Level I curriculum reading.
${FIDELITY}
Produce dense, complete markdown notes for the pages shown, in reading order:
- "LOS:" lines for any Learning Outcome Statements (verbatim, keep their letters if shown).
- Every concept and definition (paraphrased precisely), every list of factors/types/advantages/disadvantages in full.
- Every formula exactly, followed by what each variable means and when the formula applies.
- Worked examples: the setup numbers, the steps, and the result.
- Exhibit/table data that matters, caveats, "however"/"unless" conditions, and comparisons.
- Mark likely exam traps with "TRAP:".
If a page is cut off or unreadable, write "[unreadable section]". Output notes only.`;

export function plannerSystem() {
  return `You turn CFA Level I study notes into a scenario-driven game level. The learner has ADHD and learns through stories and scenarios: every concept should be anchored in a vivid situation inside ONE persistent fictional company world, but the precise exam content must be complete.
${FIDELITY}
Story world (reuse these names and keep continuity):
${worldText(state.settings.world)}`;
}

function priorBeats(topicId) {
  return Object.values(state.levels)
    .filter((l) => l.source !== 'demo' && l.storyBeat)
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
    .slice(-6)
    .map((l) => `- [${topicById(l.topicId)?.short}] ${l.storyBeat}`)
    .join('\n') || '- (this is the first chapter)';
}

const Q_SCHEMA = `Question objects:
MCQ: {"id":"q1","type":"mcq","losId":"a","prompt":"...","options":["A text","B text","C text"],"answer":0,"explanation":"why the right answer is right AND why each wrong one is wrong","trap":"optional exam trap"}
(CFA Level I uses exactly 3 options.)
CALC: {"id":"q2","type":"calc","losId":"b","prompt":"text with {varName} placeholders","variables":{"varName":{"value":0.06,"min":0.04,"max":0.09,"step":0.0025,"unit":"%","decimals":2,"label":"YTM"}},"steps":[{"id":"s1","label":"what this step computes","expr":"arithmetic using variable names and earlier step ids","unit":"%","decimals":2,"hint":"one-line nudge"}],"explanation":"worked reasoning","keystrokes":["BA II Plus keystrokes for the default values, e.g. 'N=5, I/Y=6, PMT=50, FV=1000, CPT PV → -957.88'"]}
Rules for CALC: percentages are stored as decimals with "unit":"%" (0.06 = 6%). Plain numbers use "unit":"" (or "$"). Expressions may use + - * / ^ ( ) and sqrt ln log exp abs min max pow. Each step's id can be used by later steps. min/max/step define safe random ranges that keep the problem sensible (for example keep a growth rate below the required return). Break multi-step problems into the same steps a candidate would do. For TVM problems that need a calculator solve (e.g. solving for YTM/IRR), put the known answer as a step expression only if it can be written in closed form; otherwise use an MCQ.`;

// ---------- pipeline ----------
const EXAM_SYSTEM = `You write CFA Level I study material from the learner's own curriculum notes.
${FIDELITY}`;

const MAP_RULES = `Write for a reader with ADHD who scans rather than reads:
- No story, no fluff, no paragraphs. Every point is short (max ~15 words), concrete, in the curriculum's own terms.
- Pick the block type that matches the SHAPE of the content:
  • several kinds / factors / features → "group" (label + a few words each)
  • A vs B (vs C) → "compare" table
  • a process, sequence, or cause → effect chain → "flow"
  • key terms → "define"
  • any formula → "formula", with EVERY variable explained
  • a classic mistake or tricky distinction → "trap"
  • a tiny numeric or real-world illustration → "example" (max 30 words)
  • anything else → "points"
- Cover EVERY point in the notes for that section. Compress, never drop. If the notes list 7 factors, show all 7.`;

const BLOCK_SCHEMA = `Block types (use as many as needed, in a logical order):
{"type":"points","items":["short point", "..."]}
{"type":"define","items":[{"term":"","def":"max 20 words"}]}
{"type":"group","title":"Types of X","items":[{"label":"","note":"max 12 words"}]}
{"type":"compare","title":"","columns":["","A","B"],"rows":[["Feature","A's value","B's value"]]}
{"type":"flow","title":"","steps":["max 8 words", "..."]}
{"type":"formula","formula":"WACC = wd × rd(1 − t) + we × re","vars":[{"sym":"wd","means":"weight of debt"}],"note":"when to use it"}
{"type":"trap","text":"max 25 words"}
{"type":"example","text":"max 30 words"}`;

async function extractNotes({ files, topic, title, log, signal }) {
  let notes = '';
  const per = 3;
  for (let i = 0; i < files.length; i += per) {
    const batch = files.slice(i, i + per);
    log(`Reading pages ${i + 1}–${i + batch.length} of ${files.length}…`);
    const imgs = [];
    for (const f of batch) imgs.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await fileToJpegBase64(f) } });
    const text = await callText({
      system: EXTRACT_SYSTEM, maxTokens: 12000, signal,
      messages: [{ role: 'user', content: [...imgs, { type: 'text', text: `Topic: ${topic.name}. These are pages ${i + 1}-${i + batch.length} of the reading${title ? ` "${title}"` : ''}. Keep the reading's own section headings as markdown headings. Notes so far end with:\n${notes.slice(-800) || '(start of reading)'}\n\nExtract the notes for these pages.` }] }],
    });
    notes += `\n\n<!-- pages ${i + 1}-${i + batch.length} -->\n${text}`;
  }
  return notes;
}

// Build the visual map (outline + section blocks) from notes.
export async function buildMap({ notes, topicId, title, log = () => {}, signal }) {
  const topic = topicById(topicId);
  log('Mapping the reading: big picture and sections…');
  const outline = await callJSON({
    system: EXAM_SYSTEM, maxTokens: 8000, signal,
    messages: [{ role: 'user', content: `Topic: ${topic.name}${title ? `\nReading: ${title}` : ''}\n\nSTUDY NOTES:\n${notes}\n\nReturn ONLY JSON:
{"title":"reading title","module":"Learning Module number/name if shown",
"los":[{"id":"a","text":"LOS text"}],
"bigPicture":"what this whole reading is trying to get at, max 25 words",
"why":"why it matters to an analyst/investor, max 20 words",
"sections":[{"id":"s1","title":"section title (use the reading's own headings, in order)","gist":"the one thing this section says, max 15 words","keywords":["2-5 keywords, max 3 words each"],"losIds":["a"]}],
"links":["how the sections connect, max 15 words each (2-4 items)"]}
Rules: follow the reading's own section structure and order (usually 4-10 sections; merge tiny ones, split huge ones). Every LOS must map to at least one section. If no LOS appear in the notes, derive them and prefix with "(derived)".` }],
  }, 'the map outline');

  const sections = outline.sections || [];
  for (let i = 0; i < sections.length; i += 2) {
    const group = sections.slice(i, i + 2);
    log(`Mapping section${group.length > 1 ? 's' : ''} ${i + 1}${group.length > 1 ? `–${i + group.length}` : ''} of ${sections.length}: ${group.map((g) => g.title).join(' / ')}…`);
    const out = await callJSON({
      system: EXAM_SYSTEM, maxTokens: 12000, signal,
      messages: [{ role: 'user', content: `Reading: ${outline.title} (${topic.name})\nAll sections: ${sections.map((x) => x.title).join(' | ')}\n\nSTUDY NOTES:\n${notes}\n\nWrite the content blocks for ONLY these sections:\n${JSON.stringify(group.map(({ id, title, gist }) => ({ id, title, gist })))}\n\n${MAP_RULES}\n\n${BLOCK_SCHEMA}\n\nReturn ONLY JSON: {"sections":[{"id":"s1","blocks":[BLOCK, ...]}]}` }],
    }, `section ${i + 1}`);
    for (const r of out.sections || []) {
      const target = group.find((g) => g.id === r.id) || group[(out.sections || []).indexOf(r)];
      if (target) target.blocks = r.blocks || [];
    }
  }
  return { outline, map: { bigPicture: outline.bigPicture || '', why: outline.why || '', links: outline.links || [], sections } };
}

async function buildQuiz({ notes, los, title, topic, log, signal }) {
  const half = Math.ceil(los.length / 2) || 1;
  const rounds = los.length > 3 ? [los.slice(0, half), los.slice(half)] : [los];
  const boss = [];
  for (let r = 0; r < rounds.length; r++) {
    log(`Writing quiz questions (${r + 1}/${rounds.length})…`);
    const out = await callJSON({
      system: EXAM_SYSTEM, maxTokens: 12000, signal,
      messages: [{ role: 'user', content: `Reading: ${title} (${topic.name})\nLOS to test in this round: ${JSON.stringify(rounds[r])}\n\nSTUDY NOTES:\n${notes}\n\n${Q_SCHEMA}\n\nWrite ${rounds.length > 1 ? '4-6' : '8-10'} CFA Level I exam-style questions (short, neutral exam vignettes — no story). Cover EVERY LOS listed here at least once. Include a CALC for every formula-based LOS. Include the classic exam traps. Explanations: 2-4 short sentences, say why each wrong option is wrong. Return ONLY JSON: {"boss":[QUESTION, ...]}` }],
    }, 'the quiz');
    boss.push(...(out.boss || []));
  }
  return boss;
}

export async function generateLevel({ files, topicId, title, onLog, signal, notes: cachedNotes, onNotes }) {
  const log = (m) => onLog?.(m);
  const topic = topicById(topicId);

  let notes = cachedNotes || '';
  if (!notes) { notes = await extractNotes({ files, topic, title, log, signal }); onNotes?.(notes); }
  else log('Using the screenshots already read — skipping straight to building.');

  const { outline, map } = await buildMap({ notes, topicId, title, log, signal });

  log('Writing the glossary…');
  const fm = await callJSON({
    system: EXAM_SYSTEM, maxTokens: 12000, signal,
    messages: [{ role: 'user', content: `STUDY NOTES:\n${notes}\n\nReturn ONLY JSON: {"fieldManual":[{"term":"","definition":"precise exam-ready definition (1-2 short sentences)","formula":"optional","trap":"optional exam trap"}]}\nInclude every defined term and every formula in the notes.` }],
  }, 'the glossary');

  const los = outline.los || [];
  const boss = await buildQuiz({ notes, los, title: outline.title || title, topic, log, signal });

  const level = {
    id: `lvl-${Date.now().toString(36)}`, topicId, source: 'ai', createdAt: new Date().toISOString(),
    title: outline.title || title || 'Untitled reading', module: outline.module || '', storyBeat: '',
    los, map, missions: [], fieldManual: fm.fieldManual || [], boss, notes,
  };
  log('Checking calculations and LOS coverage…');
  const report = sanitizeLevel(level);
  return { level, report };
}

// Turn an older story-style level into a map, reusing its saved notes.
export async function convertToMap(level, onLog) {
  const { outline, map } = await buildMap({ notes: level.notes, topicId: level.topicId, title: level.title, log: onLog || (() => {}) });
  level.map = map;
  if (!level.los?.length && outline.los) level.los = outline.los;
  return level;
}

// Validate and repair a level; returns a coverage report.
export function sanitizeLevel(level) {
  const issues = [];
  const fixQ = (q, where) => {
    if (!q) return null;
    if (q.type === 'calc') {
      const v = validateCalc(q);
      if (!v.ok) { issues.push(`Dropped a broken calculation in ${where}.`); return null; }
      if (!v.randomOk) { // freeze random ranges
        for (const s of Object.values(q.variables || {})) { delete s.min; delete s.max; }
        issues.push(`Random numbers turned off for one calculation in ${where} (they produced invalid values).`);
      }
      return q;
    }
    if (q.type === 'mcq' && Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.answer) && q.answer < q.options.length) return q;
    issues.push(`Dropped a malformed question in ${where}.`);
    return null;
  };
  level.missions.forEach((m, i) => {
    m.id = m.id || `m${i + 1}`;
    m.check = fixQ(m.check, `mission ${i + 1}`);
    if (m.check) m.check.id = `${m.id}-check`;
  });
  level.boss = level.boss.map((q, i) => { const r = fixQ(q, 'the boss fight'); if (r) r.id = `boss-${i + 1}`; return r; }).filter(Boolean);

  const covered = new Set();
  level.missions.forEach((m) => (m.losIds || []).forEach((x) => covered.add(x)));
  (level.map?.sections || []).forEach((sec) => (sec.losIds || []).forEach((x) => covered.add(x)));
  (level.map?.sections || []).forEach((sec, i) => { if (!sec.blocks?.length) issues.push(`Section ${i + 1} (${sec.title}) came back empty — use Rebuild map on the LOS tab.`); });
  const bossCovered = new Set(level.boss.map((q) => q.losId));
  const coverage = level.los.map((l) => ({ ...l, inMission: covered.has(l.id), inBoss: bossCovered.has(l.id) }));
  coverage.filter((c) => !c.inMission).forEach((c) => issues.push(`LOS ${c.id} isn't mapped to a section.`));
  coverage.filter((c) => !c.inBoss).forEach((c) => issues.push(`LOS ${c.id} isn't tested in the quiz.`));
  return { coverage, issues };
}

// ---------- coach chat ----------
export function coachSystem(ctx) {
  const lvl = ctx.level;
  let context = '';
  if (lvl) {
    const t = topicById(lvl.topicId);
    context += `\nThe learner is currently on the reading "${lvl.title}" (${t?.name}).`;
    if (lvl.map) context += `\nBig picture: ${lvl.map.bigPicture}\nSections: ${lvl.map.sections.map((x, i) => `${i + 1}. ${x.title} — ${x.gist}`).join('; ')}`;
    if (ctx.section) context += `\nThey are looking at the section "${ctx.section.title}": ${JSON.stringify(ctx.section.blocks || []).slice(0, 4000)}`;
    if (ctx.mission) context += `\nCurrent mission: ${ctx.mission.title}\n${ctx.mission.concept}`;
    if (lvl.notes) context += `\nSource notes from the learner's curriculum (trust these over general knowledge if they differ):\n${lvl.notes.slice(0, 14000)}`;
  }
  return `You are "Coach", a CFA Level I tutor inside a study app. The learner (${state.settings.name || 'the learner'}) has ADHD: they scan, and they understand best by seeing structure.
How to answer:
- Start with the answer in ONE plain sentence.
- Then show the structure: short bullets, a mini table, an arrow chain (A → B → C), or a formula with each variable explained. No long paragraphs.
- Use a quick everyday analogy only if it genuinely helps; no elaborate stories.
- Keep the whole reply short enough to read in under a minute. Offer a one-line check question at the end when useful.
- Be exact about CFA Level I content. If unsure, or the curriculum may treat it differently, say so.
- For calculations, show each step and the BA II Plus keystrokes.${context}`;
}

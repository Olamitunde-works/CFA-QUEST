// Visual "map" of a reading: mind-map diagram + scannable section cards.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');

export const SECTION_COLORS = ['#CCF5AC', '#C29979', '#8FC1AE', '#E8836A', '#A9C7E8', '#E3BE98', '#B9A7DA', '#F2A07B', '#7FD6B0', '#F4EDE4'];
const colorOf = (i) => SECTION_COLORS[i % SECTION_COLORS.length];

// ---------- mind map ----------
function wrap(text, max) {
  const words = String(text || '').split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  if (lines.length > 2) { lines.length = 2; lines[1] = lines[1].replace(/.{0,3}$/, '…'); }
  return lines;
}

export function mindMapSVG(level) {
  const secs = level.map.sections;
  const ROW = 30, W = 1000;
  const rx = 16, rw = 200, sx = 290, sw = 280, kx = 650, kw = 330;
  const bands = secs.map((s) => Math.max((s.keywords || []).length, 2));
  const H = Math.max(bands.reduce((a, b) => a + b, 0) * ROW + 30, 220);
  let y = 15;
  let paths = '', nodes = '';
  const rootY = H / 2;
  secs.forEach((s, i) => {
    const c = colorOf(i);
    const bandH = bands[i] * ROW;
    const cy = y + bandH / 2;
    // root -> section
    paths += `<path d="M${rx + rw},${rootY} C${rx + rw + 45},${rootY} ${sx - 45},${cy} ${sx},${cy}" stroke="${c}" stroke-width="2.5" fill="none" opacity=".75"/>`;
    const lines = wrap(s.title, 30);
    const nh = lines.length > 1 ? 46 : 32;
    nodes += `<g class="mm-node" data-goto="${i}" tabindex="0" role="button" aria-label="Go to ${esc(s.title)}">
      <rect x="${sx}" y="${cy - nh / 2}" width="${sw}" height="${nh}" rx="12" fill="${c}" fill-opacity=".16" stroke="${c}" stroke-width="1.5"/>
      <text x="${sx + 14}" y="${cy - (lines.length - 1) * 8 + 5}" class="mm-sec">${lines.map((l, j) => `<tspan x="${sx + 14}" dy="${j ? 16 : 0}">${j === 0 ? `${i + 1}. ` : ''}${esc(l)}</tspan>`).join('')}</text></g>`;
    const kws = s.keywords || [];
    kws.forEach((k, j) => {
      const ky = y + (bandH / Math.max(kws.length, 1)) * (j + .5);
      paths += `<path d="M${sx + sw},${cy} C${sx + sw + 35},${cy} ${kx - 35},${ky} ${kx},${ky}" stroke="${c}" stroke-width="1.5" fill="none" opacity=".5"/>`;
      nodes += `<g><circle cx="${kx + 6}" cy="${ky}" r="4" fill="${c}"/><text x="${kx + 18}" y="${ky + 5}" class="mm-kw">${esc(String(k).slice(0, 40))}</text></g>`;
    });
    y += bandH;
  });
  const rootLines = wrap(level.title, 22);
  nodes += `<g><rect x="${rx}" y="${rootY - 38}" width="${rw}" height="76" rx="16" fill="#23395B" stroke="#CCF5AC" stroke-width="2"/>
    <text x="${rx + rw / 2}" y="${rootY - (rootLines.length - 1) * 9 + 6}" text-anchor="middle" class="mm-root">${rootLines.map((l, j) => `<tspan x="${rx + rw / 2}" dy="${j ? 18 : 0}">${esc(l)}</tspan>`).join('')}</text></g>`;
  return `<svg class="mm-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Mind map of ${esc(level.title)}">${paths}${nodes}</svg>`;
}

function mindMapList(level) {
  return `<div class="mm-list">${level.map.sections.map((s, i) => `<button class="mm-branch" data-goto="${i}" style="--c:${colorOf(i)}"><b>${i + 1}. ${esc(s.title)}</b><span>${(s.keywords || []).map((k) => `<i>${esc(k)}</i>`).join('')}</span></button>`).join('')}</div>`;
}

// ---------- blocks ----------
function block(b) {
  switch (b?.type) {
    case 'points': return `<ul class="b-points">${(b.items || []).map((x) => `<li>${fmt(x)}</li>`).join('')}</ul>`;
    case 'define': return `<div class="b-define">${(b.items || []).map((d) => `<div class="term">${fmt(d.term)}</div><div class="def">${fmt(d.def)}</div>`).join('')}</div>`;
    case 'group': return `<div class="b-group">${b.title ? `<div class="b-title">🧩 ${fmt(b.title)}</div>` : ''}<div class="chips">${(b.items || []).map((g) => `<div class="chip"><b>${fmt(g.label)}</b>${g.note ? `<span>${fmt(g.note)}</span>` : ''}</div>`).join('')}</div></div>`;
    case 'compare': return `<div class="b-compare">${b.title ? `<div class="b-title">⚖ ${fmt(b.title)}</div>` : ''}<div class="tbl-wrap"><table><thead><tr>${(b.columns || []).map((c) => `<th>${fmt(c)}</th>`).join('')}</tr></thead><tbody>${(b.rows || []).map((r) => `<tr>${r.map((c, i) => i ? `<td>${fmt(c)}</td>` : `<th scope="row">${fmt(c)}</th>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
    case 'flow': return `<div class="b-flow">${b.title ? `<div class="b-title">➜ ${fmt(b.title)}</div>` : ''}<div class="steps-flow">${(b.steps || []).map((st, i) => `${i ? '<span class="arrow" aria-hidden="true">→</span>' : ''}<div class="fstep"><span class="n">${i + 1}</span>${fmt(st)}</div>`).join('')}</div></div>`;
    case 'formula': return `<div class="b-formula"><div class="formula">${esc(b.formula)}</div>${(b.vars || []).length ? `<div class="vars-grid">${b.vars.map((v) => `<code>${esc(v.sym)}</code><span>${fmt(v.means)}</span>`).join('')}</div>` : ''}${b.note ? `<div class="f-note">${fmt(b.note)}</div>` : ''}</div>`;
    case 'trap': return `<div class="b-trap">⚠ <span>${fmt(b.text)}</span></div>`;
    case 'example': return `<div class="b-example">💡 <span>${fmt(b.text)}</span></div>`;
    default: return '';
  }
}

function sectionCard(s, i, done, total) {
  const c = colorOf(i);
  return `<section class="sec-card ${done ? 'done' : ''}" id="sec-${i}" data-sec="${i}" style="--c:${c}">
    <header class="sec-head">
      <span class="sec-num">${done ? '✓' : i + 1}</span>
      <div class="sec-titles"><div class="kicker" style="color:${c}">Section ${i + 1} of ${total}${(s.losIds || []).length ? ` · LOS ${esc(s.losIds.join(', '))}` : ''}</div><h2>${esc(s.title)}</h2></div>
    </header>
    ${s.gist ? `<p class="sec-gist">${fmt(s.gist)}</p>` : ''}
    <div class="sec-body">${(s.blocks || []).map(block).join('') || '<p class="muted">No content in this section yet.</p>'}</div>
    <footer class="sec-foot">
      <button class="btn ${done ? 'ghost' : 'primary'} small" data-tick="${i}">${done ? '✓ Got it' : 'Got it ✓'}</button>
      <button class="btn ghost small" data-ask="${i}">💬 Explain this differently</button>
    </footer>
  </section>`;
}

// ---------- pane ----------
export function renderMapPane(pane, level, { done = [], focus = false, onTick, onAsk, onFocusToggle, onSection }) {
  const m = level.map;
  const secs = m.sections;
  let cur = Math.max(0, secs.findIndex((_, i) => !done.includes(i)));
  if (cur >= secs.length) cur = 0;

  const top = () => `
    <div class="big-picture">
      <div class="bp-main"><div class="kicker">🧭 The big picture</div><p class="bp-text">${fmt(m.bigPicture)}</p>${m.why ? `<p class="bp-why"><b>Why it matters:</b> ${fmt(m.why)}</p>` : ''}</div>
      <div class="bp-progress"><b>${done.length}/${secs.length}</b><small>sections mapped</small></div>
    </div>
    <div class="card mm-card"><div class="spread"><h3 style="margin:0">Mind map</h3><small class="muted">Tap a branch to jump to it</small></div>${mindMapSVG(level)}${mindMapList(level)}
      ${m.links?.length ? `<div class="mm-links"><div class="b-title">🔗 How it connects</div>${m.links.map((l) => `<div>${fmt(l)}</div>`).join('')}</div>` : ''}</div>
    <div class="map-controls">
      <label class="switch"><input type="checkbox" id="focusMode" ${focus ? 'checked' : ''}> One section at a time</label>
      <small class="muted">Scan it, tick it, then watch the video.</small>
    </div>`;

  const drawSections = () => {
    if (focus) {
      return `<div class="focus-nav">${secs.map((s, i) => `<button class="fdot ${i === cur ? 'on' : ''} ${done.includes(i) ? 'done' : ''}" data-jump="${i}" style="--c:${colorOf(i)}" title="${esc(s.title)}">${done.includes(i) ? '✓' : i + 1}</button>`).join('')}</div>
        ${sectionCard(secs[cur], cur, done.includes(cur), secs.length)}
        <div class="row" style="justify-content:space-between;margin-top:12px"><button class="btn ghost" data-prev ${cur === 0 ? 'disabled' : ''}>← Previous</button><button class="btn" data-next ${cur === secs.length - 1 ? 'disabled' : ''}>Next section →</button></div>`;
    }
    return secs.map((s, i) => sectionCard(s, i, done.includes(i), secs.length)).join('');
  };

  const paint = () => {
    pane.innerHTML = `${top()}<div id="secs">${drawSections()}</div>`;
    bind();
  };
  const bind = () => {
    pane.querySelectorAll('[data-goto]').forEach((n) => {
      const go = () => {
        const i = Number(n.dataset.goto);
        if (focus) { cur = i; paint(); pane.querySelector('#secs').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        else pane.querySelector(`#sec-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        onSection?.(secs[i]);
      };
      n.onclick = go;
      n.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
    });
    pane.querySelectorAll('[data-tick]').forEach((b) => b.onclick = () => {
      const i = Number(b.dataset.tick);
      onTick?.(i);
      if (!done.includes(i)) done.push(i);
      if (focus && cur < secs.length - 1) { cur++; paint(); pane.querySelector('#secs').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      else paint();
    });
    pane.querySelectorAll('[data-ask]').forEach((b) => b.onclick = () => onAsk?.(secs[Number(b.dataset.ask)]));
    pane.querySelectorAll('[data-jump]').forEach((b) => b.onclick = () => { cur = Number(b.dataset.jump); onSection?.(secs[cur]); paint(); });
    const p = pane.querySelector('[data-prev]'); if (p) p.onclick = () => { cur--; onSection?.(secs[cur]); paint(); };
    const n = pane.querySelector('[data-next]'); if (n) n.onclick = () => { cur++; onSection?.(secs[cur]); paint(); };
    pane.querySelector('#focusMode').onchange = (e) => { focus = e.target.checked; onFocusToggle?.(focus); paint(); };
  };
  paint();
}

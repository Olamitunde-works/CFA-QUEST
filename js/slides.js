// Slide reader: the curriculum text, word for word, one screen at a time. No scrolling.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// "Bionic" reading: the first letters of each word are bold so the eye glides.
function bionicWord(w) {
  if (w.length < 2) return esc(w);
  const n = w.length <= 3 ? 1 : w.length <= 8 ? 2 : 3;
  return `<b class="bn">${esc(w.slice(0, n))}</b>${esc(w.slice(n))}`;
}
function bionicPlain(text, on) {
  if (!on) return esc(text);
  return String(text ?? '').split(/([A-Za-z][A-Za-z'’-]*)/).map((p, i) => (i % 2 ? bionicWord(p) : esc(p))).join('');
}
// Supports **bold** from the source (defined terms) on top of bionic.
export function rich(text, on = true) {
  return String(text ?? '').split(/(\*\*[^*]+\*\*)/).map((seg) => {
    const m = seg.match(/^\*\*([^*]+)\*\*$/);
    return m ? `<strong class="kt">${bionicPlain(m[1], on)}</strong>` : bionicPlain(seg, on);
  }).join('');
}

function bodyHTML(text, on) {
  const lines = String(text || '').split('\n');
  const out = [];
  let list = null, para = [];
  const flushP = () => { if (para.length) { out.push(`<p>${rich(para.join(' '), on)}</p>`); para = []; } };
  const flushL = () => { if (list) { out.push(`<ul>${list.map((x) => `<li>${rich(x, on)}</li>`).join('')}</ul>`); list = null; } };
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) { flushP(); flushL(); continue; }
    const b = l.match(/^[-•*]\s+(.*)$/);
    if (b) { flushP(); (list ||= []).push(b[1]); } else { flushL(); para.push(l); }
  }
  flushP(); flushL();
  return out.join('');
}

const KIND = { text: '', definition: 'Definition', example: 'Example', formula: 'Formula', table: 'Table', exhibit: 'Exhibit', list: 'Learning outcomes' };

function slideHTML(s, on) {
  const kind = s.kind || 'text';
  const label = KIND[kind];
  let body = '';
  if (kind === 'exhibit') {
    body = `${s.img ? `<figure class="sl-fig"><img src="${s.img}" alt="${esc(s.caption || 'Exhibit from the reading')}"></figure>` : ''}${s.caption ? `<div class="sl-cap">${rich(s.caption, on)}</div>` : ''}${!s.img && s.text ? bodyHTML(s.text, on) : ''}`;
  } else if (kind === 'table') {
    body = `${s.text ? bodyHTML(s.text, on) : ''}<div class="tbl-wrap"><table class="sl-table"><thead><tr>${(s.columns || []).map((c) => `<th>${rich(c, on)}</th>`).join('')}</tr></thead><tbody>${(s.rows || []).map((r) => `<tr>${r.map((c, i) => (i ? `<td>${rich(c, on)}</td>` : `<th scope="row">${rich(c, on)}</th>`)).join('')}</tr>`).join('')}</tbody></table></div>`;
  } else if (kind === 'formula') {
    body = `${s.text ? bodyHTML(s.text, on) : ''}${s.formula ? `<div class="sl-formula">${esc(s.formula)}</div>` : ''}`;
  } else {
    body = bodyHTML(s.text, on);
  }
  return `<div class="sl-head">${s.heading ? `<div class="sl-h">${rich(s.heading, false)}</div>` : '<div></div>'}${label ? `<span class="sl-kind k-${kind}">${label}</span>` : ''}</div>
    <div class="sl-body">${body}</div>`;
}

export function slideText(s) {
  if (!s) return '';
  return [s.heading ? `[${s.heading}]` : '', s.text, s.formula, s.caption, (s.columns || []).join(' | '), ...(s.rows || []).map((r) => r.join(' | '))].filter(Boolean).join('\n');
}

// LOS grouping: slides keep a losId; blank ones inherit the previous slide's.
export function losGroups(level) {
  const slides = level.slides || [];
  const known = new Set((level.los || []).map((l) => l.id));
  let cur = '';
  const per = slides.map((s) => { if (s.losId && known.has(s.losId)) cur = s.losId; return cur; });
  const first = {}, last = {};
  per.forEach((id, i) => { if (!id) return; if (!(id in first)) first[id] = i; last[id] = i; });
  return { per, first, last };
}

export function renderSlides(root, level, { autoFull = false, start = 0, bionic = true, scale = 1, onMove, onAsk, onFinish, onBionic, onScale }) {
  const slides = level.slides;
  const total = slides.length;
  const g = losGroups(level);
  let i = Math.min(Math.max(start, 0), total - 1);
  let on = bionic, sc = scale, full = false, dir = 0;

  root.innerHTML = `<div class="reader" id="reader">
    <div class="rd-top">
      <div class="rd-los" id="rdLos"></div>
      <div class="rd-tools">
        <button class="rd-btn" data-act="smaller" aria-label="Smaller text">A−</button>
        <button class="rd-btn" data-act="bigger" aria-label="Bigger text">A+</button>
        <button class="rd-btn ${on ? 'on' : ''}" data-act="bionic" aria-pressed="${on}" title="Bold the first letters of each word">Bionic</button>
        <button class="rd-btn" data-act="full" title="Full screen (F)">⛶</button>
      </div>
    </div>
    <div class="rd-stage" id="rdStage"><article class="slide" id="rdSlide" aria-live="polite"></article></div>
    <div class="rd-los-line" id="rdLosLine"></div>
    <div class="rd-bar">
      <button class="btn rd-nav" data-act="prev" aria-label="Previous slide">←</button>
      <div class="rd-mid"><div class="rd-prog"><i id="rdFill"></i></div><div class="rd-count" id="rdCount"></div></div>
      <button class="btn ghost rd-ask" data-act="ask" title="Ask Coach (E)">💬 <span>Explain this</span></button>
      <button class="btn primary rd-nav" data-act="next" aria-label="Next slide">→</button>
    </div>
  </div>`;
  const $ = (q) => root.querySelector(q);
  const rd = $('#reader'), slide = $('#rdSlide');

  const fit = () => {
    const body = slide.querySelector('.sl-body');
    if (!body) return;
    const wide = window.innerWidth > 720;
    let fs = (wide ? 27 : 20) * sc;
    const min = 14;
    body.style.fontSize = fs + 'px';
    let guard = 40;
    while (guard-- > 0 && fs > min && (body.scrollHeight > body.clientHeight + 1 || body.scrollWidth > body.clientWidth + 1)) {
      fs -= 1; body.style.fontSize = fs + 'px';
    }
  };

  const drawLos = () => {
    const ids = (level.los || []).map((l) => l.id).filter((id) => id in g.first);
    $('#rdLos').innerHTML = ids.length ? ids.map((id) => `<button class="los-chip ${g.per[i] === id ? 'on' : ''} ${i >= g.last[id] ? 'done' : ''}" data-los="${esc(id)}" title="Jump to LOS ${esc(id)}">${esc(id)}</button>`).join('') : '';
    const cur = (level.los || []).find((l) => l.id === g.per[i]);
    $('#rdLosLine').innerHTML = cur ? `<b>LOS ${esc(cur.id)}</b> · ${esc(cur.text)}` : '';
    root.querySelectorAll('[data-los]').forEach((b) => { b.onclick = () => go(g.first[b.dataset.los]); });
  };

  const draw = (animate = true) => {
    const s = slides[i];
    slide.className = `slide k-${s.kind || 'text'}${animate && dir ? (dir > 0 ? ' in-right' : ' in-left') : ''}`;
    slide.innerHTML = slideHTML(s, on);
    $('#rdFill').style.width = `${((i + 1) / total) * 100}%`;
    $('#rdCount').textContent = `${i + 1} / ${total}`;
    root.querySelector('[data-act="prev"]').disabled = i === 0;
    root.querySelector('[data-act="next"]').textContent = i === total - 1 ? '✓' : '→';
    drawLos();
    requestAnimationFrame(() => { fit(); const im = slide.querySelector('img'); if (im && !im.complete) im.onload = fit; });
  };

  const go = (n) => {
    if (n < 0) return;
    if (n >= total) { onFinish?.(); return; }
    dir = n > i ? 1 : n < i ? -1 : 0;
    i = n; draw(); onMove?.(i, slides[i], g.per[i], g.last);
  };

  root.querySelectorAll('[data-act]').forEach((b) => {
    b.onclick = () => {
      const a = b.dataset.act;
      if (a === 'prev') go(i - 1);
      else if (a === 'next') go(i + 1);
      else if (a === 'ask') onAsk?.(slides[i], i);
      else if (a === 'bigger' || a === 'smaller') { sc = Math.min(1.6, Math.max(0.7, +(sc + (a === 'bigger' ? 0.1 : -0.1)).toFixed(2))); onScale?.(sc); fit(); }
      else if (a === 'bionic') { on = !on; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); onBionic?.(on); draw(false); }
      else if (a === 'full') toggleFull();
    };
  });

  const toggleFull = (v) => {
    full = v ?? !full;
    rd.classList.toggle('full', full);
    const fb = root.querySelector('[data-act="full"]'); if (fb) fb.textContent = full ? '✕ Exit' : '⛶';
    document.body.classList.toggle('reader-full', full);
    requestAnimationFrame(fit);
  };

  // swipe sideways
  const stage = $('#rdStage');
  let sx = 0, sy = 0, tracking = false;
  stage.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; tracking = true; });
  stage.addEventListener('pointerup', (e) => {
    if (!tracking) return; tracking = false;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) go(i + (dx < 0 ? 1 : -1));
  });
  stage.addEventListener('pointercancel', () => { tracking = false; });

  const key = (e) => {
    if (!document.body.contains(root)) { document.removeEventListener('keydown', key); window.removeEventListener('resize', fit); document.body.classList.remove('reader-full'); return; }
    if (e.target.closest?.('input,textarea,select')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) { e.preventDefault(); go(i + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) { e.preventDefault(); go(i - 1); }
    else if (e.key === 'f' || e.key === 'F') toggleFull();
    else if (e.key === 'Escape' && full) toggleFull(false);
    else if (e.key === 'e' || e.key === 'E') onAsk?.(slides[i], i);
  };
  document.addEventListener('keydown', key);
  window.addEventListener('resize', fit);

  draw(false);
  if (autoFull) toggleFull(true);
  onMove?.(i, slides[i], g.per[i], g.last);
}

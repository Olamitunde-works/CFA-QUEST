// Email reminders (via the Netlify function at /api/reminders) and calendar (.ics) export.
import { state, save, todayKey, addDays } from './store.js';
import { dayText } from './plan.js';

function schedule(plan, days = 240) {
  const out = {};
  const daily = plan?.result?.daily || {};
  for (let k = todayKey(), i = 0; i < days && k < plan.result.exam; i++, k = addDays(k, 1)) {
    if (!daily[k]) continue;
    const t = dayText(daily[k]);
    out[k] = { p: daily[k].phase, t: t.title, l: t.lines };
  }
  return out;
}

async function post(body) {
  const res = await fetch('/api/reminders', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-access-code': state.settings.accessCode || '' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 404) throw new Error('Reminder server not found — emails only work on the deployed Netlify site.');
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export async function syncReminders() {
  const r = state.settings.reminders;
  if (!r?.email) throw new Error('Add your email first.');
  if (!state.plan?.result) throw new Error('Build a study plan first.');
  const data = await post({
    action: 'subscribe', token: r.token || null, email: r.email, hour: r.hour ?? 7,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone, name: state.settings.name || '',
    exam: state.plan.result.exam, site: location.origin, schedule: schedule(state.plan),
  });
  state.settings.reminders = { ...r, token: data.token };
  await save('settings');
}

export async function unsubscribeReminders() {
  const r = state.settings.reminders;
  if (r?.token) await post({ action: 'unsubscribe', token: r.token });
  state.settings.reminders = { email: r?.email, hour: r?.hour };
  await save('settings');
}

// ---------- calendar ----------
const icsEsc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
function fold(line) {
  const out = [];
  while (line.length > 74) { out.push(line.slice(0, 74)); line = ' ' + line.slice(74); }
  out.push(line);
  return out.join('\r\n');
}
export function downloadICS(plan, hour = 19) {
  const daily = plan?.result?.daily || {};
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CFA Quest//Study Plan//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:CFA Quest study plan'];
  for (const [k, d] of Object.entries(daily)) {
    if (k < todayKey() || d.phase === 'rest' || !d.hours) continue;
    const t = dayText(d);
    const mins = Math.round(d.hours * 60);
    lines.push('BEGIN:VEVENT',
      `UID:cfaquest-${k}@cfa-quest`, `DTSTAMP:${stamp}`,
      `DTSTART:${k.replace(/-/g, '')}T${String(hour).padStart(2, '0')}0000`, `DURATION:PT${mins}M`,
      fold(`SUMMARY:${icsEsc('CFA: ' + (d.phase === 'review' ? 'Review & mocks' : t.lines[0].replace(/ \(.*\)$/, '')))}`),
      fold(`DESCRIPTION:${icsEsc(t.lines.join('\n') + '\n\nOpen CFA Quest: ' + location.origin)}`),
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:CFA study session', 'TRIGGER:-PT10M', 'END:VALARM',
      'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'cfa-study-plan.ics'; a.click();
}

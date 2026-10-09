// Shared helpers for reminder emails (sent through Resend: https://resend.com).
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function localParts(tz, date = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

export function daysBetween(a, b) {
  return Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000);
}

export function reminderEmail({ name, day, date, exam, site, unsubUrl, intro }) {
  const left = exam ? daysBetween(date, exam) : null;
  const lines = (day?.l || []).map((l) => `<li style="margin:6px 0">${esc(l)}</li>`).join('');
  const subject = day?.p === 'review'
    ? `🔁 Review day — ${left} days to the exam`
    : `📚 Today: ${(day?.l?.[0] || 'CFA study').replace(/ \(.*\)$/, '')}`;
  const html = `<!doctype html><html><body style="margin:0;background:#13213a;font-family:Inter,Segoe UI,Arial,sans-serif;color:#F6F2EA">
  <div style="max-width:520px;margin:0 auto;padding:28px 20px">
    <div style="font-weight:700;font-size:18px;color:#CCF5AC">▲ CFA Quest</div>
    <div style="background:#23395B;border:1px solid #34507a;border-radius:16px;padding:22px;margin-top:14px">
      ${intro ? `<p style="margin:0 0 14px;color:#CCF5AC">${esc(intro)}</p>` : ''}
      <p style="margin:0 0 6px;color:#C29979;font-size:12px;letter-spacing:.12em;text-transform:uppercase">${esc(date)}${left != null ? ` · ${left} days to the exam` : ''}</p>
      <h2 style="margin:0 0 10px;font-size:22px">${name ? `${esc(name)}, here's` : "Here's"} today's quest</h2>
      <p style="margin:0 0 4px;font-weight:600">${esc(day?.t || 'Study day')}</p>
      <ul style="padding-left:18px;margin:8px 0 16px">${lines}</ul>
      <a href="${esc(site)}" style="display:inline-block;background:#CCF5AC;color:#23395B;text-decoration:none;font-weight:700;padding:11px 18px;border-radius:12px">Start a focus session →</a>
      <p style="margin:16px 0 0;color:#a9bcc4;font-size:13px">One mission at a time. Clear your review queue first — it takes 5 minutes.</p>
    </div>
    <p style="color:#a9bcc4;font-size:12px;margin-top:14px">You asked CFA Quest for study reminders. <a href="${esc(unsubUrl)}" style="color:#C29979">Unsubscribe</a></p>
  </div></body></html>`;
  return { subject, html };
}

export async function sendEmail({ to, subject, html, unsubUrl }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set on the server');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: process.env.REMINDER_FROM || 'CFA Quest <onboarding@resend.dev>',
      to: [to], subject, html,
      headers: { 'List-Unsubscribe': `<${unsubUrl}>` },
    }),
  });
  if (!res.ok) throw new Error(`Email failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
}

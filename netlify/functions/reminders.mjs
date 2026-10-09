// POST /api/reminders  { action: 'subscribe' | 'unsubscribe', ... }
// GET  /api/reminders?unsub=<token>   (link in every email)
import { getStore } from '@netlify/blobs';
import { localParts, reminderEmail, sendEmail } from '../lib/email.mjs';

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
const siteUrl = (req) => process.env.URL || new URL(req.url).origin;

export default async (req) => {
  const store = getStore('reminders');

  if (req.method === 'GET') {
    const token = new URL(req.url).searchParams.get('unsub');
    if (token && /^[\w-]{20,}$/.test(token)) await store.delete(token);
    return new Response(`<!doctype html><meta name="viewport" content="width=device-width"><body style="font-family:sans-serif;background:#13213a;color:#F6F2EA;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center"><h2>You're unsubscribed</h2><p>No more reminder emails. You can turn them back on from the Plan page.</p><a style="color:#CCF5AC" href="${siteUrl(req)}">Back to CFA Quest</a></div>`, { headers: { 'content-type': 'text/html' } });
  }
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const code = process.env.ACCESS_CODE;
  if (code && req.headers.get('x-access-code') !== code) return json({ error: 'Access code missing or wrong — add it in Settings.' }, 401);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  if (body.action === 'unsubscribe') {
    if (body.token && /^[\w-]{20,}$/.test(body.token)) await store.delete(body.token);
    return json({ ok: true });
  }

  if (body.action !== 'subscribe') return json({ error: 'Unknown action' }, 400);
  const email = String(body.email || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) return json({ error: 'Invalid email' }, 400);
  const hour = Number(body.hour);
  if (!(hour >= 0 && hour <= 23)) return json({ error: 'Invalid hour' }, 400);
  try { localParts(body.tz); } catch { return json({ error: 'Invalid time zone' }, 400); }
  const schedule = body.schedule && typeof body.schedule === 'object' ? body.schedule : {};
  if (JSON.stringify(schedule).length > 300000) return json({ error: 'Schedule too large' }, 413);

  let token = typeof body.token === 'string' && /^[\w-]{20,}$/.test(body.token) ? body.token : null;
  const existing = token ? await store.get(token, { type: 'json' }) : null;
  if (!existing) token = crypto.randomUUID();

  const sub = {
    email, hour, tz: body.tz, name: String(body.name || '').slice(0, 60), exam: body.exam || null,
    schedule, lastSent: existing?.lastSent || null, createdAt: existing?.createdAt || new Date().toISOString(),
  };
  await store.setJSON(token, sub);

  // Confirmation email on first subscribe (or when the address changes).
  if (!existing || existing.email !== email) {
    const { date } = localParts(sub.tz);
    const unsubUrl = `${siteUrl(req)}/api/reminders?unsub=${token}`;
    const day = schedule[date] || { t: 'Your plan is set', l: ['Reminders will arrive daily at the time you picked.'] };
    const { html } = reminderEmail({ name: sub.name, day, date, exam: sub.exam, site: siteUrl(req), unsubUrl, intro: "✅ Reminders are on. Here's what today looks like." });
    try { await sendEmail({ to: email, subject: '✅ CFA Quest reminders are on', html, unsubUrl }); }
    catch (e) { return json({ token, warning: e.message, error: `Saved, but the confirmation email failed: ${e.message}` }, 502); }
  }
  return json({ token });
};

export const config = { path: '/api/reminders' };

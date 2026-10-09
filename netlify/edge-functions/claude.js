// Netlify Edge Function: proxies requests to the Anthropic API so the API key
// never reaches the browser. Streams the response back (server-sent events).
//
// Environment variables (Netlify → Site configuration → Environment variables):
//   ANTHROPIC_API_KEY  required  your Anthropic API key
//   ACCESS_CODE        optional  if set, users must enter this code in the app
//   CLAUDE_MODEL       optional  defaults to claude-sonnet-5-5

const MAX_TOKENS_CAP = 32000;
const MAX_BODY_BYTES = 12 * 1024 * 1024;

const json = (obj, status) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

export default async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const code = Netlify.env.get('ACCESS_CODE');
  if (code && request.headers.get('x-access-code') !== code) return json({ error: 'Invalid access code' }, 401);

  const key = Netlify.env.get('ANTHROPIC_API_KEY');
  if (!key) return json({ error: 'ANTHROPIC_API_KEY is not set on the server' }, 500);

  const len = Number(request.headers.get('content-length') || 0);
  if (len > MAX_BODY_BYTES) return json({ error: 'Request too large — try fewer or smaller screenshots' }, 413);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!Array.isArray(body.messages) || !body.messages.length) return json({ error: 'messages required' }, 400);

  // Only forward the fields the app needs; the server picks the model.
  const payload = {
    model: Netlify.env.get('CLAUDE_MODEL') || 'claude-sonnet-5-5',
    max_tokens: Math.min(Number(body.max_tokens) || 2000, MAX_TOKENS_CAP),
    system: typeof body.system === 'string' ? body.system : undefined,
    messages: body.messages,
    stream: true,
  };

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(payload),
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    return new Response(text, { status: upstream.status, headers: { 'content-type': 'application/json' } });
  }
  return new Response(upstream.body, {
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
  });
};

export const config = { path: '/api/claude' };

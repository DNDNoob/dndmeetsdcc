/**
 * Pixel-art icon generator for dndmeetsdcc.
 *
 * POST /icon  { prompt: string }  with  Authorization: Bearer <Firebase ID token>
 *   200 { image: "<base64 jpeg>" }
 *   401 bad or missing token (only Google sign-ins may generate, matching Firestore write rules)
 *   429 { error: "quota", detail } when the Workers AI free allocation is used up for the day
 *   503 { error: "busy", detail } when Workers AI is rate limiting; 502 for other failures
 *
 * No API key lives in the app: the Workers AI binding is attached to this Worker.
 */

const MODEL = '@cf/black-forest-labs/flux-1-schnell';
const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

let jwksCache = { keys: null, expires: 0 };

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (url.pathname !== '/icon' || request.method !== 'POST') {
      return json({ error: 'not found' }, 404, cors);
    }

    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const claims = await verifyFirebaseToken(token, env.FIREBASE_PROJECT_ID).catch(() => null);
    if (!claims || claims.firebase?.sign_in_provider !== 'google.com') {
      return json({ error: 'unauthorized' }, 401, cors);
    }

    let prompt = '';
    try {
      prompt = String((await request.json()).prompt || '').slice(0, 600);
    } catch {
      // fall through to the empty-prompt check
    }
    if (!prompt.trim()) return json({ error: 'prompt required' }, 400, cors);

    try {
      const result = await env.AI.run(MODEL, { prompt, steps: 4 });
      if (!result?.image) return json({ error: 'no image' }, 502, cors);
      return json({ image: result.image }, 200, cors);
    } catch (err) {
      const message = String(err?.message || err);
      const detail = message.slice(0, 200);
      console.log('[icon] Workers AI error:', message);
      // Workers AI reports an exhausted free allocation as error 4006 / "daily free allocation"
      if (/4006|free allocation|neurons/i.test(message)) {
        return json({ error: 'quota', detail }, 429, cors);
      }
      if (/rate limit|3040|capacity/i.test(message)) {
        return json({ error: 'busy', detail }, 503, cors);
      }
      return json({ error: 'generation failed', detail }, 502, cors);
    }
  },
};

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim());
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0] || '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    Vary: 'Origin',
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}

function b64urlDecode(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(str.length / 4) * 4, '=');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function getJwks() {
  if (jwksCache.keys && Date.now() < jwksCache.expires) return jwksCache.keys;
  const res = await fetch(JWKS_URL);
  const { keys } = await res.json();
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('Cache-Control') || '')?.[1] || 3600);
  jwksCache = { keys, expires: Date.now() + maxAge * 1000 };
  return keys;
}

// Verifies a Firebase Auth ID token (RS256, signed by Google's securetoken service).
async function verifyFirebaseToken(token, projectId) {
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) throw new Error('malformed');
  const header = JSON.parse(new TextDecoder().decode(b64urlDecode(h)));
  const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(p)));
  const jwk = (await getJwks()).find((k) => k.kid === header.kid);
  if (header.alg !== 'RS256' || !jwk) throw new Error('unknown key');

  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlDecode(s), new TextEncoder().encode(`${h}.${p}`));
  const now = Math.floor(Date.now() / 1000);
  if (
    !ok ||
    claims.aud !== projectId ||
    claims.iss !== `https://securetoken.google.com/${projectId}` ||
    !claims.sub ||
    claims.exp < now ||
    claims.iat > now + 300
  ) {
    throw new Error('invalid token');
  }
  return claims;
}

import { readBody, validateRequest } from './board-http.js';

const encoder = new TextEncoder();
const hex = buffer => Array.from(new Uint8Array(buffer), x => x.toString(16).padStart(2, '0')).join('');
const hmacKey = secret => crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
const signatureData = (stamp, client) => encoder.encode(`POST\n/api/board\n${stamp}\n${client}`);

async function addressKey(request, now) {
  // Daily-rotating digest only; visitor addresses are never stored or relayed.
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(`${Math.floor(now / 86400000)}:openaigames-board:${request.headers.get('CF-Connecting-IP') || 'local'}`)));
}

export async function clientKey(request, env, now) {
  const client = request.headers.get('X-Board-Client');
  const stamp = request.headers.get('X-Board-Time');
  const signature = request.headers.get('X-Board-Signature');
  if (!client && !stamp && !signature) return addressKey(request, now);
  if (!env.BOARD_RELAY_SECRET || !/^[a-f0-9]{64}$/.test(client || '') || !/^\d{13}$/.test(stamp || '') || !/^[a-f0-9]{64}$/.test(signature || '') || Math.abs(now - Number(stamp)) > 120000) return null;
  const valid = await crypto.subtle.verify('HMAC', await hmacKey(env.BOARD_RELAY_SECRET), Uint8Array.from(signature.match(/../g), x => parseInt(x, 16)), signatureData(stamp, client));
  return valid ? client : null;
}

export async function relayBoard(request, env) {
  const invalid = validateRequest(request);
  if (invalid) return invalid;
  const origin = new URL(env.BOARD_UPSTREAM);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.origin === new URL(request.url).origin) throw Error('Invalid board upstream');
  const target = new URL('/api/board', origin.origin);
  const before = new URL(request.url).searchParams.get('before');
  if (before !== null) target.searchParams.set('before', before);
  const headers = new Headers({ Accept: 'application/json' });
  let body;
  if (request.method === 'POST') {
    body = await readBody(request);
    if (body instanceof Response) return body;
    if (!env.BOARD_RELAY_SECRET) throw Error('Missing board relay secret');
    const stamp = String(Date.now());
    const client = await addressKey(request, Number(stamp));
    headers.set('Origin', origin.origin);
    headers.set('Content-Type', 'application/json');
    headers.set('X-Board-Client', client);
    headers.set('X-Board-Time', stamp);
    headers.set('X-Board-Signature', hex(await crypto.subtle.sign('HMAC', await hmacKey(env.BOARD_RELAY_SECRET), signatureData(stamp, client))));
  }
  // Fail closed on an outage: never write to a second database or follow redirects.
  const response = await fetch(target, { method: request.method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(15000) });
  if (!response.headers.get('Content-Type')?.includes('application/json') || (response.status >= 300 && response.status < 400) || response.status >= 500) throw Error('Board upstream unavailable');
  const responseHeaders = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (response.headers.has('Retry-After')) responseHeaders['Retry-After'] = response.headers.get('Retry-After');
  return new Response(response.body, { status: response.status, headers: responseHeaders });
}

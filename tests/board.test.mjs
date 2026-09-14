import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Miniflare } from 'miniflare';

test('Public board persists, paginates, deduplicates and rejects invalid writes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'openaigames-board-'));
  const options = { modules: true, scriptPath: resolve('dist/server/index.js'), compatibilityDate: '2026-05-15', d1Databases: ['DB'], d1Persist: directory };
  let mf = new Miniflare(options);
  const post = (payload, headers = {}) => mf.dispatchFetch('https://example.com/api/board', { method: 'POST', headers: { Origin: 'https://example.com', 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1', ...headers }, body: JSON.stringify(payload) });
  const payload = (body = '想玩一款合作探险游戏') => ({ requestId: crypto.randomUUID(), kind: 'wish', nickname: '玩家 A', body });
  try {
    const db = await mf.getD1Database('DB');
    for (const file of (await readdir('drizzle')).filter(f => f.endsWith('.sql')).sort()) {
      for (const sql of (await readFile('drizzle/' + file, 'utf8')).split('--> statement-breakpoint')) if (sql.trim()) await db.prepare(sql).run();
    }
    assert.deepEqual((await (await mf.dispatchFetch('https://example.com/api/board')).json()).posts, []);
    const first = payload('<img src=x onerror=alert(1)>\n我希望能一起玩');
    let response = await post(first); assert.equal(response.status, 201);
    const saved = (await response.json()).post;
    assert.equal(saved.body, first.body);
    assert.equal(saved.nickname, '玩家 A');
    assert.ok(saved.created_at > 0);
    response = await post(first); assert.equal(response.status, 200);
    assert.equal((await response.json()).post.id, saved.id);
    assert.equal((await post({ ...first, body: 'changed' })).status, 409);
    assert.equal((await post(payload())).status, 429);
    assert.equal((await post(payload(), { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await post(payload(' '.repeat(5)))).status, 400);
    assert.equal((await post(payload('a'.repeat(1001)))).status, 400);
    assert.equal((await post(payload('a'.repeat(9000)))).status, 413);
    assert.equal((await post({ ...payload(), kind: 'admin' })).status, 400);
    assert.equal((await mf.dispatchFetch('https://example.com/api/board?before=bad')).status, 400);
    const races = await Promise.all([post(payload('first'), { 'CF-Connecting-IP': '192.0.2.2' }), post(payload('second'), { 'CF-Connecting-IP': '192.0.2.2' })]);
    assert.deepEqual(races.map(r => r.status).sort(), [201, 429]);
    for (let i = 0; i < 31; i++) await db.prepare('INSERT INTO board_messages (request_id,kind,nickname,body,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),'message','test',`pagination ${i}`,Date.now()).run();
    const page1 = await (await mf.dispatchFetch('https://example.com/api/board')).json();
    assert.equal(page1.posts.length, 30); assert.ok(page1.next);
    const page2 = await (await mf.dispatchFetch('https://example.com/api/board?before=' + page1.next)).json();
    assert.equal(page2.posts.length, 3); assert.equal(page2.next, null);
    assert.equal(new Set([...page1.posts, ...page2.posts].map(p => p.id)).size, 33);
    await mf.dispose(); mf = new Miniflare(options);
    const afterRestart = await (await mf.dispatchFetch('https://example.com/api/board?before=' + page1.next)).json();
    assert.deepEqual(afterRestart.posts, page2.posts);
  } finally { await mf.dispose(); await rm(directory, { recursive: true, force: true }); }
});

test('Sites and Cloudflare share posts and per-visitor limits through an authenticated relay', async () => {
  const secret = crypto.randomUUID();
  const shared = { modules: true, scriptPath: resolve('dist/server/index.js'), compatibilityDate: '2026-05-15' };
  const origin = new Miniflare({ ...shared, d1Databases: ['DB'], bindings: { BOARD_RELAY_SECRET: secret } });
  let captured, offline = false, calls = 0;
  const proxy = new Miniflare({ ...shared, bindings: { BOARD_UPSTREAM: 'https://cloudflare.example', BOARD_RELAY_SECRET: secret }, outboundService: async request => {
    calls++;
    if (offline) return new Response('unavailable', { status: 503 });
    captured = { url: request.url, headers: Object.fromEntries(request.headers), body: request.method === 'POST' ? await request.text() : undefined };
    return origin.dispatchFetch(request.url, { method: request.method, headers: { ...captured.headers, 'CF-Connecting-IP': '192.0.2.99' }, body: captured.body });
  } });
  const payload = body => ({ requestId: crypto.randomUUID(), kind: 'message', body });
  const post = (mf, host, data, ip = '192.0.2.10', headers = {}) => mf.dispatchFetch(`https://${host}/api/board`, { method: 'POST', headers: { Origin: `https://${host}`, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip, ...headers }, body: JSON.stringify(data) });
  try {
    const db = await origin.getD1Database('DB');
    for (const file of (await readdir('drizzle')).filter(f => f.endsWith('.sql')).sort()) {
      for (const sql of (await readFile('drizzle/' + file, 'utf8')).split('--> statement-breakpoint')) if (sql.trim()) await db.prepare(sql).run();
    }
    const first = payload('From Sites');
    assert.equal((await post(proxy, 'sites.example', first, '192.0.2.10', { Cookie: 'private=keep-local', Authorization: 'Bearer private', 'X-Board-Client': 'spoofed' })).status, 201);
    const signed = structuredClone(captured);
    assert.equal(signed.url, 'https://cloudflare.example/api/board');
    assert.equal(signed.headers.cookie, undefined);
    assert.equal(signed.headers.authorization, undefined);
    assert.equal(signed.headers['cf-connecting-ip'], undefined);
    assert.match(signed.headers['x-board-client'], /^[a-f0-9]{64}$/);
    assert.equal((await post(origin, 'cloudflare.example', first)).status, 200);
    assert.equal((await post(origin, 'cloudflare.example', payload('Same visitor, different site'))).status, 429);
    assert.equal((await post(proxy, 'sites.example', payload('Different visitor'), '192.0.2.11')).status, 201);
    const direct = await (await origin.dispatchFetch('https://cloudflare.example/api/board')).json();
    const relayed = await (await proxy.dispatchFetch('https://sites.example/api/board')).json();
    assert.deepEqual(relayed, direct);
    assert.equal(direct.posts.length, 2);
    const beforeCalls = calls;
    assert.equal((await post(proxy, 'sites.example', payload('forbidden'), '192.0.2.12', { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await post(proxy, 'sites.example', payload('x'.repeat(9000)))).status, 413);
    assert.equal((await proxy.dispatchFetch('https://sites.example/api/board?before=bad')).status, 400);
    assert.equal(calls, beforeCalls);
    for (const changes of [ { 'x-board-client': 'a'.repeat(64) }, { 'x-board-time': String(Date.now() - 180000) }, { 'x-board-signature': 'b'.repeat(64) } ]) {
      const response = await origin.dispatchFetch(signed.url, { method: 'POST', headers: { ...signed.headers, ...changes }, body: signed.body });
      assert.equal(response.status, 403);
    }
    offline = true;
    assert.equal((await post(proxy, 'sites.example', payload('Keep draft'), '192.0.2.12')).status, 503);
    assert.equal((await (await origin.dispatchFetch('https://cloudflare.example/api/board')).json()).posts.length, 2);
  } finally { await proxy.dispose(); await origin.dispose(); }
});

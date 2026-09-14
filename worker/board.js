import { json, readBody, validateRequest } from './board-http.js';
import { clientKey } from './board-relay.js';
const columns = 'id, kind, nickname, body, created_at';
function database(env) {
  if (!env.DB) throw Error('Missing board database binding');
  return env.DB;
}
export async function board(request, env, ctx) {
  const invalid = validateRequest(request);
  if (invalid) return invalid;
  const url = new URL(request.url), db = database(env);
  if (request.method === 'GET') {
    const before = url.searchParams.get('before');
    const result = await db.prepare(`SELECT ${columns} FROM board_messages WHERE id < ? ORDER BY id DESC LIMIT 31`)
      .bind(before ? Number(before) : Number.MAX_SAFE_INTEGER).all();
    const posts = result.results.slice(0, 30);
    return json({ posts, next: result.results.length > 30 ? posts.at(-1).id : null });
  }
  const raw = await readBody(request);
  if (raw instanceof Response) return raw;
  let input;
  try { input = JSON.parse(raw); } catch { return json({ error: '没能读懂这条留言，请重试。' }, 400); }
  if (!input || typeof input !== 'object') return json({ error: '留言格式无效。' }, 400);
  const { kind, requestId } = input;
  const body = typeof input.body === 'string' ? input.body.trim() : '';
  const nickname = typeof input.nickname === 'string' ? input.nickname.trim() || '路过的玩家' : '路过的玩家';
  if (!['wish', 'message'].includes(kind) || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId || '')) return json({ error: '留言格式无效，请刷新重试。' }, 400);
  if (!body || body.length > 1000 || nickname.length > 32 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(body + nickname)) return json({ error: '请写 1–1000 字的内容，昵称最多 32 字。' }, 400);
  if (input.website) return json({ error: '提交未成功，请刷新后再试。' }, 400);
  const now = Date.now();
  const key = await clientKey(request, env, now);
  if (!key) return json({ error: '留言连接校验失败，请稍后重试。' }, 403);
  const previous = await db.prepare(`SELECT ${columns} FROM board_messages WHERE request_id = ?`).bind(requestId).first();
  if (previous) return previous.body === body && previous.kind === kind && previous.nickname === nickname ? json({ post: previous }) : json({ error: '请刷新表单后提交新的内容。' }, 409);
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO board_messages (request_id, kind, nickname, body, created_at) SELECT ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM board_limits WHERE key = ? AND next_at > ?)`)
      .bind(requestId, kind, nickname, body, now, key, now),
    db.prepare(`INSERT INTO board_limits (key, next_at) SELECT ?, ? WHERE EXISTS (SELECT 1 FROM board_messages WHERE request_id = ? AND created_at = ?) ON CONFLICT(key) DO UPDATE SET next_at = excluded.next_at`)
      .bind(key, now + 10000, requestId, now),
  ]);
  const post = await db.prepare(`SELECT ${columns} FROM board_messages WHERE request_id = ?`).bind(requestId).first();
  if (!post) return json({ error: '发得有点快，等 10 秒再试试。' }, 429, { 'Retry-After': '10' });
  ctx.waitUntil(db.prepare('DELETE FROM board_limits WHERE next_at < ?').bind(now - 86400000).run().catch(error => console.error('board cleanup failed', error.message)));
  return json({ post }, 201);
}

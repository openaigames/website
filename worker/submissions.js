import { json, readBody } from './board-http.js';
import { clientKey } from './board-relay.js';

const columns = 'id, title, url, description, submitter, relation, created_at';
const same = (row, data) => ['title','url','description','submitter','relation'].every(key => row[key] === data[key]);
export function normalizeSubmission(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('请使用投稿表单。');
  const result = {};
  for (const [key, max, required] of [['title',100,true],['description',500,true],['submitter',50,false]]) {
    if (input[key] !== undefined && typeof input[key] !== 'string') throw Error('请检查名称、介绍和署名。');
    result[key] = (input[key] || '').trim();
    if ((required && !result[key]) || result[key].length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(result[key])) throw Error('名称最多 100 字，介绍最多 500 字，署名最多 50 字。');
  }
  let url;
  try { url = new URL(input.url); } catch { throw Error('请填写完整的 HTTPS 试玩链接。'); }
  if (typeof input.url !== 'string' || input.url.length > 2048 || /[\s<>"'\\]/.test(input.url) || url.protocol !== 'https:' || url.username || url.password || url.port || !url.hostname.includes('.') || /^[\d.]+$/.test(url.hostname) || url.hostname.includes(':') || /\.(local|localhost|internal|test|invalid|example|arpa)$/.test(url.hostname) || ['openaigames.org','preview.openaigames.org','openaigames.3325932294.workers.dev','openaigames-preview.3325932294.workers.dev','openaigames.lens-frontier.workers.dev','openaigames-preview.lens-frontier.workers.dev','openaigames-demo.leonliuzx.chatgpt.site'].includes(url.hostname)) throw Error('请填写游戏原站的公开 HTTPS 链接。');
  result.url = url.href;
  if (!['creator','recommend'].includes(input.relation)) throw Error('请选择自己的作品或推荐的作品。');
  result.relation = input.relation;
  return result;
}

export async function submissions(request, env, ctx) {
  if (env.CATALOG_MODE === 'preview' || env.BOARD_UPSTREAM) return json({error:'请到正式站查看和提交试玩。'},403);
  const url = new URL(request.url);
  if (!['GET','POST'].includes(request.method)) return json({error:'不支持这个操作。'},405,{Allow:'GET, POST'});
  if (request.method === 'POST' && request.headers.get('Origin') !== url.origin) return json({error:'请在本站打开投稿表单。'},403);
  if (request.method === 'POST' && !request.headers.get('Content-Type')?.startsWith('application/json')) return json({error:'请使用投稿表单。'},415);
  const db = env.DB;
  if (!db) throw Error('Missing submissions database');
  if (request.method === 'GET') {
    const id = url.searchParams.get('id');
    if (id !== null) {
      if (!/^[1-9]\d{0,14}$/.test(id)) return json({error:'查询条件无效。'},400);
      const entry=await db.prepare(`SELECT ${columns} FROM game_submissions WHERE id = ? AND status = 'approved'`).bind(Number(id)).first();
      return entry ? json({entry}) : json({error:'这款试玩暂时没有找到。'},404);
    }
    const before = url.searchParams.get('before'), query = (url.searchParams.get('q') || '').trim();
    if ((before !== null && !/^[1-9]\d{0,14}$/.test(before)) || query.length > 100) return json({error:'查询条件无效。'},400);
    const result = await db.prepare(`SELECT ${columns} FROM game_submissions WHERE status = 'approved' AND id < ? AND instr(lower(title || ' ' || description), lower(?)) > 0 ORDER BY id DESC LIMIT 21`).bind(before ? Number(before) : Number.MAX_SAFE_INTEGER, query).all();
    const entries = result.results.slice(0,20);
    return json({entries, next: result.results.length > 20 ? entries.at(-1).id : null});
  }
  const raw = await readBody(request);
  if (raw instanceof Response) return raw;
  let input, data;
  try { input = JSON.parse(raw); data = normalizeSubmission(input); } catch (error) { return json({error:error instanceof SyntaxError ? '投稿格式无效。' : error.message},400); }
  const requestId = input.requestId;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId || '') || input.website || input.public !== true) return json({error:'请确认公开展示投稿后再提交。'},400);
  const prior = await db.prepare(`SELECT ${columns}, status FROM game_submissions WHERE request_id = ?`).bind(requestId).first();
  if (prior) return same(prior,data) ? json({entry:{id:prior.id,title:prior.title,status:prior.status}, duplicate:true}) : json({error:'这次投稿已有记录，请重新填写后提交。'},409);
  const exists = await db.prepare('SELECT id FROM game_submissions WHERE url = ?').bind(data.url).first();
  if (exists) return json({error:'这个试玩链接已经提交过了，无需重复投稿。',id:exists.id},409);
  const now = Date.now(), key = await clientKey(request, env, now);
  if (!key) return json({error:'投稿连接校验失败，请刷新重试。'},403);
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO game_submissions (request_id,title,url,description,submitter,relation,created_at) SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM submission_limits WHERE key = ? AND next_at > ?)`).bind(requestId,data.title,data.url,data.description,data.submitter,data.relation,now,key,now),
    db.prepare(`INSERT INTO submission_limits (key,next_at) SELECT ?,? WHERE EXISTS (SELECT 1 FROM game_submissions WHERE request_id = ? AND created_at = ?) ON CONFLICT(key) DO UPDATE SET next_at=excluded.next_at`).bind(key,now+30000,requestId,now)
  ]);
  const entry = await db.prepare(`SELECT ${columns} FROM game_submissions WHERE request_id = ?`).bind(requestId).first();
  if (!entry) {
    const duplicate = await db.prepare('SELECT id FROM game_submissions WHERE url = ?').bind(data.url).first();
    if (duplicate) return json({error:'这个试玩链接已经提交过了。',id:duplicate.id},409);
    return json({error:'请等 30 秒再提交下一款游戏。'},429,{'Retry-After':'30'});
  }
  if (!same(entry,data)) return json({error:'这次投稿已有记录，请重新填写后提交。'},409);
  ctx.waitUntil(db.prepare('DELETE FROM submission_limits WHERE next_at < ?').bind(now-86400000).run().catch(error=>console.error('submission cleanup',error.message)));
  return json({entry:{id:entry.id,title:entry.title,status:'pending'}},201);
}
function publicEntry(row) { return Object.fromEntries(columns.split(', ').map(key => [key,row[key]])); }

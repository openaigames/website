import { json, readBody, validateRequest } from './board-http.js';
import { adminIdentity, isAdministrator, hash } from './admin-auth.js';
import { catalog } from './catalog.js';

const fields = 'id,github_id,login,body,created_at';
async function reactions(env,key,identity) {
  const [totals,comments,viewer]=await Promise.all([
    env.DB.prepare('SELECT COUNT(rating) AS ratings,AVG(rating) AS average,COALESCE(SUM(liked),0) AS likes FROM game_reactions WHERE game_key=?').bind(key).first(),
    env.DB.prepare('SELECT COUNT(*) AS total FROM game_comments WHERE game_key=? AND deleted_at IS NULL').bind(key).first(),
    identity ? env.DB.prepare('SELECT rating,liked FROM game_reactions WHERE game_key=? AND github_id=?').bind(key,identity.github_id).first() : null
  ]);
  return {summary:{average:totals.ratings?Math.round(totals.average*10)/10:null,ratingCount:totals.ratings,likes:totals.likes,commentCount:comments.total},viewer:identity?{rating:viewer?.rating??null,liked:Boolean(viewer?.liked)}:null};
}
export async function comments(request, env) {
  if (env.CATALOG_MODE === 'preview' || !env.DB) return json({error:'预览站不开放评论。'},403);
  const invalid = validateRequest(request); if (invalid) return invalid;
  const url = new URL(request.url), game = url.searchParams.get('game');
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(game || '')) return json({error:'请选择一款游戏。'},400);
  let identity;
  if (request.method === 'POST' || url.searchParams.get('mine')==='1') {
    identity = await adminIdentity(request,env); if (identity instanceof Response) return identity;
    if (request.method==='POST' && request.headers.get('X-Admin-CSRF') !== identity.csrf) return json({error:'请刷新页面后重试。'},403);
  }
  const response = await catalog(new Request(new URL('/api/catalog',url)),env);
  if (!response.ok) return json({error:'暂时无法读取游戏。'},503);
  const data = await response.json();
  let gameUrl = data.projects?.find(p=>p.id === game)?.preview_url;
  if (!gameUrl && /^inbox-[1-9]\d*$/.test(game)) {
    gameUrl = (await env.DB.prepare("SELECT url FROM game_submissions WHERE id=? AND status='approved'").bind(Number(game.slice(6))).first())?.url;
  }
  if (!gameUrl) return json({error:'这款游戏暂未公开。'},404);
  // Keep the conversation when an intake game is promoted into the catalog.
  const key = await hash(gameUrl);
  if (request.method === 'GET') {
    const interaction=await reactions(env,key,identity);
    if(url.searchParams.get('view')==='summary')return json(interaction);
    const rows = (await env.DB.prepare(`SELECT ${fields} FROM game_comments WHERE game_key=? AND deleted_at IS NULL AND id<? ORDER BY id DESC LIMIT 21`).bind(key,Number(url.searchParams.get('before')||Number.MAX_SAFE_INTEGER)).all()).results;
    return json({entries:rows.slice(0,20),next:rows.length>20?rows[19].id:null,...interaction});
  }
  const raw = await readBody(request); if (raw instanceof Response) return raw;
  let input; try { input = JSON.parse(raw); } catch { return json({error:'评论格式无效。'},400); }
  if (input?.action==='rate' || input?.action==='like') {
    if(input.action==='rate' && input.rating!==null && (!Number.isInteger(input.rating)||input.rating<1||input.rating>5))return json({error:'请选择 1–5 星，或清除评分。'},400);
    if(input.action==='like' && typeof input.liked!=='boolean')return json({error:'点赞状态无效。'},400);
    // Desired-state writes make retries harmless. Updating one field preserves the other.
    if(input.action==='rate')await env.DB.prepare('INSERT INTO game_reactions(game_key,github_id,rating,updated_at) VALUES(?,?,?,?) ON CONFLICT(game_key,github_id) DO UPDATE SET rating=excluded.rating,updated_at=excluded.updated_at').bind(key,identity.github_id,input.rating,Date.now()).run();
    else await env.DB.prepare('INSERT INTO game_reactions(game_key,github_id,liked,updated_at) VALUES(?,?,?,?) ON CONFLICT(game_key,github_id) DO UPDATE SET liked=excluded.liked,updated_at=excluded.updated_at').bind(key,identity.github_id,Number(input.liked),Date.now()).run();
    return json(await reactions(env,key,identity));
  }
  if (input?.action === 'delete') {
    if (!Number.isSafeInteger(input.id) || input.id<1) return json({error:'评论不存在。'},400);
    const result = await env.DB.prepare('UPDATE game_comments SET deleted_at=? WHERE id=? AND game_key=? AND deleted_at IS NULL AND (github_id=? OR ?=1)').bind(Date.now(),input.id,key,identity.github_id,Number(isAdministrator(identity))).run();
    return result.meta.changes ? json({ok:true}) : json({error:'评论不存在或无法删除。'},404);
  }
  const body = typeof input?.body === 'string' ? input.body.trim() : '';
  if (!body || body.length>1000 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(body) || !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(input?.requestId||'')) return json({error:'请填写 1–1000 字的评论。'},400);
  const duplicate = async () => {
    const row = await env.DB.prepare(`SELECT ${fields},game_key,deleted_at FROM game_comments WHERE github_id=? AND request_id=?`).bind(identity.github_id,input.requestId).first();
    if (!row) return null;
    if (row.game_key!==key || row.body!==body || row.deleted_at) return json({error:'这条评论已变更，请刷新重试。'},409);
    delete row.game_key; delete row.deleted_at;
    return json({entry:row,duplicate:true});
  };
  const existing = await duplicate(); if (existing) return existing;
  const now = Date.now();
  const result = await env.DB.prepare('INSERT OR IGNORE INTO game_comments(request_id,game_key,github_id,login,body,created_at) SELECT ?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM game_comments WHERE github_id=? AND created_at>?)').bind(input.requestId,key,identity.github_id,identity.login,body,now,identity.github_id,now-10000).run();
  if (!result.meta.changes) return await duplicate() || json({error:'稍等 10 秒再发下一条吧。'},429,{'Retry-After':'10'});
  return json({entry:await env.DB.prepare(`SELECT ${fields} FROM game_comments WHERE github_id=? AND request_id=?`).bind(identity.github_id,input.requestId).first()},201);
}

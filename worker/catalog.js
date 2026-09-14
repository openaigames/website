import { normalizeCatalog } from '../lib/catalog.mjs';
import { json } from './board-http.js';

export async function catalog(request, env) {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  const url = new URL(request.url), preview = env.CATALOG_MODE === 'preview';
  const pr = url.searchParams.get('pr'), revision = url.searchParams.get('revision');
  if (!preview && (pr || revision)) return json({ error: '投稿预览请打开独立预览站。' }, 400);
  if (preview && (!pr || !/^[1-9]\d{0,8}$/.test(pr))) return json({ error: '请使用 PR 评论里的预览链接。' }, 400);
  if (revision && !/^[a-f0-9]{40}$/.test(revision)) return json({ error: '预览版本无效。' }, 400);
  const channel = preview ? `pr-${pr}` : 'production';
  if (!env.CATALOG) return env.ASSETS.fetch(new Request(new URL('/catalog.json', request.url)));
  const row = revision
    ? await env.CATALOG.prepare('SELECT * FROM catalog_entries WHERE channel=? AND revision=?').bind(channel, revision).first()
    : await env.CATALOG.prepare('SELECT e.* FROM catalog_entries e JOIN catalog_heads h ON e.channel=h.channel AND e.revision=h.revision WHERE h.channel=?').bind(channel).first();
  if (!row) {
    if (!preview) return env.ASSETS.fetch(new Request(new URL('/catalog.json', request.url)));
    return json({ error: '这个 PR 的预览还没准备好，请查看 PR 检查结果。' }, 404);
  }
  if (row.status === 'invalid') return json({ error: '这次提交的资料检查未通过，请查看 PR 评论。' }, 422);
  return json({ ...JSON.parse(row.payload), release: { preview, pr: preview ? Number(pr) : null, revision: row.revision, status: row.status, updated_at: row.updated_at } });
}

export async function publishCatalog(request, env) {
  if (env.CATALOG_MODE !== 'preview') return json({ error: 'Not found' }, 404);
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!env.CATALOG_PUBLISH_SECRET) return json({ error: 'Publishing is not configured' }, 503);
  const digest = s => crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  const [actual, expected] = await Promise.all([digest(request.headers.get('Authorization') || ''), digest('Bearer ' + env.CATALOG_PUBLISH_SECRET)]);
  let different = 0; new Uint8Array(actual).forEach((v,i) => { different |= v ^ new Uint8Array(expected)[i]; });
  if (different) return json({ error: 'Unauthorized' }, 401);
  if (Number(request.headers.get('Content-Length')) > 524288) return json({ error: 'Catalog too large' }, 413);
  const reader = request.body?.getReader(); if (!reader) return json({ error: 'Missing body' }, 400);
  let size = 0, raw = ''; const decoder = new TextDecoder();
  while (true) { const {done,value} = await reader.read(); if(done)break; size += value.byteLength; if(size > 524288){await reader.cancel(); return json({error:'Catalog too large'},413);} raw += decoder.decode(value,{stream:true}); }
  let input, data;
  try {
    input = JSON.parse(raw + decoder.decode());
    if (!/^(production|pr-[1-9]\d{0,8})$/.test(input.channel) || !/^[a-f0-9]{40}$/.test(input.revision) || !Number.isSafeInteger(input.sequence) || input.sequence < 1 || !['ready','merged','closed','invalid'].includes(input.status)) throw Error('Invalid publication');
    if (input.channel === 'production' && input.status !== 'ready') throw Error('Production requires a valid catalog');
    data = normalizeCatalog(input.catalog);
  } catch(error) { return json({error:error.message},400); }
  const now = Date.now();
  await env.CATALOG.batch([
    env.CATALOG.prepare('INSERT INTO catalog_entries(channel,revision,sequence,status,payload,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(channel,revision) DO UPDATE SET sequence=excluded.sequence,status=excluded.status,payload=excluded.payload,updated_at=excluded.updated_at WHERE excluded.sequence >= catalog_entries.sequence').bind(input.channel,input.revision,input.sequence,input.status,JSON.stringify(data),now),
    env.CATALOG.prepare('INSERT INTO catalog_heads(channel,revision,sequence) VALUES(?,?,?) ON CONFLICT(channel) DO UPDATE SET revision=excluded.revision,sequence=excluded.sequence WHERE excluded.sequence >= catalog_heads.sequence').bind(input.channel,input.revision,input.sequence)
  ]);
  return json({ok:true,channel:input.channel,revision:input.revision});
}

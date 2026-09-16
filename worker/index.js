import { board } from './board.js';
import { json } from './board-http.js';
import { relayBoard } from './board-relay.js';
import { catalog, publishCatalog } from './catalog.js';
import { submissions } from './submissions.js';
import { admin, adminPage } from './admin.js';
import { music } from './music.js';
import { comments } from './comments.js';
export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    try {
      if (['/admin','/admin/','/static/admin','/static/admin/','/static/admin/index.html'].includes(path)) return await adminPage(request, env);
      if (path.startsWith('/api/admin/') || path.startsWith('/api/auth/')) return await admin(request, env);
      if (path.startsWith('/api/music/')) return await music(request);
      if (path === '/api/comments') return await comments(request, env);
      if (path === '/api/submissions') return await submissions(request, env, ctx);
      if (path === '/api/catalog' || path === '/catalog.json') return await catalog(request, env);
      if (path === '/internal/catalog') return await publishCatalog(request, env);
      if (env.CATALOG_MODE === 'preview' && path === '/api/board') return json({error:'预览站不接收正式留言。'},403);
      if (path === '/api/board') return env.BOARD_UPSTREAM ? await relayBoard(request, env) : await board(request, env, ctx);
      if (path.startsWith('/api/')) return json({ error: '找不到这个入口。' }, 404);
      if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405 });
      if (env.CATALOG_MODE === 'preview' && /^\/community\/pr\/[1-9]\d{0,8}\/?$/.test(path)) {
        // Fetch the canonical asset URL so its redirect cannot discard the PR path.
        const response = await env.ASSETS.fetch(new Request(new URL('/',request.url),request));
        const headers = new Headers(response.headers); headers.set('X-Robots-Tag','noindex, nofollow'); headers.set('Cache-Control','no-store');
        return new Response(response.body,{status:response.status,headers});
      }
      return await env.ASSETS.fetch(request);
    } catch (error) {
      console.error('request failed', path, error.message);
      return json({ error: (path.startsWith('/api/admin/') || path.startsWith('/api/auth/')) ? '审核后台暂时连接不上，请稍后重试。' : path === '/api/comments' ? '评论暂时连接不上，请稍后重试。' : path === '/api/submissions' ? '投稿暂时连接不上，请稍后重试。' : path === '/api/catalog' || path === '/catalog.json' ? '游戏目录暂时连接不上，请稍后重试。' : path.startsWith('/api/') ? '留言板暂时连接不上，内容还在，请稍后重试。' : '页面暂时无法打开，请稍后重试。' }, 503);
    }
  }
};

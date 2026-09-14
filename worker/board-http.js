export const json = (data, status = 200, extra = {}) => Response.json(data, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra }
});

export function validateRequest(request) {
  const url = new URL(request.url);
  if (request.method === 'GET') {
    const before = url.searchParams.get('before');
    if (before !== null && (!/^\d{1,15}$/.test(before) || Number(before) < 1)) return json({ error: '留言页码无效，请刷新重试。' }, 400);
    return;
  }
  if (request.method !== 'POST') return json({ error: '不支持这个操作。' }, 405, { Allow: 'GET, POST' });
  if (request.headers.get('Origin') !== url.origin) return json({ error: '请在本站打开留言板后提交。' }, 403);
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({ error: '请使用留言表单提交。' }, 415);
}

export async function readBody(request) {
  const tooLong = () => json({ error: '内容太长了，最多写 1000 字。' }, 413);
  if (Number(request.headers.get('Content-Length')) > 8192) return tooLong();
  const reader = request.body?.getReader();
  if (!reader) return json({ error: '写点什么再发送吧。' }, 400);
  let bytes = 0, raw = '';
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) return raw + decoder.decode();
    bytes += value.byteLength;
    if (bytes > 8192) { await reader.cancel(); return tooLong(); }
    raw += decoder.decode(value, { stream: true });
  }
}

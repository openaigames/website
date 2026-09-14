/* Static published releases. No local-server dependency or pretend write API. */
(() => {
  let pending, fetchedAt = 0;
  const pr = /^\/community\/pr\/([1-9]\d*)\/?$/.exec(location.pathname)?.[1];
  const params = new URLSearchParams();
  if (pr) { params.set('pr',pr); const revision = new URLSearchParams(location.search).get('revision'); if(revision)params.set('revision',revision); }
  window.OpenAIGamesPreview = Boolean(pr);
  async function catalog() {
    if (Date.now() - fetchedAt > 30000) pending = null;
    pending ||= fetch('/api/catalog' + (params.size ? '?' + params : '')).then(async response => {
      const data = await response.json();
      if (!response.ok) throw Error(data.error || '卡带目录暂时未能载入，请重试。');
      fetchedAt = Date.now();
      window.dispatchEvent(new CustomEvent('openaigames-catalog',{detail:data}));
      return data;
    }).catch(error => { pending = null; throw error; });
    return pending;
  }
  async function request(path, body) {
    if (body !== undefined) throw Error('这版展厅提供试玩；创作和投稿请前往共创社区。');
    if (path === '/session') return { user: 'visitor', users: [], mode: 'online-showcase' };
    if (path === '/source') return { can_edit: false, mode: 'showcase' };
    const data = await catalog();
    if (path === '/projects') return structuredClone(data);
    const match = /^\/projects\/([^/]+)$/.exec(path);
    if (match) {
      const project = data.projects.find(item => item.id === decodeURIComponent(match[1]));
      if (project) return structuredClone(project);
      throw Error('这张卡带暂时没有找到。');
    }
    throw Error('当前展厅没有这个入口。');
  }
  window.OpenAIGamesCloud = Object.freeze({ request, catalog });
})();

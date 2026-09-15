import { combineGames, intakeGame } from '../lib/arcade.mjs';
import gameMedia from '../content/game-media.json';
const withMedia = project => ({...project,...gameMedia[project.preview_url]});
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
  let arcadePending, arcadeAt=0;
  async function arcade() {
    if(Date.now()-arcadeAt>30000)arcadePending=null;
    arcadePending ||= (async()=>{
      const data=await catalog();
      if(window.OpenAIGamesPreview)return data;
      const entries=[];let before='';
      try {
        do {const response=await fetch('/api/submissions'+(before?'?before='+before:''),{signal:AbortSignal.timeout(12000)});if(!response.ok)break;const page=await response.json();entries.push(...page.entries);before=page.next;}while(before&&entries.length<200);
      } catch {}
      arcadeAt=Date.now();return {...data,projects:combineGames(data.projects,entries).map(withMedia)};
    })().catch(error=>{arcadePending=null;throw error;});
    return arcadePending;
  }
  async function request(path, body) {
    if (body !== undefined) throw Error('这版展厅提供试玩；创作和投稿请前往共创社区。');
    if (path === '/session') return { user: 'visitor', users: [], mode: 'online-showcase' };
    if (path === '/source') return { can_edit: false, mode: 'showcase' };
    if(path==='/arcade')return structuredClone(await arcade());
    const intake = /^\/projects\/inbox-([1-9]\d*)$/.exec(path);
    if(intake&&!window.OpenAIGamesPreview){const response=await fetch('/api/submissions?id='+intake[1]);const result=await response.json();if(!response.ok)throw Error(result.error);return withMedia(intakeGame(result.entry));}
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
  window.OpenAIGamesCloud = Object.freeze({ request, catalog, arcade });
})();

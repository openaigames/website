/* Optional imperative browser tools. Uses the same catalog and play action as the UI. */
(() => {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  const t=text=>window.OpenAIGamesI18n?.t(text)||text;
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
  function inputObject(input, allowed) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !allowed.includes(key))) throw Error('Invalid input');
    return input;
  }
  const tools = [{
    name: 'list_playable_games', title: t('查找可玩的游戏'),
    description: 'Read the current published community games. Optionally filter by title, description, or category.',
    inputSchema: { type: 'object', properties: { query: { type: 'string', maxLength: 100 } }, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    async execute(input) {
      const { query = '' } = inputObject(input, ['query']);
      if (typeof query !== 'string' || query.length > 100) throw Error('Invalid query');
      const { projects } = await window.OpenAIGamesCloud.arcade();
      return { games: projects.filter(p => window.OpenAIGamesI18n.matchesGame(p,query)).map(p => ({ id: p.id, title: t(p.title), original_title:p.title, category: t(p.category), description: t(p.description) })) };
    }
  }, {
    name: 'open_game_for_play', title: t('插卡并打开游戏'),
    description: 'Insert the selected game and open its playable start screen. Does not press the in-game start button or publish content.',
    inputSchema: { type: 'object', properties: { gameId: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]{0,63}$' } }, required: ['gameId'], additionalProperties: false },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    async execute(input) {
      const { gameId } = inputObject(input, ['gameId']);
      const { projects } = await window.OpenAIGamesCloud.arcade();
      const game = projects.find(p => p.id === gameId);
      if (!game) throw Error('Unknown game');
      if (!window.OpenAIGamesSite?.play) throw Error('The showcase is still loading');
      const state=window.OpenAIGamesHost?.state();
      const alreadyPlaying=state?.route==='game'&&state.selected===gameId&&document.querySelector('#player iframe');
      await window.OpenAIGamesSite.play(gameId);
      if(!alreadyPlaying)await new Promise((resolve, reject) => {
        let timer;
        const done = () => { clearTimeout(timer); window.removeEventListener('openaigames-game-ready', ready); };
        const ready = event => { if (event.detail?.id === gameId) { done(); resolve(); } };
        window.addEventListener('openaigames-game-ready', ready);
        timer = setTimeout(() => { done(); reject(Error('Game did not finish loading')); }, 12000);
      });
      return { id: game.id, title: t(game.title), status: 'ready_to_start' };
    }
  }];
  for (const tool of tools) {
    try { Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch {}
  }
})();

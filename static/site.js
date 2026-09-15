/* Published community games and the shared player board. */
(() => {
  'use strict';
  const community = 'https://github.com/openaigames/community';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
  const host = () => window.OpenAIGamesHost;
  const header = document.createElement('header');
  header.id = 'site-header';
  header.innerHTML = `<a class="site-brand" href="#/discover" aria-label="OpenAIGames 首页">OpenAI<span>Games</span><small>一起，做点好玩的。</small></a><nav aria-label="站点导航"><a href="#/discover" data-site-nav="home">精选游戏</a><a href="#/games" data-site-nav="games">游戏目录</a><a href="#/board" data-site-nav="board">许愿 / 留言</a><a class="site-submit" href="#/submit" data-site-nav="submit">快捷投稿 ＋</a><a href="#/community" data-site-nav="community">如何共创</a><a class="site-github" href="${community}" target="_blank" rel="noopener">GitHub ↗</a></nav>`;
  const intro = document.createElement('section');
  intro.id = 'site-intro';
  intro.setAttribute('aria-label', '关于 OpenAIGames');
  intro.innerHTML = `<p class="site-kicker">AI × GAME CREATION</p><h1>下一张卡带，<br>由你创造。</h1><p class="intro-copy">把一个好玩的点子，<br>变成大家都能玩的游戏。</p><a class="intro-link" href="#/games">打开游戏目录 <span>↗</span></a><small class="intro-note">精选卡带 · 更多作品在游戏目录</small>`;
  const view = document.createElement('main');
  view.id = 'site-view';
  view.hidden = true;
  view.tabIndex = -1;
  document.body.append(header, intro, view);
  window.addEventListener('openaigames-catalog', event => {
    if (!event.detail.release?.preview) return;
    const release = event.detail.release;
    let banner = document.getElementById('preview-banner');
    if (!banner) { banner = document.createElement('aside'); banner.id='preview-banner'; document.body.append(banner); }
    const labels = {ready:'投稿预览',merged:'已合并',closed:'已关闭，未上架'};
    banner.innerHTML = `<b>PR #${release.pr} · ${labels[release.status] || '投稿预览'}</b><span>${release.revision.slice(0,7)}</span><a href="https://github.com/openaigames/community/pull/${release.pr}" target="_blank" rel="noopener">回 PR 留反馈 ↗</a><a href="?revision=${release.revision}${location.hash}">固定这个版本</a>`;
  });
  let routeId = 0, request, pageKind = '', projects = [], category = '全部', query = '', opening = false, inboxView;
  const paths = () => (location.hash.replace(/^#\/?/, '') || 'discover').split('/');
  const external = (href, label, className = '') => `<a class="${className}" href="${esc(href)}" target="_blank" rel="noopener">${label} <span aria-hidden="true">↗</span></a>`;
  const sourceLabel = project => project.creator || '社区创作者';
  function cover(project, large = false) {
    return `<div class="site-cartridge ${large ? 'large' : ''}" style="--case:#b3ac8d"><div class="cartridge-ridges" aria-hidden="true"></div><div class="cartridge-label"><span class="cartridge-imprint">OpenAIGames <i>COMMUNITY EDITION</i></span><img class="cartridge-image submitted-art" src="${esc(project.cover_url)}" alt="${esc(project.title)} 卡带封面"><span class="cartridge-caption">${esc(project.title)}</span></div><span class="cartridge-notch" aria-hidden="true"></span></div>`;
  }
  function footer() {
    return `<footer class="site-page-footer"><a href="#/discover">OpenAIGames <span>一起，做点好玩的。</span></a><p>社区作品 · 玩过以后，留句话</p>${external(community, '去社区逛逛')}</footer>`;
  }
  function syncInert() {
    const open = !view.hidden;
    for (const element of document.querySelectorAll('#three-room, body > .room')) element.inert = open;
  }
  new MutationObserver(syncInert).observe(document.body, { childList: true });
  function setOpen(open) {
    view.hidden = !open;
    document.body.classList.toggle('site-open', open);
    intro.hidden = open || ['game','studio','mine','workspace'].includes(paths()[0]);
    syncInert();
  }
  async function read(path, signal) {
    if (signal.aborted) throw new DOMException('Aborted','AbortError');
    return window.OpenAIGamesCloud.request(path);
  }
  function mount(html) {
    view.innerHTML = html + footer();
    const heading = view.querySelector('h1');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  }
  function loading() {
    view.innerHTML = '<div class="site-state" role="status"><span class="site-kicker">READING CARTRIDGES</span><h1>正在打开卡带盒…</h1><div class="loading-track" aria-hidden="true"></div></div>';
  }
  function renderCards() {
    const list = view.querySelector('#site-game-grid');
    if (!list) return;
    const normalized = query.trim().toLocaleLowerCase();
    const filtered = projects.filter(project => (category === '全部' || project.category === category) && `${project.title} ${project.description} ${project.category}`.toLocaleLowerCase().includes(normalized));
    view.querySelector('#catalog-count').textContent = `${filtered.length} 张已收录卡带`;
    for (const button of view.querySelectorAll('[data-site-category]')) button.setAttribute('aria-pressed', String(button.dataset.siteCategory === category));
    list.innerHTML = filtered.length ? filtered.map(project => `<article class="catalog-game"><a class="cartridge-link" href="#/title/${encodeURIComponent(project.id)}" aria-label="查看${esc(project.title)}">${cover(project)}</a><div class="catalog-meta"><span>${esc(project.category)} · ${esc(sourceLabel(project))}</span><a href="#/title/${encodeURIComponent(project.id)}" aria-label="查看${esc(project.title)}详情">↗</a></div><h2><a href="#/title/${encodeURIComponent(project.id)}">${esc(project.title)}</a></h2><p>${esc(project.description)}</p><button class="catalog-play" data-site-play="${esc(project.id)}" aria-label="插卡试玩${esc(project.title)}">插卡试玩 <span aria-hidden="true">→</span></button></article>`).join('') : '<div class="catalog-empty catalog-no-match"><p>已收录卡带中暂无匹配项，看看下方的新投稿。</p><button class="site-button" data-site-reset>清空筛选</button></div>';
  }
  async function catalog(signal) {
    const data = await read('/projects', signal);
    projects = data.projects.filter(project => project.current_version);
    if (signal.aborted) return;
    const categories = ['全部', ...new Set(projects.map(project => project.category).filter(Boolean))];
    if (!categories.includes(category)) category = '全部';
    mount(`<section class="site-content catalog-content"><div class="catalog-heading"><div><p class="site-kicker">THE CARTRIDGE COLLECTION</p><h1>挑一张，开玩。</h1><p class="site-lead">从一个小玩法，遇见下一个好点子。</p></div><div class="collection-number" aria-label="${projects.length} 款游戏"><b>${String(projects.length).padStart(2,'0')}</b><span>已收录卡带</span></div></div><div class="catalog-tools"><div class="category-tabs" role="group" aria-label="游戏类型">${categories.map(name => `<button data-site-category="${esc(name)}" aria-pressed="${name===category}">${esc(name)}</button>`).join('')}</div><label class="catalog-search"><span class="sr-only">搜索游戏</span><input maxlength="100" id="site-search" type="search" placeholder="找一款游戏…" autocomplete="off" value="${esc(query)}"><span aria-hidden="true">⌕</span></label></div><div class="catalog-caption"><span id="catalog-count" role="status" aria-live="polite"></span><p>来自社区的真实作品，下一张也可以是你的。</p></div><div id="site-game-grid" class="site-game-grid"></div><div id="catalog-inbox"></div><aside class="catalog-invite"><div><span class="site-kicker">THE NEXT CARTRIDGE</span><h2>这一格，留给你的想法。</h2></div><a class="site-button" href="#/submit">投稿我的游戏 <span>↗</span></a></aside></section>`);
    renderCards();
    inboxView = window.OpenAIGamesSubmissions.mountInbox(view.querySelector("#catalog-inbox"),signal,projects);
    if (query) inboxView.search(query);
  }
  async function detail(id, signal) {
    const project = await read('/projects/' + encodeURIComponent(id), signal);
    if (signal.aborted) return;
    document.title = `${project.title} · OpenAIGames`;
    mount(`<article class="site-content title-content"><a class="site-back" href="#/games">← 回到游戏目录</a><div class="title-layout"><div class="title-cover">${cover(project,true)}<span class="title-cover-note">${esc(project.creator)} / ${esc(project.version_label)}</span>${project.gameplay_url ? `<figure class="gameplay-figure"><img src="${esc(project.gameplay_url)}" alt="${esc(project.title)} 展示画面" loading="lazy" width="960" height="576"><figcaption>${esc(project.image_caption || "由创作者提供")}</figcaption></figure>` : ""}</div><div class="title-copy"><p class="site-kicker">${esc(project.category)} / 社区投稿</p><h1>${esc(project.title)}</h1><p class="title-description">${esc(project.description)}</p><div class="title-actions"><button class="site-button primary" data-site-play="${esc(project.id)}">插卡试玩 <span>→</span></button>${external(project.preview_url,'在原站打开','site-text-link')}</div><section class="title-instructions"><h2>怎么玩</h2><span class="control-keys">${esc(project.controls)}</span><p>${esc(project.instructions)}</p><small>进入屏幕后点击游戏画面，让游戏接收按键。</small></section><section class="title-instructions"><h2>作者想听听</h2><ul class="feedback-questions">${project.feedback_questions.map(question=>`<li>${esc(question)}</li>`).join('')}</ul><a class="site-text-link" href="#/board" data-board-feedback>玩过了，留句话 ↗</a></section><section class="title-notes"><h2>卡带档案</h2><dl><div><dt>创作者</dt><dd>${external(project.creator_url,esc(project.creator))}</dd></div><div><dt>投稿版本</dt><dd>${esc(project.version_label)}</dd></div><div><dt>投稿记录</dt><dd>${external(project.submission_url,'查看投稿记录')}</dd></div></dl><p>${esc(project.credits)}</p><p>${esc(project.attribution)}</p>${external(project.source_url,'查看源码与制作记录','site-text-link')}</section></div></div></article>`);
  }
  function participation() {
    mount(`<section class="community-hero"><div class="site-content"><span class="site-kicker">LET’S MAKE SOMETHING PLAYABLE</span><h1>好玩的想法，<br>值得被做出来。</h1><p>先把点子做成能玩的游戏，再一起把它变得更好。<br>这里是 OpenAIGames，一个围绕 AI 与游戏创作的开源社区。</p>${external(community,'走进 OpenAIGames 社区','site-button light')}<span class="community-stamp" aria-hidden="true">INSERT<br>YOUR<br>IDEA.</span></div></section><section class="site-content community-content"><div class="community-section-heading"><span class="site-kicker">YOUR NEXT MOVE</span><h2>从你手上的那一点开始。</h2></div><div class="participation-row"><span class="step-number">01</span><div><h3>有一个点子</h3><p>说说玩家要做什么、哪里好玩。找几个同路人，一起做出第一版。</p></div><a href="#/board" class="site-row-link">写下游戏愿望 ↗</a></div><div class="participation-row"><span class="step-number">02</span><div><h3>已经能玩了</h3><p>填名称、试玩链接和一句介绍，就能进入公开的试玩收件箱。补齐资料后提 PR，正式收录进卡带目录。</p></div><a href="#/submit" class="site-row-link">快捷投稿 →</a></div><div class="participation-row"><span class="step-number">03</span><div><h3>遇到反复出现的问题</h3><p>把创作中缺的工具记下来，一起把它做成下一次创作的帮手。</p></div>${external(community+'/issues/new?template=03-tool-need.yml','提出工具需求','site-row-link')}</div><div class="participation-row"><span class="step-number">04</span><div><h3>让 Agent 帮你投稿</h3><p>把 Skill 交给你的 Agent，按统一模板整理游戏、检查内容并提交 PR。新作品默认进入目录，首页精选由维护者挑选。</p></div>${external(community+'/blob/main/skills/openaigames-submit-demo/SKILL.md','读取 Agent Skill','site-row-link')}</div><div class="community-local"><div><span class="site-kicker">START SMALL, PLAY NOW</span><h2>还没有作品？先搓一张。</h2><p>先来试玩社区里的作品，再把你的感受和想做的玩法留在留言板。</p><small>做出能玩的版本，再带上试玩地址和制作过程回到社区。</small></div><a class="site-button primary" href="#/games">试玩社区作品 <span>→</span></a></div><div class="community-footnote">站内投稿、试玩、留反馈；完整作品档案和源码协作在 GitHub 留存。${external(community+'/blob/main/CONTRIBUTING.md','阅读参与指南')}</div></section>`);
  }
  async function route() {
    const epoch = ++routeId;
    request?.abort(); request = new AbortController();
    const [kind, id] = paths();
    pageKind = ['games','title','community','board','submit'].includes(kind) ? kind : '';
    const active = pageKind === 'title' ? 'games' : pageKind || 'home';
    for (const link of header.querySelectorAll('[data-site-nav]')) {
      if (link.dataset.siteNav === active) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
    }
    document.title = `${pageKind === 'submit' ? '快捷投稿' : pageKind === 'games' ? '游戏目录' : pageKind === 'board' ? '许愿 / 留言' : pageKind === 'community' ? '如何共创' : '社区游戏展厅'} · OpenAIGames`;
    setOpen(Boolean(pageKind));
    if (!pageKind) return;
    window.OpenAIGamesScene?.browse();
    view.scrollTop = 0;
    loading();
    try {
      if (pageKind === 'games') await catalog(request.signal);
      else if (pageKind === 'title') await detail(id || '', request.signal);
      else if (pageKind === 'board') { if(window.OpenAIGamesPreview) mount('<section class="site-content"><h1>试玩反馈，留在 PR 里。</h1><p>这是投稿预览，不接收正式留言。</p></section>'); else { window.OpenAIGamesBoard.mount(view, request.signal); view.insertAdjacentHTML('beforeend', footer()); } }
      else if (pageKind === 'submit') { window.OpenAIGamesSubmissions.mount(view, request.signal); view.insertAdjacentHTML('beforeend',footer()); }
      else participation();
    } catch (error) {
      if (epoch !== routeId || error.name === 'AbortError') return;
      mount(`<section class="site-state" role="alert"><span class="site-kicker">CARTRIDGE NOT READY</span><h1>${esc(error.message)}</h1><p>请稍后重试，或回到目录选一张其他卡带。</p><div><button class="site-button" data-site-retry>重新读取</button><a href="#/games" class="site-text-link">回到目录 →</a></div></section>`);
    }
  }
  async function play(id) {
    if (opening) return;
    opening = true;
    try {
      // Refresh the host list before selecting a release created since its last poll.
      if (!host()?.state().projects.some(project => project.id === id)) {
        location.hash = '/game/' + encodeURIComponent(id);
        return;
      }
      setOpen(false);
      location.hash = '/discover';
      if (!window.OpenAIGamesScene?.play(id)) { host().pick(id); host().start(); }
    } finally { opening = false; }
  }
  view.addEventListener('input', event => {
    if (event.target.id === 'site-search') { query = event.target.value; renderCards(); inboxView?.search(query); }
  });
  document.addEventListener('click', event => {
    if (event.target.closest?.('[data-board-feedback]')) window.OpenAIGamesBoard.prepareFeedback();
    const target = event.target.closest?.('[data-site-category],[data-site-reset],[data-site-play],[data-site-create],[data-site-retry]');
    if (!target) return;
    if (target.hasAttribute('data-site-category')) { category = target.dataset.siteCategory; renderCards(); }
    else if (target.hasAttribute('data-site-reset')) { category = '全部'; query = ''; view.querySelector('#site-search').value = ''; renderCards(); inboxView?.search(''); view.querySelector('#site-search').focus(); }
    else if (target.hasAttribute('data-site-play')) play(target.dataset.sitePlay);
    else if (target.hasAttribute('data-site-create')) host()?.action('create');
    else route();
  });
  window.OpenAIGamesSite = Object.freeze({ play });
  window.addEventListener('hashchange', route);
  route();
})();

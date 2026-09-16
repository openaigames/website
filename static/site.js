/* Published community games and the shared player board. */
(() => {
  'use strict';
  const community = 'https://github.com/openaigames/community';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
  const host = () => window.OpenAIGamesHost;
  const header = document.createElement('header');
  header.id = 'site-header';
  header.innerHTML = `<a class="site-brand" href="#/discover" aria-label="OpenAIGames 首页"><span class="brand-ai">OpenAI</span><span class="brand-games">Games</span><small>一起，做点好玩的。</small></a><div class="site-utilities"><button class="site-language" type="button" data-language-toggle>EN</button></div><nav aria-label="站点导航"><a href="#/discover" data-site-nav="home">精选游戏</a><a href="#/games" data-site-nav="games">游戏目录</a><a href="#/board" data-site-nav="board">许愿 / 留言</a><a class="site-submit" href="#/submit" data-site-nav="submit">快捷投稿 ＋</a><a href="#/community" data-site-nav="community">如何共创</a><a class="site-github" href="${community}" target="_blank" rel="noopener">GitHub ↗</a></nav>`;
  const intro = document.createElement('section');
  intro.id = 'site-intro';
  intro.setAttribute('aria-label', '关于 OpenAIGames');
  intro.innerHTML = `<p class="site-kicker">AI × GAME CREATION</p><h1>下一张卡带，<br>由你创造。</h1><p class="intro-copy">把一个好玩的点子，<br>变成大家都能玩的游戏。</p><a class="intro-link" href="#/games">打开游戏目录 <span>↗</span></a><small class="intro-note">精选卡带 · 更多作品在游戏目录</small>`;
  const view = document.createElement('main');
  view.id = 'site-view';
  view.hidden = true;
  view.tabIndex = -1;
  const panel = document.createElement('dialog');
  panel.id = 'room-panel'; panel.className = 'room-panel';
  panel.setAttribute('aria-labelledby','room-panel-title');
  panel.innerHTML = `<header class="room-panel-bar"><button type="button" class="panel-back" aria-label="返回上一层" hidden>←</button><strong id="room-panel-title">游戏目录</strong><nav class="panel-tabs" aria-label="房间功能"><button type="button" data-panel-tab="games">游戏目录</button><button type="button" data-panel-tab="submit">快捷投稿</button><button type="button" data-panel-tab="board">许愿 / 留言</button><button type="button" data-panel-tab="community">如何共创</button></nav><button class="site-language" type="button" data-language-toggle>EN</button><button type="button" class="panel-close" aria-label="关闭弹窗，回到房间">×</button></header>`;
  panel.append(view); document.body.append(header, intro, panel);
  window.addEventListener('openaigames-catalog', event => {
    if (!event.detail.release?.preview) return;
    const release = event.detail.release;
    let banner = document.getElementById('preview-banner');
    if (!banner) { banner = document.createElement('aside'); banner.id='preview-banner'; document.body.append(banner); }
    const labels = {ready:'投稿预览',merged:'已合并',closed:'已关闭，未上架'};
    banner.innerHTML = `<b>PR #${release.pr} · ${labels[release.status] || '投稿预览'}</b><span>${release.revision.slice(0,7)}</span><a href="https://github.com/openaigames/community/pull/${release.pr}" target="_blank" rel="noopener">回 PR 留反馈 ↗</a><a href="?revision=${release.revision}${location.hash}">固定这个版本</a>`;
  });
  let routeId = 0, request, pageKind = '', projects = [], category = '全部', query = '', opening = false, opener, panelStack = [];
  const guideFiles={submission:'submission',contributing:'contributing',agent:'agent'};let guideEpoch=0;
  const panelKinds = new Set(['games','title','community','board','submit','guide','resource']);
  const paths = () => (location.hash.replace(/^#\/?/, '') || 'discover').split('/');
  const external = (href, label, className = '') => !href ? label : `<a class="${className}" href="${esc(href)}" target="_blank" rel="noopener">${label} <span aria-hidden="true">↗</span></a>`;
  const sourceLabel = project => project.pending ? (project.relation==='creator' ? project.creator || '作者自荐' : '社区推荐') : project.creator || '社区创作者';
  const stage = project => project.development_stage || project.version_label || '试玩版';
  const badges = project => `<div class="game-stage">${project.featured?'<span class="is-featured">精选</span>':''}<span>${project.pending?'待补资料':'已收录'}</span><span>${esc(stage(project))}</span></div>`;
  function cover(project, large = false) {
    return `<div class="site-cartridge ${large ? 'large' : ''}" style="--case:#b3ac8d"><div class="cartridge-ridges" aria-hidden="true"></div><div class="cartridge-label"><span class="cartridge-imprint">OpenAIGames <i>COMMUNITY EDITION</i></span>${project.cover_url?`<img class="cartridge-image submitted-art" src="${esc(project.cover_url)}" alt="${esc(project.title)} 卡带封面">`:`<div class="title-card-placeholder"><small>COMMUNITY PLAYTEST</small><b>${esc(project.title)}</b></div>`}<span class="cartridge-caption">${esc(project.title)}</span></div><span class="cartridge-notch" aria-hidden="true"></span></div>`;
  }
  function setOpen(open) {
    view.hidden = !open; document.body.classList.toggle('site-open', open); intro.hidden = true;
    if (open && !panel.open) {
      opener = document.activeElement;
      document.getElementById('dialog')?.close();
      window.OpenAIGamesScene?.pause(); panel.showModal();
    } else if (!open && panel.open) panel.close();
  }
  function closePanel() {
    ++routeId; request?.abort(); panelStack = []; pageKind = '';
    setOpen(false); document.title = '社区游戏展厅 · OpenAIGames';
    if (opener?.isConnected && opener !== document.body && !opener.closest('#room-panel')) opener.focus({preventScroll:true});
    else document.querySelector('#three-canvas canvas')?.focus({preventScroll:true});
  }
  header.querySelector('.site-brand').addEventListener('click',event=>{if(window.OpenAIGamesScene){event.preventDefault();closePanel();window.OpenAIGamesScene.browse();}});
  panel.querySelector('.panel-close').addEventListener('click',closePanel);
  panel.addEventListener('cancel',event=>{event.preventDefault();closePanel();});
  panel.addEventListener('click',event=>{if(event.target===panel){const rect=panel.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closePanel();}});
  panel.querySelector('.panel-back').addEventListener('click',()=>{
    if(panelStack.length<2){closePanel();return;}panelStack.pop();const previous=panelStack.at(-1);openPage(previous.kind,previous.id,{replace:true});
  });
  panel.querySelector('.panel-tabs').addEventListener('click',event=>{const button=event.target.closest('[data-panel-tab]');if(button)openPage(button.dataset.panelTab);});
  async function read(path, signal) {
    if (signal.aborted) throw new DOMException('Aborted','AbortError');
    const result = await window.OpenAIGamesCloud.request(path);
    if (signal.aborted) throw new DOMException('Aborted','AbortError');
    return result;
  }
  function mount(html) {
    view.innerHTML = html;
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
    const filtered = projects.filter(project => (category === '全部' || project.category === category) && window.OpenAIGamesI18n.matchesGame(project,normalized));
    view.querySelector('#catalog-count').textContent = `${filtered.length} 张可玩卡带`;
    for (const button of view.querySelectorAll('[data-site-category]')) button.setAttribute('aria-pressed', String(button.dataset.siteCategory === category));
    list.innerHTML = filtered.length ? filtered.map(project => `<article class="catalog-game"><a class="cartridge-link" href="#/title/${encodeURIComponent(project.id)}" aria-label="查看${esc(project.title)}">${cover(project)}</a>${badges(project)}<div class="catalog-meta"><span><span>${esc(project.category)}</span> · <span ${project.pending||!project.creator?'':'data-i18n-ignore'}>${esc(sourceLabel(project))}</span></span><a href="#/title/${encodeURIComponent(project.id)}" aria-label="查看${esc(project.title)}详情">↗</a></div><h2><a href="#/title/${encodeURIComponent(project.id)}">${esc(project.title)}</a></h2><p>${esc(project.description)}</p><button class="catalog-play" data-site-play="${esc(project.id)}" aria-label="插卡试玩${esc(project.title)}">插卡试玩 <span aria-hidden="true">→</span></button></article>`).join('') : '<div class="catalog-empty catalog-no-match"><p>没有找到匹配的卡带，换个名字或分类试试。</p><button class="site-button" data-site-reset>清空筛选</button></div>';
  }
  async function catalog(signal) {
    const data = await read('/arcade', signal);
    projects = data.projects.filter(project => project.current_version);
    if (signal.aborted) return;
    const categories = ['全部', ...new Set(projects.map(project => project.category).filter(Boolean))];
    if (!categories.includes(category)) category = '全部';
    mount(`<section class="site-content catalog-content"><div class="catalog-heading"><div><p class="site-kicker">THE CARTRIDGE COLLECTION</p><h1>挑一张，开玩。</h1><p class="site-lead">社区作品和新投稿，都在这里。</p></div><div class="collection-number" aria-label="${projects.length} 款游戏"><b>${String(projects.length).padStart(2,'0')}</b><span>可玩卡带</span></div></div><div class="catalog-tools"><div class="category-tabs" role="group" aria-label="游戏类型">${categories.map(name => `<button data-site-category="${esc(name)}" aria-pressed="${name===category}">${esc(name)}</button>`).join('')}</div><label class="catalog-search"><span class="sr-only">搜索游戏</span><input maxlength="100" id="site-search" type="search" placeholder="找一款游戏…" autocomplete="off" value="${esc(query)}"><span aria-hidden="true">⌕</span></label></div><div class="catalog-caption"><span id="catalog-count" role="status" aria-live="polite"></span><p>来自社区的真实作品，下一张也可以是你的。</p></div><div id="site-game-grid" class="site-game-grid"></div><aside class="catalog-invite"><div><span class="site-kicker">THE NEXT CARTRIDGE</span><h2>这一格，留给你的想法。</h2></div><a class="site-button" href="#/submit">投稿我的游戏 <span>↗</span></a></aside></section>`);
    renderCards();

  }
  async function detail(id, signal) {
    const project = await read('/projects/' + encodeURIComponent(id), signal);
    if (signal.aborted) return;
    document.title = `${project.title} · OpenAIGames`;
    if(project.pending){
      mount(`<article class="site-content title-content"><a class="site-back" href="#/games">← 回到游戏目录</a><div class="title-layout"><div class="title-cover">${cover(project,true)}${project.gameplay_url?`<figure class="gameplay-figure"><img src="${esc(project.gameplay_url)}" alt="${esc(project.title)} 试玩截图"><figcaption>${esc(project.image_caption)}</figcaption></figure>`:''}</div><div class="title-copy"><p class="site-kicker">社区试玩 · 待补充档案</p><h1>${esc(project.title)}</h1>${badges(project)}<p class="title-description">${esc(project.description)}</p><div class="title-actions"><button class="site-button primary" data-site-play="${esc(project.id)}">插卡试玩 <span>→</span></button><button class="site-text-link" data-source-url="${esc(project.preview_url)}">原站与链接</button></div><section class="title-instructions"><h2>怎么玩</h2><p>操作方式请查看游戏原站。</p><small>默认在房间全屏试玩；其他打开方式见「原站与链接」。</small></section><section class="title-notes"><h2>投稿记录</h2><p><span>${project.relation==='creator'?'作者自荐':'社区推荐'}</span> · <span ${project.creator==='社区整理'?'':'data-i18n-ignore'}>${esc(project.creator)}</span></p><p>快捷投稿提供试玩链接，完整作者信息和源码由投稿者后续补充。</p><a class="site-text-link" href="#/board" data-board-feedback>玩过了，留句话 ↗</a></section></div></div></article>`);return;
    }

    mount(`<article class="site-content title-content"><a class="site-back" href="#/games">← 回到游戏目录</a><div class="title-layout"><div class="title-cover">${cover(project,true)}<span class="title-cover-note">${esc(project.creator)} / ${esc(project.version_label)}</span>${project.gameplay_url ? `<figure class="gameplay-figure"><img src="${esc(project.gameplay_url)}" alt="${esc(project.title)} 展示画面" loading="lazy" width="960" height="576"><figcaption>${esc(project.image_caption || "由创作者提供")}</figcaption></figure>` : ""}</div><div class="title-copy"><p class="site-kicker">${esc(project.category)} / 社区投稿</p><h1>${esc(project.title)}</h1>${badges(project)}<p class="title-description">${esc(project.description)}</p><div class="title-actions"><button class="site-button primary" data-site-play="${esc(project.id)}">插卡试玩 <span>→</span></button><button class="site-text-link" data-source-url="${esc(project.preview_url)}">原站与链接</button></div><section class="title-instructions"><h2>怎么玩</h2><span class="control-keys">${esc(project.controls)}</span><p>${esc(project.instructions)}</p><small>进入屏幕后点击游戏画面，让游戏接收按键。</small></section><section class="title-instructions"><h2>作者想听听</h2><ul class="feedback-questions">${project.feedback_questions.map(question=>`<li>${esc(question)}</li>`).join('')}</ul><a class="site-text-link" href="#/board" data-board-feedback>玩过了，留句话 ↗</a></section><section class="title-notes"><h2>卡带档案</h2><dl><div><dt>创作者</dt><dd data-i18n-ignore>${external(project.creator_url,esc(project.creator))}</dd></div><div><dt>投稿版本</dt><dd>${esc(project.version_label)}</dd></div><div><dt>投稿记录</dt><dd>${external(project.submission_url,'查看投稿记录')}</dd></div></dl><p>${esc(project.credits)}</p><p>${esc(project.attribution)}</p>${external(project.source_url,'查看源码与制作记录','site-text-link')}</section></div></div></article>`);
  }
  function participation() {
    mount(`<section class="community-hero"><div class="site-content"><span class="site-kicker">LET’S MAKE SOMETHING PLAYABLE</span><h1>好玩的想法，<br> 值得被做出来。</h1><p>先把点子做成能玩的游戏，再一起把它变得更好。<br> 这里是 OpenAIGames，一个围绕 AI 与游戏创作的开源社区。</p><a href="#/guide/contributing" class="site-button light">看看怎么参与 →</a><span class="community-stamp" aria-hidden="true">INSERT<br>YOUR<br>IDEA.</span></div></section><section class="site-content community-content"><div class="community-section-heading"><span class="site-kicker">YOUR NEXT MOVE</span><h2>从你手上的那一点开始。</h2></div><div class="participation-row"><span class="step-number">01</span><div><h3>有一个点子</h3><p>说说玩家要做什么、哪里好玩。找几个同路人，一起做出第一版。</p></div><a href="#/board" class="site-row-link">写下游戏愿望 ↗</a></div><div class="participation-row"><span class="step-number">02</span><div><h3>已经能玩了</h3><p>填名称、试玩链接和一句介绍，审核通过后进入社区试玩。补齐资料后提 PR，正式收录进卡带目录。</p></div><a href="#/submit" class="site-row-link">快捷投稿 →</a></div><div class="participation-row"><span class="step-number">03</span><div><h3>遇到反复出现的问题</h3><p>把创作中缺的工具记下来，一起把它做成下一次创作的帮手。</p></div><a href="#/board" class="site-row-link">记下工具需求 →</a></div><div class="participation-row"><span class="step-number">04</span><div><h3>让 Agent 帮你投稿</h3><p>把 Skill 交给你的 Agent，按统一模板整理游戏、检查内容并提交 PR。新作品默认进入目录，首页精选由维护者挑选。</p></div><a href="#/guide/agent" class="site-row-link">读取 Agent Skill →</a></div><div class="community-local"><div><span class="site-kicker">START SMALL, PLAY NOW</span><h2>还没有作品？先搓一张。</h2><p>先来试玩社区里的作品，再把你的感受和想做的玩法留在留言板。</p><small>做出能玩的版本，再带上试玩地址和制作过程回到社区。</small></div><a class="site-button primary" href="#/games">试玩社区作品 <span>→</span></a></div><div class="community-footnote">站内投稿、试玩、留反馈；完整作品档案和源码协作在 GitHub 留存。<a href="#/guide/contributing">阅读参与指南 →</a></div></section>`);
  }
  async function copyText(text,button){
    try{await navigator.clipboard.writeText(text);button.textContent='已复制';}
    catch{window.OpenAIGamesHost?.toast('复制未成功，可以选中文字复制。');}
  }
  function resource(url){
    let parsed;try{parsed=new URL(url);if(!['https:','http:'].includes(parsed.protocol))throw Error();}catch{throw Error('链接暂时不可用。');}
    const project=host()?.state().projects.find(p=>[p.preview_url,p.source_url,p.creator_url,p.submission_url].includes(url));
    mount(`<section class="site-content resource-content"><h1>来源与链接</h1>${project?`<h2>${esc(project.title)}</h2><p>${esc(project.credits||project.description)}</p><p>${esc(project.attribution||'')}</p><button class="site-button primary" data-site-play="${esc(project.id)}">回房间全屏试玩 →</button>`:''}<p>这份资料保存在外部网站。可以复制链接，或在新标签打开，房间会保留。</p><code class="resource-url" data-i18n-ignore>${esc(url)}</code><div class="resource-actions"><button class="site-button" data-copy-resource="${esc(url)}">复制链接</button><a class="site-text-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer" data-external-direct>在新标签打开 ↗</a></div></section>`);
  }
  async function guide(id,signal){
    if(!guideFiles[id])throw Error('没有找到这份指南。');
    const epoch=++guideEpoch,language=window.OpenAIGamesI18n?.locale||'zh';
    const response=await fetch('/static/guides/'+guideFiles[id]+'.'+language+'.md',{signal});
    if(!response.ok)throw Error('指南暂时未能载入。');const source=await response.text();if(signal.aborted||epoch!==guideEpoch)return;
    const names={submission:'投稿与 PR 留存',contributing:'一起把游戏做出来',agent:'让 Agent 帮你投稿'};
    const body=id==='agent'?`<p>把下面的 Skill 复制给你的 Agent，附上游戏地址和制作说明。</p>`:`<p>点子、试玩反馈、工具需求都可以从这里开始；完整作品通过 PR 留存。</p><ol class="guide-steps"><li>先提交试玩链接、名称和一句介绍，让大家玩到作品。</li><li>补上作者、操作方式、截图、版本与想收集的反馈。</li><li>在 community 仓库添加作品档案，提交 PR；维护者审核后正式收录。</li></ol>`;
    mount(`<section class="site-content guide-content"><h1>${names[id]}</h1>${body}<div class="resource-actions"><a class="site-button primary" href="#/submit">快捷投稿 →</a><a class="site-button" href="#/board">写下想法 →</a><button class="site-button" data-copy-guide>复制完整说明</button></div><details ${id==='agent'?'open':''}><summary>完整仓库说明</summary><pre class="guide-source" data-i18n-ignore>${esc(source)}</pre></details><small>仓库说明快照 · 2026-09-15</small></section>`);
  }
  async function openPage(kind, id = '', options = {}) {
    if(!panelKinds.has(kind))return;
    if(!options.replace && (panelStack.at(-1)?.kind!==kind || panelStack.at(-1)?.id!==id))panelStack.push({kind,id});
    const epoch = ++routeId; request?.abort(); request = new AbortController();
    pageKind = kind;
    const names={games:'游戏目录',title:'卡带档案',board:'许愿 / 留言',submit:'快捷投稿',community:'如何共创',guide:'参与指南',resource:'来源与链接'};
    document.title = `${names[kind]} · OpenAIGames`;
    panel.querySelector('#room-panel-title').textContent=names[kind];
    panel.querySelector('.panel-back').hidden=panelStack.length<2;
    for(const button of panel.querySelectorAll('[data-panel-tab]'))button.setAttribute('aria-pressed',String(button.dataset.panelTab===(kind==='title'?'games':kind==='guide'?'community':kind)));
    setOpen(true); view.scrollTop = 0; loading();
    try {
      if (kind === 'games') { await catalog(request.signal); if(options.search && epoch===routeId)view.querySelector('#site-search')?.focus(); }
      else if (kind === 'title') await detail(id, request.signal);
      else if (kind === 'board') {
        if(window.OpenAIGamesPreview) mount('<section class="site-content"><h1>试玩反馈，留在 PR 里。</h1><p>这是投稿预览，不接收正式留言。</p></section>');
        else window.OpenAIGamesBoard.mount(view, request.signal);
      } else if (kind === 'submit') window.OpenAIGamesSubmissions.mount(view, request.signal);
      else if(kind==='guide') await guide(id,request.signal);
      else if(kind==='resource') resource(id);
      else participation();
    } catch (error) {
      if (epoch !== routeId || error.name === 'AbortError') return;
      mount(`<section class="site-state" role="alert"><h1>${esc(error.message)}</h1><p>请稍后重试，或回到目录选一张其他卡带。</p><div><button class="site-button" data-site-retry>重新读取</button><a href="#/games" class="site-text-link">回到目录 →</a></div></section>`);
    }
  }
  function route() {
    const [kind,id] = paths();
    if(panelKinds.has(kind)) {
      // Old shared links open the matching room panel; subsequent navigation stays in the room.
      history.replaceState(history.state,'',location.pathname+location.search+'#/discover');
      openPage(kind,decodeURIComponent(id||''));
    }else if(panel.open)closePanel();
  }
  async function play(id) {
    if (opening) return;
    opening = true;
    try {
      // Refresh the host list before selecting a release created since its last poll.
      if (!host()?.state().projects.some(project => project.id === id)) {
        closePanel();
        location.hash = '/game/' + encodeURIComponent(id);
        return;
      }
      closePanel();
      if (!window.OpenAIGamesScene?.play(id)) { host().pick(id); host().start(); }
    } finally { opening = false; }
  }
  view.addEventListener('input', event => {
    if (event.target.id === 'site-search') { query = event.target.value; renderCards(); }
  });
  document.addEventListener('click', event => {
    if (event.target.closest?.('[data-board-feedback]')) window.OpenAIGamesBoard.prepareFeedback();
    const target = event.target.closest?.('[data-site-category],[data-site-reset],[data-site-play],[data-site-create],[data-site-retry],[data-source-url],[data-copy-resource],[data-copy-guide]');
    if (!target) return;
    if (target.hasAttribute('data-site-category')) { category = target.dataset.siteCategory; renderCards(); }
    else if (target.hasAttribute('data-site-reset')) { category = '全部'; query = ''; view.querySelector('#site-search').value = ''; renderCards(); view.querySelector('#site-search').focus(); }
    else if(target.hasAttribute('data-source-url')) openPage('resource',target.dataset.sourceUrl);
    else if(target.hasAttribute('data-copy-resource')) copyText(target.dataset.copyResource,target);
    else if(target.hasAttribute('data-copy-guide')) copyText(view.querySelector('.guide-source').textContent,target);
    else if (target.hasAttribute('data-site-play')) play(target.dataset.sitePlay);
    else if (target.hasAttribute('data-site-create')) host()?.action('create');
    else openPage(pageKind,panelStack.at(-1)?.id||'',{replace:true});
  });
  window.OpenAIGamesSite = Object.freeze({ play, open:openPage, close:closePanel, get page(){return pageKind;}, refresh:()=>openPage(pageKind,panelStack.at(-1)?.id||'',{replace:true}) });
  document.addEventListener('click',event=>{
    if(event.defaultPrevented || event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)return;
    const link=event.target.closest('a[href]');if(!link||link.hasAttribute('download')||link.hasAttribute('data-external-direct'))return;
    const href=link.getAttribute('href');
    if(/^https?:/.test(href)){
      event.preventDefault();
      const guideId=href.includes('/docs/GAME_SUBMISSION.md')?'submission':href.includes('/CONTRIBUTING.md')?'contributing':href.includes('/openaigames-submit-demo/SKILL.md')?'agent':null;
      if(guideId)openPage('guide',guideId);else openPage('resource',href);return;
    }
    if(!href.startsWith('#/'))return;
    const [kind,id]=link.getAttribute('href').slice(2).split('/');
    if(link.hasAttribute('data-board-feedback'))window.OpenAIGamesBoard.prepareFeedback();
    if(panelKinds.has(kind)){event.preventDefault();openPage(kind,decodeURIComponent(id||''));}
    else if(kind==='discover'&&panel.open){event.preventDefault();closePanel();}
  },true);
  window.addEventListener('openaigames-language',()=>{
    if(pageKind==='games')renderCards();
    if(pageKind==='guide'&&panel.open)guide(panelStack.at(-1).id,request.signal).catch(error=>{if(error.name!=='AbortError')window.OpenAIGamesHost?.toast(error.message);});
  });
  window.addEventListener('hashchange', route);
  route();
})();

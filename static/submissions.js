(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const guide = 'https://github.com/openaigames/community/blob/main/docs/GAME_SUBMISSION.md';
  const fields = ['title','url','description','submitter','relation'];
  const empty = () => ({title:'',url:'',description:'',submitter:'',relation:'creator',requestId:crypto.randomUUID(),public:false});
  let draft = empty(), receipt = null, sending = false;
  async function api(options = {}, query = '') {
    const response = await fetch('/api/submissions' + query, {cache:'no-store', ...options});
    let data; try { data = await response.json(); } catch { throw Error('投稿暂时连接不上，请稍后重试。'); }
    if (!response.ok) throw Error(data.error || '没有保存成功，请重试。');
    return data;
  }
  function mountInbox(container, signal, projects = []) {
    if (window.OpenAIGamesPreview) { container.innerHTML = ''; return {search(){}}; }
    container.innerHTML = `<section class="submission-inbox" aria-label="试玩收件箱"><div class="inbox-heading"><div><p class="site-kicker">FRESH FROM THE COMMUNITY</p><h2>试玩收件箱</h2><p>刚做出来，就可以带来玩。这里的投稿还在等待补齐资料、正式收录。</p></div><a class="site-button" href="#/submit">＋ 快捷投稿</a></div><div class="submission-list"></div><p class="inbox-status" role="status"></p><button class="site-button inbox-more" hidden>再看一些</button></section>`;
    const list = container.querySelector('.submission-list'), status = container.querySelector('.inbox-status'), more = container.querySelector('.inbox-more');
    let entries = [], next = null, query = '', timer, epoch = 0, controller;
    const render = () => {
      list.innerHTML = entries.length ? entries.map(entry => {
        const published = projects.find(p => p.preview_url === entry.url);
        return `<article class="submission-card"><div class="submission-meta"><span>NO. ${String(entry.id).padStart(3,'0')}</span><span>${published ? '已收录' : '待收录'}</span></div><h3>${esc(entry.title)}</h3><p>${esc(entry.description)}</p><div class="submission-byline">${entry.relation === 'creator' ? '作者自荐' : '社区推荐'}${entry.submitter ? ' · '+esc(entry.submitter) : ''}</div><a class="submission-play" href="${esc(entry.url)}" target="_blank" rel="noopener noreferrer ugc nofollow">去原站试玩 <span aria-hidden="true">↗</span></a><small>${esc(new URL(entry.url).hostname)}</small>${published ? `<a class="site-text-link" href="#/title/${encodeURIComponent(published.id)}">查看卡带档案 →</a>` : ''}</article>`;
      }).join('') : `<p class="inbox-empty">${query ? '没有找到这款试玩，换个名字试试。' : '还没有新的投稿。第一款，可以是你的。'}</p>`;
      more.hidden = !next;
    };
    async function load(append = false) {
      if (signal.aborted) return;
      const current = ++epoch; controller?.abort(); controller = new AbortController();
      status.textContent = '正在读取投稿…'; more.disabled = true;
      try {
        const params = new URLSearchParams({q:query}); if (append && next) params.set('before',next);
        const data = await api({signal:controller.signal},'?'+params);
        if (signal.aborted || current !== epoch) return;
        entries = append ? [...entries,...data.entries.filter(e => !entries.some(p=>p.id === e.id))] : data.entries;
        next = data.next; render(); status.textContent = '';
      } catch(error) {
        if (signal.aborted || current !== epoch || error.name === 'AbortError') return;
        status.replaceChildren(document.createTextNode(error.message+' '));
        const retry = document.createElement('button'); retry.type='button'; retry.className='board-retry'; retry.textContent='重新读取'; retry.onclick=()=>load(append); status.append(retry);
      } finally { if (current === epoch) more.disabled = false; }
    }
    more.addEventListener('click',()=>load(true),{signal});
    signal.addEventListener('abort',()=>{clearTimeout(timer);controller?.abort();},{once:true});
    load();
    return {refresh:()=>load(),search:value=>{query=value.trim(); clearTimeout(timer);timer=setTimeout(()=>load(),250);}};
  }
  function mount(container, signal) {
    if (window.OpenAIGamesPreview) {
      container.innerHTML = '<section class="site-content"><h1>把试玩带到正式站。</h1><p>当前是 PR 预览。</p><a class="site-button" href="https://openaigames.lens-frontier.workers.dev/#/submit">前往快捷投稿 →</a></section>';
      return;
    }
    container.innerHTML = `<section class="site-content submission-content"><div class="submission-heading"><p class="site-kicker">A LINK. A GAME. LET’S PLAY.</p><h1><span>能玩了？</span><span>发来试试。</span></h1><p>先把游戏带过来，剩下的慢慢补。</p></div><div class="submission-layout"><form class="submission-form"><fieldset ${sending?'disabled':''}><legend class="sr-only">快捷投稿</legend><label for="submit-url">试玩链接 <span>必填</span></label><input id="submit-url" name="url" type="url" required maxlength="2048" placeholder="https://…" inputmode="url" value="${esc(draft.url)}"><label for="submit-title">游戏叫什么 <span>必填</span></label><input id="submit-title" name="title" required maxlength="100" placeholder="给它起个名字" value="${esc(draft.title)}"><label for="submit-description">一句话介绍 <span>必填</span></label><textarea id="submit-description" name="description" required maxlength="500" rows="3" placeholder="怎么玩？有什么有意思的地方？">${esc(draft.description)}</textarea><div class="submission-fields"><div><label for="submit-relation">这是</label><select id="submit-relation" name="relation"><option value="creator" ${draft.relation==='creator'?'selected':''}>我参与制作的作品</option><option value="recommend" ${draft.relation==='recommend'?'selected':''}>我推荐的作品</option></select></div><div><label for="submit-name">怎么称呼你 <span>选填，公开显示</span></label><input id="submit-name" name="submitter" maxlength="50" autocomplete="nickname" placeholder="昵称" value="${esc(draft.submitter)}"></div></div><div class="board-honeypot" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div><label class="submission-consent"><input type="checkbox" name="public" required ${draft.public?'checked':''}><span>将这些内容公开展示在试玩收件箱</span></label><button class="site-button primary submission-send" type="submit">${sending?'正在保存…':'提交试玩'} <span aria-hidden="true">↗</span></button></fieldset><p class="submission-feedback" role="status" aria-live="polite"></p></form><aside class="submission-aside"><span class="submission-stamp" aria-hidden="true">PLAY<br>IN<br>PROGRESS.</span><h2>一个链接就能开始。</h2><ol><li><b>提交到收件箱</b><span>无需登录，保存后大家就能看见和试玩。</span></li><li><b>边玩边补资料</b><span>作者、操作方式、封面和制作记录，可以再整理。</span></li><li><b>正式收录成卡带</b><span>整理成社区 PR，审核合并后进入卡带目录。</span></li></ol><a class="site-text-link" href="${guide}" target="_blank" rel="noopener">已经备齐资料？直接提 PR ↗</a></aside></div><div id="submission-recent"></div></section>`;
    const form = container.querySelector('form'), feedback = container.querySelector('.submission-feedback');
    const inbox = mountInbox(container.querySelector('#submission-recent'), signal);
    const showReceipt = () => { if (receipt) feedback.textContent = `已保存投稿 #${receipt.id}「${receipt.title}」，大家可以在下方试玩收件箱看到。`; };
    showReceipt();
    form.addEventListener('input',()=>{
      for (const key of fields) draft[key] = form.elements[key].value;
      draft.public = form.elements.public.checked; draft.requestId = crypto.randomUUID();
      receipt = null; feedback.textContent=''; feedback.classList.remove('is-error');
    },{signal});
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (sending || !form.reportValidity()) return;
      const snapshot = {...draft,website:form.elements.website.value};
      sending=true; form.querySelector('fieldset').disabled=true; const button=form.querySelector('.submission-send'); button.textContent='正在保存…'; feedback.textContent='';
      try {
        const {entry} = await api({method:'POST',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json'},body:JSON.stringify(snapshot)});
        receipt=entry; draft=empty();
        if (signal.aborted) return;
        form.reset(); for (const key of fields) form.elements[key].value=draft[key]; form.elements.public.checked=false;
        feedback.classList.remove('is-error'); showReceipt(); inbox.refresh();
      } catch(error) {
        if (!signal.aborted) { feedback.classList.add('is-error');feedback.textContent=error.message+' 内容仍在表单里。'; }
      } finally {
        sending=false;
        if (!signal.aborted) { form.querySelector('fieldset').disabled=false;button.innerHTML='提交试玩 <span aria-hidden="true">↗</span>'; }
        // Navigating away must not cancel a write. Remount a newly opened form after it settles.
        if (signal.aborted && location.hash==='#/submit') window.dispatchEvent(new HashChangeEvent('hashchange'));
      }
    },{signal});
    container.querySelector('h1').tabIndex=-1;container.querySelector('h1').focus({preventScroll:true});
  }
  window.OpenAIGamesSubmissions=Object.freeze({mount,mountInbox});
})();

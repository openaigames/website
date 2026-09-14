(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const draft = { kind: 'wish', nickname: '', body: '', requestId: crypto.randomUUID() };
  async function request(options = {}, before = '') {
    const response = await fetch('/api/board' + (before ? '?before=' + encodeURIComponent(before) : ''), { cache: 'no-store', ...options });
    let data;
    try { data = await response.json(); } catch { throw Error('留言板暂时连接不上，请稍后重试。'); }
    if (!response.ok) throw Error(data.error || '暂时没有保存成功，请再试一次。');
    return data;
  }
  function mount(container, signal) {
    let posts = [], next = null, filter = 'all', loading = false, sending = false;
    container.innerHTML = `<section class="site-content board-content"><div class="board-heading"><div><p class="site-kicker">PLAYER NOTES</p><h1>给下一个好玩，留句话。</h1><p>想玩的游戏、试玩的感受，都可以写在这里。</p></div><span class="board-mark" aria-hidden="true">WISH<br>& PLAY<span>↗</span></span></div><div class="board-layout"><form class="board-compose"><fieldset><legend>今天想…</legend><div class="board-kind"><label><input type="radio" name="kind" value="wish" ${draft.kind === 'wish' ? 'checked' : ''}><span>✦ 许个愿</span></label><label><input type="radio" name="kind" value="message" ${draft.kind === 'message' ? 'checked' : ''}><span>↳ 留句话</span></label></div></fieldset><label class="board-label" for="board-nickname">怎么称呼你 <small>选填</small></label><input id="board-nickname" name="nickname" maxlength="32" autocomplete="nickname" placeholder="路过的玩家" value="${esc(draft.nickname)}"><label class="board-label" for="board-body">写下你的想法</label><textarea id="board-body" name="body" rows="6" required maxlength="1000" aria-describedby="board-public-note board-count" placeholder="如果有一款游戏，可以……">${esc(draft.body)}</textarea><div class="board-count" id="board-count">${draft.body.length} / 1000</div><div class="board-honeypot" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div><button class="site-button primary board-send" type="submit"><span>把想法留在这里</span><span aria-hidden="true">↗</span></button><p id="board-public-note" class="board-public-note">发布后所有人可见，无需登录。请勿填写私人信息。</p><p class="board-feedback" role="status" aria-live="polite"></p></form><section class="board-wall" aria-label="大家的许愿与留言"><div class="board-wall-top"><h2>大家留下的</h2><div class="board-filter" role="group" aria-label="留言类型"><button data-board-filter="all" aria-pressed="true">全部</button><button data-board-filter="wish" aria-pressed="false">许愿</button><button data-board-filter="message" aria-pressed="false">留言</button></div></div><div class="board-list" aria-live="polite"></div><p class="board-load-status" role="status"></p><button class="site-button board-more" hidden type="button">再看看前面的</button></section></div></section>`;
    const find = selector => container.querySelector(selector), form = find('form'), list = find('.board-list');
    const feedback = find('.board-feedback'), loadStatus = find('.board-load-status'), more = find('.board-more');
    function render() {
      const visible = posts.filter(post => filter === 'all' || post.kind === filter);
      list.innerHTML = visible.length ? visible.map(post => `<article class="board-note ${post.kind === 'wish' ? 'is-wish' : ''}"><header><span class="note-kind">${post.kind === 'wish' ? '✦ 一个愿望' : '↳ 一句留言'}</span><time datetime="${new Date(post.created_at).toISOString()}">${esc(new Date(post.created_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }))}</time></header><p>${esc(post.body)}</p><footer><span class="note-avatar" aria-hidden="true">${esc(Array.from(post.nickname)[0])}</span><span>${esc(post.nickname)}</span><span class="note-number">NO. ${String(post.id).padStart(3, '0')}</span></footer></article>`).join('') : `<div class="board-empty"><span aria-hidden="true">${filter === 'message' ? '↳' : '✦'}</span><h3>${posts.length ? '这里暂时还没有这一类留言。' : '第一张小纸条，留给你。'}</h3><p>${posts.length ? '换个分类看看，或写下你的想法。' : '许一个想玩的游戏，或说说刚才那一局。'}</p></div>`;
      more.hidden = !next;
    }
    async function load(append = false) {
      if (loading || signal.aborted) return;
      loading = true; more.disabled = true;
      loadStatus.textContent = '正在读取大家的留言…';
      try {
        const data = await request({ signal }, append ? next : '');
        if (signal.aborted) return;
        posts = append ? [...posts, ...data.posts.filter(p => !posts.some(item => item.id === p.id))] : data.posts;
        next = data.next; render(); loadStatus.textContent = '';
      } catch (error) {
        if (signal.aborted) return;
        loadStatus.replaceChildren(document.createTextNode(error.message + ' '));
        const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'board-retry'; retry.textContent = '重新读取'; retry.onclick = () => load(append); loadStatus.append(retry);
      } finally { loading = false; more.disabled = false; }
    }
    form.addEventListener('input', () => {
      draft.kind = form.elements.kind.value; draft.nickname = form.elements.nickname.value; draft.body = form.elements.body.value; draft.requestId = crypto.randomUUID();
      find('#board-count').textContent = `${draft.body.length} / 1000`;
      find('#board-body').placeholder = draft.kind === 'wish' ? '如果有一款游戏，可以……' : '刚玩了 dodo，我觉得……';
      feedback.textContent = '';
    }, { signal });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (sending || !form.reportValidity()) return;
      if (!draft.body.trim()) { feedback.textContent = '写点什么再发送吧。'; find('#board-body').focus(); return; }
      sending = true; const snapshot = { ...draft, website: form.elements.website.value };
      const submit = find('.board-send'); submit.disabled = true; submit.firstElementChild.textContent = '正在保存…';
      feedback.classList.remove('is-error'); feedback.textContent = '';
      try {
        const { post } = await request({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snapshot) });
        if (draft.requestId === snapshot.requestId) { draft.body = ''; draft.requestId = crypto.randomUUID(); }
        if (signal.aborted) return;
        posts = [post, ...posts.filter(item => item.id !== post.id)]; filter = 'all';
        container.querySelectorAll('[data-board-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.boardFilter === 'all')));
        render(); find('#board-body').value = draft.body; find('#board-count').textContent = `${draft.body.length} / 1000`;
        feedback.textContent = '留下了！你的想法已经出现在留言板上。';
      } catch (error) {
        if (signal.aborted) return;
        feedback.classList.add('is-error'); feedback.textContent = error.message;
      } finally {
        sending = false;
        if (!signal.aborted) { submit.disabled = false; submit.firstElementChild.textContent = '把想法留在这里'; }
      }
    }, { signal });
    container.querySelectorAll('[data-board-filter]').forEach(button => button.addEventListener('click', () => {
      filter = button.dataset.boardFilter;
      container.querySelectorAll('[data-board-filter]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      render();
    }, { signal }));
    more.addEventListener('click', () => load(true), { signal });
    load();
  }
  window.OpenAIGamesBoard = Object.freeze({ mount, prepareFeedback: () => { draft.kind = 'message'; } });
})();

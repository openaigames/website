(() => {
  const en=()=>window.OpenAIGamesI18n?.locale==='en',t=(zh,english)=>en()?english:zh;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const endpoint=(game,params={})=>'/api/comments?'+new URLSearchParams({game,...params});
  const score=s=>s?.average==null?t('暂无评分','Not rated yet'):s.average.toFixed(1)+' / 5';
  async function summary(root,project,signal){
    const actions=root.querySelector('.title-actions');if(!actions)return;
    const link=document.createElement('a');link.className='game-reaction-summary';link.dataset.i18nIgnore='';link.href='#/comments/'+encodeURIComponent(project.id);actions.after(link);
    let data;
    const render=()=>{link.textContent=data?`${score(data)} · ${t(data.ratingCount+' 人评分',data.ratingCount+(data.ratingCount===1?' rating':' ratings'))} · ${t(data.likes+' 赞',data.likes+(data.likes===1?' like':' likes'))} · ${t(data.commentCount+' 条评论',data.commentCount+(data.commentCount===1?' comment':' comments'))} →`:t('查看评分与评论 →','See ratings & comments →');};
    render();window.addEventListener('openaigames-language',render,{signal});
    try{const response=await fetch(endpoint(project.id,{view:'summary'}),{signal,cache:'no-store'});if(response.ok){data=(await response.json()).summary;if(!signal.aborted)render();}}catch{}
  }
  function mount(root,project,signal){
    const game=project.id,storageKey='oag-comment-draft:'+game;
    let entries=[],next=null,busy=false,sequence=0,draft='',requestId=crypto.randomUUID(),session=window.OpenAIGamesAccount?.session;
    let totals=null,viewer=null,reactionReady=false,readError=false,loading=false,reactionMessage='';
    try{const saved=JSON.parse(sessionStorage.getItem(storageKey)||'null');if(saved){draft=saved.body||'';requestId=saved.requestId||requestId;}}catch{}
    const save=()=>{try{sessionStorage.setItem(storageKey,JSON.stringify({body:draft,requestId}));}catch{}};
    root.innerHTML=`<section class="site-content game-comments" data-i18n-ignore><header class="comment-game">${project.cover_url?`<img src="${esc(project.cover_url)}" alt="">`:""}<div><h1 tabindex="-1"></h1><a class="comment-details" href="#/title/${encodeURIComponent(game)}"></a></div></header><section class="game-reactions"><div class="reaction-overview"><div class="rating-average"><strong></strong><span></span></div><button class="reaction-like" type="button" aria-pressed="false"><span aria-hidden="true">♡</span><span class="like-label"></span></button></div><div class="your-rating"><fieldset><legend></legend><div class="rating-stars">${[1,2,3,4,5].map(n=>`<button type="button" data-rating="${n}" aria-pressed="false"><span aria-hidden="true">★</span></button>`).join('')}</div></fieldset><button type="button" class="rating-clear" hidden></button></div><p class="rating-help" role="status" aria-live="polite"></p><a class="site-button primary comment-login" data-external-direct></a></section><form class="comment-form"><label for="comment-body"></label><textarea id="comment-body" rows="3" maxlength="1000"></textarea><div class="comment-actions"><span class="comment-identity"></span><button type="submit" class="site-button primary"></button></div></form><p class="comment-status" role="status" aria-live="polite"></p><button class="comments-retry site-button" type="button" hidden></button><h2 class="comments-heading"></h2><div class="comments-list" aria-live="polite"></div><button class="site-button comments-more" hidden></button></section>`;
    const box=root.querySelector('.game-comments'),$=s=>box.querySelector(s);
    const say=message=>{if(!signal.aborted)$('.comment-status').textContent=message;};
    function renderReactions(){
      $('.rating-average strong').textContent=totals?score(totals):'—';
      $('.rating-average span').textContent=totals?t(totals.ratingCount+' 人评分',totals.ratingCount+(totals.ratingCount===1?' rating':' ratings')):t('正在读取评价…','Loading ratings…');
      $('.reaction-like').disabled=busy||loading||!session||!reactionReady;
      $('.reaction-like').setAttribute('aria-pressed',String(!!viewer?.liked));
      $('.reaction-like').title=viewer?.liked?t('取消点赞','Unlike'):t('给这个游戏点赞','Like this game');
      $('.reaction-like span').textContent=viewer?.liked?'♥':'♡';
      $('.like-label').textContent=(viewer?.liked?t('已点赞','Liked'):t('点赞','Like'))+' · '+(totals?.likes??'—');
      $('legend').textContent=viewer?.rating?t('你的评分 · '+viewer.rating+' 星','Your rating · '+viewer.rating+'/5'):t('给游戏打个分','Rate this game');
      for(const button of box.querySelectorAll('[data-rating]')){const n=Number(button.dataset.rating);button.disabled=busy||loading||!session||!reactionReady;button.setAttribute('aria-label',t(n+' 星',n+' '+(n===1?'star':'stars')));button.setAttribute('aria-pressed',String(viewer?.rating===n));button.classList.toggle('filled',n<=(viewer?.rating||0));}
      $('.rating-clear').textContent=t('撤回评分','Clear rating');$('.rating-clear').hidden=!viewer?.rating;$('.rating-clear').disabled=busy;
      $('.rating-help').textContent=reactionMessage||(session?t('点星星即保存，随时可改。','Tap a star to save. Change it anytime.'):t('登录一次，就能评分、点赞和评论。','Sign in to rate, like and comment.'));
    }
    function render(){
      if(signal.aborted)return;
      $('.comment-details').textContent=t('作品档案 ↗','Game details ↗');
      $('h1').textContent=window.OpenAIGamesI18n?.t(project.title)||project.title;
      renderReactions();
      $('label').textContent=t('你的评论','Your comment');$('textarea').placeholder=t('哪里好玩，哪里还能改进…','What worked? What could be better?');$('textarea').value=draft;
      $('.comment-identity').textContent=session?'@'+session.user.login:t('最多 1000 字','Up to 1,000 characters');
      $('[type=submit]').hidden=!session;$('[type=submit]').disabled=busy;$('[type=submit]').textContent=busy?t('请稍候…','Please wait…'):t('发表评论','Post comment');
      $('.comment-login').hidden=!!session;$('.comment-login').textContent=t('使用 GitHub 登录 →','Sign in with GitHub →');$('.comment-login').href=window.OpenAIGamesAccount.loginUrl(game);
      $('.comments-retry').hidden=!readError;$('.comments-retry').textContent=t('重新读取','Retry');
      $('.comments-heading').textContent=t('评论','Comments')+(totals?' · '+totals.commentCount:'');
      $('.comments-more').textContent=t('加载更多','Load more');$('.comments-more').hidden=!next;$('.comments-more').disabled=busy||loading;
      $('.comments-list').innerHTML=entries.length?entries.map(entry=>`<article class="game-comment"><header><strong>@${esc(entry.login)}</strong><time datetime="${new Date(entry.created_at).toISOString()}">${esc(new Date(entry.created_at).toLocaleString(en()?'en-GB':'zh-CN',{dateStyle:'medium',timeStyle:'short'}))}</time>${session&&(session.user.id===entry.github_id||session.user.isAdmin)?`<button class="comment-delete" data-delete="${entry.id}" ${busy?'disabled':''}>${t('删除','Delete')}</button>`:''}</header><p>${esc(entry.body)}</p></article>`).join(''):`<p class="comments-empty">${totals?t('还没有评论，来聊第一句吧。','No comments yet. Start the conversation.'):t('正在读取评论…','Loading comments…')}</p>`;
    }
    async function api(options={},before){
      const response=await fetch(endpoint(game,{...(before?{before}:{}),...(session?{mine:'1'}:{})}),{cache:'no-store',credentials:'same-origin',signal,...options});
      const data=await response.json();
      if(!response.ok){const error=Error(en()?({401:'Sign in to continue.',403:'Please sign in again.',429:'Wait 10 seconds before posting again.',404:'This game or comment is no longer available.'}[response.status]||'Could not complete the request. Please try again.'):data.error||'请稍后重试。');error.status=response.status;throw error;}return data;
    }
    async function recover(error){if(error.name==='AbortError')return;say(error.message);if([401,403].includes(error.status))await window.OpenAIGamesAccount.refresh();}
    async function load(append=false){
      const seq=++sequence;loading=true;renderReactions();$('.comments-more').disabled=true;
      try{const data=await api({},append?next:null);if(seq!==sequence||signal.aborted)return;entries=append?[...entries,...data.entries]:data.entries;next=data.next;totals=data.summary;viewer=data.viewer;reactionReady=true;readError=false;render();}
      catch(e){if(seq!==sequence||signal.aborted)return;readError=true;reactionReady=false;render();await recover(e);}
      finally{if(!signal.aborted&&seq===sequence){loading=false;$('.comments-more').disabled=false;renderReactions();}}
    }
    async function react(input){
      if(busy||loading||!session||!reactionReady)return;const active=document.activeElement;busy=true;reactionMessage=t('正在保存…','Saving…');++sequence;render();
      try{const data=await api({method:'POST',headers:{'Content-Type':'application/json','X-Admin-CSRF':session.csrf},body:JSON.stringify(input)});if(signal.aborted)return;totals=data.summary;viewer=data.viewer;reactionMessage=input.action==='like'?(viewer.liked?t('已点赞，再点可取消。','Liked. Tap again to undo.'):t('已取消点赞。','Like removed.')):viewer.rating?t('已保存 '+viewer.rating+' 星，点其他星星可修改。',viewer.rating+' stars saved. Tap another star to change.'):t('评分已撤回。','Rating cleared.');}
      catch(e){reactionMessage='';await recover(e);}finally{busy=false;if(!signal.aborted){render();if(document.activeElement===document.body&&active?.isConnected&&!active.hidden)active.focus({preventScroll:true});}}
    }
    $('.rating-stars').onclick=event=>{const button=event.target.closest('[data-rating]');if(button)react({action:'rate',rating:Number(button.dataset.rating)});};
    $('.rating-clear').onclick=()=>react({action:'rate',rating:null});$('.reaction-like').onclick=()=>react({action:'like',liked:!viewer?.liked});
    $('textarea').oninput=e=>{draft=e.target.value;requestId=crypto.randomUUID();save();};$('.comment-login').onclick=save;
    $('form').onsubmit=async event=>{
      event.preventDefault();if(busy||!session)return;if(!draft.trim()){say(t('写点什么再发送吧。','Write a comment first.'));$('textarea').focus();return;}
      busy=true;++sequence;loading=false;$('textarea').disabled=true;render();say('');
      try{await api({method:'POST',headers:{'Content-Type':'application/json','X-Admin-CSRF':session.csrf},body:JSON.stringify({body:draft,requestId})});draft='';requestId=crypto.randomUUID();save();await load();say(t('评论已发布。','Comment posted.'));}
      catch(e){await recover(e);}finally{busy=false;if(!signal.aborted){$('textarea').disabled=false;render();}}
    };
    $('.comments-list').onclick=async event=>{const button=event.target.closest('[data-delete]');if(!button||busy||!session)return;if(button.dataset.confirm!=='yes'){button.dataset.confirm='yes';button.textContent=t('确认删除','Confirm delete');return;}busy=true;++sequence;loading=false;button.disabled=true;renderReactions();try{await api({method:'POST',headers:{'Content-Type':'application/json','X-Admin-CSRF':session.csrf},body:JSON.stringify({action:'delete',id:Number(button.dataset.delete)})});await load();say(t('评论已删除。','Comment deleted.'));}catch(e){await recover(e);}finally{busy=false;if(!signal.aborted)render();}};
    $('.comments-more').onclick=()=>{if(!busy)load(true);};$('.comments-retry').onclick=()=>{if(!busy){say('');load();}};
    window.addEventListener('openaigames-account',event=>{const previous=session?.user.id;session=event.detail;if(previous!==session?.user.id){viewer=null;reactionReady=false;load();}render();},{signal});
    window.addEventListener('openaigames-language',()=>{say('');reactionMessage='';render();},{signal});
    render();$('h1').focus({preventScroll:true});load();window.OpenAIGamesAccount?.refresh();
  }
  window.OpenAIGamesComments=Object.freeze({mount,summary});
})();

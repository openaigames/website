import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translate, english, chinese, matchesGame } from '../lib/i18n.mjs';
import gameLocales from '../content/game-locales.json' with {type:'json'};
import {readFile} from 'node:fs/promises';
test('Interface translations preserve dynamic names and provide reversible source strings',()=>{
  assert.equal(translate('快捷投稿','en'),'Submit a game');
  assert.equal(translate('快捷投稿','zh'),'快捷投稿');
  assert.equal(translate('返回 3D','en'),'Back to 3D');
  assert.equal(translate('1 张已收录卡带','en'),'1 published game');
  assert.equal(translate('5 张已收录卡带','en'),'5 published games');
  assert.equal(translate('已保存投稿 #12「风之书」，大家可以在下方试玩收件箱看到。','en'),'Saved submission #12 “风之书”. It is now in the playtest inbox below.');
  assert.equal(translate('这个试玩链接已经提交过了，无需重复投稿。 内容仍在表单里。','en'),'This play link has already been submitted. No need to submit it again. Your entries are still in the form.');
  assert.equal(translate('游戏目录 · OpenAIGames','en'),'Games · OpenAIGames');
  assert.equal(translate('一段未登记的作者原文','en'),'一段未登记的作者原文');
  assert.equal(translate('选择卡带：风之书','en'),'Select cartridge: 风之书');
  for(const [source,target] of Object.entries(english)) {assert.ok(target.trim(),source);assert.equal(translate(source,'en'),target,source);}
});

test('all seven curated games have reversible English names and complete display translations',()=>{
  assert.equal(Object.keys(gameLocales).length,7);
  for(const {zh,en} of Object.values(gameLocales)){
    assert.deepEqual(Object.keys(en).sort(),Object.keys(zh).sort());
    for(const field of Object.keys(zh)){
      const sources=Array.isArray(zh[field])?zh[field]:[zh[field]],targets=Array.isArray(en[field])?en[field]:[en[field]];
      assert.equal(sources.length,targets.length);
      sources.forEach((source,i)=>{
        assert.equal(translate(source,'en'),targets[i],field);
        assert.equal(translate(source,'zh'),source,field);
        assert.doesNotMatch(targets[i],/\p{Script=Han}/u,field);
      });
    }
    assert.equal(translate(`选择卡带：${zh.title}`,'en'),`Select cartridge: ${en.title}`);
    assert.equal(translate(`${zh.title} 卡带封面`,'en'),`${en.title} cartridge cover`);
    assert.equal(translate(`${zh.title} · OpenAIGames`,'en'),`${en.title} · OpenAIGames`);
  }
  for(const [source,target] of Object.entries(chinese)){assert.equal(translate(source,'zh'),target);assert.equal(translate(source,'en'),source);}
});

test('all embedded guides have full Chinese and English copies',async()=>{
  for(const id of ['submission','contributing','agent']){
    const [zh,en]=await Promise.all(['zh','en'].map(locale=>readFile(new URL(`../static/guides/${id}.${locale}.md`,import.meta.url),'utf8')));
    assert.match(zh,/\p{Script=Han}/u);
    assert.doesNotMatch(en,/\p{Script=Han}/u);
    assert.ok(zh.length>1000&&en.length>2000,id);
    assert.match(en,/openaigames\/community|GAME_SUBMISSION/);
  }
});

test('catalog search accepts both original and translated names and gameplay terms',()=>{
  const game={title:'风之书的旅途',description:gameLocales['https://shenzh21.github.io/wind-book-journey-playtest/'].zh.description,category:'社区试玩'};
  for(const query of ['风之书','WIND BOOK','double-jump','社区试玩','community playtest'])assert.ok(matchesGame(game,query),query);
  assert.equal(matchesGame(game,'racing'),false);
});

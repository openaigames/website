import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combineGames,intakeGame} from '../lib/arcade.mjs';
test('Arcade includes playable intake without replacing credited published releases',()=>{
 const published=[{id:'a',preview_url:'https://game.test/a',title:'Original'}];
 const entries=[{id:1,url:'https://game.test/a',title:'Duplicate'},{id:2,url:'https://game.test/b',title:'中文作品',description:'玩法',relation:'recommend',submitter:'推荐人'}];
 const result=combineGames(published,entries);
 assert.equal(result.length,2);assert.equal(result[0],published[0]);
 assert.equal(result[1].pending,true);assert.equal(result[1].featured,false);assert.equal(result[1].source_url,'');
 assert.equal(result[1].title,'中文作品');assert.equal(result[1].versions[0].preview_url,entries[1].url);assert.equal(result[1].id,'inbox-2');assert.equal(intakeGame(entries[1]).relation,'recommend');
});

// A collection describes where a cartridge belongs; its genre stays independent.
export const collections = [
  {id:'featured',label:'精选卡带',includes:game=>Boolean(game.featured)},
  {id:'playtest',label:'社区试玩',includes:game=>Boolean(game.pending)},
  {id:'all',label:'全部卡带',includes:()=>true},
];
export function collectionGames(projects, id='all') {
  const collection=collections.find(item=>item.id===id)||collections.at(-1);
  return projects.filter(game=>game.current_version && collection.includes(game));
}
// Cross-origin games do not implement our pause bridge. Destroy their browsing
// context when ejecting, changing games, or leaving play so Web Audio stops too.
export function unloadPlayer(root) {
  for(const frame of root.querySelectorAll('#player iframe')) {
    frame.src='about:blank';
    frame.remove();
  }
}

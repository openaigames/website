// Stable homes: featured cartridges on the left, community playtests on the right.
// A short collection stays put while the overflowing collection changes page.
export function cabinetLayout(projects, requestedPage=0) {
  const unique=[...new Map(projects.map(game=>[game.id,game])).values()];
  const order=(a,b)=>a.id.localeCompare(b.id,'en',{numeric:true});
  const featured=unique.filter(game=>game.featured).sort(order);
  const community=unique.filter(game=>!game.featured).sort(order);
  const leftCapacity=Math.min(8,Math.max(2,featured.length));
  const capacities=[leftCapacity,10-leftCapacity];
  const groups=[featured,community];
  const counts=groups.map((games,i)=>Math.max(1,Math.ceil(games.length/capacities[i])));
  const pages=Math.max(...counts);
  const page=Math.max(0,Math.min(pages-1,Number.isFinite(requestedPage)?Math.floor(requestedPage):0));
  const shelves=groups.map((games,i)=>{
    const start=Math.min(page,counts[i]-1)*capacities[i];
    return {label:i===0?'精选卡带':'社区试玩',games:games.slice(start,start+capacities[i])};
  });
  return {page,pages,shelves,upper:shelves.flatMap(shelf=>shelf.games),upperSlots:[...shelves[0].games.map((_,i)=>i),...shelves[1].games.map((_,i)=>leftCapacity+i)]};
}

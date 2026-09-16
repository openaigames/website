// Each page is one cabinet: up to two category shelves and ten face-out games.
// Both displays use the same entries, including when a category spans pages.
export function cabinetLayout(projects, requestedPage=0) {
  const categories=new Map();
  for(const project of projects){const name=project.category||'社区试玩';if(!categories.has(name))categories.set(name,[]);categories.get(name).push(project);}
  const cabinets=[];
  let shelves=[],count=0;
  for(const [label,games] of categories){
    for(let i=0;i<games.length;){
      if(shelves.length===2||count===10){cabinets.push(shelves);shelves=[];count=0;}
      const size=Math.min(8,10-count,games.length-i);
      shelves.push({label,games:games.slice(i,i+size)});count+=size;i+=size;
    }
  }
  if(shelves.length)cabinets.push(shelves);
  const pages=Math.max(1,cabinets.length);
  const page=Math.max(0,Math.min(pages-1,requestedPage));
  shelves=cabinets[page]||[];
  return {page,pages,shelves,upper:shelves.flatMap(shelf=>shelf.games)};
}

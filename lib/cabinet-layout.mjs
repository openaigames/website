// Keep category shelves together, including when one category spans several pages.
export function cabinetLayout(projects, requestedPage=0) {
  const categories=new Map();
  for(const project of projects){const name=project.category||'社区试玩';if(!categories.has(name))categories.set(name,[]);categories.get(name).push(project);}
  const groups=[];
  for(const [label,games] of categories)for(let i=0;i<games.length;i+=8)groups.push({label,games:games.slice(i,i+8)});
  const pages=Math.max(1,Math.ceil(groups.length/2));
  const page=Math.max(0,Math.min(pages-1,requestedPage));
  const shelves=groups.slice(page*2,page*2+2);
  const upperPage=page%Math.max(1,Math.ceil(projects.length/10));
  return {page,pages,shelves,upper:projects.slice(upperPage*10,upperPage*10+10)};
}

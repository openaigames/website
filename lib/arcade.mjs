export function intakeGame(entry) {
  const id = `inbox-${entry.id}`;
  return {id,title:entry.title,description:entry.description,creator:entry.submitter||'',creator_url:entry.url,
    category:'社区试玩',pending:true,featured:false,external:true,cover_url:'',preview_url:entry.url,
    source_url:'',submission_url:'#/submit',version_label:'试玩投稿',controls:'操作方式请查看游戏原站。',
    current_version:id+'-current',versions:[{id:id+'-current',number:'试玩投稿',preview_url:entry.url}],
    relation:entry.relation};
}
export function combineGames(published, entries) {
  const urls=new Set(published.map(p=>p.preview_url));
  return [...published,...entries.filter(e=>!urls.has(e.url)).map(intakeGame)];
}

(() => {
'use strict';
const base=window.MARIENBAD_DATA, $=id=>document.getElementById(id), KEY='marienbad.edits.v1';
const isPublic=base.edition==='public';
const stateNames={implemented:'已有实现 / 内容',verify:'待验证',planned:'未来 / AI 建议',unknown:'未知'};
const stages={partial:'待验收',available:'待线上核验',unknown:'进展未确认',empty:'未开始'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hiddenProjects=new Set(base.dashboardHidden??[]);
const projects=base.projects.filter(p=>!hiddenProjects.has(p.id));
const relations=base.relations.filter(r=>!hiddenProjects.has(r.source)&&!hiddenProjects.has(r.target));
let edits={},selected=null,view='projects',editing=null;
if(!isPublic)try{const v=JSON.parse(localStorage.getItem(KEY)||'{}');if(v&&typeof v==='object'&&!Array.isArray(v))edits=v;}catch{}
function projectList(){return projects.map(p=>({...p,...Object.fromEntries(['goal','current','future','editedOn'].filter(k=>typeof edits[p.id]?.[k]==='string').map(k=>[k,edits[p.id][k]]))}));}
function toast(msg){$('toast').textContent=msg;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),4000);}
function persist(next){try{localStorage.setItem(KEY,JSON.stringify(next));edits=next;return true;}catch{toast('浏览器无法保存。请允许本地存储后重试。');return false;}}
const groups=[...new Set(projects.map(p=>p.group))];
$('group-filter').innerHTML='<option value="">全部领域</option>'+groups.map(group=>`<option>${esc(group)}</option>`).join('');
$('stage-filter').innerHTML='<option value="">全部状态</option>'+Object.entries(stages).map(([id,label])=>`<option value="${id}">${label}</option>`).join('');
$('total').textContent=projects.length;
$('relation-count').textContent=relations.length;
if(isPublic) $('edition-label').textContent='公开只读版';
const compactIndex=matchMedia('(max-width: 760px)');
const syncIndex=()=>{$('index-panel').open=!compactIndex.matches;};
compactIndex.addEventListener('change',syncIndex);
syncIndex();

const legend='<div class="legend" aria-label="组件状态图例"><span class="implemented">已实现</span><span class="verify">待验证</span><span class="planned">规划中</span><span class="unknown">未知</span></div>';
function fitLabel(text, max){
 let count=0;
 for(const [i,c] of [...text].entries()){
  count+=/[ -~]/.test(c)?0.58:1;
  if(count>max) return [...text].slice(0,i).join('')+'…';
 }
 return text;
}
function graph(p){
 const nw=207,nh=64,stepX=252,stepY=112;
 const width=26+stepX*Math.max(...p.nodes.map(n=>n.x))+nw+27;
 const height=14+stepY*Math.max(...p.nodes.map(n=>n.y))+nh+17;
 const coords=n=>({x:18+n.x*stepX,y:14+n.y*stepY});
 const nodesById=new Map(p.nodes.map(n=>[n.id,n]));
 const lines=p.edges.map(e=>{
  const a=nodesById.get(e.source),b=nodesById.get(e.target),s=coords(a),t=coords(b);
  let path;
  if(a.x===b.x){
   const down=b.y>a.y,sy=s.y+(down?nh:0),ty=t.y+(down?0:nh),x=s.x+nw/2;
   if(Math.abs(a.y-b.y)===1){
    path=`M ${x} ${sy} V ${ty}`;
   }else{
    const margin=s.x+nw+15,leave=sy+(down?12:-12),arrive=ty+(down?-12:12);
    path=`M ${x} ${sy} V ${leave} H ${margin} V ${arrive} H ${x} V ${ty}`;
   }
  }else{
   const right=b.x>a.x,sx=s.x+(right?nw:0),tx=t.x+(right?0:nw);
   const sy=s.y+nh/2,ty=t.y+nh/2,mid=(sx+tx)/2;
   if(Math.abs(a.x-b.x)===1){
    path=`M ${sx} ${sy} C ${mid} ${sy}, ${mid} ${ty}, ${tx} ${ty}`;
   }else{
    const from=sx+(right?14:-14),to=tx+(right?-14:14);
    const corridor=s.y+nh+17;
    path=`M ${sx} ${sy} H ${from} V ${corridor} H ${to} V ${ty} H ${tx}`;
   }
  }
  const future=a.status==='planned'||b.status==='planned';
  return `<path class="graph-edge ${future?'future':''}" d="${path}" marker-end="url(#arrow-${esc(p.id)})"><title>${esc(a.title+' → '+b.title+(e.label?' · '+e.label:''))}</title></path>`;
 }).join('');
 const nodes=p.nodes.map(n=>{
  const c=coords(n),action=n.function??n.title;
  return `<g class="graph-node ${esc(n.status)}" role="button" tabindex="0" aria-label="${esc(action+'，'+n.title+'，'+stateNames[n.status])}" data-project="${esc(p.id)}" data-node="${esc(n.id)}" transform="translate(${c.x},${c.y})"><title>${esc(n.title+' · '+n.detail)}</title><rect width="${nw}" height="${nh}" rx="5"/><text class="node-function" x="13" y="26">${esc(fitLabel(action,13.2))}</text><text class="node-title" x="13" y="47">${esc(fitLabel(n.title,16.6))}</text></g>`;
 }).join('');
 return `<div class="diagram-wrap" aria-label="${esc(p.title)} 架构图"><svg class="diagram" style="--diagram-width:${width}px" viewBox="0 0 ${width} ${height}" role="group" aria-label="${esc(p.title)} 组件和关系"><defs><marker id="arrow-${esc(p.id)}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#74857a"/></marker></defs>${lines}${nodes}</svg></div>`;
}
function componentGuide(p){
 const items=p.nodes.map(n=>`<li><strong>${esc(n.function??n.title)}</strong><span>${esc(n.title)}</span><p>${esc(n.detail)}</p></li>`).join('');
 return `<details class="component-links"><summary>组件说明 <span>${p.nodes.length} 项</span></summary><ul class="component-guide">${items}</ul></details>`;
}
function componentLinks(p){
 const names=new Map(p.nodes.map(node=>[node.id,node.title]));
 const rows=p.edges.map(edge=>`<tr><td>${esc(names.get(edge.source))}</td><td>${esc(edge.label||'输出')}</td><td>${esc(names.get(edge.target))}</td></tr>`).join('');
 return `<details class="component-links"><summary>组件之间的关系 <span>${p.edges.length} 条</span></summary><div class="relation-table"><table><thead><tr><th scope="col">起点</th><th scope="col">数据或动作</th><th scope="col">终点</th></tr></thead><tbody>${rows}</tbody></table></div></details>`;
}
function relationSummary(p){return relations.filter(r=>r.source===p.id||r.target===p.id).map(r=>{const other=r.source===p.id?r.target:r.source;return `<a href="#project/${encodeURIComponent(other)}">${esc(other)} · ${r.type==='confirmed'?'已见依据':'可能关联'} ↗</a>`;}).join('');}
function article(p){
 const sources=p.sources.map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener" title="${esc(s.basis)}">${esc(s.title)} ↗</a>`).join('');
 const repo=p.repository?`<a href="${esc(p.repository)}" target="_blank" rel="noopener">GitHub ↗</a>`:'';
 return `<article class="project" id="${esc(p.id)}"><div class="project-header"><div><div class="project-kicker">${esc(p.group)} · ${p.visibility==='private'?'私有仓库':'公开仓库'}</div><h2>${esc(p.title)}${edits[p.id]?'<span class="edited">有本地校订</span>':''}</h2></div><div class="project-top-actions"><span class="badge ${esc(p.stage)}">${esc(stages[p.stage])}</span>${isPublic?'':`<button data-edit="${esc(p.id)}">校订文字 ↗</button>`}</div></div>
 <p class="goal">${esc(p.goal)}</p>
 <div class="project-info"><div><span class="info-label">当前</span><p>${esc(p.current)}</p></div><div><span class="info-label">下一步</span><p>${esc(p.future)}</p></div></div>
 <div class="map-heading"><h3>组件与流程</h3>${legend}</div>${graph(p)}
 ${componentGuide(p)}${componentLinks(p)}
 <div class="project-links">${repo}${sources}${relationSummary(p)}<span>核对于 ${esc(p.observedOn)}</span></div>
 ${p.question?`<p class="project-question">待确认 · ${esc(p.question)}</p>`:''}</article>`;
}
function matches(p){
 const q=$('search').value.trim().toLowerCase(),group=$('group-filter').value,stage=$('stage-filter').value;
 return (!group||p.group===group)&&(!stage||p.stage===stage)&&(!q||JSON.stringify([p.title,p.id,p.goal,p.current,p.future,p.nodes]).toLowerCase().includes(q));
}
function projectLink(id){
 return `#project/${encodeURIComponent(id)}`;
}
function renderIndex(list,activeId){
 const groupBy=$('grouping').value==='stage';
 const buckets=groupBy?Object.entries(stages):groups.map(g=>[g,g]);
 $('match-count').textContent=list.length+' / '+projects.length;
 $('project-nav').innerHTML=buckets.map(([key,label])=>{
  const entries=list.filter(p=>p[groupBy?'stage':'group']===key);
  if(!entries.length)return '';
  return `<section class="index-group"><h2>${esc(label)} <span>${entries.length}</span></h2>
   ${entries.map(p=>`<a class="repo-link ${activeId===p.id?'active':''}" ${activeId===p.id?'aria-current="page"':''} href="${projectLink(p.id)}"><span class="repo-dot ${esc(p.stage)}" aria-label="${esc(stages[p.stage])}" title="${esc(stages[p.stage])}"></span><span>${esc(p.title)}</span></a>`).join('')}</section>`;
 }).join('');
}
function render(){
 const list=projectList().filter(matches),ids=new Set(list.map(p=>p.id));
 const project=list.find(p=>p.id===selected)??list[0];
 renderIndex(list,view==='projects'?project?.id:null);
 $('reset-filters').hidden=!($('search').value||$('group-filter').value||$('stage-filter').value);
 $('all-link').classList.toggle('active',view==='projects');
 $('relations-link').classList.toggle('active',view==='relations');
 if(view==='relations'){
  const visible=relations.filter(r=>ids.has(r.source)&&ids.has(r.target));
  const title=id=>projects.find(p=>p.id===id).title;
  $('atlas').innerHTML=visible.length?`<section class="relations"><h2>跨项目关系</h2><div class="relation-lines">${visible.map(r=>`<div class="relation-row ${esc(r.type)}"><a href="${projectLink(r.source)}">${esc(title(r.source))}</a><div class="bridge">${esc(r.label)}<div class="bridge-line"></div><small>${r.type==='confirmed'?'已记录':'待确认'}${r.basis?' · '+esc(r.basis):''}</small>${r.evidence?`<a class="relation-evidence" href="${esc(r.evidence)}" target="_blank" rel="noopener">查看依据 ↗</a>`:''}</div><a href="${projectLink(r.target)}">${esc(title(r.target))}</a></div>`).join('')}</div></section>`:'';
  $('empty').hidden=visible.length>0;
  return;
 }
 $('atlas').innerHTML=project?article(project):'';
 $('empty').hidden=Boolean(project);
}
function clearFilters(){
 for(const id of ['search','group-filter','stage-filter']) $(id).value='';
}
function route(){
 const hash=location.hash.slice(1);
 let id;
 try{id=hash.startsWith('project/')?decodeURIComponent(hash.slice(8)):null;}catch{id=null;}
 selected=projects.some(p=>p.id===id)?id:null;
 view=hash==='relations'?'relations':'projects';
 const target=projectList().find(p=>p.id===selected);
 if(target&&!matches(target))clearFilters();
 render();
}
window.addEventListener('hashchange',route);
$('search').addEventListener('input',render);
for(const id of ['group-filter','stage-filter','grouping']) $(id).addEventListener('change',render);
$('reset-filters').addEventListener('click',()=>{clearFilters();render();});
$('project-nav').addEventListener('click',e=>{
 const link=e.target.closest('a');
 if(link&&compactIndex.matches) $('index-panel').open=false;
});
function openNode(el){
 const p=projectList().find(p=>p.id===el.dataset.project);
 const n=p.nodes.find(n=>n.id===el.dataset.node),source=p.sources[n.source];
 const names=new Map(p.nodes.map(node=>[node.id,node.function??node.title]));
 const related=p.edges.filter(e=>e.source===n.id||e.target===n.id);
 $('detail-kind').textContent=stateNames[n.status]+' · '+p.title;
 $('detail-title').textContent=n.function??n.title;
 $('detail-text').textContent=n.title+' · '+n.detail;
 $('detail-connections').innerHTML=related.length?`<h3>上下游</h3><ul>${related.map(e=>`<li>${esc(names.get(e.source))} → ${esc(names.get(e.target))}${e.label?' · '+esc(e.label):''}</li>`).join('')}</ul>`:'';
 $('detail-source').innerHTML=source?`<p>${esc(source.basis)}</p><a target="_blank" rel="noopener" href="${esc(source.url)}">${esc(source.title)} ↗</a><p>核对于 ${esc(p.observedOn)}</p>`:'';
 $('detail-dialog').showModal();
}
$('atlas').addEventListener('click',e=>{const node=e.target.closest('[data-node]');if(node){openNode(node);return;}const b=e.target.closest('[data-edit]');if(!b)return;editing=b.dataset.edit;const p=projectList().find(p=>p.id===editing);$('edit-title').textContent=p.title;['goal','current','future'].forEach(k=>$('edit-'+k).value=p[k]);$('edit-dialog').showModal();});
$('atlas').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-node]')){e.preventDefault();openNode(e.target);}});
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',() => $(b.dataset.close).close()));
if(!isPublic){
$('edit-form').addEventListener('submit',e=>{e.preventDefault();let update={editedOn:new Date().toISOString()};['goal','current','future'].forEach(k=>update[k]=$('edit-'+k).value.trim());if(persist({...edits,[editing]:update})){$('edit-dialog').close();render();toast('已保存本地校订；可导出并提交到 GitHub。');}});
$('reset-edit').addEventListener('click',()=>{let next={...edits};delete next[editing];if(persist(next)){$('edit-dialog').close();render();toast('已恢复仓库中的文字。');}});
$('export-btn').addEventListener('click',()=>{const updated=new Map(projectList().map(p=>[p.id,p]));const data={...base,exportedAt:new Date().toISOString(),projects:base.projects.map(p=>updated.get(p.id)??p)};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='marienbad-projects.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已导出完整图谱与校订；请将需要保留的文字合回仓库。');});
$('import-btn').addEventListener('click',()=>$('import-file').click());$('import-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2_000_000)throw Error('文件大于 2 MB');const data=JSON.parse(await file.text());if(data.schemaVersion!==1||!Array.isArray(data.projects))throw Error('格式不正确');const next={...edits};let count=0;for(const p of data.projects){if(!projects.some(b=>b.id===p.id))continue;if(!['goal','current','future'].every(k=>typeof p[k]==='string'&&p[k].length>0&&p[k].length<=4000))throw Error('字段不完整或过长');next[p.id]={goal:p.goal,current:p.current,future:p.future,editedOn:new Date().toISOString()};count++;}if(!count)throw Error('没有匹配的项目');if(persist(next)){render();toast(`已合入 ${count} 个项目的文字校订。图与来源以仓库为准。`);}}catch(err){toast('导入失败：'+err.message);}finally{e.target.value='';}});
}
route();
})();

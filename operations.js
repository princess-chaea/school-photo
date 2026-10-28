export function createOperations({cloud,getUser,run,toast}){
 const $=id=>document.getElementById(id);let users=[],events=[],epoch=0;
 const pages={users:{cursor:null,more:false},events:{cursor:null,more:false}};
 const el=(tag,text)=>Object.assign(document.createElement(tag),{textContent:text});
 function render(){
  if(!cloud.isSiteAdmin(getUser()))return;const term=$('operations-search').value.trim().toLowerCase();
  $('operations-summary').replaceChildren(...[`조회한 사용자 ${users.length}명`,`조회한 활동 ${events.length}개`,`게시 중 ${events.filter(e=>e.published).length}개`].map(t=>el('strong',t)));
  for(const [kind,items]of [['users',users],['events',events]]){
   const list=$('operations-'+kind);list.replaceChildren();
   for(const item of items.filter(i=>[i.displayName,i.email,i.title,i.school,i.ownerId,i.id].join(' ').toLowerCase().includes(term))){
    const row=el('article','');row.className='operations-row';row.append(el('strong',kind==='users'?(item.displayName||'이름 없음'):item.title),el('p',kind==='users'?item.email:[item.school,item.published?'게시 중':'비공개','소유자 '+item.ownerId].filter(Boolean).join(' · ')));
    const button=el('button',kind==='users'?(item.publishingBlocked?'게시 제한 해제':'새 게시 제한'):'게시 중지');button.className='button';button.disabled=kind==='events'&&!item.published||kind==='users'&&item.id===getUser().uid;
    button.onclick=()=>run(async()=>{if(!confirm(kind==='users'?'이 사용자의 새 행사 게시 권한을 변경할까요? 기존 게시물은 개별적으로 관리합니다.':'이 활동을 비공개로 전환할까요? 행사 QR의 신규 접속이 중단됩니다.'))return;if(kind==='users'){await cloud.setPublishingBlocked(item.id,!item.publishingBlocked);item.publishingBlocked=!item.publishingBlocked;}else{await cloud.moderateEvent(item.id);item.published=false;}render();toast('반영했어요.');});row.append(button);list.append(row);
   }
   if(!list.children.length)list.append(el('p','표시할 항목이 없습니다.'));
   if(pages[kind].more){const more=el('button','다음 100개 불러오기');more.className='button';more.onclick=()=>run(()=>load(kind,epoch));list.append(more);}
  }
 }
 async function load(kind,version){const page=await cloud.listOperationsPage(kind,pages[kind].cursor);if(version!==epoch||!cloud.isSiteAdmin(getUser()))return;if(kind==='users')users.push(...page.items);else events.push(...page.items);pages[kind]=page;render();}
 async function refresh(){const version=++epoch;users=[];events=[];for(const kind of ['users','events'])pages[kind]={cursor:null,more:false};$('operations-users').replaceChildren();$('operations-events').replaceChildren();$('operations-summary').replaceChildren();if(!cloud.isSiteAdmin(getUser()))return;$('operations-status').textContent='불러오는 중…';try{await Promise.all([load('users',version),load('events',version)]);if(version===epoch)$('operations-status').textContent='각 목록은 최대 100개씩 불러옵니다. 검색은 불러온 항목에서 적용됩니다.';}catch(error){if(version===epoch)$('operations-status').textContent=error.message;}}
 $('operations-refresh').onclick=()=>run(refresh);$('operations-search').oninput=render;
 return {refresh,clear(){epoch++;users=[];events=[];$('operations-users').replaceChildren();$('operations-events').replaceChildren();$('operations-summary').replaceChildren();}};
}

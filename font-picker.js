// Preserve the native select as the form/state source; use a dialog for reliable font previews.
const controls=new WeakMap();let picker;
function createPicker(){
 const dialog=document.createElement('dialog');dialog.className='font-picker-dialog';dialog.id='font-preview-dialog';dialog.setAttribute('aria-labelledby','font-preview-title');
 dialog.innerHTML=`<header><h2 id="font-preview-title">글꼴 고르기</h2><button type="button" class="text-button" data-close>닫기</button></header><div class="font-picker-filters"><label>글꼴 검색<input type="search" data-search placeholder="글꼴 이름으로 검색" autocomplete="off"></label><label>분류<select data-group><option value="all">전체</option><option value="recommended">추천</option><option value="school">학교·OFL</option></select></label></div><p class="font-picker-status" data-status role="status" aria-live="polite"></p><div class="font-picker-list" role="listbox" aria-label="실제 글꼴 미리보기 목록"></div><p class="font-picker-help">글꼴 이름을 실제 모양으로 보여드려요. 마음에 드는 글꼴을 누르면 적용됩니다.</p>`;
 document.body.append(dialog);const find=s=>dialog.querySelector(s),list=find('.font-picker-list');let active=null,observer=null,queue=[],running=0,version=0,selectionVersion=0,visibleFonts=[];
 const normalized=value=>value.replace(/\s/g,'').toLocaleLowerCase();
 function cardState(card,state,message=''){card.dataset.state=state;card.querySelector('.font-preview-state').textContent=message;}
 function paintReady(card,font){card.querySelector('.font-preview-name').style.fontFamily=font.family;cardState(card,'ready');}
 function drain(){while(active&&running<4&&queue.length){const job=queue.shift();if(job.version!==version||!job.card.isConnected)continue;running++;const owner=active;owner.options.loadFont(job.font.id).then(()=>{if(job.version===version&&job.card.isConnected)paintReady(job.card,job.font);}).catch(()=>{if(job.version===version&&job.card.isConnected)cardState(job.card,'error','불러오지 못했어요. 눌러 다시 시도해 주세요.');}).finally(()=>{running--;drain();});}}
 function enqueue(card,font){if(card.dataset.queued)return;card.dataset.queued='true';queue.push({card,font,version});drain();}
 async function choose(font,card){const owner=active,ticket=++selectionVersion;if(!owner)return;cardState(card,'loading','글꼴을 준비하고 있어요…');try{
   await owner.options.loadFont(font.id);
   if(active!==owner||ticket!==selectionVersion||!dialog.open||!owner.select.isConnected||owner.select.disabled)return;
   owner.select.value=font.id;owner.sync();owner.select.dispatchEvent(new Event('input',{bubbles:true}));owner.select.dispatchEvent(new Event('change',{bubbles:true}));close();
  }catch{if(active===owner&&ticket===selectionVersion){cardState(card,'error','불러오지 못했어요. 눌러 다시 시도해 주세요.');find('[data-status]').textContent='선택한 글꼴을 불러오지 못했어요. 다시 누르거나 다른 글꼴을 선택해 주세요.';}}}
 function render({reveal=false}={}){
  if(!active)return;version++;selectionVersion++;observer?.disconnect();queue=[];const query=normalized(find('[data-search]').value),group=find('[data-group]').value;
  visibleFonts=active.options.fonts.filter((font,index)=>(group==='all'||(group==='recommended'?index<6:index>=6))&&normalized(font.name).includes(query));
  list.replaceChildren(...visibleFonts.map(font=>{
   const card=document.createElement('button');card.type='button';card.className='font-preview-card';card.dataset.font=font.id;card.setAttribute('role','option');card.setAttribute('aria-label',font.name+' 글꼴 선택');const selected=font.id===active.select.value;card.setAttribute('aria-selected',String(selected));card.tabIndex=selected?0:-1;
   const name=document.createElement('span');name.className='font-preview-name';name.textContent=font.name;
   const state=document.createElement('span');state.className='font-preview-state';card.append(name,state);cardState(card,'loading','미리보기 불러오는 중…');card.onclick=()=>choose(font,card);return card;
  }));
  if(!list.querySelector('[tabindex="0"]')&&list.firstElementChild)list.firstElementChild.tabIndex=0;
  find('[data-status]').textContent=visibleFonts.length?`${visibleFonts.length}개 글꼴 · 선택한 글꼴: ${active.options.fonts.find(f=>f.id===active.select.value)?.name||''}`:'검색 결과가 없어요. 다른 이름으로 찾아보세요.';
  list.scrollTop=0;
  if(reveal){const selected=list.querySelector('[aria-selected="true"]');if(selected)list.scrollTop=Math.max(0,selected.offsetTop-list.offsetTop-12);}
  observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){const card=e.target,font=visibleFonts.find(f=>f.id===card.dataset.font);if(font)enqueue(card,font);observer.unobserve(card);}},{root:list,rootMargin:'100px 0px'});
  for(const card of list.children)observer.observe(card);
 }
 find('[data-search]').oninput=()=>render();find('[data-group]').onchange=()=>render();
 function clearOwner(){const owner=active;active=null;version++;selectionVersion++;observer?.disconnect();queue=[];owner?.trigger.setAttribute('aria-expanded','false');return owner;}
 function restoreFocus(owner){if(owner?.trigger.isConnected)owner.trigger.focus({preventScroll:true});}
 function close(){if(!dialog.open)return;const owner=clearOwner();dialog.close();restoreFocus(owner);}
 find('[data-close]').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();e.stopPropagation();close();});
 dialog.addEventListener('close',()=>{if(!dialog.open&&active)restoreFocus(clearOwner());});
 list.onkeydown=e=>{const index=[...list.children].indexOf(document.activeElement);if(index<0)return;const cols=getComputedStyle(list).gridTemplateColumns.split(' ').length;const move={ArrowRight:1,ArrowLeft:-1,ArrowDown:cols,ArrowUp:-cols}[e.key];let target;if(move)target=Math.max(0,Math.min(list.children.length-1,index+move));else if(e.key==='Home')target=0;else if(e.key==='End')target=list.children.length-1;else return;e.preventDefault();list.children[index].tabIndex=-1;list.children[target].tabIndex=0;list.children[target].focus();};
 return{open(owner){if(dialog.open||owner.select.disabled)return;active=owner;find('[data-search]').value='';find('[data-group]').value='all';owner.trigger.setAttribute('aria-expanded','true');dialog.showModal();render({reveal:true});find('[data-search]').focus({preventScroll:true});}};
}
export function enhanceFontSelect(select,options){
 const previous=controls.get(select);if(previous){previous.options=options;previous.sync();return;}
 const trigger=document.createElement('button');trigger.type='button';trigger.className='font-picker-trigger';trigger.id=(select.id||'font-'+crypto.randomUUID())+'-picker';trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls','font-preview-dialog');trigger.setAttribute('aria-expanded','false');
 const name=document.createElement('span');name.className='font-picker-current';trigger.append(name);let currentFont='',labels=[];
 const owner={select,trigger,options,sync(){
   if(select.parentElement&&trigger.previousElementSibling!==select)select.after(trigger);
   for(const label of [...(select.labels||[])])if(!labels.includes(label)){labels.push(label);label.htmlFor=trigger.id;}
   const font=owner.options.fonts.find(f=>f.id===select.value)||owner.options.fonts[0];name.textContent=font.name;trigger.disabled=select.disabled;
   trigger.setAttribute('aria-label',`${labels.map(l=>l.textContent.trim()).join(' ')||'글꼴'}: ${font.name}`);
   if(currentFont!==font.id){currentFont=font.id;trigger.style.fontFamily='inherit';owner.options.loadFont(font.id).then(()=>{if(currentFont===font.id)trigger.style.fontFamily=font.family;}).catch(()=>{if(currentFont===font.id)currentFont='';});}
  }};
 select.hidden=true;select.tabIndex=-1;select.setAttribute('aria-hidden','true');controls.set(select,owner);select.addEventListener('change',()=>owner.sync());
 trigger.onclick=()=>{owner.sync();picker??=createPicker();picker.open(owner);};owner.sync();
}
export function refreshFontSelect(select){controls.get(select)?.sync();}

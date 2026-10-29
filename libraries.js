import {observeFrameChoices,paintFrameChoice} from './frame-choice-preview.js';
import {normalizeFrameDraft} from './frame-draft.js';
import {confirmAction} from './app-dialog.js';
import {paletteDefaultInk} from './frame-palettes.js';
import {drawLayoutGuide} from './layout-guide.js';
import {createFrameMaker} from './frame-maker.js';
import {renderFrameGroups} from './frame-groups.js';
import {FRAME_SIZES} from './frame-sizes.js';
import { DEFAULT_FRAMES, DEFAULT_STICKERS, templateGeometry, downloadBlob } from './core.js';
import { optimizeDesign, formatBytes } from './optimize.js';
import { icon,labelButton } from './icons.js';
import { printPNG } from './print-png.js';
import { paintFramePreview } from './frame-preview.js';
import { createFrameUpload } from './frame-upload.js';
import * as cloud from './cloud.js';
const $ = id => document.getElementById(id);
const LABELS = { frame: '프레임', palette: '단색 프레임', sticker: '꾸미기 이미지', logo: '학교 로고' };
export function createLibraries({ getAssets, getShared, getUser, demo, run, added, sharedAdded, sharedChanged, removePrivate, toast }) {
  const frameUpload=createFrameUpload(), drafts=new WeakMap();let makerShared=false,frameMaker;
  for(const id of ['asset-form','shared-form','frame-form']){const form=$(id),submit=form.querySelector('button[type=submit],button.button.lime');const cell=document.createElement('div');cell.className='upload-submit-cell';const label=element('span','업로드','field-label');submit.before(cell);cell.append(label,submit);form.classList.add('upload-three-steps');}
  for(const id of ['asset-file','shared-file','frame-upload-file']){
    const input=$(id),cell=input.parentElement,picker=element('div','','upload-file-picker'),caption=element('span','파일 첨부');cell.classList.add('upload-file-cell');input.before(picker);picker.append(icon('attachment'),caption,input);
    const sync=()=>{caption.textContent=input.files[0]?.name||'파일 첨부';picker.title=caption.textContent;};input.addEventListener('change',sync);input.addEventListener('file-label-update',sync);input.form.addEventListener('reset',()=>queueMicrotask(sync));
  }
  let frameDrafts=[],draftUser='',draftLoadVersion=0,currentFrameDraftId=null;
  const draftSections=[false,true].map(shared=>{const section=element('section','','frame-draft-section');section.hidden=true;section.dataset.draftScope=shared?'shared':'private';section.append(element('h3','임시 저장한 배치'),element('p',demo?'이 브라우저에 배치만 보관해요. 이미지는 나중에 첨부하세요.':'내 계정에 배치만 보관해요. 다른 기기에서도 이어서 만들 수 있어요.'));section.append(element('div','','frame-draft-list'));if(shared)$('shared-frame-maker-launch').append(section);else $('frame-library').before(section);return section;});
  function localDraftKey(){return 'moment-frame-drafts:'+(getUser()?.uid||'demo');}
  function renderDrafts(){
    for(const [i,section]of draftSections.entries()){
      const stamp=d=>d.updatedAt?.toMillis?.()||Date.parse(d.updatedAt)||0,rows=frameDrafts.filter(d=>d.scope===(i?'shared':'private')).sort((a,b)=>stamp(b)-stamp(a)),list=section.querySelector('.frame-draft-list');section.hidden=!rows.length;list.replaceChildren();
      for(const row of rows){const config=normalizeFrameDraft(row.config);if(!config)continue;const card=element('article','','frame-draft-card'),canvas=document.createElement('canvas');canvas.width=100;canvas.height=120;const base=templateGeometry(config.count,config.orientation,config.format);drawLayoutGuide(canvas,{...base,slots:config.layouts[config.count].map(s=>({...s,x:s.x*base.width,y:s.y*base.height,w:s.w*base.width,h:s.h*base.height}))});const info=element('div','');info.append(element('strong',row.name),element('p',`${FRAME_SIZES.find(f=>f.id===config.format).name} · ${config.enabled.join('·')}컷`));const date=row.updatedAt?.toDate?.()||new Date(row.updatedAt);if(Number.isFinite(date.getTime()))info.append(element('p',date.toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})));const actions=element('div','','compact-actions'),resume=element('button','이어서 만들기','button'),remove=element('button','삭제','text-button danger');resume.type=remove.type='button';resume.onclick=()=>run(()=>openMaker(Boolean(i),{...row,config}));remove.onclick=()=>run(async()=>{if(!await confirmAction('임시 저장한 배치를 삭제할까요?'))return;if(demo){frameDrafts=frameDrafts.filter(d=>d.id!==row.id);localStorage.setItem(localDraftKey(),JSON.stringify(frameDrafts));}else{await cloud.deleteFrameDraft(getUser().uid,row.id);frameDrafts=frameDrafts.filter(d=>d.id!==row.id);}if(currentFrameDraftId===row.id)currentFrameDraftId=null;renderDrafts();});actions.append(resume,remove);card.append(canvas,info,actions);list.append(card);}
    }
  }
  function loadDrafts(){const uid=getUser()?.uid||(demo?'demo':'');if(uid===draftUser)return;draftUser=uid;const ticket=++draftLoadVersion;frameDrafts=[];renderDrafts();if(!uid)return;if(demo){try{frameDrafts=JSON.parse(localStorage.getItem(localDraftKey())||'[]').filter(d=>normalizeFrameDraft(d.config));}catch{frameDrafts=[];}renderDrafts();}else cloud.listFrameDrafts(uid).then(rows=>{if(ticket!==draftLoadVersion)return;frameDrafts=rows.filter(d=>normalizeFrameDraft(d.config));renderDrafts();}).catch(()=>{if(ticket===draftLoadVersion)toast('임시 저장 배치를 불러오지 못했어요. 새로고침해 주세요.');});}
  $('save-frame-draft').onclick=()=>run(async()=>{
    const draftOwner=getUser()?.uid,config=frameMaker.snapshot(),name=$('frame-upload-name').value.trim()||FRAME_SIZES.find(f=>f.id===config.format).name+' 배치',value={id:currentFrameDraftId||crypto.randomUUID(),name,scope:makerShared?'shared':'private',config};let saved;
    if(demo){saved={...value,updatedAt:new Date().toISOString()};const next=[saved,...frameDrafts.filter(d=>d.id!==value.id)];localStorage.setItem(localDraftKey(),JSON.stringify(next));frameDrafts=next;}else{saved=await cloud.saveFrameDraft(draftOwner,value);if(getUser()?.uid!==draftOwner)return;frameDrafts=[saved,...frameDrafts.filter(d=>d.id!==saved.id)];}
    currentFrameDraftId=saved.id;renderDrafts();$('frame-draft-status').textContent=demo?'이 브라우저에 배치를 저장했어요. 보관함에서 이어서 만들 수 있어요.':'내 계정에 배치를 저장했어요. 보관함에서 이어서 만들 수 있어요.';toast('배치를 임시 저장했어요.');
  });labelButton($('save-frame-draft'),'save','배치 임시 저장');
  observeFrameChoices($('frame-library'));
  const designFilters=document.createElement('div');designFilters.className='sticker-library-filters';designFilters.innerHTML='<label>디자인 검색<input type="search" placeholder="이름으로 찾기" data-design-search></label><label>테마<select data-design-category><option>전체</option></select></label>';$('asset-library').before(designFilters);
  const designSearch=designFilters.querySelector('input'),designCategory=designFilters.querySelector('select');designSearch.oninput=render;designCategory.onchange=render;
  function element(tag, value, className = '') { const el = document.createElement(tag); el.textContent = value; el.className = className; return el; }
  function isAdmin() { return cloud.isSiteAdmin(getUser()); }
  const framePreview=document.createElement('canvas');framePreview.hidden=true;framePreview.style.cssText='max-width:100%;max-height:60dvh;object-fit:contain';$('library-preview-image').after(framePreview);
  const frameEvent=asset=>({title:'',school:'',logo:'',schedule:'',frames:[{...asset,overlay:asset.url,bg:asset.bg||'#fffdf6',ink:asset.ink||'#34372f'}]});
  function showAsset(asset) {
    if (!asset.url) return; $('library-preview-title').textContent = asset.name; $('library-preview-image').src = asset.url;$('library-preview-image').hidden=asset.kind==='frame';framePreview.hidden=asset.kind!=='frame';if(asset.kind==='frame')paintFramePreview(framePreview,frameEvent(asset),{count:asset.layoutCount||4,orientation:asset.orientation,maxDimension:1100}).catch(()=>{});
    $('library-preview-info').textContent = [asset.layoutCount ? `${asset.photoLayouts?Object.keys(asset.photoLayouts).join('·'):asset.layoutCount}컷 지원` : '', asset.width ? `${asset.width} × ${asset.height}px` : '', asset.optimizedBytes ? `WebP · ${formatBytes(asset.optimizedBytes)}` : ''].filter(Boolean).join(' · ');
    $('library-preview').showModal();
  }
  function assetCard(asset, manage = false) {
    if(asset.base&&asset.kind==='palette'){const card=element('article','','asset-card design-choice palette-library-card');card.setAttribute('aria-label',asset.name);paintFrameChoice(card,asset,{compact:true});return card;}
    const card = element('article', '', 'asset-card'), image = element('button', '', 'asset-image library-image'); image.type = 'button'; image.setAttribute('aria-label', `${asset.name} 크게 보기`);
    if(asset.kind==='frame'&&asset.url){const sample=document.createElement('canvas');sample.className='palette-preview';image.append(sample);paintFramePreview(sample,frameEvent(asset),{count:asset.layoutCount||4,orientation:asset.orientation,maxDimension:360}).catch(()=>{});image.onclick=()=>showAsset(asset);}
    else if (asset.url) { const img = new Image(); img.src = asset.url; img.alt = asset.name; img.loading='lazy';image.append(img); image.addEventListener('click', () => showAsset(asset)); }
    else { const sample=document.createElement('canvas'); sample.className='palette-preview'; sample.setAttribute('aria-label',asset.name+' 4컷 예시'); image.append(sample); paintFramePreview(sample,{title:'',school:'',logo:'',schedule:'',frames:[asset]}); image.disabled=true; }
    const info = element('div', '', 'asset-info'); info.append(element('span', asset.base ? '기본' : asset.shared ? (asset.active ? '공용' : '공용 · 노출 중지') : '내 자료', `library-source ${asset.shared ? 'public' : ''}`), element('strong', asset.name), element('p', `${LABELS[asset.kind]}${asset.layoutCount ? ` · ${asset.photoLayouts?Object.keys(asset.photoLayouts).join('·'):asset.layoutCount}컷 지원` : asset.preserveAspect ? ' · 기존 공통 배치' : ''}`));
    if (asset.layoutCount || asset.preserveAspect) { const g = templateGeometry(asset.layoutCount || 4, asset.orientation,asset.frameFormat); info.append(element('p', `제작 규격 ${g.width} × ${g.height}px`)); }
    if (asset.optimizedBytes) info.append(element('p', `WebP · ${formatBytes(asset.optimizedBytes)}`));
    if (manage && isAdmin()) { const b = element('button', asset.active ? '공용 노출 중지' : '공용 다시 표시', 'text-button'); b.type = 'button'; b.addEventListener('click', () => run(async () => { await cloud.setSharedActive(asset.id, !asset.active); sharedChanged(asset.id, !asset.active); toast(asset.active ? '새 선택 목록에서 숨겼어요. 기존 행사의 파일은 유지돼요.' : '다시 공용 목록에 표시했어요.'); })); info.append(b); }
    else if (!asset.base && !asset.shared) { const b = element('button', '삭제', 'text-button danger'); b.type = 'button'; b.addEventListener('click', () => run(() => removePrivate(asset))); info.append(b); }
    card.append(image, info); return card;
  }
  function render() {
    loadDrafts();renderDrafts();
    const own = getAssets(), shared = getShared().filter(a => a.active);
    const frames = [...DEFAULT_FRAMES.map(f => ({ ...f, kind: 'palette', base: true })), ...shared.filter(a => ['frame','palette'].includes(a.kind)), ...own.filter(a => ['frame','palette'].includes(a.kind))];
    const designs = [...DEFAULT_STICKERS.filter(s => s.url).map(s => ({ ...s, kind: 'sticker', base: true })), ...shared.filter(a => a.kind === 'sticker'), ...own.filter(a => a.kind === 'sticker')];
    $('frame-count').textContent = frames.length; $('asset-count').textContent = designs.length;
    renderFrameGroups($('frame-library'),frames,{library:true,renderCard:asset=>assetCard(asset)}); const category=a=>a.category||(a.shared?'공용 자료':'내 자료'),previous=designCategory.value;designCategory.replaceChildren(...['전체',...new Set(designs.map(category))].map(value=>Object.assign(document.createElement('option'),{value,textContent:value})));designCategory.value=[...designCategory.options].some(o=>o.value===previous)?previous:'전체';
    const matchingDesigns=designs.filter(a=>a.kind===$('asset-kind').value&&(designCategory.value==='전체'||category(a)===designCategory.value)&&a.name.includes(designSearch.value.trim()));$('asset-library').replaceChildren(...matchingDesigns.map(a=>assetCard(a)));if(!matchingDesigns.length)$('asset-library').append(element('p','검색 결과가 없어요.','empty-state'));
    $('shared-library').replaceChildren(...getShared().filter(a=>$('shared-kind').value==='frame'?['frame','palette'].includes(a.kind):a.kind==='sticker').map(a => assetCard(a, true)));
    if (!getShared().length) $('shared-library').append(element('div', '첫 번째 공용 스티커나 프레임을 등록해 보세요.', 'empty-state'));
    $('shared-tab').hidden = !isAdmin(); if (!isAdmin()) $('shared-view').hidden = true;
  }
  async function upload(form, shared = false) {
    const makerForm=form===$('frame-form');const kind = makerForm?'frame':shared ? $('shared-kind').value : 'frame';
    const name = $(makerForm?'frame-upload-name':'shared-name').value.trim(), input = $(makerForm?'frame-upload-file':'shared-file'), file = input.files[0];
    if (!file || !name) throw new Error('이름과 이미지를 선택해 주세요.');
    if (shared && !isAdmin()) throw new Error('운영자 전용입니다.');
    let prepared=file, metadata={};
    if(kind==='frame'){
      let draft=drafts.get(form);
      if(!draft || draft.source!==file){await prepareFrame(form,shared);draft=drafts.get(form);}
      if(!draft)return;
      prepared=draft.file;metadata=makerForm?{...draft,...frameMaker.selection()}:draft;
    }
    const button = $(makerForm?'upload-frame':'upload-shared'); labelButton(button, 'refresh', 'WebP로 최적화 중…');
    try {
      const optimized = await optimizeDesign(prepared, kind, metadata);
      let asset;
      if (demo) { const url = await new Promise((resolve,reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(optimized.file); }); asset = { id: crypto.randomUUID(), name, kind, url, ...optimized.metadata,...(shared?{shared:true,active:true}:{}) }; }
      else asset = shared ? await cloud.uploadSharedAsset(optimized.file, kind, name, optimized.metadata) : await cloud.uploadAsset(getUser().uid, optimized.file, kind, name, optimized.metadata);
      drafts.delete(form);shared ? sharedAdded(asset) : added(asset); const selectedKind=$('shared-kind').value;form.reset();if(shared)$('shared-kind').value=selectedKind;if(makerForm)frameMaker.clearDraft();render();$('shared-count-wrap').hidden = true;
      toast(`${formatBytes(file.size)} → ${formatBytes(optimized.file.size)} WebP로 ${shared ? '공용 자료' : demo ? '탭 임시 보관함' : '내 프레임'}에 추가했어요.`);
    } finally { labelButton(button, 'upload', shared ? (makerForm?'공용 프레임 등록':'최적화 후 공용으로 등록') : '내 프레임 등록'); }
  }
  async function prepareFrame(form,shared){
    const makerForm=form===$('frame-form'),input=$(makerForm?'frame-upload-file':'shared-file'),file=input.files[0],previous=drafts.get(form);drafts.delete(form);
    if(!file)return;
    const chosen=makerForm?frameMaker.selection():{frameFormat:$('shared-format').value};
    try{const result=await frameUpload.edit(file,{...chosen,lockLayout:true,placement:previous?.source===file?previous.placement:undefined});drafts.set(form,{...result,...(makerForm?frameMaker.selection():{}),source:file});if(makerForm)await frameMaker.setDraft(result);toast('배치를 적용했어요. 미리보기를 확인하고 등록해 주세요.');}
    catch(error){if(error.name!=='AbortError')throw error;if(previous?.source===file)drafts.set(form,previous);else{input.value='';input.dispatchEvent(new Event('file-label-update'));}}
  }
  for(const shared of [false,true]){
    const form=$(shared?'shared-form':'frame-form'),input=$(shared?'shared-file':'frame-upload-file'),format=$(shared?'shared-format':'frame-upload-format');
    input.addEventListener('change',()=>{if(!shared||$('shared-kind').value==='frame')run(()=>prepareFrame(form,shared));});
    format.addEventListener('change',()=>{drafts.delete(form);if(input.files[0])run(()=>prepareFrame(form,shared));});
    const preview=element('button','위치 다시 조절','text-button');preview.type='button';preview.onclick=()=>run(()=>prepareFrame(form,shared));const actions=element('div','','upload-placement-actions');actions.append(preview);form.append(actions);const syncAction=()=>{actions.hidden=!input.files[0]||(shared&&$('shared-kind').value!=='frame');};input.addEventListener('change',syncAction);input.addEventListener('file-label-update',syncAction);form.addEventListener('reset',()=>queueMicrotask(syncAction));syncAction();
    if(shared)document.querySelectorAll('[data-library-target="shared-kind"]').forEach(tab=>tab.addEventListener('click',()=>{preview.hidden=$('shared-kind').value!=='frame';drafts.delete(form);}));
    preview.hidden=shared&&$('shared-kind').value!=='frame';
  }
  async function template(count) {
    await document.fonts.ready;const g=frameMaker.geometry(),c=document.createElement('canvas');c.width=g.width;c.height=g.height;drawLayoutGuide(c,g);const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));if(blob)downloadBlob(await printPNG(blob),`chalkak-${count}cuts-${g.width}x${g.height}-guide.png`);
  }
  for(const id of ['template-format','frame-upload-format','shared-format'])$(id).replaceChildren(...FRAME_SIZES.map(s=>Object.assign(document.createElement('option'),{value:s.id,textContent:s.name})));
  frameMaker=createFrameMaker({onChange:(selection,{reposition}={})=>{const form=$('frame-form'),draft=drafts.get(form);if(reposition){drafts.delete(form);if($('frame-upload-file').files[0])run(()=>prepareFrame(form,makerShared));}else if(draft)drafts.set(form,{...draft,...selection});},onDownload:count=>run(()=>template(count))});
  function syncSharedKind(){const frame=$('shared-kind').value==='frame';$('shared-frame-maker-launch').hidden=!frame;$('shared-form').hidden=frame;$('shared-count-wrap').hidden=true;}
  function openMaker(shared=false,saved){
    if(shared&&!isAdmin())throw new Error('운영자 전용입니다.');
    $('frame-form').reset();drafts.delete($('frame-form'));makerShared=shared;currentFrameDraftId=saved?.id||null;
    $('frame-maker-title').textContent=shared?'공용 프레임 만들기·추가':'프레임 만들기·추가';document.querySelector('label[for=frame-upload-name]').textContent=shared?'공용 프레임 이름':'내 프레임 이름';$('upload-frame').textContent=shared?'공용 프레임 등록':'내 프레임 등록';$('add-palette').textContent=shared?'공용 단색 프레임 등록':'단색 프레임 등록';frameMaker.begin();
    if(saved){frameMaker.restore(saved.config);$('frame-upload-name').value=saved.name;}
    $('frame-draft-status').textContent=saved?'저장한 배치를 불러왔어요. 완성 이미지를 첨부해 등록하세요.':'배치만 저장합니다. 제작한 이미지는 나중에 첨부할 수 있어요.';
    $('frame-maker').showModal();$('maker-scroll').scrollTop=0;
  }
  $('add-palette').addEventListener('click',()=>run(async()=>{const name=$('palette-name').value.trim();if(!name)return toast('프레임 이름을 입력해 주세요.');if(makerShared&&!isAdmin())throw new Error('운영자 전용입니다.');const value={name,bg:$('palette-bg').value,ink:paletteDefaultInk($('palette-bg').value)};const asset=demo?{...value,id:crypto.randomUUID(),kind:'palette',...(makerShared?{shared:true,active:true}:{})}:makerShared?await cloud.saveSharedPalette(value):await cloud.savePalette(getUser().uid,value);makerShared?sharedAdded(asset):added(asset);$('palette-name').value='';toast(makerShared?'모든 교사에게 제공할 단색 프레임을 등록했어요.':'단색 프레임을 등록했어요.');}));
  document.querySelectorAll('[data-library-kind]').forEach(b=>b.onclick=()=>{const id=b.dataset.libraryTarget;$(id).value=b.dataset.libraryKind;document.querySelectorAll(`[data-library-target="${id}"]`).forEach(tab=>tab.setAttribute('aria-selected',String(tab===b)));syncSharedKind();render();});
  syncSharedKind();
  $('open-frame-maker').addEventListener('click',()=>openMaker());$('open-shared-frame-maker').onclick=()=>run(()=>openMaker(true)); $('close-frame-maker').addEventListener('click',()=>$('frame-maker').close());
  $('frame-form').addEventListener('submit', e => { e.preventDefault(); run(()=>upload(e.target,makerShared)); });
  $('shared-form').addEventListener('submit', e => { e.preventDefault(); run(()=>upload(e.target,true)); });
  $('shared-kind').addEventListener('change',syncSharedKind);
  $('close-library-preview').addEventListener('click', () => $('library-preview').close());
  labelButton($('upload-frame'),'upload','최적화 후 내 프레임 추가'); labelButton($('upload-shared'),'upload','최적화 후 공용으로 등록');
  return { render };
}

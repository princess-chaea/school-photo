import {createFrameMaker} from './frame-maker.js';
import {renderFrameGroups} from './frame-groups.js';
import {FRAME_SIZES} from './frame-sizes.js';
import { DEFAULT_FRAMES, DEFAULT_STICKERS, templateGeometry, downloadBlob } from './core.js';
import { optimizeDesign, formatBytes } from './optimize.js';
import { labelButton } from './icons.js';
import { printPNG } from './print-png.js';
import { paintFramePreview } from './frame-preview.js';
import { createFrameUpload } from './frame-upload.js';
import * as cloud from './cloud.js';
const $ = id => document.getElementById(id);
const LABELS = { frame: '프레임', palette: '단색 프레임', sticker: '꾸미기 이미지', logo: '학교 로고' };
export function createLibraries({ getAssets, getShared, getUser, demo, run, added, sharedAdded, sharedChanged, removePrivate, toast }) {
  const frameUpload=createFrameUpload(), drafts=new WeakMap();let makerShared=false,frameMaker;
  const designFilters=document.createElement('div');designFilters.className='sticker-library-filters';designFilters.innerHTML='<label>디자인 검색<input type="search" placeholder="이름으로 찾기" data-design-search></label><label>테마<select data-design-category><option>전체</option></select></label>';$('asset-library').before(designFilters);
  const designSearch=designFilters.querySelector('input'),designCategory=designFilters.querySelector('select');designSearch.oninput=render;designCategory.onchange=render;
  function element(tag, value, className = '') { const el = document.createElement(tag); el.textContent = value; el.className = className; return el; }
  function isAdmin() { return cloud.isSiteAdmin(getUser()); }
  const framePreview=document.createElement('canvas');framePreview.hidden=true;framePreview.style.cssText='max-width:100%;max-height:60dvh;object-fit:contain';$('library-preview-image').after(framePreview);
  const frameEvent=asset=>({title:'',school:'',logo:'',schedule:'',frames:[{...asset,overlay:asset.url,bg:asset.bg||'#fffdf6',ink:asset.ink||'#34372f'}]});
  function showAsset(asset) {
    if (!asset.url) return; $('library-preview-title').textContent = asset.name; $('library-preview-image').src = asset.url;$('library-preview-image').hidden=asset.kind==='frame';framePreview.hidden=asset.kind!=='frame';if(asset.kind==='frame')paintFramePreview(framePreview,frameEvent(asset),{count:asset.layoutCount||4,orientation:asset.orientation,maxDimension:1100}).catch(()=>{});
    $('library-preview-info').textContent = [asset.layoutCount ? `${asset.layoutCount}컷 전용` : '', asset.width ? `${asset.width} × ${asset.height}px` : '', asset.optimizedBytes ? `WebP · ${formatBytes(asset.optimizedBytes)}` : ''].filter(Boolean).join(' · ');
    $('library-preview').showModal();
  }
  function assetCard(asset, manage = false) {
    const card = element('article', '', 'asset-card'), image = element('button', '', 'asset-image library-image'); image.type = 'button'; image.setAttribute('aria-label', `${asset.name} 크게 보기`);
    if(asset.kind==='frame'&&asset.url){const sample=document.createElement('canvas');sample.className='palette-preview';image.append(sample);paintFramePreview(sample,frameEvent(asset),{count:asset.layoutCount||4,orientation:asset.orientation,maxDimension:360}).catch(()=>{});image.onclick=()=>showAsset(asset);}
    else if (asset.url) { const img = new Image(); img.src = asset.url; img.alt = asset.name; img.loading='lazy';image.append(img); image.addEventListener('click', () => showAsset(asset)); }
    else { const sample=document.createElement('canvas'); sample.className='palette-preview'; sample.setAttribute('aria-label',asset.name+' 4컷 예시'); image.append(sample); paintFramePreview(sample,{title:'',school:'',logo:'',schedule:'',frames:[asset]}); image.disabled=true; }
    const info = element('div', '', 'asset-info'); info.append(element('span', asset.base ? '기본' : asset.shared ? (asset.active ? '공용' : '공용 · 노출 중지') : '내 자료', `library-source ${asset.shared ? 'public' : ''}`), element('strong', asset.name), element('p', `${LABELS[asset.kind]}${asset.layoutCount ? ` · ${asset.layoutCount}컷 전용` : asset.preserveAspect ? ' · 기존 공통 배치' : ''}`));
    if (asset.layoutCount || asset.preserveAspect) { const g = templateGeometry(asset.layoutCount || 4, asset.orientation,asset.frameFormat); info.append(element('p', `제작 규격 ${g.width} × ${g.height}px`)); }
    if (asset.optimizedBytes) info.append(element('p', `WebP · ${formatBytes(asset.optimizedBytes)}`));
    if (manage && isAdmin()) { const b = element('button', asset.active ? '공용 노출 중지' : '공용 다시 표시', 'text-button'); b.type = 'button'; b.addEventListener('click', () => run(async () => { await cloud.setSharedActive(asset.id, !asset.active); sharedChanged(asset.id, !asset.active); toast(asset.active ? '새 선택 목록에서 숨겼어요. 기존 행사의 파일은 유지돼요.' : '다시 공용 목록에 표시했어요.'); })); info.append(b); }
    else if (!asset.base && !asset.shared) { const b = element('button', '삭제', 'text-button danger'); b.type = 'button'; b.addEventListener('click', () => run(() => removePrivate(asset))); info.append(b); }
    card.append(image, info); return card;
  }
  function render() {
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
      prepared=draft.file;metadata=draft;
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
    try{const result=await frameUpload.edit(file,{...chosen,lockLayout:true,placement:previous?.source===file?previous.placement:undefined});drafts.set(form,{...result,source:file});if(makerForm)await frameMaker.setDraft(result);toast('배치를 적용했어요. 미리보기를 확인하고 등록해 주세요.');}
    catch(error){if(error.name!=='AbortError')throw error;if(previous?.source===file)drafts.set(form,previous);else input.value='';}
  }
  for(const shared of [false,true]){
    const form=$(shared?'shared-form':'frame-form'),input=$(shared?'shared-file':'frame-upload-file'),format=$(shared?'shared-format':'frame-upload-format');
    input.addEventListener('change',()=>{if(!shared||$('shared-kind').value==='frame')run(()=>prepareFrame(form,shared));});
    format.addEventListener('change',()=>{drafts.delete(form);if(input.files[0])run(()=>prepareFrame(form,shared));});
    const preview=element('button','위치 다시 조절','text-button');preview.type='button';preview.onclick=()=>run(()=>prepareFrame(form,shared));input.parentElement.append(preview);
    if(shared)document.querySelectorAll('[data-library-target="shared-kind"]').forEach(tab=>tab.addEventListener('click',()=>{preview.hidden=$('shared-kind').value!=='frame';drafts.delete(form);}));
    preview.hidden=shared&&$('shared-kind').value!=='frame';
  }
  async function template(count, guide) {
    await document.fonts.ready; const base=templateGeometry(count,$('template-orientation').value,$('template-format').value),selection=frameMaker.selection(),g={...base,slots:selection.photoSlots.map(s=>({x:s.x*base.width,y:s.y*base.height,w:s.w*base.width,h:s.h*base.height}))}, c = document.createElement('canvas'); c.width = g.width; c.height = g.height; const ctx = c.getContext('2d'); ctx.fillStyle = '#fffdf6'; ctx.fillRect(0,0,c.width,c.height);
    g.slots.forEach((slot,i) => { if (!guide) ctx.clearRect(slot.x,slot.y,slot.w,slot.h); else { ctx.fillStyle = '#dae3cf'; ctx.fillRect(slot.x,slot.y,slot.w,slot.h); ctx.fillStyle = '#71875c'; ctx.font = '24px KerisBaeum, Arial'; ctx.textAlign = 'center'; ctx.fillText(`사진 ${i+1} · ${slot.w} × ${slot.h}px`,slot.x+slot.w/2,slot.y+slot.h/2); } });
    if (guide) { ctx.fillStyle = '#78905c'; ctx.textAlign = 'center'; ctx.font = '23px KerisBaeum, Arial'; ctx.fillText('상단 로고·문구 영역',g.width/2,g.brandAreas.top.y+g.brandH/2); ctx.fillText('하단 로고·문구 영역',g.width/2,g.brandAreas.bottom.y+g.brandH/2); ctx.font = '16px KerisBaeum, Arial'; ctx.fillText('이 가이드 레이어는 최종 저장 전에 숨겨 주세요.',g.width/2,g.height-40); }
    const blob = await new Promise(resolve => c.toBlob(resolve,'image/png')); if (blob) downloadBlob(await printPNG(blob),`chalkak-${count}cuts-${g.width}x${g.height}-${guide?'guide':'blank'}.png`);
  }
  for(const id of ['template-format','frame-upload-format','shared-format'])$(id).replaceChildren(...FRAME_SIZES.map(s=>Object.assign(document.createElement('option'),{value:s.id,textContent:s.name})));
  frameMaker=createFrameMaker({onChange:()=>{const form=$('frame-form');drafts.delete(form);if(frameMaker.selection().kind==='image'&&$('frame-upload-file').files[0])run(()=>prepareFrame(form,makerShared));},onDownload:(count,guide)=>run(()=>template(count,guide))});
  function syncSharedKind(){const frame=$('shared-kind').value==='frame';$('shared-frame-maker-launch').hidden=!frame;$('shared-form').hidden=frame;$('shared-count-wrap').hidden=true;}
  function openMaker(shared=false){if(shared&&!isAdmin())throw new Error('운영자 전용입니다.');if(makerShared!==shared){$('frame-form').reset();drafts.delete($('frame-form'));frameMaker.clearDraft();}makerShared=shared;$('frame-maker-title').textContent=shared?'공용 프레임 만들기·추가':'프레임 만들기·추가';document.querySelector('label[for=frame-upload-name]').textContent=shared?'공용 프레임 이름':'내 프레임 이름';$('upload-frame').textContent=shared?'공용 프레임 등록':'내 프레임 등록';$('add-palette').textContent=shared?'공용 단색 프레임 등록':'단색 프레임 등록';frameMaker.begin();$('frame-maker').showModal();}
  $('add-palette').addEventListener('click',()=>run(async()=>{const name=$('palette-name').value.trim();if(!name)return toast('프레임 이름을 입력해 주세요.');if(makerShared&&!isAdmin())throw new Error('운영자 전용입니다.');const value={name,bg:$('palette-bg').value,ink:$('palette-ink').value};const asset=demo?{...value,id:crypto.randomUUID(),kind:'palette',...(makerShared?{shared:true,active:true}:{})}:makerShared?await cloud.saveSharedPalette(value):await cloud.savePalette(getUser().uid,value);makerShared?sharedAdded(asset):added(asset);$('palette-name').value='';toast(makerShared?'모든 교사에게 제공할 단색 프레임을 등록했어요.':'단색 프레임을 등록했어요.');}));
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

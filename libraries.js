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
  const frameUpload=createFrameUpload();
  function element(tag, value, className = '') { const el = document.createElement(tag); el.textContent = value; el.className = className; return el; }
  function isAdmin() { return cloud.isSiteAdmin(getUser()); }
  function showAsset(asset) {
    if (!asset.url) return; $('library-preview-title').textContent = asset.name; $('library-preview-image').src = asset.url;
    $('library-preview-info').textContent = [asset.layoutCount ? `${asset.layoutCount}컷 전용` : '', asset.width ? `${asset.width} × ${asset.height}px` : '', asset.optimizedBytes ? `WebP · ${formatBytes(asset.optimizedBytes)}` : ''].filter(Boolean).join(' · ');
    $('library-preview').showModal();
  }
  function assetCard(asset, manage = false) {
    const card = element('article', '', 'asset-card'), image = element('button', '', 'asset-image library-image'); image.type = 'button'; image.setAttribute('aria-label', `${asset.name} 크게 보기`);
    if (asset.url) { const img = new Image(); img.src = asset.url; img.alt = asset.name; image.append(img); image.addEventListener('click', () => showAsset(asset)); }
    else { const sample=document.createElement('canvas'); sample.className='palette-preview'; sample.setAttribute('aria-label',asset.name+' 4컷 예시'); image.append(sample); paintFramePreview(sample,{title:'',school:'',logo:'',schedule:'',frames:[asset]}); image.disabled=true; }
    const info = element('div', '', 'asset-info'); info.append(element('span', asset.base ? '기본' : asset.shared ? (asset.active ? '공용' : '공용 · 노출 중지') : '내 자료', `library-source ${asset.shared ? 'public' : ''}`), element('strong', asset.name), element('p', `${LABELS[asset.kind]}${asset.layoutCount ? ` · ${asset.layoutCount}컷 전용` : ''}`));
    if (asset.layoutCount) { const g = templateGeometry(asset.layoutCount, asset.orientation); info.append(element('p', `제작 규격 ${g.width} × ${g.height}px`)); }
    if (asset.optimizedBytes) info.append(element('p', `WebP · ${formatBytes(asset.optimizedBytes)}`));
    if (manage && isAdmin()) { const b = element('button', asset.active ? '공용 노출 중지' : '공용 다시 표시', 'text-button'); b.type = 'button'; b.addEventListener('click', () => run(async () => { await cloud.setSharedActive(asset.id, !asset.active); sharedChanged(asset.id, !asset.active); toast(asset.active ? '새 선택 목록에서 숨겼어요. 기존 행사의 파일은 유지돼요.' : '다시 공용 목록에 표시했어요.'); })); info.append(b); }
    else if (!asset.base && !asset.shared) { const b = element('button', '삭제', 'text-button danger'); b.type = 'button'; b.addEventListener('click', () => run(() => removePrivate(asset))); info.append(b); }
    card.append(image, info); return card;
  }
  function render() {
    const own = getAssets(), shared = getShared().filter(a => a.active);
    const frames = [...DEFAULT_FRAMES.map(f => ({ ...f, kind: 'palette', base: true })), ...shared.filter(a => a.kind === 'frame'), ...own.filter(a => ['frame','palette'].includes(a.kind))];
    const designs = [...DEFAULT_STICKERS.filter(s => s.url).map(s => ({ ...s, kind: 'sticker', base: true })), ...shared.filter(a => a.kind === 'sticker'), ...own.filter(a => ['logo','sticker'].includes(a.kind))];
    $('frame-count').textContent = frames.length; $('asset-count').textContent = designs.length;
    $('frame-library').replaceChildren(...frames.map(a => assetCard(a))); $('asset-library').replaceChildren(...designs.map(a => assetCard(a)));
    $('shared-library').replaceChildren(...getShared().map(a => assetCard(a, true)));
    if (!getShared().length) $('shared-library').append(element('div', '첫 번째 공용 스티커나 프레임을 등록해 보세요.', 'empty-state'));
    $('shared-tab').hidden = !isAdmin(); if (!isAdmin()) $('shared-view').hidden = true;
  }
  async function upload(form, shared = false) {
    const kind = shared ? $('shared-kind').value : 'frame';
    const name = $(shared ? 'shared-name' : 'frame-upload-name').value.trim(), input = $(shared ? 'shared-file' : 'frame-upload-file'), file = input.files[0];
    if (!file || !name) throw new Error('이름과 이미지를 선택해 주세요.');
    if (shared && !isAdmin()) throw new Error('운영자 전용입니다.');
    let layoutCount = kind === 'frame' ? Number($(shared ? 'shared-count' : 'frame-upload-count').value) : 0;
    let orientation=$(shared ? 'shared-orientation' : 'frame-upload-orientation').value; let prepared=file, photoSlots;
    if(kind==='frame'){try { const result=await frameUpload.edit(file,{count:layoutCount,orientation});prepared=result.file;layoutCount=result.count;orientation=result.orientation;photoSlots=result.photoSlots; } catch(error) {if(error.name==='AbortError')return;throw error;}}
    const button = $(shared ? 'upload-shared' : 'upload-frame'); labelButton(button, 'refresh', 'WebP로 최적화 중…');
    try {
      const optimized = await optimizeDesign(prepared, kind, { layoutCount, orientation, photoSlots });
      let asset;
      if (demo) { const url = await new Promise((resolve,reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(optimized.file); }); asset = { id: crypto.randomUUID(), name, kind, url, ...optimized.metadata }; }
      else asset = shared ? await cloud.uploadSharedAsset(optimized.file, kind, name, optimized.metadata) : await cloud.uploadAsset(getUser().uid, optimized.file, kind, name, optimized.metadata);
      shared ? sharedAdded(asset) : added(asset); form.reset(); $('shared-count-wrap').hidden = $('shared-kind').value !== 'frame';
      toast(`${formatBytes(file.size)} → ${formatBytes(optimized.file.size)} WebP로 ${shared ? '공용 자료' : demo ? '탭 임시 보관함' : '내 프레임'}에 추가했어요.`);
    } finally { labelButton(button, 'upload', shared ? '최적화 후 공용으로 등록' : '최적화 후 내 프레임 추가'); }
  }
  async function template(count, guide) {
    await document.fonts.ready; const g = templateGeometry(count, $('template-orientation').value), c = document.createElement('canvas'); c.width = g.width; c.height = g.height; const ctx = c.getContext('2d'); ctx.fillStyle = '#fffdf6'; ctx.fillRect(0,0,c.width,c.height);
    g.slots.forEach((slot,i) => { if (!guide) ctx.clearRect(slot.x,slot.y,slot.w,slot.h); else { ctx.fillStyle = '#dae3cf'; ctx.fillRect(slot.x,slot.y,slot.w,slot.h); ctx.fillStyle = '#71875c'; ctx.font = '24px KerisBaeum, Arial'; ctx.textAlign = 'center'; ctx.fillText(`사진 ${i+1} · ${slot.w} × ${slot.h}px`,slot.x+slot.w/2,slot.y+slot.h/2); } });
    if (guide) { ctx.fillStyle = '#78905c'; ctx.textAlign = 'center'; ctx.font = '23px KerisBaeum, Arial'; ctx.fillText('상단 로고·문구 영역',g.width/2,g.brandAreas.top.y+g.brandH/2); ctx.fillText('하단 로고·문구 영역',g.width/2,g.brandAreas.bottom.y+g.brandH/2); ctx.font = '16px KerisBaeum, Arial'; ctx.fillText('이 가이드 레이어는 최종 저장 전에 숨겨 주세요.',g.width/2,g.height-40); }
    const blob = await new Promise(resolve => c.toBlob(resolve,'image/png')); if (blob) downloadBlob(await printPNG(blob),`chalkak-${count}cuts-${g.width}x${g.height}-${guide?'guide':'blank'}.png`);
  }
  function renderGuides(){ $('template-guides').replaceChildren(...[2,4,6,8].map(count => { const g = templateGeometry(count, $('template-orientation').value), card = element('article','','template-guide-card'); card.append(element('strong',`${count}컷 프레임`),element('p',`${g.width} × ${g.height}px`)); for (const [label,guide] of [['빈 프레임 PNG',false],['가이드 PNG',true]]) { const b = element('button',label,'text-button'); b.type = 'button'; b.addEventListener('click',()=>run(()=>template(count,guide))); card.append(b); } return card; })); }
  renderGuides(); $('template-orientation').addEventListener('change',renderGuides);
  $('open-frame-maker').addEventListener('click',()=>$('frame-maker').showModal()); $('close-frame-maker').addEventListener('click',()=>$('frame-maker').close());
  $('frame-form').addEventListener('submit', e => { e.preventDefault(); run(()=>upload(e.target)); });
  $('shared-form').addEventListener('submit', e => { e.preventDefault(); run(()=>upload(e.target,true)); });
  $('shared-kind').addEventListener('change', () => $('shared-count-wrap').hidden = $('shared-kind').value !== 'frame');
  $('close-library-preview').addEventListener('click', () => $('library-preview').close());
  labelButton($('upload-frame'),'upload','최적화 후 내 프레임 추가'); labelButton($('upload-shared'),'upload','최적화 후 공용으로 등록');
  return { render };
}

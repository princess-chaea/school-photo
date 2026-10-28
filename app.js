import {renderFrameGroups} from './frame-groups.js';
import './frame-groups.css';
import {drawFrameOverlay} from './frame-overlay.js';
import {createUsageTracker} from './usage-data.js';
import {createTextStyleControls} from './text-style-controls.js';
import {textColorSettings,paintColoredText,measureStyledText} from './text-colors.js';
import {confirmAction} from './app-dialog.js';
import {fontFamily,fillFontSelect,loadFont} from './fonts.js';
import { decorationHit, rotatedPoint, radians, degrees, rotationDelta } from './decoration-geometry.js';
import { normalizeSharing, callCollectionRelay, httpsURL, collectionName } from './sharing.js';
import { drawLayoutGuide, fitLayoutGuide } from './layout-guide.js';
import { EXPORT_FORMATS, paintExport, createExportPicker } from './export-formats.js';
import { createEditorView } from './editor-view.js';
import { printPNG } from './print-png.js';
import { DEFAULT_EVENT, FILTERS, layout, crop, clamp, normalizeEvent, imageFromURL, downloadBlob, brandingModel, brandEntries, compatibleFrame } from './core.js';
import { drawBranding } from './branding.js';
import { icon, labelButton } from './icons.js';

const $ = id => document.getElementById(id);
const canvas = $('preview'), ctx = canvas.getContext('2d');
const titles = ['어디에 사용할 사진인가요?', '어떤 프레임에 담을까요?', '준비됐나요? 하나, 둘, 셋.', '우리답게, 조금 더 특별하게.', '이 순간을 간직해요.'];
const descriptions = ['용도와 컷 수, 가로·세로 배치를 선택하세요.', '사진을 감쌀 색상이나 행사에 준비된 콜라보·특별 프레임을 선택하세요.', '사진을 찍거나 기기에 있는 사진을 골라주세요.', '사진 위에 스티커와 문구를 자유롭게 놓아보세요.', '완성 이미지는 내 기기에만 저장돼요.'];
const nextLabels = ['프레임 선택으로', '촬영 시작', '꾸미기로', '저장·공유로'];
let state = { step: 0, count: 4, frame: 0, orientation: 'portrait', photos: Array(4).fill(null), selectedPhoto: 0, selectedDeco: null, filter: 'original', decorations: [], event: structuredClone(DEFAULT_EVENT) };
let stream = null, facing = 'user', busy = false, starting = false, cameraEpoch = 0, captureEpoch = 0, toastTimeout, downloadURL;
let photoDate = new Date(), assetImages = new Map(), failedAssets = new Set();
const pointers = new Map();
let gesture = null, deletedDecoration = null, eventId='', submitting=false, lastSubmission=null,lastDownloadedSignature=null;
const usage=createUsageTracker(async kind=>{const{recordPublicUsage}=await import('./public-event.js');await recordPublicUsage(eventId,kind);});
let blocked = false, assetReady = Promise.resolve();
const editDialog = $('edit-dialog'), previewHome = canvas.parentElement, toolsHome = $('decoration-tools').parentElement;
const cropCanvas = $('crop-preview'), cropPointers = new Map();
let cropGesture = null;
const editorView=createEditorView(editDialog,canvas);
const saveCanvas=$('save-preview');
for(const group of [...new Set(EXPORT_FORMATS.map(f=>f.group))]){const optgroup=document.createElement('optgroup');optgroup.label=group;for(const f of EXPORT_FORMATS.filter(f=>f.group===group))optgroup.append(Object.assign(document.createElement('option'),{value:f.id,textContent:f.name}));$('export-format').append(optgroup);}
$('export-format').value='print-4x6';
function changePurpose(){ state.photos.forEach(p=>{if(p){p.zoom=1;p.panX=0;p.panY=0;}}); renderChoices(); renderThumbnails(); render(); }
$('export-format').addEventListener('change',changePurpose);
const exportPicker=createExportPicker(()=>canvas,changePurpose,preset=>spaceGeometryFor(preset));
const studentTextStyles=createTextStyleControls($('student-text-style'),{
 getState:()=>{const d=state.decorations[state.selectedDeco];return d?.type==='text'?{key:d.id,label:'문구',text:d.text,settings:{...d,...textColorSettings(d.text,d)},baseSize:.055,minSize:.015,maxSize:.35,ink:'#ffffff'}:null;},
 onChange:part=>{const d=state.decorations[state.selectedDeco];if(d?.type==='text'){Object.assign(d,part);updateAdjustment();render();}}
});
function outputFormat(){return (state.event.frames[state.frame]?.layoutCount || state.event.frames[state.frame]?.preserveAspect) ? $('export-format').value : 'original';}

function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimeout); toastTimeout = setTimeout(() => $('toast').classList.remove('visible'), 4500); }
function createButton(className, text, handler) { const el = document.createElement('button'); el.className = className; el.textContent = text; el.type = 'button'; el.addEventListener('click', handler); return el; }
function renderChoices() {
  if (!state.event.frames.some(f => !f.layoutCount || (f.orientation || 'portrait') === state.orientation)) state.orientation = state.event.frames[0].orientation || 'portrait';
  if (!state.event.frames.some(f => compatibleFrame(f,state.count,state.orientation))) { state.count = [2,4,6,8].find(n => state.event.frames.some(f => compatibleFrame(f,n,state.orientation))); state.photos = Array(state.count).fill(null); }
  if (!state.event.frames[state.frame] || !compatibleFrame(state.event.frames[state.frame], state.count, state.orientation)) state.frame = state.event.frames.findIndex(f => compatibleFrame(f,state.count,state.orientation));
  $('cut-options').replaceChildren();
  for (const count of [2, 4, 6, 8]) {
    const button = createButton(`cut-option ${state.count === count ? 'selected' : ''}`, '', async () => {
      if (count !== state.count && state.photos.some(Boolean) && !await confirmAction('컷 수를 바꾸면 촬영한 사진과 꾸미기가 초기화돼요. 바꿀까요?')) return;
      if (count !== state.count) { state.count = count; state.photos = Array(count).fill(null); state.decorations = []; deletedDecoration=null;state.selectedPhoto = 0; state.selectedDeco = null; }
      renderChoices(); renderThumbnails(); render();
    });
    button.setAttribute('aria-pressed', String(state.count === count));
    button.disabled = !state.event.frames.some(f => compatibleFrame(f, count, state.orientation));
    if (button.disabled) button.title = '이 컷 수에 사용할 행사 프레임이 없어요.';
    const cols = state.orientation === 'landscape' ? ({2:2,4:2,6:3,8:4}[count]) : count === 2 ? 1 : 2;
    const strip = document.createElement('canvas'); strip.width=100;strip.height=80;strip.className='cut-layout-guide';strip.setAttribute('aria-hidden','true');
    const preset=EXPORT_FORMATS.find(f=>f.id===$('export-format').value)||{};
    const frame=state.event.frames.find(f=>compatibleFrame(f,count,state.orientation));
    drawLayoutGuide(strip,spaceGeometryFor(preset,count,frame));
    const title = document.createElement('strong'); title.textContent = `${count}컷`;
    const desc = document.createElement('small'); desc.textContent = `${cols} × ${count / cols}`;
    button.append(strip, title, desc);
    if (state.count === count) { const check = document.createElement('span'); check.className = 'check'; check.textContent = '✓'; button.append(check); }
    $('cut-options').append(button);
  }
  $('orientation-options').replaceChildren(...[['portrait','세로 구성'],['landscape','가로 구성']].map(([value,label]) => { const b = createButton(state.orientation === value ? 'selected' : '',label,()=>{state.orientation=value;state.photos.forEach(p=>{if(p){p.zoom=1;p.panX=0;p.panY=0;}});renderChoices();renderThumbnails();render();});b.setAttribute('aria-pressed',String(state.orientation===value));b.disabled=!state.event.frames.some(f=>!f.layoutCount||(f.orientation||'portrait')===value);return b; }));
  renderFrameGroups($('frame-options'),state.event.frames,{student:true,filter:frame=>compatibleFrame(frame,state.count,state.orientation),renderCard:(frame,index,group)=>{
    const button=createButton(`frame-option ${state.frame===index?'selected':''}`,'',()=>{state.frame=index;renderChoices();render();});button.setAttribute('aria-pressed',String(state.frame===index));button.setAttribute('aria-label',frame.name+' 프레임 선택');
    if(group==='base'){const dot=document.createElement('span');dot.className='palette-dot';dot.style.background=frame.bg;button.append(dot);}
    else{
      const sample=document.createElement('span');sample.className='color-sample frame-layout-sample';sample.style.background=frame.bg;
      const guide=document.createElement('canvas');guide.width=160;guide.height=120;drawLayoutGuide(guide,spaceGeometryFor(EXPORT_FORMATS.find(f=>f.id===$('export-format').value)||{},state.count,frame),{background:frame.bg,ink:frame.ink});sample.append(guide);
      if(frame.overlay){const image=new Image();image.src=frame.overlay;image.alt='';sample.append(image);}button.append(sample);
    }
    const label=document.createElement('span');label.textContent=frame.name;button.append(label);return button;
  }});
  $('frame-name').textContent = state.event.frames[state.frame].name;
  $('chosen-purpose').textContent = $('export-format').selectedOptions[0].textContent+' · '+state.count+'컷 · '+(state.orientation==='landscape'?'가로 배치':'세로 배치');
  renderFilterChoices();
  renderStickerChoices();
}
function renderStickerChoices(){
  const picker=$('sticker-category'),previous=picker.value;const category=s=>s.category||'기타';
  picker.replaceChildren(...['전체',...new Set(state.event.stickers.map(category))].map(value=>Object.assign(document.createElement('option'),{value,textContent:value})));picker.value=[...picker.options].some(o=>o.value===previous)?previous:'전체';
  $('no-stickers').hidden=state.event.stickers.length>0;picker.parentElement.hidden=state.event.stickers.length===0;
  $('sticker-options').replaceChildren();
  state.event.stickers.filter(s=>picker.value==='전체'||category(s)===picker.value).forEach(sticker => {
    const button = createButton('sticker-button', sticker.text || '', () => {
      if (sticker.url && !assetImages.has(sticker.url)) { toast(failedAssets.has(sticker.url) ? '이 이미지를 불러오지 못했어요. 다른 스티커를 골라 주세요.' : '스티커를 불러오는 중이에요. 잠시 후 다시 선택해 주세요.'); return; }
      addDecoration({ type: sticker.url ? 'image' : 'symbol', text: sticker.text || '', url: sticker.url || '', color: '#ffffff' });
    });
    button.setAttribute('aria-label', `${sticker.name} 스티커 추가`);
    if (sticker.url) { const img = document.createElement('img'); img.src = sticker.url; img.alt = ''; img.width = 30; img.height = 30; img.style.objectFit = 'contain'; button.append(img); }
    $('sticker-options').append(button);
  });
}
$('sticker-category').addEventListener('change',renderStickerChoices);
function renderFilterChoices(){
  const list=$('filter-options');list.replaceChildren();const photo=state.photos[state.selectedPhoto]||state.photos.find(Boolean);
  for(const group of [...new Set(FILTERS.map(f=>f.group))]){
    const section=document.createElement('section');section.className='filter-category';const heading=document.createElement('h3');heading.textContent=group;const cards=document.createElement('div');cards.className='filter-cards';
    for(const filter of FILTERS.filter(f=>f.group===group)){
      const button=createButton(`filter-chip ${state.filter===filter.id?'selected':''}`,'',()=>{state.filter=filter.id;renderFilterChoices();render();});button.setAttribute('aria-label',filter.name);button.setAttribute('aria-pressed',String(state.filter===filter.id));
      const preview=document.createElement('canvas');preview.width=96;preview.height=72;preview.setAttribute('aria-hidden','true');const context=preview.getContext('2d');context.filter=filter.css;
      if(photo){const c=crop(photo.image.width,photo.image.height,96,72);context.drawImage(photo.image,c.x,c.y,c.w,c.h,0,0,96,72);}else{context.fillStyle='#a8d6c5';context.fillRect(0,0,96,72);context.fillStyle='#f6b4b9';context.fillRect(48,0,48,72);context.fillStyle='#ffdc7c';context.beginPath();context.arc(48,36,20,0,Math.PI*2);context.fill();}
      const label=document.createElement('span');label.textContent=filter.name;button.append(preview,label);cards.append(button);
    }
    section.append(heading,cards);list.append(section);
  }
}
function canEditDecoration(d){return d&&(editDialog.dataset.tool==='text'?d.type==='text':editDialog.dataset.tool==='stickers'&&d.type!=='text');}
function go(step) {
  if (busy) return;
  if (step >= 3 && !state.photos.every(Boolean)) { toast('모든 칸에 사진을 채워 주세요.'); return; }
  if (state.step === 2 && step !== 2) stopCamera();
  if(step===2)usage.start();if(step===4)usage.complete();
  state.step = step; state.selectedDeco = null; pointers.clear(); gesture = null;
  renderSteps(); render(); updateAdjustment();
  if(step===2&&!$('web-capture-area').hidden&&!stream)startCamera();
  $('step-title').focus({ preventScroll: true });
  window.scrollTo({ top: Math.max(0, document.querySelector('.steps').getBoundingClientRect().top + scrollY - 15), behavior: 'smooth' });
}
function renderSteps() {
  document.body.dataset.step = String(state.step);
  $('step-list').replaceChildren();
  [0,1,2,3,4].forEach((step,index)=>{const li=document.createElement('li');li.className=step===state.step?'active':step<state.step?'done':'';if(step===state.step)li.setAttribute('aria-current','step');const n=document.createElement('span');n.className='step-number';n.textContent=step<state.step?'✓':String(index+1).padStart(2,'0');const label=document.createElement('span');label.className='step-label';label.textContent=['용도','프레임','촬영','꾸미기','저장·공유'][index];li.append(n,label);$('step-list').append(li);});
  document.querySelectorAll('.step-content').forEach(el => el.hidden = Number(el.dataset.step) !== state.step);
  $('step-title').textContent = titles[state.step]; $('step-kicker').textContent = `STEP ${String([0,1,2,3,4].indexOf(state.step)+1).padStart(2, '0')} / ${['LAYOUT', 'FRAME', 'CAPTURE', 'DECORATE', 'KEEP'][state.step]}`;
  $('step-description').textContent = descriptions[state.step]; $('step-counter').textContent = `${[0,1,2,3,4].indexOf(state.step)+1} / 5`;
  $('back').hidden = state.step === 0;labelButton($('back'),'back',state.step===4?'꾸미기로 돌아가기':state.step===3?'사진 다시 찍기':'이전'); $('next').hidden = state.step===4;$('restart-corner').hidden=state.step!==4;
  $('expand-preview').hidden = state.step !== 3 && state.step !== 4;
  $('change-layout').hidden = state.step !== 3;
  labelButton($('next'), ['frame', 'camera', 'sticker', 'check'][state.step] || 'check', state.step===3?'저장·공유로':state.step===2?'꾸미기로':nextLabels[state.step] || '', true);
  $('preview-hint').textContent = state.step === 3 ? '도구 탭을 눌러 원하는 기능을 선택해요' : state.step === 4 ? '오늘의 우리, 오래 간직해요' : '나만의 한 장이 만들어지는 중';
  updateButtons();
}
function updateCameraGeometry(){const slot=currentGeometry().slots[state.selectedPhoto]||currentGeometry().slots[0],shell=$('camera-shell'),parent=$('web-capture-area');if(!slot||parent.hidden)return;const ratio=slot.w/slot.h,maxH=Math.max(130,Math.min(innerHeight*.34,420)),width=Math.min(parent.clientWidth,maxH*ratio);shell.style.width=width+'px';shell.style.height=width/ratio+'px';$('web-capture-guide').textContent=(state.selectedPhoto+1)+'번 컷 · 사진 칸과 같은 비율·구도로 저장돼요.';}
window.addEventListener('resize',updateCameraGeometry);
function updateButtons() {
  $('next').disabled = blocked || busy || (state.step === 2 && !state.photos.every(Boolean)); $('back').disabled = busy;
  $('capture').disabled = !stream || busy; $('auto-capture').disabled = !stream || busy || state.photos.every(Boolean);
  const remaining=state.photos.filter(p=>!p).length;$('auto-capture').textContent=remaining?`남은 ${remaining}컷 연속 촬영`:'모든 컷 촬영 완료';
  $('camera-flip').disabled = busy || starting; $('photo-upload').disabled = busy; $('native-capture').disabled=busy; $('native-photo').disabled=busy; $('demo').disabled = busy;
  updateCameraGeometry();
  $('native-capture-status').textContent=(state.selectedPhoto+1)+'번 컷 '+(state.photos[state.selectedPhoto]?'다시 찍기':'촬영 준비')+' · '+state.photos.filter(Boolean).length+'/'+state.count+'장 등록';
  $('cancel-capture').hidden = !busy; $('capture-progress').textContent = `${state.photos.filter(Boolean).length} / ${state.count}`;
}
function renderThumbnails() {
  $('thumbnails').replaceChildren();
  state.photos.forEach((photo, i) => {
    const button = createButton(`thumbnail ${state.selectedPhoto === i ? 'selected' : ''}`, photo ? '' : '+', () => { if (busy) return; state.selectedPhoto = i; state.selectedDeco = null; renderThumbnails(); updateAdjustment(); render(); });
    button.disabled = busy; button.setAttribute('aria-label', `${i + 1}번 사진 ${photo ? '선택 및 재촬영' : '빈 칸 선택'}`); button.setAttribute('aria-pressed', String(state.selectedPhoto === i));
    if (photo) { const img = document.createElement('img'); img.src = photo.image.src; img.alt = ''; button.append(img); }
    const badge = document.createElement('span'); badge.textContent = String(i + 1).padStart(2, '0'); button.append(badge); $('thumbnails').append(button);
  }); updateButtons();
}
function fitText(text, x, y, maxWidth, size, color, weight = '500',font='baeum') {
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; let actual = size;
  do { ctx.font = `${weight} ${actual}px ${fontFamily(font)}, Arial, "Malgun Gothic", sans-serif`; if (ctx.measureText(text).width <= maxWidth) break; actual -= 1; } while (actual > 9);
  ctx.fillText(text, x, y, maxWidth);
}
function branding(g, frame) {
  drawBranding(ctx, state.event, g, assetImages, frame.ink);
}
function decorationBox(d, g) {
  const font = d.size * g.width; let w, h;
  if (d.type === 'image') { const img = assetImages.get(d.url); h = font; w = img ? font * img.width / img.height : font; }
  else { ctx.font = `700 ${font}px ${fontFamily(d.font)}, Arial, "Malgun Gothic", sans-serif`; const metrics=measureStyledText(ctx,d.text,d);w=metrics.width;h=metrics.maxSize*1.2; }
  return { x: d.x * g.width, y: d.y * g.height, w: Math.max(w, 20), h: Math.max(h, 20), font };
}
function geometryFor(preset, count=state.count, frame=state.event.frames[state.frame]) {
  return layout(count,state.event,{frame,orientation:state.orientation,width:preset.width,height:preset.height,padding:preset.padding,caption:Boolean($('caption').value.trim()),captureDate:$('show-date').checked});
}
function spaceGeometryFor(preset,count=state.count,frame=state.event.frames[state.frame]) { const g=geometryFor(preset,count,frame);return (frame?.layoutCount || frame?.preserveAspect)?fitLayoutGuide(g,preset):g; }
function currentGeometry() { return geometryFor(EXPORT_FORMATS.find(f=>f.id===$('export-format').value)||{}); }
function render(exporting = false) {
  const g = currentGeometry(), frame = state.event.frames[state.frame];
  const space=spaceGeometryFor(EXPORT_FORMATS.find(f=>f.id===$('export-format').value)||{});
  drawLayoutGuide($('layout-space-preview'),space,{background:frame.bg,ink:frame.ink});
  const slot=space.slots[state.selectedPhoto]||space.slots[0],photoArea=space.slots.reduce((sum,s)=>sum+s.w*s.h,0)/(space.width*space.height);
  $('layout-space-summary').textContent=`전체 ${space.width} × ${space.height}px · ${state.count}컷 · 사진 칸 약 ${Math.round(slot.w)} × ${Math.round(slot.h)}px · 사진 영역 ${Math.round(photoArea*100)}%`;
  $('export-format-note').textContent=(frame.layoutCount || frame.preserveAspect)?'이미지 프레임은 원래 디자인을 보존해 선택한 용도에 맞춰 저장해요.':'선택한 용도에 맞춰 처음부터 사진을 크게 배치해요.';
  if (canvas.width !== g.width || canvas.height !== g.height) { canvas.width = g.width; canvas.height = g.height; }
  ctx.filter = 'none'; ctx.fillStyle = frame.bg; ctx.fillRect(0, 0, g.width, g.height);
  g.slots.forEach((slot, i) => {
    const photo = state.photos[i]; ctx.save(); ctx.beginPath(); ctx.rect(slot.x, slot.y, slot.w, slot.h); ctx.clip();
    if (photo) {
      const c = crop(photo.image.width, photo.image.height, slot.w, slot.h, photo.zoom, photo.panX, photo.panY);
      ctx.filter = FILTERS.find(f => f.id === state.filter).css; ctx.drawImage(photo.image, c.x, c.y, c.w, c.h, slot.x, slot.y, slot.w, slot.h);
    } else {
      ctx.fillStyle = state.frame === 1 ? '#3a3d36' : '#e3e7dc'; ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
      ctx.strokeStyle = state.frame === 1 ? '#626959' : '#c5cdb9'; ctx.lineWidth = 1.4; const cx = slot.x + slot.w / 2, cy = slot.y + slot.h / 2;
      ctx.beginPath(); ctx.arc(cx, cy - 25, 30, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.ellipse(cx, cy + 62, 72, 48, 0, Math.PI, Math.PI * 2); ctx.stroke();
      fitText(`YOUR MOMENT ${String(i + 1).padStart(2, '0')}`, cx, slot.y + slot.h - 32, slot.w - 50, 12, '#8f9b80');
    }
    ctx.restore();
  });
  const overlay = assetImages.get(frame.overlay); if (overlay) drawFrameOverlay(ctx,overlay,frame,g);
  branding(g, frame);
  fitText($('caption').value || ' ', g.width / 2, g.footerY + 48, g.width - 80, 23, frame.ink, '700',$('caption-font').value);
  if ($('show-date').checked) fitText(photoDate.toLocaleDateString('sv-SE').replaceAll('-', '. '), g.width / 2, g.footerY + 82, g.width - 80, 13, frame.ink);
  state.decorations.forEach(d => { const b = decorationBox(d, g); ctx.save();ctx.translate(b.x,b.y);ctx.rotate(radians(d.rotation||0)); ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillStyle = d.color; ctx.font = `700 ${b.font}px ${fontFamily(d.font)}, Arial, "Malgun Gothic", sans-serif`; if (d.type === 'image') { const image = assetImages.get(d.url); if (image) ctx.drawImage(image, -b.w / 2, -b.h / 2, b.w, b.h); } else paintColoredText(ctx,d.text,0,0,b.w,d,d.color); ctx.restore(); });
  if (!exporting && state.step === 3 && editDialog.open) {
    if (state.selectedDeco !== null) {
      const d=state.decorations[state.selectedDeco];if(d){const b=decorationBox(d,g),scale=g.width/Math.max(1,canvas.getBoundingClientRect().width),gap=4*scale,h=5*scale;
        ctx.save();ctx.translate(b.x,b.y);ctx.rotate(radians(d.rotation||0));ctx.strokeStyle='#52882d';ctx.lineWidth=1.5*scale;ctx.setLineDash([4*scale,3*scale]);ctx.strokeRect(-b.w/2-gap,-b.h/2-gap,b.w+2*gap,b.h+2*gap);ctx.setLineDash([]);ctx.fillStyle='#c5f564';for(const x of [-1,1])for(const y of [-1,1]){ctx.fillRect(x*(b.w/2+gap)-h,y*(b.h/2+gap)-h,2*h,2*h);ctx.strokeRect(x*(b.w/2+gap)-h,y*(b.h/2+gap)-h,2*h,2*h);}ctx.restore();
        const handle=rotationHandle(b,d,g),edge=rotatedPoint(0,-b.h/2-gap,b,d.rotation||0);ctx.save();ctx.strokeStyle='#52882d';ctx.lineWidth=1.5*scale;ctx.beginPath();ctx.moveTo(edge.x,edge.y);ctx.lineTo(handle.x,handle.y);ctx.stroke();ctx.beginPath();ctx.arc(handle.x,handle.y,14*scale,0,Math.PI*2);ctx.fillStyle='#fffefa';ctx.fill();ctx.stroke();ctx.fillStyle='#415c2c';ctx.font=`${20*scale}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('↻',handle.x,handle.y);ctx.restore();
      }
    }
    else { const s = g.slots[state.selectedPhoto]; ctx.strokeStyle = '#98bb63'; ctx.lineWidth = 5; ctx.strokeRect(s.x + 2, s.y + 2, s.w - 4, s.h - 4); }
  }
  $('preview-layout').textContent = `${state.count} CUTS · ${g.width} × ${g.height}`; $('output-size').textContent = `${g.width} × ${g.height}px · 300dpi`;
  if (!editDialog.open) {canvas.hidden=state.step===4;saveCanvas.hidden=state.step!==4;}
  exportPicker.refresh();
  if(state.step===4){const output=paintExport(canvas,saveCanvas,outputFormat(),frame.bg);$('output-size').textContent=output.width+' × '+output.height+'px · 300dpi';$('export-format-note').textContent=output.width+' × '+output.height+'px · 선택한 용도로 저장해요.';}
  if (editDialog.open && editDialog.dataset.tool === 'photo') renderCrop();
}
function stopCamera() {
  cameraEpoch++; captureEpoch++; busy = false;
  if (stream) stream.getTracks().forEach(t => t.stop()); stream = null;
  $('video').srcObject = null; $('camera-placeholder').hidden = false; $('camera-live').hidden = true; $('countdown').textContent = ''; updateButtons();
}
async function startCamera() {
  if (starting) return;
  if (!navigator.mediaDevices?.getUserMedia) { toast('카메라는 HTTPS 또는 localhost에서 사용할 수 있어요. 사진 선택도 가능해요.'); return; }
  stopCamera(); const epoch = cameraEpoch; starting = true; $('camera-start').disabled = true; $('camera-start').textContent = '카메라 연결 중…'; updateButtons();
  let obtained;
  try {
    obtained = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 1600 }, height: { ideal: 1200 } } });
    if (cameraEpoch !== epoch || state.step !== 2) { obtained.getTracks().forEach(t => t.stop()); return; }
    stream = obtained; $('video').srcObject = stream; $('video').style.transform = facing === 'user' ? 'scaleX(-1)' : 'none'; await $('video').play();
    if (cameraEpoch !== epoch) return;
    $('camera-placeholder').hidden = true; $('camera-live').hidden = false;
    stream.getVideoTracks()[0].addEventListener('ended', () => { if (stream === obtained) { stopCamera(); toast('카메라 연결이 끝났어요. 다시 켜 주세요.'); } });
  } catch (error) { if (obtained) obtained.getTracks().forEach(t => t.stop()); stream = null; $('camera-placeholder').hidden = false; $('camera-live').hidden = true; toast(error.name === 'NotAllowedError' ? '카메라 권한을 허용해 주세요. 내 사진 선택으로도 이용할 수 있어요.' : '카메라를 연결하지 못했어요. 다른 앱에서 사용 중인지 확인해 주세요.'); }
  finally { starting = false; $('camera-start').disabled = false; labelButton($('camera-start'), 'camera', '카메라 켜기'); updateButtons(); }
}
function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function savePhoto(image, index) { state.photos[index] = { image, zoom: 1, panX: 0, panY: 0 }; photoDate = new Date(); renderThumbnails(); render(); }
async function captureOne(index, epoch) {
  for (let n = Number($('timer').value); n > 0; n--) { if (epoch !== captureEpoch || !stream) return false; $('countdown').textContent = String(n); await wait(1000); }
  $('countdown').textContent = ''; if (epoch !== captureEpoch || !stream) return false;
  const video = $('video'); if (!video.videoWidth) throw new Error('카메라 준비 중이에요. 잠시 후 다시 촬영해 주세요.');
  const slot=currentGeometry().slots[index],source=crop(video.videoWidth,video.videoHeight,slot.w,slot.h); const c=document.createElement('canvas'),scale=Math.min(1,1800/Math.max(source.w,source.h));c.width=Math.max(1,Math.round(source.w*scale));c.height=Math.max(1,Math.round(source.h*scale));
  const cc = c.getContext('2d'); if (facing === 'user') { cc.translate(c.width, 0); cc.scale(-1, 1); } cc.drawImage(video,source.x,source.y,source.w,source.h,0,0,c.width,c.height);
  const image = await imageFromURL(c.toDataURL('image/jpeg', .93)); if (epoch !== captureEpoch) return false;
  savePhoto(image, index);usage.record('cameraShots'); $('camera-flash').classList.remove('flash'); void $('camera-flash').offsetWidth; $('camera-flash').classList.add('flash'); return true;
}
async function capture(auto) {
  if (busy || !stream) return;
  busy = true; const epoch = ++captureEpoch; updateButtons(); renderThumbnails();
  const indices = auto ? state.photos.map((p, i) => !p ? i : -1).filter(i => i >= 0) : [state.selectedPhoto];
  if (!indices.length) indices.push(state.selectedPhoto);
  try { for (const index of indices) { state.selectedPhoto = index; renderThumbnails(); if (!await captureOne(index, epoch)) break; if (auto) await wait(350); } if (epoch === captureEpoch) { const empty = state.photos.findIndex(p => !p); if (empty >= 0) state.selectedPhoto = empty; toast(state.photos.every(Boolean) ? '모든 순간을 담았어요. 이제 꾸며볼까요?' : '찰칵! 다음 표정을 준비해요.'); } }
  catch (error) { toast(error.message); }
  finally { if (epoch === captureEpoch) { busy = false; $('countdown').textContent = ''; renderThumbnails(); updateButtons(); if(state.step===2&&state.photos.every(Boolean))go(3); } }
}
function updateAdjustment() {
  const photo = state.photos[state.selectedPhoto]; $('photo-zoom-value').textContent=Math.round((photo?.zoom||1)*100)+'%';
  $('photo-zoom-out').disabled=!photo||photo.zoom<=1;$('photo-zoom-in').disabled=!photo||photo.zoom>=2.5;
  $('delete-decoration').disabled=state.selectedDeco===null;$('rotate-decoration').disabled=state.selectedDeco===null;$('undo-decoration').disabled=!deletedDecoration||state.decorations.length>=40;
  const d = state.decorations[state.selectedDeco]; $('decoration-edit').hidden = !d; if(d?.type==='text')$('text-font').value=d.font||'baeum';
  if(d)$('rotation-value').textContent=Math.round(d.rotation||0)+'°';
  $('selected-text-controls').hidden=d?.type!=='text';if(d?.type==='text'){Object.assign(d,textColorSettings(d.text,d));if($('selected-decoration-text').value!==d.text)$('selected-decoration-text').value=d.text;}studentTextStyles.refresh();
  if (d) { $('decoration-color').value = d.color; $('decoration-color').closest('label').hidden=d.type==='image'; }
}
function renderPhotoPicker() {
  $('photo-picker').replaceChildren();
  state.photos.forEach((photo, i) => {
    const b = createButton(i === state.selectedPhoto ? 'selected' : '', '', () => { state.selectedPhoto = i; state.selectedDeco = null; updateAdjustment(); renderPhotoPicker(); render(); });
    b.setAttribute('aria-label', `${i + 1}번 사진 구도 조정`); b.setAttribute('aria-pressed', String(i === state.selectedPhoto));
    if (photo) { const image = new Image(); image.src = photo.image.src; image.alt = String(i + 1); b.append(image); } else b.textContent = String(i + 1);
    $('photo-picker').append(b);
  });
}
function selectEditorTool(tool) {
  editDialog.dataset.tool = tool;pointers.clear();gesture=null;cropPointers.clear();cropGesture=null;if(!canEditDecoration(state.decorations[state.selectedDeco]))state.selectedDeco=null;if(tool==='filter')renderFilterChoices();
  canvas.hidden = tool === 'photo'; cropCanvas.hidden = tool !== 'photo';
  $('edit-title').textContent = { stickers: '스티커로 꾸미기', text: '마음을 적어요', photo: '사진을 크게 보고 조정해요', filter: '오늘의 분위기' }[tool];
  $('edit-help').textContent = tool === 'photo' ? '사진을 끌어 구도 이동 · 두 손가락 또는 +/−로 확대·축소' : tool==='filter'?'색감 필터를 눌러 비교해요. 모든 사진에 적용되며 원본은 유지돼요.':tool==='text'?'문구를 추가하고 끌어 이동해요. 모서리·두 손가락으로 크기와 회전을 조절해요.':'스티커를 끌어 이동 · 두 손가락으로 크기·회전 · 동그라미로 회전';
  document.querySelectorAll('[data-editor-tool]').forEach(b => { b.classList.toggle('selected', b.dataset.editorTool === tool); b.setAttribute('aria-pressed', String(b.dataset.editorTool === tool)); });
  renderPhotoPicker(); updateAdjustment(); render(); editorView.refresh();
}
function openEditorTool(tool = 'stickers') {
  if (state.step !== 3) return;
  if (!editDialog.open) { $('editor-viewport').prepend(canvas); $('expanded-tools').append($('decoration-tools')); document.body.classList.add('modal-open'); editDialog.showModal(); editorView.reset(); }
  $('expanded-tools').hidden=false;$('toggle-editor-tools').setAttribute('aria-expanded','true');$('toggle-editor-tools').textContent='도구 접기 ⌄';
  selectEditorTool(tool);
}
function closeEditor() {
  if (editDialog.open) editDialog.close();
  editorView.clear(); canvas.hidden = false; previewHome.prepend(canvas); toolsHome.append($('decoration-tools')); document.body.classList.remove('modal-open'); pointers.clear(); cropPointers.clear(); gesture = null; cropGesture = null; render();
}
function renderCrop() {
  const photo = state.photos[state.selectedPhoto]; if (!photo) return;
  const slot = currentGeometry().slots[state.selectedPhoto]; const height = Math.round(1000 * slot.h / slot.w); if (cropCanvas.width !== 1000 || cropCanvas.height !== height) { cropCanvas.width = 1000; cropCanvas.height = height; }
  const cc = cropCanvas.getContext('2d'), c = crop(photo.image.width, photo.image.height, cropCanvas.width, cropCanvas.height, photo.zoom, photo.panX, photo.panY);
  cc.filter = FILTERS.find(f => f.id === state.filter).css; cc.clearRect(0, 0, cropCanvas.width, cropCanvas.height); cc.drawImage(photo.image, c.x, c.y, c.w, c.h, 0, 0, cropCanvas.width, cropCanvas.height); cc.filter = 'none';
}
function cropPoint(e) { const r = cropCanvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * cropCanvas.width / r.width, y: (e.clientY - r.top) * cropCanvas.height / r.height }; }
cropCanvas.addEventListener('pointerdown', e => {
  e.preventDefault(); cropCanvas.setPointerCapture(e.pointerId); const p = cropPoint(e), photo = state.photos[state.selectedPhoto]; cropPointers.set(e.pointerId, p);
  if (cropPointers.size === 1) cropGesture = { mode: 'pan', start: p, x: photo.panX, y: photo.panY, crop: crop(photo.image.width, photo.image.height, cropCanvas.width, cropCanvas.height, photo.zoom, photo.panX, photo.panY) };
  else if (cropPointers.size === 2) { const [a, b] = [...cropPointers.values()]; cropGesture = { mode: 'pinch', distance: distance(a, b), zoom: photo.zoom }; }
});
cropCanvas.addEventListener('pointermove', e => {
  if (!cropPointers.has(e.pointerId) || !cropGesture) return; e.preventDefault(); const p = cropPoint(e), photo = state.photos[state.selectedPhoto]; cropPointers.set(e.pointerId, p);
  if (cropGesture.mode === 'pan') { const c = cropGesture.crop; photo.panX = clamp(cropGesture.x - 2 * (p.x - cropGesture.start.x) * c.w / cropCanvas.width / Math.max(1, photo.image.width - c.w), -1, 1); photo.panY = clamp(cropGesture.y - 2 * (p.y - cropGesture.start.y) * c.h / cropCanvas.height / Math.max(1, photo.image.height - c.h), -1, 1); }
  else if (cropPointers.size === 2) { const [a, b] = [...cropPointers.values()]; photo.zoom = clamp(cropGesture.zoom * distance(a, b) / Math.max(1, cropGesture.distance), 1, 2.5); }
  updateAdjustment(); render();
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) cropCanvas.addEventListener(type, e => { cropPointers.delete(e.pointerId); cropGesture = null; });
function addDecoration(data) {
  if (state.decorations.length >= 40) { toast('꾸미기 요소는 최대 40개까지 추가할 수 있어요.'); return; }
  state.decorations.push({ ...data,id:crypto.randomUUID(),...textColorSettings(data.text||''), font:$('text-font').value, rotation:0, x: .5, y: .5 + (state.decorations.length % 4) * .035, size: data.type === 'text' ? .055 : .10 }); state.selectedDeco = state.decorations.length - 1; updateAdjustment(); render();
}
function point(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height }; }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function rotationHandle(box,d,g){const scale=g.width/Math.max(1,canvas.getBoundingClientRect().width),p=rotatedPoint(0,-box.h/2-32*scale,box,d.rotation||0);return {x:clamp(p.x,16*scale,g.width-16*scale),y:clamp(p.y,16*scale,g.height-16*scale)};}
function pointerDown(e) {
  if (state.step !== 3 || !editDialog.open || !['stickers','text'].includes(editDialog.dataset.tool)) return; e.preventDefault(); canvas.setPointerCapture(e.pointerId); const p = point(e); pointers.set(e.pointerId, p); const g = currentGeometry();
  if (pointers.size === 2 && state.selectedDeco !== null) { const [a, b] = [...pointers.values()]; const d = state.decorations[state.selectedDeco]; gesture = { mode: 'pinch', distance: distance(a,b),size:d.size,angle:degrees(Math.atan2(b.y-a.y,b.x-a.x)),rotation:d.rotation||0 }; return; }
  if (pointers.size > 1) return;
  const selected = canEditDecoration(state.decorations[state.selectedDeco])?state.decorations[state.selectedDeco]:null;
  if (selected) { const b = decorationBox(selected, g); const r = canvas.getBoundingClientRect(), hit = 22 * g.width / r.width;
    if(distance(p,rotationHandle(b,selected,g))<=22*g.width/r.width){gesture={mode:'rotate',angle:degrees(Math.atan2(p.y-b.y,p.x-b.x)),rotation:selected.rotation||0};return;}
    if (decorationHit(p,b,selected.rotation||0)) { gesture = { mode: 'move', dx: p.x / g.width - selected.x, dy: p.y / g.height - selected.y }; return; }
    const gap = 4 * g.width / r.width; for (const dx of [-1, 1]) for (const dy of [-1, 1]) { const corner=rotatedPoint(dx*(b.w/2+gap),dy*(b.h/2+gap),b,selected.rotation||0); if (distance(p, corner) <= hit) { gesture = { mode: 'resize', distance: distance(p, { x: b.x, y: b.y }), size: selected.size }; return; } }
  }
  for (let i = state.decorations.length - 1; i >= 0; i--) { if(!canEditDecoration(state.decorations[i]))continue;const b = decorationBox(state.decorations[i], g); if (decorationHit(p,b,state.decorations[i].rotation||0,16)) { state.selectedDeco = i; gesture = { mode: 'move', dx: p.x / g.width - state.decorations[i].x, dy: p.y / g.height - state.decorations[i].y }; updateAdjustment(); render(); return; } }
  state.selectedDeco = null; gesture = null; updateAdjustment(); render();
}
function pointerMove(e) {
  if (!pointers.has(e.pointerId)) return; e.preventDefault(); const p = point(e); pointers.set(e.pointerId, p); const d = state.decorations[state.selectedDeco]; if (!gesture || !d) return; const g = currentGeometry();
  if (gesture.mode === 'move') { const b = decorationBox(d, g); d.x = clamp(p.x / g.width - gesture.dx, Math.min(.48, b.w / 2 / g.width), Math.max(.52, 1 - b.w / 2 / g.width)); d.y = clamp(p.y / g.height - gesture.dy, b.h / 2 / g.height, 1 - b.h / 2 / g.height); }
  else if(gesture.mode==='rotate')d.rotation=gesture.rotation+rotationDelta(gesture.angle,degrees(Math.atan2(p.y-d.y*g.height,p.x-d.x*g.width)));
  else if (gesture.mode === 'resize') d.size = clamp(gesture.size * distance(p, { x: d.x * g.width, y: d.y * g.height }) / Math.max(gesture.distance, 1), .03, .22);
  else if (gesture.mode === 'pinch' && pointers.size === 2) { const [a, b] = [...pointers.values()]; d.size=clamp(gesture.size*distance(a,b)/Math.max(gesture.distance,1),.03,.22);d.rotation=gesture.rotation+rotationDelta(gesture.angle,degrees(Math.atan2(b.y-a.y,b.x-a.x))); }
  updateAdjustment(); render();
}
function pointerEnd(e) { pointers.delete(e.pointerId); if (pointers.size < 2 && gesture?.mode === 'pinch') gesture = null; if (!pointers.size) gesture = null; }
async function exportImage() {
  if (!state.photos.every(Boolean)) throw new Error('사진을 모두 채워 주세요.');
  await assetReady;await Promise.all([...brandEntries(state.event).filter(item=>item.key!=='logo').map(item=>loadFont(item.settings.font)),loadFont($('caption-font').value),...state.decorations.filter(d=>d.type==='text').map(d=>loadFont(d.font))]);
  const required = [state.event.frames[state.frame].overlay, ...(brandingModel(state.event).logo.visible ? [state.event.logo] : []), ...state.decorations.filter(d => d.type === 'image').map(d => d.url)].filter(Boolean);
  if (required.some(url => failedAssets.has(url))) throw new Error('선택한 디자인을 불러오지 못했어요. 다른 프레임을 선택하거나 네트워크를 확인해 주세요.');
  render(true);
  try { const outputCanvas=document.createElement('canvas');paintExport(canvas,outputCanvas,outputFormat(),state.event.frames[state.frame].bg); const blob = await new Promise((resolve, reject) => outputCanvas.toBlob(b => b ? resolve(b) : reject(new Error('이미지를 생성하지 못했어요.')), 'image/png')); return await printPNG(blob); }
  finally { render(); }
}
async function loadAssets() {
  await Promise.all(brandEntries(state.event).filter(item=>item.key!=='logo').map(item=>loadFont(item.settings.font)));
  const urls = [state.event.logo, ...state.event.frames.map(f => f.overlay), ...state.event.stickers.map(s => s.url)].filter(Boolean);
  await Promise.all([...new Set(urls)].map(async url => { try { assetImages.set(url, await imageFromURL(url)); } catch { failedAssets.add(url); } }));
  if (failedAssets.size) toast('일부 행사 디자인을 불러오지 못했어요. 다른 디자인을 선택할 수 있어요.');
  render();
}
function renderCollection(){
  const s=normalizeSharing(state.event.sharing),name=collectionName(s);$('event-collection').hidden=s.mode==='none';document.querySelector('.private-badge').lastChild.textContent=s.mode==='none'?' 내 기기에서만':' 제출은 선택';
  labelButton($('submit-result'),'upload',name==='Padlet'?'Padlet에 올리기':name==='Google Drive'?'Google Drive에 공유':'행사 게시판에 공유');
  $('collection-note').textContent=['drive','padlet'].includes(s.mode)?`제출 버튼을 누르면 이 완성 이미지 한 장이 선생님의 Google Drive${s.mode==='padlet'?'와 Padlet 게시판에':''}로 전송돼요.${s.mode==='padlet'?' 첨부 이미지 링크는 링크를 가진 사람이 볼 수 있어요.':''}`:'먼저 완성 이미지를 저장한 뒤 게시판·폴더를 열어 올려요. 기기 공유창은 열지 않아요.';
}
async function submissionImage(){
  const png=await exportImage(),url=URL.createObjectURL(png);try{const image=await imageFromURL(url),c=document.createElement('canvas'),scale=Math.min(1,2400/Math.max(image.width,image.height));c.width=Math.round(image.width*scale);c.height=Math.round(image.height*scale);c.getContext('2d').drawImage(image,0,0,c.width,c.height);const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.9));if(!blob||blob.size>5*1024*1024)throw new Error('제출 이미지가 커요. 더 작은 용도를 선택해 주세요.');const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob);});return data;}finally{URL.revokeObjectURL(url);}
}
function currentResultSignature(){return state.step===4?$('export-format').value+':'+saveCanvas.toDataURL('image/png'):null;}
async function downloadFinishedImage(){
  const signature=currentResultSignature();
  const blob=await exportImage();downloadBlob(blob,`moment-${$('export-format').value}-${photoDate.toISOString().slice(0,10)}.png`);
  usage.record('downloads');
  lastDownloadedSignature=signature&&signature===currentResultSignature()?signature:null;
  return Boolean(lastDownloadedSignature);
}
function prepareCollectionLink(s){const link=$('collection-open');link.href=s.url;link.textContent='2. '+collectionName(s)+' 열고 올리기 ↗';}
function openCollectionLink(s){
  const link=document.createElement('a');link.href=s.url;link.target='_blank';link.rel='noopener noreferrer';document.body.append(link);link.click();link.remove();usage.record('shares');
  $('collection-status').textContent=collectionName(s)+'를 열었어요. 다운로드한 이미지를 선택해 올려 주세요. 제출 완료 여부는 게시판에서 확인해 주세요.';
}
$('close-collection-save').onclick=()=>$('collection-save-dialog').close();
$('collection-download').onclick=async()=>{
 const button=$('collection-download');button.disabled=true;$('collection-open').hidden=true;$('collection-save-status').textContent='이미지를 준비하고 있어요…';
 try{const unchanged=await downloadFinishedImage();$('collection-save-status').textContent=unchanged?'다운로드를 시작했어요. 파일이 저장됐는지 확인한 뒤 게시판을 열어 주세요.':'이미지가 변경됐어요. 저장·공유 단계에서 다시 확인해 주세요.';$('collection-open').hidden=!unchanged;}
 catch(error){$('collection-save-status').textContent='저장하지 못했어요. '+error.message;}
 finally{button.disabled=false;}
};
$('collection-open').onclick=()=>{usage.record('shares');$('collection-save-dialog').close();$('collection-status').textContent='게시판에서 저장한 이미지를 선택해 올려 주세요. 아직 자동 게시된 것은 아니에요.';};
$('submit-result').onclick=async()=>{
  if(submitting)return;const s=normalizeSharing(state.event.sharing);
  if(s.mode==='link'){
    if(lastDownloadedSignature&&lastDownloadedSignature===currentResultSignature()){openCollectionLink(s);return;}
    prepareCollectionLink(s);$('collection-open').hidden=true;$('collection-save-status').textContent='';$('collection-save-title').textContent=lastDownloadedSignature?'바뀐 이미지를 다시 저장해요':'먼저 완성 이미지를 저장해요';$('collection-save-dialog').showModal();return;
  }
  submitting=true;$('submit-result').disabled=true;$('collection-status').textContent='공유할 이미지를 준비하고 있어요…';
  try{
    if(['drive','padlet'].includes(s.mode)){
      if(!eventId||new URLSearchParams(location.search).has('preview'))throw new Error('미리보기에서는 전송하지 않아요. 게시한 행사 QR로 이용해 주세요.');
      const imageBase64=await submissionImage(),fingerprint=await crypto.subtle.digest('SHA-256',Uint8Array.from(atob(imageBase64),c=>c.charCodeAt(0))),hash=[...new Uint8Array(fingerprint)].map(x=>x.toString(16).padStart(2,'0')).join('');
      if(lastSubmission?.hash!==hash)lastSubmission={hash,id:crypto.randomUUID()};
      const result=await callCollectionRelay(s.relayUrl,{action:'submit',eventId,submissionKey:s.submissionKey,submissionId:lastSubmission.id,imageBase64,consent:true});
      if(!lastSubmission.counted){usage.record('submissions');lastSubmission.counted=true;}
      $('collection-status').textContent=result.message||'제출했어요. 감사합니다!';
      if(result.url&&httpsURL(result.url)){const a=document.createElement('a');a.href=httpsURL(result.url);a.target='_blank';a.rel='noopener noreferrer';a.textContent=' 제출 결과 보기 ↗';$('collection-status').append(a);}
    }
  }catch(error){if(error.name==='AbortError')$('collection-status').textContent='공유를 취소했어요. 사진은 전송하지 않았어요.';else $('collection-status').textContent=error.message||'제출하지 못했어요. 기기에 저장한 뒤 선생님께 확인해 주세요.';}
  finally{submitting=false;$('submit-result').disabled=false;}
};
async function bootEvent() {
  const params = new URLSearchParams(location.search), id = location.pathname.match(/^\/e\/([a-zA-Z0-9_-]{1,100})\/?$/)?.[1] || params.get('event');
  eventId=id||'';
  if (!id && !params.has('preview') && !params.has('demo') && (matchMedia('(display-mode: standalone)').matches || navigator.standalone)) { try { const previous = localStorage.getItem('chalkak-last-event'); if (/^[a-zA-Z0-9_-]{1,100}$/.test(previous || '')) { location.replace(`./booth.html?event=${encodeURIComponent(previous)}`); return; } } catch { /* 저장소가 제한되면 QR 안내를 표시 */ } }
  if (!id && !params.has('preview') && !params.has('demo')) { blocked = true; $('step-title').textContent = '행사 QR로 참여해 주세요.'; $('step-description').textContent = '학교에서 안내받은 QR을 스캔하면 해당 행사 사진관이 열려요.'; $('next').disabled = true; return; }
  if (params.has('preview')) {
    try { const preview = sessionStorage.getItem('moment-event-preview'); if (preview) state.event = normalizeEvent(JSON.parse(preview)); } catch { toast('행사 미리보기를 불러오지 못했어요.'); }
  } else if (id) {
    blocked = true; $('next').disabled = true;
    try { const { loadPublicEvent } = await import('./public-event.js'); state.event = await loadPublicEvent(id); blocked = false;if(!params.has('demo'))usage.enable(); try { localStorage.setItem('chalkak-last-event', id); } catch { /* 사진은 저장하지 않으며 행사 ID만 선택적으로 기억 */ } }
    catch (error) { $('step-title').textContent = '행사를 열 수 없어요.'; $('step-description').textContent = error.code === 'permission-denied' ? '게시되지 않았거나 삭제된 행사입니다. 운영자에게 QR을 확인해 주세요.' : error.message; toast('행사 설정을 확인해 주세요.'); return; }
  }
  if (id || params.has('preview')) { $('event-intro').hidden = false; document.title = `${state.event.school} ${state.event.title} — 사제동행 찰칵! 포토`; document.querySelector('h1').textContent = state.event.title; document.querySelector('.intro-copy').textContent = [state.event.school, state.event.schedule].filter(Boolean).join(' · '); }
  $('show-date').checked = brandingModel(state.event).captureDate;
  state.orientation = state.event.orientation || 'portrait';
  renderCollection();renderChoices(); renderSteps(); render(); assetReady = loadAssets();
}

$('next').addEventListener('click', () => go(state.step+1)); $('back').addEventListener('click', () => go(state.step-1));
$('caption').addEventListener('input', () => render()); $('show-date').addEventListener('change', () => render());
$('camera-start').addEventListener('click', startCamera); $('camera-flip').addEventListener('click', () => { facing = facing === 'user' ? 'environment' : 'user'; startCamera(); });
$('capture').setAttribute('aria-label','남은 컷 연속 촬영');$('capture').addEventListener('click', () => capture(true)); $('auto-capture').addEventListener('click', () => capture(true));
$('cancel-capture').addEventListener('click', () => { captureEpoch++; busy = false; $('countdown').textContent = ''; renderThumbnails(); });
async function importPhotoFiles(e) {
  if (busy) return; const files = [...e.target.files]; if (!files.length) return; busy = true; updateButtons(); let imported = 0;
  try {
    const indices = Array.from({ length: state.count }, (_, n) => (state.selectedPhoto + n) % state.count);
    for (const [n, file] of files.slice(0, state.count).entries()) {
      if (!file.type.startsWith('image/') || file.size > 25 * 1024 * 1024) { toast('25MB 이하 이미지 파일을 선택해 주세요.'); continue; }
      const url = URL.createObjectURL(file);
      try { const img = await imageFromURL(url); const c = document.createElement('canvas'); const scale = Math.min(1, 1800 / Math.max(img.width, img.height)); c.width = Math.max(1, Math.round(img.width * scale)); c.height = Math.max(1, Math.round(img.height * scale)); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); const resized = await imageFromURL(c.toDataURL('image/jpeg', .93)); savePhoto(resized, indices[n]);usage.record('photoImports'); imported++; } catch { toast('이 이미지를 읽지 못했어요. JPEG·PNG·WebP로 다시 선택해 주세요.'); } finally { URL.revokeObjectURL(url); }
    }
    if (imported) { state.selectedPhoto = Math.max(0, state.photos.findIndex(p => !p)); toast(`${imported}장의 사진을 담았어요. 사진은 전송되지 않았어요.`); }
  } finally { busy = false; e.target.value = ''; renderThumbnails(); updateButtons();if(imported&&state.photos.every(Boolean))go(3); }
}
$('photo-upload').addEventListener('change',importPhotoFiles); $('native-photo').addEventListener('change',importPhotoFiles);
function selectCaptureMethod(native){if(busy)return;if(native)stopCamera();$('native-capture-area').hidden=!native;$('web-capture-area').hidden=native;$('native-mode').setAttribute('aria-pressed',String(native));$('web-mode').setAttribute('aria-pressed',String(!native));updateCameraGeometry();}
$('native-mode').addEventListener('click',()=>selectCaptureMethod(true));$('web-mode').addEventListener('click',()=>selectCaptureMethod(false));
$('native-capture').addEventListener('click',()=>{if(busy)return;stopCamera();$('native-photo').click();});
$('demo').addEventListener('click', async () => {
  if (state.photos.some(Boolean) && !await confirmAction('현재 사진을 샘플 이미지로 바꿀까요?')) return;
  busy = true; updateButtons();
  try { for (let i = 0; i < state.count; i++) { const c = document.createElement('canvas'); c.width = 1000; c.height = 750; const cc = c.getContext('2d'); const colors = [['#cbdac1', '#7c946b'], ['#ead4c6', '#b87a64'], ['#d0ddec', '#748ca8'], ['#e0d5e5', '#9c81a5']][i % 4]; const grad = cc.createLinearGradient(0, 0, 1000, 750); grad.addColorStop(0, colors[0]); grad.addColorStop(1, colors[1]); cc.fillStyle = grad; cc.fillRect(0, 0, 1000, 750); cc.fillStyle = '#ffffff55'; cc.beginPath(); cc.arc(780, 130, 190, 0, Math.PI * 2); cc.fill(); cc.fillStyle = '#fffaf0'; cc.font = '200px Georgia'; cc.textAlign = 'center'; cc.fillText(['✿', '☺', '✦', '♡'][i % 4], 500, 380); cc.font = '18px Arial'; cc.fillText('S A M P L E   M O M E N T   ' + String(i + 1).padStart(2, '0'), 500, 550); savePhoto(await imageFromURL(c.toDataURL()), i); } toast('샘플 사진이에요. 마음껏 꾸며보세요.'); } finally { busy = false; renderThumbnails(); updateButtons();if(state.photos.every(Boolean))go(3); }
});
for(const [id,delta] of [['photo-zoom-in',.15],['photo-zoom-out',-.15]])$(id).onclick=()=>{const p=state.photos[state.selectedPhoto];if(p){p.zoom=clamp(p.zoom+delta,1,2.5);updateAdjustment();render();}};
$('photo-reset').onclick=()=>{const p=state.photos[state.selectedPhoto];if(p){p.zoom=1;p.panX=0;p.panY=0;updateAdjustment();render();}};
cropCanvas.addEventListener('wheel',e=>{e.preventDefault();const p=state.photos[state.selectedPhoto];if(p){p.zoom=clamp(p.zoom*(e.deltaY<0?1.1:1/1.1),1,2.5);updateAdjustment();render();}},{passive:false});
$('toggle-editor-tools').onclick=()=>{const hidden=!$('expanded-tools').hidden;$('expanded-tools').hidden=hidden;$('toggle-editor-tools').setAttribute('aria-expanded',String(!hidden));$('toggle-editor-tools').textContent=hidden?'도구 펼치기 ⌃':'도구 접기 ⌄';editorView.refresh();};
$('add-text').addEventListener('click', () => { const text = $('decoration-text').value.trim(); if (!text) return toast('문구를 먼저 입력해 주세요.'); addDecoration({ type: 'text', text, color: '#ffffff' }); $('decoration-text').value = ''; });
$('selected-decoration-text').addEventListener('input',e=>{const d=state.decorations[state.selectedDeco];if(d?.type==='text'){d.text=e.target.value;updateAdjustment();render();}});
$('decoration-color').addEventListener('input', e => { const d = state.decorations[state.selectedDeco]; if (d) { d.color = e.target.value;d.letterColors=[];updateAdjustment(); render(); } });
$('undo-decoration').onclick=()=>{if(!deletedDecoration||state.decorations.length>=40)return;const {item,index}=deletedDecoration;state.decorations.splice(index,0,item);state.selectedDeco=index;deletedDecoration=null;updateAdjustment();render();};
$('rotate-decoration').replaceChildren(icon('refresh'));$('rotate-decoration').onclick=()=>{const d=state.decorations[state.selectedDeco];if(d){d.rotation=(d.rotation||0)+15;updateAdjustment();render();}};
$('delete-decoration').replaceChildren(icon('trash'));$('undo-decoration').replaceChildren(icon('undo'));
$('delete-decoration').addEventListener('click', () => { if (state.selectedDeco === null) return; deletedDecoration={item:state.decorations[state.selectedDeco],index:state.selectedDeco};state.decorations.splice(state.selectedDeco, 1); state.selectedDeco = null; updateAdjustment(); render(); });
canvas.addEventListener('clear-selection',()=>{state.selectedDeco=null;updateAdjustment();render();});
canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointermove', pointerMove); for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, pointerEnd);

$('expand-preview').addEventListener('click', () => {if(state.step===4)go(3);openEditorTool();});
$('change-layout').addEventListener('click', () => go(0));
document.querySelectorAll('[data-open-tool]').forEach(b => b.addEventListener('click', () => openEditorTool(b.dataset.openTool)));
document.querySelectorAll('[data-editor-tool]').forEach(b => b.addEventListener('click', () => selectEditorTool(b.dataset.editorTool)));
$('close-edit').addEventListener('click', closeEditor);
editDialog.addEventListener('cancel', e => { e.preventDefault(); closeEditor(); });
canvas.tabIndex = 0; canvas.addEventListener('keydown', e => { const d = state.decorations[state.selectedDeco]; if (!d || state.step !== 3 || !editDialog.open || !canEditDecoration(d)) return; if (e.key.startsWith('Arrow')) { e.preventDefault(); d.x = clamp(d.x + (e.key === 'ArrowRight' ? .01 : e.key === 'ArrowLeft' ? -.01 : 0), .03, .97); d.y = clamp(d.y + (e.key === 'ArrowDown' ? .01 : e.key === 'ArrowUp' ? -.01 : 0), .02, .98); render(); } if(e.key.toLowerCase()==='r'){e.preventDefault();d.rotation=(d.rotation||0)+(e.shiftKey?-15:15);updateAdjustment();render();} if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); $('delete-decoration').click(); } });
$('download').addEventListener('click', async () => { try { await downloadFinishedImage(); toast('다운로드를 시작했어요. 기기의 저장 위치를 확인해 주세요.'); } catch (error) { toast(`저장 실패: ${error.message}`); } });
$('share').addEventListener('click', async () => { try { const blob = await exportImage(), file = new File([blob], 'moment.png', { type: 'image/png' }); if (navigator.canShare?.({ files: [file] })) {await navigator.share({ files: [file], title: state.event.title });usage.record('shares');} else { if (downloadURL) URL.revokeObjectURL(downloadURL); downloadURL = URL.createObjectURL(blob); const link = Object.assign(document.createElement('a'), { href: downloadURL, target: '_blank', rel: 'noopener' }); link.click();usage.record('shares'); toast('이미지를 길게 눌러 저장하거나 PNG 저장 버튼을 이용해 주세요.'); } } catch (error) { if (error.name !== 'AbortError') toast('공유하지 못했어요. PNG 저장 버튼을 이용해 주세요.'); } });
$('restart').addEventListener('click', async () => { if (!await confirmAction('새로 시작할까요? 저장하지 않은 사진과 꾸미기는 사라져요.')) return;usage.restart(); stopCamera();lastDownloadedSignature=null; state.photos = Array(state.count).fill(null); state.decorations = []; deletedDecoration=null;state.selectedPhoto = 0; state.filter = 'original'; renderChoices(); renderThumbnails(); go(0); });
document.addEventListener('visibilitychange', () => { if (document.hidden) stopCamera(); }); window.addEventListener('pagehide', stopCamera);
window.addEventListener('beforeunload', e => { if (state.photos.some(Boolean)) { e.preventDefault(); e.returnValue = ''; } });
for (const [id, name, label] of [['back', 'back', '이전'], ['native-capture', 'camera', '기본 카메라로 촬영'], ['camera-start', 'camera', '카메라 켜기'], ['camera-flip', 'flip', '카메라 전환'], ['download', 'save', 'PNG 이미지 저장'], ['share', 'share', '이미지 공유 / 기기에 저장'], ['restart', 'refresh', '새로운 순간 담기'], ['close-edit', 'back', '돌아가기'], ['expand-preview', 'expand', '크게 편집'], ['change-layout', 'frame', '컷 변경'], ['demo', 'camera', '카메라 없이 샘플로 체험하기']]) labelButton($(id), name, label);
document.querySelectorAll('[data-open-tool], [data-editor-tool]').forEach(b => { const tool = b.dataset.openTool || b.dataset.editorTool; const name = { stickers: 'sticker', text: 'text', photo: 'crop', filter: 'filter' }[tool]; labelButton(b, name, { stickers: '스티커', text: '문구', photo: '사진 구도', filter: '필터' }[tool]); });
for(const id of ['text-font','caption-font']){fillFontSelect($(id));$(id).onchange=async()=>{const font=$(id).value;try{await loadFont(font);const d=state.decorations[state.selectedDeco];if(id==='text-font'&&d?.type==='text')d.font=font;render();}catch(error){toast(error.message);}};}
renderChoices(); renderThumbnails(); renderSteps(); render(); bootEvent();
document.fonts.ready.then(() => render());

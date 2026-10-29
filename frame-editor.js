import {createFrameComparison} from './frame-comparison.js';
import {createTextStyleControls} from './text-style-controls.js';
import {confirmAction} from './app-dialog.js';
import {fillFontSelect,refreshFontSelect,loadFont} from './fonts.js';
import { brandingModel, brandEntries, brandPart, changeBrandPart, BRAND_KEYS, BRAND_LABELS, BRAND_SIZES, clamp, compatibleFrame } from './core.js';
import { paintFramePreview } from './frame-preview.js';
import { labelButton } from './icons.js';
const $ = id => document.getElementById(id);
export function createFrameEditor({ getEvent, onChange, onSave, onTextChange }) {
  const dialog = $('frame-editor'), canvas = $('frame-editor-canvas'), stage = $('frame-editor-stage');
  let fontRequest=0;let focusSelection = true; const pointers=new Map();
  let count = 4, frameIndex = 0, selected = 'school', zoom = 1, last = null, gesture = null, version = 0;
  createFrameComparison({getEvent,getSelection:()=>({count,frameIndex})});
  function cleanModel(model) { const { hasContent, hasTop, hasBottom, ...clean } = model; return clean; }
  const textStyles=createTextStyleControls($('frame-text-style'),{fontSelect:$('frame-element-font'),onTextChange:text=>{if(selected?.startsWith('extra-'))changePart(selected,{text});else if(selected)onTextChange?.(selected,text);},getState:()=>{const event=getEvent();return event&&selected&&brandPart(event,selected)?{key:selected,label:brandPart(event,selected).label,text:brandPart(event,selected).content||'',settings:brandPart(event,selected).settings,ink:event.frames[frameIndex]?.ink}:null;},onChange:part=>{if(selected)changePart(selected,part);}});
  function changePart(key, part) { const event = getEvent(); if (!event) return; onChange(changeBrandPart(event,key,part)); }
  function updateSize() {
    if (!last) return;
    const { width, height } = last.geometry; const fit = Math.min((stage.clientWidth - 30) / width, (stage.clientHeight - 28) / height);
    const w = Math.max(50, width * fit * zoom), h = height * fit * zoom;
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    $('frame-canvas-wrap').style.width = `${Math.max(stage.clientWidth, w + 30)}px`;
    $('frame-canvas-wrap').style.minHeight = `${Math.max(stage.clientHeight, h + 28)}px`;
    $('frame-zoom-value').textContent = `${Math.round(zoom * 100)}%`;
  }
  function controls(event) {
    const model = brandingModel(event);
    if (!event.frames.some(f => compatibleFrame(f,count))) count = event.frames[0].layoutCount || 4;
    if (!event.frames[frameIndex] || !compatibleFrame(event.frames[frameIndex],count)) frameIndex = event.frames.findIndex(f => compatibleFrame(f,count));
    $('frame-selected').replaceChildren();
    for (const {key,label,settings,content} of brandEntries(event)) { const option = document.createElement('option'); option.value = key; option.textContent = label; option.disabled = !settings.visible || !content; $('frame-selected').append(option); }
    if(selected&&(!brandPart(event,selected)||!brandPart(event,selected)?.settings.visible))selected=brandEntries(event).find(item=>item.content&&item.settings.visible)?.key||null;
    $('frame-selected').value = selected || ''; $('frame-item-controls').hidden = !selected; $('frame-no-selection').hidden = Boolean(selected);
    if (selected) { const item = brandPart(event,selected).settings;$('frame-element-font').value=item.font;$('frame-element-font').disabled=selected==='logo';refreshFontSelect($('frame-element-font')); $('frame-size-value').textContent = `${Math.round(item.size / (BRAND_SIZES[selected]||BRAND_SIZES.title) * 100)}%`; }
    textStyles.refresh();
    const height=String(Math.round(model.height*100));if(![...$('frame-brand-height').options].some(o=>o.value===height))$('frame-brand-height').append(Object.assign(document.createElement('option'),{value:height,textContent:height+'%'}));$('frame-brand-height').value=height; $('frame-brand-height').disabled = Boolean(event.frames[frameIndex]?.layoutCount);
    $('frame-example').replaceChildren(...event.frames.flatMap((frame, i) => compatibleFrame(frame,count) ? [Object.assign(document.createElement('option'), { value: i, textContent: frame.name })] : []));
    $('frame-example').value = String(frameIndex);
    $('frame-cut-options').replaceChildren(...[2, 4, 6, 8].map(n => { const b = document.createElement('button'); b.textContent = `${n}컷`; b.className = count === n ? 'selected' : ''; b.disabled = !event.frames.some(f => compatibleFrame(f,n)); b.setAttribute('aria-pressed', String(count === n)); b.addEventListener('click', () => { count = n; last = null; refresh(); }); return b; }));
    for (const target of ['brand-toggles', 'frame-brand-toggles']) {
      $(target).replaceChildren();
      for (const key of [...BRAND_KEYS, 'captureDate']) { const label = document.createElement('label'), input = document.createElement('input'), span = document.createElement('span'); input.type = 'checkbox'; input.checked = key === 'captureDate' ? model.captureDate : model[key].visible; span.textContent = key === 'captureDate' ? '하단 촬영일' : BRAND_LABELS[key]; input.addEventListener('change', () => { const changed = cleanModel(brandingModel(getEvent())); if (key === 'captureDate') changed.captureDate = input.checked; else changed[key].visible = input.checked; onChange(changed); }); label.append(input, span); $(target).append(label); }
    }
  }
  async function refresh() {
    const event = getEvent(); if (!event) return;
    controls(event); if (!dialog.open) return;
    const epoch = ++version;
    const result = await paintFramePreview(canvas, event, { count, frameIndex, selected, guides: true }); if (!result || epoch !== version) return;
    last = result; updateSize(); if (focusSelection) { focusSelection = false; const item=last.items.find(i=>i.key===selected); if(item) { const scale=canvas.clientWidth/canvas.width; stage.scrollLeft=canvas.offsetLeft+item.x*scale-stage.clientWidth/2; stage.scrollTop=canvas.offsetTop+item.y*scale-stage.clientHeight/2; } }
  }
  function open() { if (!getEvent()) return; focusSelection = true; zoom = 1; dialog.showModal(); refresh(); }
  function close() { dialog.close(); gesture = null;pointers.clear(); }
  $('open-frame-editor').addEventListener('click', open); $('admin-preview').addEventListener('click', open);
  $('close-frame-editor').addEventListener('click', close); dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
  $('reset-frame-branding').addEventListener('click', async () => {if(await confirmAction('로고·문구의 위치와 크기를 초기화할까요? 현재 배치는 사라집니다.'))onChange(null);});
  fillFontSelect($('frame-element-font'));$('frame-element-font').onchange=async e=>{const key=selected,id=e.target.value,request=++fontRequest;$('save-frame-editor').disabled=true;try{await loadFont(id);if(request===fontRequest&&key)changePart(key,{font:id});}catch(error){if(request===fontRequest){$('frame-save-status').textContent=error.message;$('frame-element-font').value=brandPart(getEvent(),key)?.settings.font||'baeum';refreshFontSelect($('frame-element-font'));}}finally{if(request===fontRequest)$('save-frame-editor').disabled=false;}};
  $('save-frame-editor').onclick=async()=>{const button=$('save-frame-editor');button.disabled=true;$('frame-save-status').textContent='저장 중…';try{await onSave();$('frame-save-status').textContent='';close();}catch(error){$('frame-save-status').textContent=error.message;}finally{button.disabled=false;}};
  $('frame-selected').addEventListener('change', e => { selected = e.target.value; focusSelection = true; refresh(); });
  $('frame-example').addEventListener('change', e => { frameIndex = Number(e.target.value); refresh(); });
  $('frame-view-minus').onclick=()=>{zoom=clamp(zoom-.25,1,3);updateSize();};
  $('frame-view-plus').onclick=()=>{zoom=clamp(zoom+.25,1,3);updateSize();};
  $('frame-view-fit').onclick=()=>{zoom=1;updateSize();stage.scrollTo(0,0);};
  for(const [id,factor] of [['frame-size-minus',1/1.12],['frame-size-plus',1.12]])$(id).onclick=()=>{if(selected){const item=brandPart(getEvent(),selected).settings;changePart(selected,{size:clamp(item.size*factor,selected==='logo'?.035:.012,selected==='logo'?.35:.10)});}};
  $('frame-center-item').onclick=()=>{if(selected)changePart(selected,{position:'free',anchor:'',x:.5,y:.5});};
  $('frame-brand-height').addEventListener('change', e => { const model = cleanModel(brandingModel(getEvent())); model.height = Number(e.target.value) / 100; onChange(model); });
  function point(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height, screenX:e.clientX, screenY:e.clientY }; }
  canvas.addEventListener('pointerdown', e => {
    if (!last) return; const p = point(e);pointers.set(e.pointerId,p);
    if(pointers.size===2){const[a,b]=[...pointers.values()];gesture={type:selected?'pinch-item':'pinch-view',distance:selected?Math.hypot(a.x-b.x,a.y-b.y):Math.hypot(a.screenX-b.screenX,a.screenY-b.screenY),size:selected?brandPart(getEvent(),selected).settings.size:zoom};e.preventDefault();canvas.setPointerCapture(e.pointerId);return;}
    const scale = canvas.width / canvas.getBoundingClientRect().width;
    const active = last.items.find(i => i.key === selected);
    if (active && Math.abs(p.x - active.x) <= active.w / 2 && Math.abs(p.y - active.y) <= active.h / 2) { gesture = { type: 'move', dx: p.x - active.x, dy: p.y - active.y }; }
    else if (active && [-1, 1].some(dx => [-1, 1].some(dy => Math.hypot(p.x - active.x - dx * (active.w / 2 + 4 * scale), p.y - active.y - dy * (active.h / 2 + 4 * scale)) < 20 * scale))) gesture = { type: 'resize', size: brandPart(getEvent(),selected).settings.size, distance: Math.hypot(p.x - active.x, p.y - active.y) };
    else { const found = [...last.items].reverse().find(i => Math.abs(p.x - i.x) <= i.w / 2 + 10 * scale && Math.abs(p.y - i.y) <= i.h / 2 + 10 * scale); if (!found) { selected=null;gesture = { type: 'pan', x: e.clientX, y: e.clientY, left: stage.scrollLeft, top: stage.scrollTop };refresh(); } else { selected = found.key; gesture = { type: 'move', dx: p.x - found.x, dy: p.y - found.y }; refresh(); } }
    e.preventDefault(); canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!gesture || !last || !pointers.has(e.pointerId)) return; e.preventDefault();pointers.set(e.pointerId,point(e));if(gesture.type.startsWith('pinch-')&&pointers.size===2){const[a,b]=[...pointers.values()],value=gesture.size*(gesture.type==='pinch-view'?Math.hypot(a.screenX-b.screenX,a.screenY-b.screenY):Math.hypot(a.x-b.x,a.y-b.y))/Math.max(gesture.distance,1);if(gesture.type==='pinch-view'){zoom=clamp(value,1,3);updateSize();}else if(selected)changePart(selected,{size:clamp(value,selected==='logo'?.035:.012,selected==='logo'?.35:.10)});return;} if (gesture.type === 'pan') { stage.scrollLeft = gesture.left - (e.clientX - gesture.x); stage.scrollTop = gesture.top - (e.clientY - gesture.y); return; } if (!selected) return; const p = point(e), g = last.geometry, model = brandingModel(getEvent()), settings = brandPart(getEvent(),selected).settings, item = last.items.find(i => i.key === selected); if (!item) return;
    if (gesture.type === 'move') { const y=clamp(p.y-gesture.dy,0,g.height),anchor=y<=g.pad+g.brandH?'top':y>=g.height-g.pad-g.footerH-g.brandH?'bottom':'';changePart(selected,{position:'free',anchor,x:clamp((p.x-gesture.dx)/g.width,0,1),y:y/g.height}); }
    else changePart(selected, { size: clamp(gesture.size * Math.hypot(p.x - item.x, p.y - item.y) / Math.max(gesture.distance, 1), selected === 'logo' ? .035 : .012, selected === 'logo' ? .35 : .10) });
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(type, e => {pointers.delete(e.pointerId);gesture=null;});
  canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=clamp(zoom*(e.deltaY<0?1.1:1/1.1),1,3);updateSize();},{passive:false});
  new ResizeObserver(() => { if (dialog.open) { updateSize(); refresh(); } }).observe(stage);
  labelButton($('open-frame-editor'), 'expand', '프레임 크게 편집 · 위치와 크기 조절'); labelButton($('close-frame-editor'), 'back', '돌아가기');
  return { refresh, open };
}

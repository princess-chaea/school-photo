import { brandingModel, BRAND_KEYS, BRAND_LABELS, BRAND_SIZES, clamp, compatibleFrame } from './core.js';
import { paintFramePreview } from './frame-preview.js';
import { labelButton } from './icons.js';
const $ = id => document.getElementById(id);
export function createFrameEditor({ getEvent, onChange }) {
  const dialog = $('frame-editor'), canvas = $('frame-editor-canvas'), stage = $('frame-editor-stage');
  let focusSelection = true;
  let count = 4, frameIndex = 0, selected = 'school', zoom = 1, last = null, gesture = null, version = 0;
  function cleanModel(model) { const { hasContent, hasTop, hasBottom, ...clean } = model; return clean; }
  function changePart(key, part) { const event = getEvent(); if (!event) return; const model = cleanModel(brandingModel(event)); model[key] = { ...model[key], ...part }; onChange(model); }
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
    for (const key of BRAND_KEYS) { const option = document.createElement('option'); option.value = key; option.textContent = BRAND_LABELS[key]; option.disabled = !model[key].visible || !event[key]; $('frame-selected').append(option); }
    if (!selected || !event[selected] || !model[selected].visible) selected = BRAND_KEYS.find(key => event[key] && model[key].visible) || null;
    $('frame-selected').value = selected || ''; $('frame-item-controls').hidden = !selected; $('frame-no-selection').hidden = Boolean(selected);
    if (selected) { const item = model[selected]; $('frame-element-position').value = item.position; $('frame-element-size').value = clamp(item.size / BRAND_SIZES[selected] * 100, 40, 300); $('frame-size-value').textContent = `${Math.round(item.size / BRAND_SIZES[selected] * 100)}%`; $('frame-element-x').value = item.x * 100; $('frame-element-y').value = item.y * 100; $('frame-element-color').value = item.color || event.frames[frameIndex]?.ink || '#34372f'; $('frame-element-color').disabled = selected === 'logo'; $('frame-auto-color').disabled = selected === 'logo'; }
    $('frame-brand-height').value = model.height * 100; $('frame-brand-height').disabled = Boolean(event.frames[frameIndex]?.layoutCount);
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
  function open() { if (!getEvent()) return; focusSelection = true; zoom = 1; $('frame-zoom').value = '1'; dialog.showModal(); refresh(); }
  function close() { dialog.close(); gesture = null; }
  $('open-frame-editor').addEventListener('click', open); $('admin-preview').addEventListener('click', open);
  $('close-frame-editor').addEventListener('click', close); dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
  $('reset-frame-branding').addEventListener('click', () => onChange(null));
  $('frame-selected').addEventListener('change', e => { selected = e.target.value; focusSelection = true; refresh(); });
  $('frame-example').addEventListener('change', e => { frameIndex = Number(e.target.value); refresh(); });
  $('frame-zoom').addEventListener('input', e => { zoom = Number(e.target.value); refresh(); });
  $('frame-element-size').addEventListener('input', e => { if (selected) changePart(selected, { size: clamp(BRAND_SIZES[selected] * Number(e.target.value) / 100, selected === 'logo' ? .035 : .012, selected === 'logo' ? .35 : .10) }); });
  for (const axis of ['x', 'y']) $(`frame-element-${axis}`).addEventListener('input', e => { if (selected) changePart(selected, { [axis]: Number(e.target.value) / 100 }); });
  $('frame-element-position').addEventListener('change', e => { focusSelection = true; if (selected) changePart(selected, { position: e.target.value, y: .5 }); });
  $('frame-element-color').addEventListener('input', e => { if (selected) changePart(selected, { color: e.target.value }); });
  $('frame-auto-color').addEventListener('click', () => { if (selected) changePart(selected, { color: '' }); });
  $('frame-brand-height').addEventListener('input', e => { const model = cleanModel(brandingModel(getEvent())); model.height = Number(e.target.value) / 100; onChange(model); });
  function point(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height }; }
  canvas.addEventListener('pointerdown', e => {
    if (!last) return; const p = point(e), scale = canvas.width / canvas.getBoundingClientRect().width;
    const active = last.items.find(i => i.key === selected);
    if (active && Math.abs(p.x - active.x) <= active.w / 2 && Math.abs(p.y - active.y) <= active.h / 2) { gesture = { type: 'move', dx: p.x - active.x, dy: p.y - active.y }; }
    else if (active && [-1, 1].some(dx => [-1, 1].some(dy => Math.hypot(p.x - active.x - dx * (active.w / 2 + 4 * scale), p.y - active.y - dy * (active.h / 2 + 4 * scale)) < 20 * scale))) gesture = { type: 'resize', size: brandingModel(getEvent())[selected].size, distance: Math.hypot(p.x - active.x, p.y - active.y) };
    else { const found = [...last.items].reverse().find(i => Math.abs(p.x - i.x) <= i.w / 2 + 10 * scale && Math.abs(p.y - i.y) <= i.h / 2 + 10 * scale); if (!found) gesture = { type: 'pan', x: e.clientX, y: e.clientY, left: stage.scrollLeft, top: stage.scrollTop }; else { selected = found.key; gesture = { type: 'move', dx: p.x - found.x, dy: p.y - found.y }; refresh(); } }
    e.preventDefault(); canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!gesture || !last) return; e.preventDefault(); if (gesture.type === 'pan') { stage.scrollLeft = gesture.left - (e.clientX - gesture.x); stage.scrollTop = gesture.top - (e.clientY - gesture.y); return; } if (!selected) return; const p = point(e), g = last.geometry, model = brandingModel(getEvent()), settings = model[selected], item = last.items.find(i => i.key === selected); if (!item) return;
    if (gesture.type === 'move') { const area = g.brandAreas[settings.position]; changePart(selected, { x: clamp((p.x - gesture.dx) / g.width, .05, .95), y: clamp((p.y - gesture.dy - area.y) / Math.max(1, area.h), 0, 1) }); }
    else changePart(selected, { size: clamp(gesture.size * Math.hypot(p.x - item.x, p.y - item.y) / Math.max(gesture.distance, 1), selected === 'logo' ? .035 : .012, selected === 'logo' ? .35 : .10) });
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(type, () => gesture = null);
  new ResizeObserver(() => { if (dialog.open) { updateSize(); refresh(); } }).observe(stage);
  labelButton($('open-frame-editor'), 'expand', '프레임 크게 편집 · 위치와 크기 조절'); labelButton($('close-frame-editor'), 'back', '돌아가기');
  return { refresh, open };
}

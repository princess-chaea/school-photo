import { EXPORT_FORMATS, paintExport, createExportPicker } from './export-formats.js';
import { createEditorView } from './editor-view.js';
import { printPNG } from './print-png.js';
import { DEFAULT_EVENT, FILTERS, layout, crop, clamp, normalizeEvent, imageFromURL, downloadBlob, brandingModel, compatibleFrame } from './core.js';
import { drawBranding } from './branding.js';
import { icon, labelButton } from './icons.js';

const $ = id => document.getElementById(id);
const canvas = $('preview'), ctx = canvas.getContext('2d');
const steps = ['컷 선택', '프레임', '촬영', '꾸미기', '저장'];
const titles = ['몇 컷의 순간을 담을까요?', '오늘의 무드를 골라요.', '준비됐나요? 하나, 둘, 셋.', '우리답게, 조금 더 특별하게.', '이 순간을 간직해요.'];
const descriptions = ['마음에 드는 구성을 골라주세요.', '사진을 감싸 줄 색과 한마디를 골라주세요.', '사진을 찍거나 기기에 있는 사진을 골라주세요.', '사진 위에 스티커와 문구를 자유롭게 놓아보세요.', '완성 이미지는 내 기기에만 저장돼요.'];
const nextLabels = ['프레임 고르기', '사진 찍으러 가기', '꾸미러 가기', '완성하기'];
let state = { step: 0, count: 4, frame: 0, orientation: 'portrait', photos: Array(4).fill(null), selectedPhoto: 0, selectedDeco: null, filter: 'original', decorations: [], event: structuredClone(DEFAULT_EVENT) };
let stream = null, facing = 'user', busy = false, starting = false, cameraEpoch = 0, captureEpoch = 0, toastTimeout, downloadURL;
let photoDate = new Date(), assetImages = new Map(), failedAssets = new Set();
const pointers = new Map();
let gesture = null;
let blocked = false, assetReady = Promise.resolve();
const editDialog = $('edit-dialog'), previewHome = canvas.parentElement, toolsHome = $('decoration-tools').parentElement;
const cropCanvas = $('crop-preview'), cropPointers = new Map();
let cropGesture = null;
const editorView=createEditorView(editDialog,canvas);
const saveCanvas=$('save-preview');
for(const group of [...new Set(EXPORT_FORMATS.map(f=>f.group))]){const optgroup=document.createElement('optgroup');optgroup.label=group;for(const f of EXPORT_FORMATS.filter(f=>f.group===group))optgroup.append(Object.assign(document.createElement('option'),{value:f.id,textContent:f.name}));$('export-format').append(optgroup);}
$('export-format').addEventListener('change',()=>render());
const exportPicker=createExportPicker(()=>canvas,()=>render());

function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimeout); toastTimeout = setTimeout(() => $('toast').classList.remove('visible'), 4500); }
function createButton(className, text, handler) { const el = document.createElement('button'); el.className = className; el.textContent = text; el.type = 'button'; el.addEventListener('click', handler); return el; }
function renderChoices() {
  if (!state.event.frames.some(f => !f.layoutCount || (f.orientation || 'portrait') === state.orientation)) state.orientation = state.event.frames[0].orientation || 'portrait';
  if (!state.event.frames.some(f => compatibleFrame(f,state.count,state.orientation))) { state.count = [2,4,6,8].find(n => state.event.frames.some(f => compatibleFrame(f,n,state.orientation))); state.photos = Array(state.count).fill(null); }
  if (!state.event.frames[state.frame] || !compatibleFrame(state.event.frames[state.frame], state.count, state.orientation)) state.frame = state.event.frames.findIndex(f => compatibleFrame(f,state.count,state.orientation));
  $('cut-options').replaceChildren();
  for (const count of [2, 4, 6, 8]) {
    const button = createButton(`cut-option ${state.count === count ? 'selected' : ''}`, '', () => {
      if (count !== state.count && state.photos.some(Boolean) && !confirm('컷 수를 바꾸면 촬영한 사진과 꾸미기가 초기화돼요. 바꿀까요?')) return;
      if (count !== state.count) { state.count = count; state.photos = Array(count).fill(null); state.decorations = []; state.selectedPhoto = 0; state.selectedDeco = null; }
      renderChoices(); renderThumbnails(); render();
    });
    button.setAttribute('aria-pressed', String(state.count === count));
    button.disabled = !state.event.frames.some(f => compatibleFrame(f, count, state.orientation));
    if (button.disabled) button.title = '이 컷 수에 사용할 행사 프레임이 없어요.';
    const cols = state.orientation === 'landscape' ? ({2:2,4:2,6:3,8:4}[count]) : count === 2 ? 1 : 2;
    const strip = document.createElement('span'); strip.className = `mini-strip ${cols > 1 ? 'grid' : ''}`; strip.style.gridTemplateColumns = `repeat(${cols},1fr)`; strip.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < count; i++) strip.append(document.createElement('i'));
    const title = document.createElement('strong'); title.textContent = `${count}컷`;
    const desc = document.createElement('small'); desc.textContent = `${cols} × ${count / cols}`;
    button.append(strip, title, desc);
    if (state.count === count) { const check = document.createElement('span'); check.className = 'check'; check.textContent = '✓'; button.append(check); }
    $('cut-options').append(button);
  }
  $('orientation-options').replaceChildren(...[['portrait','세로 4×6'],['landscape','가로 6×4']].map(([value,label]) => { const b = createButton(state.orientation === value ? 'selected' : '',label,()=>{state.orientation=value;state.photos.forEach(p=>{if(p){p.zoom=1;p.panX=0;p.panY=0;}});renderChoices();renderThumbnails();render();});b.setAttribute('aria-pressed',String(state.orientation===value));b.disabled=!state.event.frames.some(f=>!f.layoutCount||(f.orientation||'portrait')===value);return b; }));
  $('frame-options').replaceChildren();
  state.event.frames.forEach((frame, index) => {
    if (!compatibleFrame(frame, state.count, state.orientation)) return;
    const button = createButton(`frame-option ${state.frame === index ? 'selected' : ''}`, '', () => { state.frame = index; renderChoices(); render(); });
    button.setAttribute('aria-pressed', String(state.frame === index));
    const sample = document.createElement('span'); sample.className = 'color-sample'; sample.style.background = frame.bg;
    if (frame.overlay) { const image = new Image(); image.src = frame.overlay; image.alt = ''; sample.append(image); }
    const label = document.createElement('span'); label.textContent = frame.name;
    button.append(sample, label); $('frame-options').append(button);
  });
  $('frame-name').textContent = state.event.frames[state.frame].name;
  $('filter-options').replaceChildren();
  FILTERS.forEach(filter => {
    const button = createButton(`filter-chip ${state.filter === filter.id ? 'selected' : ''}`, filter.name, () => { state.filter = filter.id; renderChoices(); render(); });
    button.setAttribute('aria-pressed', String(state.filter === filter.id)); $('filter-options').append(button);
  });
  $('sticker-options').replaceChildren();
  state.event.stickers.forEach(sticker => {
    const button = createButton('sticker-button', sticker.text || '', () => {
      if (sticker.url && !assetImages.has(sticker.url)) { toast(failedAssets.has(sticker.url) ? '이 이미지를 불러오지 못했어요. 다른 스티커를 골라 주세요.' : '스티커를 불러오는 중이에요. 잠시 후 다시 선택해 주세요.'); return; }
      addDecoration({ type: sticker.url ? 'image' : 'symbol', text: sticker.text || '', url: sticker.url || '', color: '#ffffff' });
    });
    button.setAttribute('aria-label', `${sticker.name} 스티커 추가`);
    if (sticker.url) { const img = document.createElement('img'); img.src = sticker.url; img.alt = ''; img.width = 30; img.height = 30; img.style.objectFit = 'contain'; button.append(img); }
    $('sticker-options').append(button);
  });
}
function go(step) {
  if (busy) return;
  if (step >= 3 && !state.photos.every(Boolean)) { toast('모든 칸에 사진을 채워 주세요.'); return; }
  if (state.step === 2 && step !== 2) stopCamera();
  state.step = step; state.selectedDeco = null; pointers.clear(); gesture = null;
  renderSteps(); render(); updateAdjustment();
  $('step-title').focus({ preventScroll: true });
  window.scrollTo({ top: Math.max(0, document.querySelector('.steps').getBoundingClientRect().top + scrollY - 15), behavior: 'smooth' });
}
function renderSteps() {
  document.body.dataset.step = String(state.step);
  $('step-list').replaceChildren();
  steps.forEach((label, index) => { const li = document.createElement('li'); li.className = index === state.step ? 'active' : index < state.step ? 'done' : ''; if (index === state.step) li.setAttribute('aria-current', 'step'); const n = document.createElement('span'); n.className = 'step-number'; n.textContent = index < state.step ? '✓' : String(index + 1).padStart(2, '0'); const l = document.createElement('span'); l.className = 'step-label'; l.textContent = label; li.append(n, l); $('step-list').append(li); });
  document.querySelectorAll('.step-content').forEach(el => el.hidden = Number(el.dataset.step) !== state.step);
  $('step-title').textContent = titles[state.step]; $('step-kicker').textContent = `STEP ${String(state.step + 1).padStart(2, '0')} / ${['LAYOUT', 'FRAME', 'CAPTURE', 'DECORATE', 'KEEP'][state.step]}`;
  $('step-description').textContent = descriptions[state.step]; $('step-counter').textContent = `${state.step + 1} / 5`;
  $('back').hidden = state.step === 0; $('next').hidden = state.step === 4;
  $('expand-preview').hidden = state.step !== 3 && state.step !== 4;
  $('change-layout').hidden = state.step !== 3;
  labelButton($('next'), ['frame', 'camera', 'sticker', 'check'][state.step] || 'check', nextLabels[state.step] || '', true);
  $('preview-hint').textContent = state.step === 3 ? '사진 선택 · 드래그 이동 · 모서리 / 두 손가락으로 확대' : state.step === 4 ? '오늘의 우리, 오래 간직해요' : '나만의 한 장이 만들어지는 중';
  updateButtons();
}
function updateCameraGeometry(){const slot=currentGeometry().slots[state.selectedPhoto]||currentGeometry().slots[0],shell=$('camera-shell'),parent=$('web-capture-area');if(!slot||parent.hidden)return;const ratio=slot.w/slot.h,maxH=Math.max(130,Math.min(innerHeight*.34,420)),width=Math.min(parent.clientWidth,maxH*ratio);shell.style.width=width+'px';shell.style.height=width/ratio+'px';$('web-capture-guide').textContent=(state.selectedPhoto+1)+'번 컷 · 사진 칸과 같은 비율·구도로 저장돼요.';}
window.addEventListener('resize',updateCameraGeometry);
function updateButtons() {
  $('next').disabled = blocked || busy || (state.step === 2 && !state.photos.every(Boolean)); $('back').disabled = busy;
  $('capture').disabled = !stream || busy; $('auto-capture').disabled = !stream || busy;
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
function fitText(text, x, y, maxWidth, size, color, weight = '500') {
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; let actual = size;
  do { ctx.font = `${weight} ${actual}px KerisBaeum, Arial, "Malgun Gothic", sans-serif`; if (ctx.measureText(text).width <= maxWidth) break; actual -= 1; } while (actual > 9);
  ctx.fillText(text, x, y, maxWidth);
}
function branding(g, frame) {
  drawBranding(ctx, state.event, g, assetImages, frame.ink);
}
function decorationBox(d, g) {
  const font = d.size * g.width; let w, h;
  if (d.type === 'image') { const img = assetImages.get(d.url); h = font; w = img ? font * img.width / img.height : font; }
  else { ctx.font = `700 ${font}px KerisBaeum, Arial, "Malgun Gothic", sans-serif`; w = ctx.measureText(d.text).width; h = font * 1.2; }
  return { x: d.x * g.width, y: d.y * g.height, w: Math.max(w, 20), h: Math.max(h, 20), font };
}
function currentGeometry() { return layout(state.count, state.event, { frame: state.event.frames[state.frame], orientation: state.orientation, caption: Boolean($('caption').value.trim()), captureDate: $('show-date').checked }); }
function render(exporting = false) {
  const g = currentGeometry(), frame = state.event.frames[state.frame];
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
  const overlay = assetImages.get(frame.overlay); if (overlay) ctx.drawImage(overlay, 0, 0, g.width, g.height);
  branding(g, frame);
  fitText($('caption').value || ' ', g.width / 2, g.footerY + 48, g.width - 80, 23, frame.ink, '700');
  if ($('show-date').checked) fitText(photoDate.toLocaleDateString('sv-SE').replaceAll('-', '. '), g.width / 2, g.footerY + 82, g.width - 80, 13, frame.ink);
  state.decorations.forEach(d => { const b = decorationBox(d, g); ctx.save(); ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillStyle = d.color; ctx.font = `700 ${b.font}px KerisBaeum, Arial, "Malgun Gothic", sans-serif`; if (d.type === 'image') { const image = assetImages.get(d.url); if (image) ctx.drawImage(image, b.x - b.w / 2, b.y - b.h / 2, b.w, b.h); } else ctx.fillText(d.text, b.x, b.y); ctx.restore(); });
  if (!exporting && state.step === 3) {
    if (state.selectedDeco !== null) { const d = state.decorations[state.selectedDeco]; if (d) { const b = decorationBox(d, g); const scale = g.width / Math.max(1, canvas.getBoundingClientRect().width), handle = 5 * scale, gap = 4 * scale; ctx.strokeStyle = '#52882d'; ctx.lineWidth = 1.4 * scale; ctx.setLineDash([4 * scale, 3 * scale]); ctx.strokeRect(b.x - b.w / 2 - gap, b.y - b.h / 2 - gap, b.w + 2 * gap, b.h + 2 * gap); ctx.setLineDash([]); for (const dx of [-1, 1]) for (const dy of [-1, 1]) { ctx.fillStyle = '#c5f564'; ctx.strokeStyle = '#456d2a'; const x = b.x + dx * (b.w / 2 + gap), y = b.y + dy * (b.h / 2 + gap); ctx.fillRect(x - handle, y - handle, 2 * handle, 2 * handle); ctx.strokeRect(x - handle, y - handle, 2 * handle, 2 * handle); } } }
    else { const s = g.slots[state.selectedPhoto]; ctx.strokeStyle = '#98bb63'; ctx.lineWidth = 5; ctx.strokeRect(s.x + 2, s.y + 2, s.w - 4, s.h - 4); }
  }
  $('preview-layout').textContent = `${state.count} CUTS · ${state.orientation === 'landscape' ? '가로' : '세로'} 4×6`; $('output-size').textContent = `${g.width} × ${g.height}px · 300dpi`;
  if (!editDialog.open) {canvas.hidden=state.step===4;saveCanvas.hidden=state.step!==4;}
  if(state.step===4){exportPicker.refresh();const output=paintExport(canvas,saveCanvas,$('export-format').value,frame.bg);$('output-size').textContent=output.width+' × '+output.height+'px · 300dpi';$('export-format-note').textContent=output.width+' × '+output.height+'px · 사진을 자르지 않고 여백을 넣어요.';}
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
  savePhoto(image, index); $('camera-flash').classList.remove('flash'); void $('camera-flash').offsetWidth; $('camera-flash').classList.add('flash'); return true;
}
async function capture(auto) {
  if (busy || !stream) return;
  busy = true; const epoch = ++captureEpoch; updateButtons(); renderThumbnails();
  const indices = auto ? state.photos.map((p, i) => !p ? i : -1).filter(i => i >= 0) : [state.selectedPhoto];
  if (!indices.length) indices.push(state.selectedPhoto);
  try { for (const index of indices) { state.selectedPhoto = index; renderThumbnails(); if (!await captureOne(index, epoch)) break; if (auto) await wait(350); } if (epoch === captureEpoch) { const empty = state.photos.findIndex(p => !p); if (empty >= 0) state.selectedPhoto = empty; toast(state.photos.every(Boolean) ? '모든 순간을 담았어요. 이제 꾸며볼까요?' : '찰칵! 다음 표정을 준비해요.'); } }
  catch (error) { toast(error.message); }
  finally { if (epoch === captureEpoch) { busy = false; $('countdown').textContent = ''; renderThumbnails(); updateButtons(); } }
}
function updateAdjustment() {
  const photo = state.photos[state.selectedPhoto]; $('zoom').value = photo?.zoom || 1; $('pan-x').value = photo?.panX || 0; $('pan-y').value = photo?.panY || 0;
  const d = state.decorations[state.selectedDeco]; $('decoration-edit').hidden = !d; if (d) { $('decoration-size').value = d.size; $('decoration-color').value = d.color; }
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
  editDialog.dataset.tool = tool;
  canvas.hidden = tool === 'photo'; cropCanvas.hidden = tool !== 'photo';
  $('edit-title').textContent = { stickers: '스티커로 꾸미기', text: '마음을 적어요', photo: '사진을 크게 보고 조정해요', filter: '오늘의 분위기' }[tool];
  $('edit-help').textContent = tool === 'photo' ? '아래에서 사진을 고르고, 끌어서 구도를 바꾸거나 두 손가락으로 확대해요.' : '보기 확대 후 세밀하게 꾸며요. ‘화면 이동’을 켜면 프레임을 끌거나 두 손가락으로 확대할 수 있어요.';
  document.querySelectorAll('[data-editor-tool]').forEach(b => { b.classList.toggle('selected', b.dataset.editorTool === tool); b.setAttribute('aria-pressed', String(b.dataset.editorTool === tool)); });
  renderPhotoPicker(); updateAdjustment(); render(); editorView.refresh();
}
function openEditorTool(tool = 'stickers') {
  if (state.step !== 3) return;
  if (!editDialog.open) { $('editor-viewport').prepend(canvas); $('expanded-tools').append($('decoration-tools')); document.body.classList.add('modal-open'); editDialog.showModal(); editorView.reset(); }
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
  state.decorations.push({ ...data, x: .5, y: .5 + (state.decorations.length % 4) * .035, size: data.type === 'text' ? .055 : .10 }); state.selectedDeco = state.decorations.length - 1; updateAdjustment(); render();
}
function point(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height }; }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function pointerDown(e) {
  if (state.step !== 3 || !editDialog.open) return; e.preventDefault(); canvas.setPointerCapture(e.pointerId); const p = point(e); pointers.set(e.pointerId, p); const g = currentGeometry();
  if (pointers.size === 2 && state.selectedDeco !== null) { const [a, b] = [...pointers.values()]; const d = state.decorations[state.selectedDeco]; gesture = { mode: 'pinch', distance: distance(a, b), size: d.size }; return; }
  if (pointers.size > 1) return;
  const selected = state.decorations[state.selectedDeco];
  if (selected) { const b = decorationBox(selected, g); const r = canvas.getBoundingClientRect(), hit = 22 * g.width / r.width;
    if (Math.abs(p.x - b.x) <= b.w / 2 && Math.abs(p.y - b.y) <= b.h / 2) { gesture = { mode: 'move', dx: p.x / g.width - selected.x, dy: p.y / g.height - selected.y }; return; }
    const gap = 4 * g.width / r.width; for (const dx of [-1, 1]) for (const dy of [-1, 1]) { const corner = { x: b.x + dx * (b.w / 2 + gap), y: b.y + dy * (b.h / 2 + gap) }; if (distance(p, corner) <= hit) { gesture = { mode: 'resize', distance: distance(p, { x: b.x, y: b.y }), size: selected.size }; return; } }
  }
  for (let i = state.decorations.length - 1; i >= 0; i--) { const b = decorationBox(state.decorations[i], g); if (Math.abs(p.x - b.x) <= b.w / 2 + 16 && Math.abs(p.y - b.y) <= b.h / 2 + 16) { state.selectedDeco = i; gesture = { mode: 'move', dx: p.x / g.width - state.decorations[i].x, dy: p.y / g.height - state.decorations[i].y }; updateAdjustment(); render(); return; } }
  state.selectedDeco = null; const i = g.slots.findIndex(s => p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h); if (i >= 0) state.selectedPhoto = i; gesture = null; updateAdjustment(); render();
}
function pointerMove(e) {
  if (!pointers.has(e.pointerId)) return; e.preventDefault(); const p = point(e); pointers.set(e.pointerId, p); const d = state.decorations[state.selectedDeco]; if (!gesture || !d) return; const g = currentGeometry();
  if (gesture.mode === 'move') { const b = decorationBox(d, g); d.x = clamp(p.x / g.width - gesture.dx, Math.min(.48, b.w / 2 / g.width), Math.max(.52, 1 - b.w / 2 / g.width)); d.y = clamp(p.y / g.height - gesture.dy, b.h / 2 / g.height, 1 - b.h / 2 / g.height); }
  else if (gesture.mode === 'resize') d.size = clamp(gesture.size * distance(p, { x: d.x * g.width, y: d.y * g.height }) / Math.max(gesture.distance, 1), .03, .22);
  else if (gesture.mode === 'pinch' && pointers.size === 2) { const [a, b] = [...pointers.values()]; d.size = clamp(gesture.size * distance(a, b) / Math.max(gesture.distance, 1), .03, .22); }
  updateAdjustment(); render();
}
function pointerEnd(e) { pointers.delete(e.pointerId); if (pointers.size < 2 && gesture?.mode === 'pinch') gesture = null; if (!pointers.size) gesture = null; }
async function exportImage() {
  if (!state.photos.every(Boolean)) throw new Error('사진을 모두 채워 주세요.');
  await assetReady;
  const required = [state.event.frames[state.frame].overlay, ...(brandingModel(state.event).logo.visible ? [state.event.logo] : []), ...state.decorations.filter(d => d.type === 'image').map(d => d.url)].filter(Boolean);
  if (required.some(url => failedAssets.has(url))) throw new Error('선택한 디자인을 불러오지 못했어요. 다른 프레임을 선택하거나 네트워크를 확인해 주세요.');
  render(true);
  try { const outputCanvas=document.createElement('canvas');paintExport(canvas,outputCanvas,$('export-format').value,state.event.frames[state.frame].bg); const blob = await new Promise((resolve, reject) => outputCanvas.toBlob(b => b ? resolve(b) : reject(new Error('이미지를 생성하지 못했어요.')), 'image/png')); return await printPNG(blob); }
  finally { render(); }
}
async function loadAssets() {
  const urls = [state.event.logo, ...state.event.frames.map(f => f.overlay), ...state.event.stickers.map(s => s.url)].filter(Boolean);
  await Promise.all([...new Set(urls)].map(async url => { try { assetImages.set(url, await imageFromURL(url)); } catch { failedAssets.add(url); } }));
  if (failedAssets.size) toast('일부 행사 디자인을 불러오지 못했어요. 다른 디자인을 선택할 수 있어요.');
  render();
}
async function bootEvent() {
  const params = new URLSearchParams(location.search), id = params.get('event');
  if (!id && !params.has('preview') && !params.has('demo') && (matchMedia('(display-mode: standalone)').matches || navigator.standalone)) { try { const previous = localStorage.getItem('chalkak-last-event'); if (/^[a-zA-Z0-9_-]{1,100}$/.test(previous || '')) { location.replace(`./booth.html?event=${encodeURIComponent(previous)}`); return; } } catch { /* 저장소가 제한되면 QR 안내를 표시 */ } }
  if (!id && !params.has('preview') && !params.has('demo')) { blocked = true; $('step-title').textContent = '행사 QR로 참여해 주세요.'; $('step-description').textContent = '학교에서 안내받은 QR을 스캔하면 해당 행사 사진관이 열려요.'; $('next').disabled = true; return; }
  if (params.has('preview')) {
    try { const preview = sessionStorage.getItem('moment-event-preview'); if (preview) state.event = normalizeEvent(JSON.parse(preview)); } catch { toast('행사 미리보기를 불러오지 못했어요.'); }
  } else if (id) {
    blocked = true; $('next').disabled = true;
    try { const { loadPublicEvent } = await import('./public-event.js'); state.event = await loadPublicEvent(id); blocked = false; try { localStorage.setItem('chalkak-last-event', id); } catch { /* 사진은 저장하지 않으며 행사 ID만 선택적으로 기억 */ } }
    catch (error) { $('step-title').textContent = '행사를 열 수 없어요.'; $('step-description').textContent = error.code === 'permission-denied' ? '게시되지 않았거나 삭제된 행사입니다. 운영자에게 QR을 확인해 주세요.' : error.message; toast('행사 설정을 확인해 주세요.'); return; }
  }
  if (id || params.has('preview')) { $('event-intro').hidden = false; document.title = `${state.event.school} ${state.event.title} — 사제동행 찰칵! 포토`; document.querySelector('h1').textContent = state.event.title; document.querySelector('.intro-copy').textContent = [state.event.school, state.event.schedule].filter(Boolean).join(' · '); }
  $('show-date').checked = brandingModel(state.event).captureDate;
  state.orientation = state.event.orientation || 'portrait';
  renderChoices(); renderSteps(); render(); assetReady = loadAssets();
}

$('next').addEventListener('click', () => go(state.step + 1)); $('back').addEventListener('click', () => go(state.step - 1));
$('caption').addEventListener('input', () => render()); $('show-date').addEventListener('change', () => render());
$('camera-start').addEventListener('click', startCamera); $('camera-flip').addEventListener('click', () => { facing = facing === 'user' ? 'environment' : 'user'; startCamera(); });
$('capture').addEventListener('click', () => capture(false)); $('auto-capture').addEventListener('click', () => capture(true));
$('cancel-capture').addEventListener('click', () => { captureEpoch++; busy = false; $('countdown').textContent = ''; renderThumbnails(); });
async function importPhotoFiles(e) {
  if (busy) return; const files = [...e.target.files]; if (!files.length) return; busy = true; updateButtons(); let imported = 0;
  try {
    const indices = Array.from({ length: state.count }, (_, n) => (state.selectedPhoto + n) % state.count);
    for (const [n, file] of files.slice(0, state.count).entries()) {
      if (!file.type.startsWith('image/') || file.size > 25 * 1024 * 1024) { toast('25MB 이하 이미지 파일을 선택해 주세요.'); continue; }
      const url = URL.createObjectURL(file);
      try { const img = await imageFromURL(url); const c = document.createElement('canvas'); const scale = Math.min(1, 1800 / Math.max(img.width, img.height)); c.width = Math.max(1, Math.round(img.width * scale)); c.height = Math.max(1, Math.round(img.height * scale)); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); const resized = await imageFromURL(c.toDataURL('image/jpeg', .93)); savePhoto(resized, indices[n]); imported++; } catch { toast('이 이미지를 읽지 못했어요. JPEG·PNG·WebP로 다시 선택해 주세요.'); } finally { URL.revokeObjectURL(url); }
    }
    if (imported) { state.selectedPhoto = Math.max(0, state.photos.findIndex(p => !p)); toast(`${imported}장의 사진을 담았어요. 사진은 전송되지 않았어요.`); }
  } finally { busy = false; e.target.value = ''; renderThumbnails(); updateButtons(); }
}
$('photo-upload').addEventListener('change',importPhotoFiles); $('native-photo').addEventListener('change',importPhotoFiles);
function selectCaptureMethod(native){if(busy)return;if(native)stopCamera();$('native-capture-area').hidden=!native;$('web-capture-area').hidden=native;$('native-mode').setAttribute('aria-pressed',String(native));$('web-mode').setAttribute('aria-pressed',String(!native));updateCameraGeometry();}
$('native-mode').addEventListener('click',()=>selectCaptureMethod(true));$('web-mode').addEventListener('click',()=>selectCaptureMethod(false));
$('native-capture').addEventListener('click',()=>{if(busy)return;stopCamera();$('native-photo').click();});
$('demo').addEventListener('click', async () => {
  if (state.photos.some(Boolean) && !confirm('현재 사진을 샘플 이미지로 바꿀까요?')) return;
  busy = true; updateButtons();
  try { for (let i = 0; i < state.count; i++) { const c = document.createElement('canvas'); c.width = 1000; c.height = 750; const cc = c.getContext('2d'); const colors = [['#cbdac1', '#7c946b'], ['#ead4c6', '#b87a64'], ['#d0ddec', '#748ca8'], ['#e0d5e5', '#9c81a5']][i % 4]; const grad = cc.createLinearGradient(0, 0, 1000, 750); grad.addColorStop(0, colors[0]); grad.addColorStop(1, colors[1]); cc.fillStyle = grad; cc.fillRect(0, 0, 1000, 750); cc.fillStyle = '#ffffff55'; cc.beginPath(); cc.arc(780, 130, 190, 0, Math.PI * 2); cc.fill(); cc.fillStyle = '#fffaf0'; cc.font = '200px Georgia'; cc.textAlign = 'center'; cc.fillText(['✿', '☺', '✦', '♡'][i % 4], 500, 380); cc.font = '18px Arial'; cc.fillText('S A M P L E   M O M E N T   ' + String(i + 1).padStart(2, '0'), 500, 550); savePhoto(await imageFromURL(c.toDataURL()), i); } toast('샘플 사진이에요. 마음껏 꾸며보세요.'); } finally { busy = false; renderThumbnails(); updateButtons(); }
});
for (const [id, key] of [['zoom', 'zoom'], ['pan-x', 'panX'], ['pan-y', 'panY']]) $(id).addEventListener('input', e => { const photo = state.photos[state.selectedPhoto]; if (photo) { photo[key] = Number(e.target.value); render(); } });
$('add-text').addEventListener('click', () => { const text = $('decoration-text').value.trim(); if (!text) return toast('문구를 먼저 입력해 주세요.'); addDecoration({ type: 'text', text, color: '#ffffff' }); $('decoration-text').value = ''; });
$('decoration-size').addEventListener('input', e => { const d = state.decorations[state.selectedDeco]; if (d) { d.size = Number(e.target.value); render(); } });
$('decoration-color').addEventListener('input', e => { const d = state.decorations[state.selectedDeco]; if (d) { d.color = e.target.value; render(); } });
$('delete-decoration').addEventListener('click', () => { if (state.selectedDeco === null) return; state.decorations.splice(state.selectedDeco, 1); state.selectedDeco = null; updateAdjustment(); render(); });
canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointermove', pointerMove); for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, pointerEnd);
canvas.addEventListener('click', e => { if (state.step !== 3 || editDialog.open) return; const p = point(e), g = currentGeometry(); const i = g.slots.findIndex(s => p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h); if (i >= 0) state.selectedPhoto = i; openEditorTool(i >= 0 ? 'photo' : 'stickers'); });
$('expand-preview').addEventListener('click', () => {if(state.step===4)go(3);openEditorTool();});
$('change-layout').addEventListener('click', () => go(0));
document.querySelectorAll('[data-open-tool]').forEach(b => b.addEventListener('click', () => openEditorTool(b.dataset.openTool)));
document.querySelectorAll('[data-editor-tool]').forEach(b => b.addEventListener('click', () => selectEditorTool(b.dataset.editorTool)));
$('close-edit').addEventListener('click', closeEditor);
editDialog.addEventListener('cancel', e => { e.preventDefault(); closeEditor(); });
canvas.tabIndex = 0; canvas.addEventListener('keydown', e => { const d = state.decorations[state.selectedDeco]; if (!d || state.step !== 3) return; if (e.key.startsWith('Arrow')) { e.preventDefault(); d.x = clamp(d.x + (e.key === 'ArrowRight' ? .01 : e.key === 'ArrowLeft' ? -.01 : 0), .03, .97); d.y = clamp(d.y + (e.key === 'ArrowDown' ? .01 : e.key === 'ArrowUp' ? -.01 : 0), .02, .98); render(); } if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); $('delete-decoration').click(); } });
$('download').addEventListener('click', async () => { try { downloadBlob(await exportImage(), `moment-${$('export-format').value}-${photoDate.toISOString().slice(0, 10)}.png`); toast('이미지를 만들었어요. 기기의 다운로드를 확인해 주세요.'); } catch (error) { toast(`저장 실패: ${error.message}`); } });
$('share').addEventListener('click', async () => { try { const blob = await exportImage(), file = new File([blob], 'moment.png', { type: 'image/png' }); if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: state.event.title }); else { if (downloadURL) URL.revokeObjectURL(downloadURL); downloadURL = URL.createObjectURL(blob); const link = Object.assign(document.createElement('a'), { href: downloadURL, target: '_blank', rel: 'noopener' }); link.click(); toast('이미지를 길게 눌러 저장하거나 PNG 저장 버튼을 이용해 주세요.'); } } catch (error) { if (error.name !== 'AbortError') toast('공유하지 못했어요. PNG 저장 버튼을 이용해 주세요.'); } });
$('restart').addEventListener('click', () => { if (!confirm('새로 시작할까요? 저장하지 않은 사진과 꾸미기는 사라져요.')) return; stopCamera(); state.photos = Array(state.count).fill(null); state.decorations = []; state.selectedPhoto = 0; state.filter = 'original'; renderChoices(); renderThumbnails(); go(0); });
document.addEventListener('visibilitychange', () => { if (document.hidden) stopCamera(); }); window.addEventListener('pagehide', stopCamera);
window.addEventListener('beforeunload', e => { if (state.photos.some(Boolean)) { e.preventDefault(); e.returnValue = ''; } });
for (const [id, name, label] of [['back', 'back', '이전'], ['native-capture', 'camera', '기본 카메라로 촬영'], ['camera-start', 'camera', '카메라 켜기'], ['camera-flip', 'flip', '카메라 전환'], ['download', 'save', 'PNG 이미지 저장'], ['share', 'share', '이미지 공유 / 기기에 저장'], ['restart', 'refresh', '새로운 순간 담기'], ['close-edit', 'back', '돌아가기'], ['expand-preview', 'expand', '크게 편집'], ['change-layout', 'frame', '컷 변경'], ['demo', 'camera', '카메라 없이 샘플로 체험하기']]) labelButton($(id), name, label);
document.querySelectorAll('[data-open-tool], [data-editor-tool]').forEach(b => { const tool = b.dataset.openTool || b.dataset.editorTool; const name = { stickers: 'sticker', text: 'text', photo: 'crop', filter: 'filter' }[tool]; labelButton(b, name, { stickers: '스티커', text: '문구', photo: '사진 구도', filter: '필터' }[tool]); });
renderChoices(); renderThumbnails(); renderSteps(); render(); bootEvent();
document.fonts.ready.then(() => render());

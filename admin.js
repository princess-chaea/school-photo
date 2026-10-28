import {createExtraTextEditor} from './extra-text-editor.js';
import {createTextStyleControls} from './text-style-controls.js';
import {confirmAction} from './app-dialog.js';
import {fillFontSelect,loadFont,fontFamily} from './fonts.js';
import {createOperations} from './operations.js';
import {normalizeSharing,validateSharing,parsePadletDetails,callCollectionRelay} from './sharing.js';
import QRCode from 'qrcode';
import { DEFAULT_EVENT, DEFAULT_FRAMES, DEFAULT_STICKERS, normalizeEvent, imageFromURL, downloadBlob, eventURL, brandingModel, BRAND_KEYS } from './core.js';
import * as cloud from './cloud.js';
import { labelButton } from './icons.js';
import { optimizeDesign, formatBytes } from './optimize.js';
import { createFrameEditor } from './frame-editor.js';
import { paintFramePreview } from './frame-preview.js';
import { createLibraries } from './libraries.js';

const $ = id => document.getElementById(id);
let user = null, events = [], assets = [], editing = null, dirty = false, locked = false, qrEvent = null, toastTimer, previewEpoch = 0, authEpoch = 0;
let school = { school: '', logo: '' }, profileDirty = false;
let frameEditor, libraries, extraTextEditor, sharedAssets = [];
const textStyleControls=[];
const operations=createOperations({cloud,getUser:()=>user,run,toast});
const demo = !cloud.configured || new URLSearchParams(location.search).has('demo');
const kinds = { logo: '학교 로고', frame: '투명 프레임', sticker: '스티커', palette: '단색 프레임' };
function toast(text) { $('toast').textContent = text; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 4500); }
function errorMessage(error) {
  const messages = { 'auth/unauthorized-domain': 'Firebase Authentication의 승인된 도메인에 현재 주소를 추가해 주세요.', 'auth/popup-blocked': '팝업이 차단됐어요. 페이지 이동 로그인을 사용해 주세요.', 'auth/operation-not-allowed': 'Firebase Authentication에서 Google 로그인을 켜 주세요.', 'permission-denied': '접근 권한이 없어요. 로그인 상태와 Firebase 보안 규칙을 확인해 주세요.', 'storage/unauthorized': '디자인 저장 권한이 없어요. Storage 보안 규칙을 확인해 주세요.', 'auth/network-request-failed': '네트워크 연결을 확인해 주세요.' };
  return messages[error.code] || error.message || '처리하지 못했어요. 다시 시도해 주세요.';
}
async function run(action) {
  if (locked) return; locked = true; document.body.classList.add('is-busy'); $('admin-error').hidden = true;
  try { await action(); } catch (error) { if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(error.code)) { $('admin-error').textContent = errorMessage(error); $('admin-error').hidden = false; toast(errorMessage(error)); } }
  finally { locked = false; document.body.classList.remove('is-busy'); }
}
function button(text, action, className = 'text-button') { const el = document.createElement('button'); el.type = 'button'; el.className = className; el.textContent = text; if (text.includes('QR')) labelButton(el, 'qr', text.replace(' ↗', '')); el.addEventListener('click', action); return el; }
function text(tag, content, className = '') { const el = document.createElement(tag); el.textContent = content; el.className = className; return el; }
function persistDemo() { if (!demo) return; try { sessionStorage.setItem('moment-admin-demo', JSON.stringify({ events, assets, school })); } catch { toast('탭 임시 저장 용량이 부족해요. 작은 이미지를 사용해 주세요.'); } }
function switchTab(tab) { if (['shared','operations'].includes(tab) && !cloud.isSiteAdmin(user)) return; for (const id of ['events', 'frames', 'assets', 'school', 'shared','operations']) { $(`${id}-view`).hidden = id !== tab; $(`${id}-tab`).classList.toggle('selected', id === tab); $(`${id}-tab`).setAttribute('aria-selected', String(id === tab)); } if (tab === 'school') renderSchool();if(tab==='operations')operations.refresh(); }
function framesAvailable() { return [...DEFAULT_FRAMES, ...[...assets.filter(a => ['frame','palette'].includes(a.kind)), ...sharedAssets.filter(a => a.active && a.kind === 'frame')].map(a => ({ id: a.shared ? `shared-${a.id}` : a.id, name: a.name, bg: a.bg || '#fffdf6', ink: a.ink || '#34372f', layoutCount: a.layoutCount || 0, orientation: a.orientation || 'portrait',frameFormat:a.frameFormat||'print-4x6', ...(a.photoSlots ? {photoSlots:a.photoSlots} : {}), shared: Boolean(a.shared), ...(a.url ? { overlay: a.url } : {}) }))]; }
function stickersAvailable() { return [...DEFAULT_STICKERS, ...[...assets.filter(a => a.kind === 'sticker'), ...sharedAssets.filter(a => a.active && a.kind === 'sticker')].map(a => ({ id: a.shared ? `shared-${a.id}` : a.id, name: a.name, url: a.url, shared: Boolean(a.shared) }))]; }
function usesAsset(event, asset) { return (asset.url && (event.logo === asset.url || event.frames.some(f => f.overlay === asset.url) || event.stickers.some(s => s.url === asset.url))) || event.frames.some(f => f.id === asset.id); }
function renderEvents() {
  $('event-count').textContent = events.length; $('event-list').replaceChildren();
  if (!events.length) $('event-list').append(text('div', '아직 담아둔 행사가 없어요. 첫 번째 행사를 만들어 보세요. ✳', 'empty-state'));
  events.forEach(event => {
    const card = document.createElement('article'); card.className = 'event-card';
    const art = document.createElement('div'); art.className = 'event-card-art'; art.style.background = event.frames[0]?.bg || '#e9eddf';
    if (event.logo) { const img = new Image(); img.src = event.logo; img.alt = ''; art.append(img); } else art.append(text('span', '✳', 'symbol'));
    const body = document.createElement('div'); body.className = 'event-card-body'; body.append(text('span', event.published ? '● 게시 중' : '○ 비공개', `status-pill ${event.published ? '' : 'draft'}`), text('h3', event.title), text('p', [event.school, event.schedule].filter(Boolean).join(' · ') || '우리만의 행사'));
    const actions = document.createElement('div'); actions.className = 'card-actions';
    actions.append(button('편집', () => openEditor(event)), button('복제', () => openEditor({ ...structuredClone(event), id: crypto.randomUUID(), title: `${event.title.slice(0, 72)} (복제)`, published: false })));
    if (event.published) { actions.append(button('QR 발급 ↗', () => run(() => showQR(event)))); actions.append(button('게시 중지', () => run(async () => { if (!await confirmAction('게시를 중지하면 이 QR로 새로 접속할 수 없어요. 중지할까요?')) return; await storeEvent(event.id, event, false); toast('게시를 중지했어요. 이미 열린 화면에는 설정이 남아 있을 수 있어요.'); }))); }
    actions.append(button('삭제', () => run(async () => { if (!await confirmAction(`‘${event.title}’ 행사를 삭제할까요? 발급된 QR도 사용할 수 없게 됩니다.`)) return; if (!demo) await cloud.removeEvent(event.id); events = events.filter(e => e.id !== event.id); if (editing?.id === event.id) { editing = null; dirty = false; $('event-editor').hidden = true; } persistDemo(); renderEvents(); }), 'text-button danger'));
    body.append(actions); card.append(art, body); $('event-list').append(card);
  });
}
async function openEditor(event) {
  if (dirty && !await confirmAction('저장하지 않은 변경을 버리고 다른 행사를 열까요?')) return;
  editing = event ? structuredClone(event) : { ...structuredClone(DEFAULT_EVENT), id: crypto.randomUUID(), published: false, title: '', school: school.school, logo: school.logo, schedule: '' };
  $('event-title').value = editing.title; $('event-school').value = editing.school; $('event-schedule').value = editing.schedule; $('logo-position').value = editing.logoPosition;
  $('editor-title').textContent = editing.title || '새 행사 만들기'; $('event-editor').hidden = false; dirty = false;
  renderSharingSettings();renderEditorChoices(); updatePreview(); $('event-editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function renderEditorChoices() {
  if (!editing) return;
  $('event-logo').replaceChildren(Object.assign(document.createElement('option'), { value: '', textContent: '로고 없이' }));
  assets.filter(a => a.kind === 'logo').forEach(a => $('event-logo').append(Object.assign(document.createElement('option'), { value: a.url, textContent: a.name })));
  if (editing.logo && !assets.some(a => a.url === editing.logo)) $('event-logo').append(Object.assign(document.createElement('option'), { value: editing.logo, textContent: '기존 행사 로고' }));
  $('event-logo').value = editing.logo || '';
  renderLogoPreview('event', editing.logo);
  for (const [kind, available] of [['frames', framesAvailable()], ['stickers', stickersAvailable()]]) {
    // 기존 행사에 연결된 디자인도 보존합니다.
    const all = [...available, ...editing[kind].filter(a => !available.some(b => b.id === a.id))];
    $(`event-${kind}`).replaceChildren();
    all.forEach(design => {
      const selected = editing[kind].some(d => d.id === design.id);
      const b = button('', () => {
        if (selected) { if (kind === 'frames' && editing.frames.length === 1) return toast('프레임은 하나 이상 선택해 주세요.'); editing[kind] = editing[kind].filter(d => d.id !== design.id); }
        else { if (editing[kind].length >= (kind === 'frames' ? 32 : 64)) return toast('선택 가능한 디자인 개수에 도달했어요.'); editing[kind].push(design); }
        dirty = true; renderEditorChoices(); updatePreview();
      }, `design-choice ${selected ? 'selected' : ''}`);
      b.setAttribute('aria-pressed', String(selected)); b.setAttribute('aria-label', `${design.name} ${selected ? '선택 해제' : '선택'}`);
      if (design.url || design.overlay) { const img = new Image(); img.src = design.url || design.overlay; img.alt = ''; b.append(img); }
      else if (design.bg) { const swatch = text('span', '', 'swatch'); swatch.style.background = design.bg; b.append(swatch); }
      b.append(text('span', design.text || (kind === 'frames' ? `${design.name}${design.layoutCount ? ` · ${design.layoutCount}컷` : ''}` : ''))); if (design.shared) b.classList.add('shared-choice'); if (design.url) b.title = `${design.shared ? '공용 · ' : ''}${design.name}`; $(`event-${kind}`).append(b);
    });
  }
  $('publication-state').textContent = editing.published ? '● 게시 중 · 저장하면 기존 QR에도 반영됩니다' : '○ 비공개 · 게시 후 QR을 발급할 수 있어요';
  $('save-draft').textContent = editing.published ? '저장 (게시 유지)' : '임시 저장';
  $('publish-event').disabled = demo;
}
function readEditor() {
  if (!editing) throw new Error('행사를 먼저 선택해 주세요.');
  const title = $('event-title').value.trim(); if (!title) { $('event-title').focus(); throw new Error('행사명을 입력해 주세요.'); }
  return { ...editing, ...normalizeEvent({ ...editing, sharing:readSharingSettings(), title, school: $('event-school').value.trim(), schedule: $('event-schedule').value.trim(), logo: $('event-logo').value, logoPosition: $('logo-position').value }) };
}
async function storeEvent(id, event, published) {
  const saved = demo ? normalizeEvent(event) : await cloud.saveEvent(user.uid, id, event, published);
  const result = { ...saved, id, published, ownerId: user?.uid || 'demo' };
  events = [result, ...events.filter(e => e.id !== id)]; persistDemo(); renderEvents();
  if (editing?.id === id) { editing = structuredClone(result); dirty = false; $('editor-title').textContent = result.title; renderEditorChoices(); }
  return result;
}
async function saveEditor(publish) { const event = readEditor(); if(publish&&!demo&&['drive','padlet'].includes(event.sharing?.mode))await callCollectionRelay(event.sharing.relayUrl,{action:'verify',eventId:event.id,idToken:await user.getIdToken()}); const saved = await storeEvent(event.id, event, publish || event.published); toast(demo ? '이 탭에 체험 행사를 저장했어요. 클라우드에는 저장되지 않아요.' : saved.published ? '행사를 저장하고 게시했어요.' : '비공개로 저장했어요.'); if (publish && !demo) await showQR(saved); }
function previewEvent() { return editing ? { ...editing, title: $('event-title').value || '행사 이름', school: $('event-school').value, schedule: $('event-schedule').value, logo: $('event-logo').value, logoPosition: $('logo-position').value } : null; }
async function updatePreview() { const event = previewEvent(); if (!event) return; for(const key of ['title','school','schedule']){const select=$(`event-${key}-font`);select.value=brandingModel(event)[key].font;select.style.fontFamily=fontFamily(select.value);$(`event-${key}`).style.fontFamily=fontFamily(select.value);} for(const controls of textStyleControls)controls.refresh();extraTextEditor?.refresh(); frameEditor?.refresh(); await paintFramePreview($('admin-preview'), event); }
function renderAssets() { libraries?.render(); }
async function removePrivateAsset(asset) {
  if (events.some(e => usesAsset(e, asset)) || (editing && usesAsset(editing, asset)) || (asset.url && school.logo === asset.url)) return toast('행사나 학교 설정에서 사용 중인 자료예요. 먼저 해제하고 저장해 주세요.');
  if (!await confirmAction('‘' + asset.name + '’ 자료를 내 보관함에서 삭제할까요?')) return;
  if (!demo) await cloud.removeAsset(user.uid, asset); assets = assets.filter(a => a.id !== asset.id); persistDemo(); renderAssets(); renderEditorChoices(); renderSchool();
}
async function demoImage(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); }
function renderLogoPreview(target, url) {
  const card = $(`${target}-logo-preview`), image = $(`${target}-logo-image`), details = $(`${target}-logo-details`);
  card.hidden = !url;
  if (!url) { image.removeAttribute('src'); details.textContent = ''; return; }
  const asset = assets.find(a => a.url === url);
  const label = [asset?.name || '선택한 로고', asset?.width ? `${asset.width}×${asset.height}` : '', asset?.optimizedBytes ? `WebP · ${formatBytes(asset.optimizedBytes)}` : ''].filter(Boolean).join(' · ');
  details.textContent = label;
  image.onload = () => { details.textContent = label; card.classList.remove('image-error'); };
  image.onerror = () => { details.textContent = '로고를 불러오지 못했어요. 네트워크와 파일을 확인해 주세요.'; card.classList.add('image-error'); };
  if (image.getAttribute('src') !== url) image.src = url;
}
function renderSchool() {
  $('school-name').value = school.school;
  $('school-logo').replaceChildren(Object.assign(document.createElement('option'), { value: '', textContent: '로고 없이' }));
  assets.filter(a => a.kind === 'logo').forEach(a => $('school-logo').append(Object.assign(document.createElement('option'), { value: a.url, textContent: a.name })));
  $('school-logo').value = school.logo || '';
  renderLogoPreview('school', school.logo);
}
async function directLogo(file, target) {
  if (!file) return; toast('로고를 WebP로 최적화하고 있어요.');
  const optimized = await optimizeDesign(file, 'logo');
  const asset = demo ? { id: crypto.randomUUID(), kind: 'logo', name: file.name.replace(/\.[^.]+$/, ''), url: await demoImage(optimized.file), ...optimized.metadata } : await cloud.uploadAsset(user.uid, optimized.file, 'logo', file.name.replace(/\.[^.]+$/, ''), optimized.metadata);
  assets.push(asset);
  if (target === 'school') { school.logo = asset.url; profileDirty = true; renderSchool(); }
  else { editing.logo = asset.url; dirty = true; renderEditorChoices(); updatePreview(); }
  persistDemo(); renderAssets(); toast('로고를 추가했어요. 설정 저장도 눌러 주세요.');
}
async function showQR(event) {
  qrEvent = event; $('qr-title').textContent = event.title;
  $('public-base').value = import.meta.env.VITE_STUDENT_BASE_URL || (import.meta.env.DEV ? new URL('./', location.href).href : 'https://teacher-student-photo-students.web.app/');
  await refreshQR(); if (!$('qr-dialog').open) $('qr-dialog').showModal();
}
async function refreshQR() {
  const url = eventURL($('public-base').value.trim(), qrEvent.id); const u = new URL(url);
  if(!import.meta.env.DEV&&u.origin===location.origin)throw new Error('관리자 주소와 다른 학생 전용 사이트 주소를 입력해 주세요.');
  await QRCode.toCanvas($('qr-canvas'), url, { width: 260, margin: 3, errorCorrectionLevel: 'M', color: { dark: '#252820', light: '#ffffff' } });
  $('qr-url').value = url; $('open-event').href = url;
  $('qr-note').textContent = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(u.hostname) || u.protocol !== 'https:' ? '현재 주소는 다른 기기에서 촬영하기에 적합하지 않아요. 배포한 HTTPS 웹앱 주소를 넣어 주세요.' : '학생 배포용 주소입니다. 기본 주소에는 관리자 화면이 없어요. 실제 휴대폰으로 행사 접속을 확인해 주세요.';
}

$('google-login').addEventListener('click', () => run(() => cloud.login())); $('redirect-login').addEventListener('click', () => run(() => cloud.login(true)));
$('sign-out').addEventListener('click', () => run(async () => { if ((dirty || profileDirty) && !await confirmAction('저장하지 않은 변경이 있어요. 로그아웃할까요?')) return; await cloud.logout(); }));
$('events-tab').addEventListener('click', () => switchTab('events')); $('assets-tab').addEventListener('click', () => switchTab('assets')); $('school-tab').addEventListener('click', () => switchTab('school'));
$('operations-tab').onclick=()=>switchTab('operations');
$('frames-tab').addEventListener('click', () => switchTab('frames')); $('shared-tab').addEventListener('click', () => switchTab('shared'));
function readSharingSettings(){
  return validateSharing({mode:$('event-sharing-mode').value,url:$('event-sharing-url').value.trim(),relayUrl:$('event-sharing-relay').value.trim(),boardId:$('event-padlet-board').value.trim(),submissionKey:editing?.sharing?.submissionKey||crypto.randomUUID()});
}
function refreshSharingFields(){const mode=$('event-sharing-mode').value;$('sharing-link-fields').hidden=mode==='none';$('sharing-auto-fields').hidden=!['drive','padlet'].includes(mode);$('sharing-padlet-fields').hidden=mode!=='padlet';}
function renderSharingSettings(){const s=normalizeSharing(editing?.sharing);$('event-sharing-mode').value=s.mode;$('event-sharing-url').value=s.url;$('event-sharing-relay').value=s.relayUrl;$('event-padlet-board').value=s.boardId;$('event-padlet-key').value='';$('event-sharing-folder').value='';$('padlet-paste').value='';$('event-public-attachment').checked=false;$('collection-connection-status').textContent='';refreshSharingFields();}
for(const id of ['event-sharing-mode','event-sharing-url','event-sharing-relay','event-padlet-board'])$(id).oninput=()=>{dirty=true;refreshSharingFields();};
$('sharing-help').onclick=()=>$('sharing-help-dialog').showModal();$('close-sharing-help').onclick=()=>$('sharing-help-dialog').close();
$('parse-padlet').onclick=()=>{const parsed=parsePadletDetails($('padlet-paste').value);if(parsed.boardId)$('event-padlet-board').value=parsed.boardId;if(parsed.apiKey)$('event-padlet-key').value=parsed.apiKey;$('padlet-paste').value='';dirty=true;toast(parsed.boardId?'게시판 ID를 찾아 넣었어요. API 키도 확인해 주세요.':'개발자 메뉴의 URL·cURL·JS를 복사해 붙여 주세요.');};
$('copy-collection-owner').onclick=()=>run(async()=>{if(!user)throw new Error('실제 Google 로그인 후 사용할 수 있어요.');await navigator.clipboard.writeText(user.uid);toast('내 UID를 복사했어요. 수합 도우미의 OWNER_UID에 넣어 주세요.');});
$('connect-collection').onclick=()=>run(async()=>{
  if(demo)throw new Error('실제 Google 로그인과 교사 소유 수합 도우미가 필요해요.');
  const event=readEditor(),sharing=event.sharing;
  if(!['drive','padlet'].includes(sharing.mode))throw new Error('자동 수합 방식을 선택해 주세요.');
  await storeEvent(event.id,event,event.published);
  const result=await callCollectionRelay(sharing.relayUrl,{action:'configure',eventId:event.id,idToken:await user.getIdToken(),boardId:sharing.boardId,apiKey:$('event-padlet-key').value.trim(),folderId:$('event-sharing-folder').value.trim(),publicAttachment:$('event-public-attachment').checked});
  $('event-padlet-key').value='';$('collection-connection-status').textContent=result.message||'수합 연결을 확인했어요. 게시 후 학생 제출을 받을 수 있어요.';
});

$('new-event').addEventListener('click', () => openEditor()); $('close-editor').addEventListener('click', async () => { if (dirty && !await confirmAction('저장하지 않은 변경을 버릴까요?')) return; dirty = false; editing = null; $('event-editor').hidden = true; });
for (const [id, key] of [['event-title', 'title'], ['event-school', 'school'], ['event-schedule', 'schedule'], ['event-logo', 'logo'], ['logo-position', 'logoPosition']]) $(id).addEventListener('input', e => { dirty = true; if (editing) { editing[key] = e.target.value; if (key === 'logoPosition') { const { hasContent, hasTop, hasBottom, ...model } = brandingModel(editing); for (const part of BRAND_KEYS) model[part].position = e.target.value; editing.branding = model; } } if (key === 'logo') renderLogoPreview('event', e.target.value); updatePreview(); });
for(const key of ['title','school','schedule']){
  const select=$(`event-${key}-font`);fillFontSelect(select);
  select.addEventListener('change',()=>{if(!editing)return;const id=select.value;run(async()=>{await loadFont(id);if(!editing)return;const {hasContent,hasTop,hasBottom,...model}=brandingModel(editing);model[key]={...model[key],font:id};editing.branding=model;dirty=true;await updatePreview();});});
}
for(const [key,label] of [['title','행사명'],['school','학교명'],['schedule','행사 날짜']]){
 textStyleControls.push(createTextStyleControls($(`event-${key}-style`),{
  getState:()=>editing?{key,label,text:$(`event-${key}`).value,settings:brandingModel(previewEvent())[key],ink:editing.frames[0]?.ink}:null,
  onChange:part=>{if(!editing)return;const {hasContent,hasTop,hasBottom,...model}=brandingModel(previewEvent());model[key]={...model[key],...part};editing.branding=model;dirty=true;updatePreview();}
 }));
}
extraTextEditor=createExtraTextEditor($('extra-text-editor'),{getEvent:previewEvent,onChange:branding=>{if(!editing)return;editing.branding=branding;dirty=true;updatePreview();}});
$('school-name').addEventListener('input', e => { school.school = e.target.value; profileDirty = true; });
$('school-logo').addEventListener('change', e => { school.logo = e.target.value; profileDirty = true; renderLogoPreview('school', school.logo); });
for (const target of ['school', 'event']) $(`clear-${target}-logo`).addEventListener('click', () => { if (target === 'school') { school.logo = ''; profileDirty = true; $('school-logo').value = ''; } else if (editing) { editing.logo = ''; dirty = true; $('event-logo').value = ''; updatePreview(); } renderLogoPreview(target, ''); });
for (const target of ['school', 'event']) $(`${target}-logo-file`).addEventListener('change', e => { const file = e.target.files[0]; run(async () => { try { await directLogo(file, target); } finally { e.target.value = ''; } }); });
$('save-school').addEventListener('click', () => run(async () => { if (!demo) await cloud.saveSchool(user.uid, school); persistDemo(); profileDirty = false; toast(demo ? '체험용 학교 설정을 이 탭에 저장했어요.' : '내 학교 설정을 저장했어요. 새 행사에 자동으로 적용돼요.'); }));
$('save-draft').addEventListener('click', () => run(() => saveEditor(false))); $('publish-event').addEventListener('click', () => run(() => saveEditor(true)));
$('preview-event').addEventListener('click', () => run(async () => { const event = readEditor(); sessionStorage.setItem('moment-event-preview', JSON.stringify(normalizeEvent(event))); if (demo) { await storeEvent(event.id, event, false); } else { sessionStorage.setItem('moment-admin-editor', JSON.stringify(event)); dirty = false; } location.href = './booth.html?preview=1'; }));
$('asset-form').addEventListener('submit', e => { e.preventDefault(); run(async () => {
  const file = $('asset-file').files[0], kind = $('asset-kind').value, name = $('asset-name').value.trim();
  if (!file || !name) throw new Error('디자인 이름과 이미지를 선택해 주세요.');
  labelButton($('upload-asset'), 'refresh', 'WebP로 최적화 중…');
  try {
    const optimized = await optimizeDesign(file, kind, { forceWasm: new URLSearchParams(location.search).has('wasm') });
    labelButton($('upload-asset'), 'upload', '보관함에 저장 중…');
    const asset = demo ? { id: crypto.randomUUID(), name, kind, url: await demoImage(optimized.file), ...optimized.metadata } : await cloud.uploadAsset(user.uid, optimized.file, kind, name, optimized.metadata);
    assets.push(asset); persistDemo(); renderAssets(); renderEditorChoices(); $('asset-form').reset();$('asset-kind').value=kind;
    toast(`${formatBytes(file.size)} → ${formatBytes(optimized.file.size)} WebP로 ${demo ? '탭에 임시 보관' : '내 보관함에 저장'}했어요.`);
  } finally { labelButton($('upload-asset'), 'upload', '최적화 후 보관함에 추가'); }
}); });
$('add-palette').addEventListener('click', () => run(async () => { const name = $('palette-name').value.trim(); if (!name) return toast('프레임 이름을 입력해 주세요.'); const palette = { name, bg: $('palette-bg').value, ink: $('palette-ink').value }; assets.push(demo ? { ...palette, id: crypto.randomUUID(), kind: 'palette' } : await cloud.savePalette(user.uid, palette)); persistDemo(); renderAssets(); renderEditorChoices(); $('palette-name').value = ''; toast('단색 프레임을 추가했어요.'); }));
$('close-qr').addEventListener('click', () => $('qr-dialog').close()); $('refresh-qr').addEventListener('click', () => run(refreshQR));
$('download-qr').addEventListener('click', () => $('qr-canvas').toBlob(blob => { if (blob) downloadBlob(blob, `moment-qr-${qrEvent.id}.png`); }));
$('copy-link').addEventListener('click', () => run(async () => { try { await navigator.clipboard.writeText($('qr-url').value); toast('행사 링크를 복사했어요.'); } catch { $('qr-url').select(); toast('주소를 선택했어요. 길게 눌러 복사해 주세요.'); } }));
window.addEventListener('beforeunload', e => { if (dirty || profileDirty) { e.preventDefault(); e.returnValue = ''; } });
for (const [id, name, label] of [['new-event', 'plus', '새 행사 만들기'], ['preview-event', 'camera', '참가자 화면 미리보기'], ['save-draft', 'save', '임시 저장'], ['publish-event', 'check', '저장하고 게시'], ['close-editor', 'close', '닫기'], ['upload-asset', 'upload', '최적화 후 보관함에 추가'], ['download-qr', 'qr', 'QR 저장'], ['close-qr', 'close', '닫기'], ['enter-demo', 'camera', '관리 화면 체험하기']]) labelButton($(id), name, label);
libraries = createLibraries({ getAssets: () => assets, getShared: () => sharedAssets, getUser: () => user, demo, run, toast, removePrivate: removePrivateAsset, added: asset => { assets.push(asset); persistDemo(); renderAssets(); renderEditorChoices(); }, sharedAdded: asset => { sharedAssets.push(asset); renderAssets(); renderEditorChoices(); }, sharedChanged: (id, active) => { sharedAssets = sharedAssets.map(a => a.id === id ? { ...a, active } : a); renderAssets(); renderEditorChoices(); } });
frameEditor = createFrameEditor({ getEvent: previewEvent, onSave:()=>saveEditor(false), onChange: branding => { if (!editing) return; editing.branding = branding || undefined; dirty = true; updatePreview(); } });
document.fonts.ready.then(() => { if (editing) updatePreview(); });
if (demo) {
  $('setup-banner').hidden = false; $('login-card').hidden = false; $('google-login').disabled = true; $('redirect-login').hidden = true; $('demo-login-note').hidden = false; $('enter-demo').hidden = false; $('admin-workspace').hidden = true; $('user-name').textContent = '체험 모드';
  $('enter-demo').addEventListener('click', () => { document.body.classList.add('signed-in'); $('login-card').hidden = true; $('admin-workspace').hidden = false; });
  try { const saved = JSON.parse(sessionStorage.getItem('moment-admin-demo') || 'null'); if (saved) { events = saved.events; assets = saved.assets; school = saved.school || school; } } catch { /* 새 체험으로 시작 */ }
  renderEvents(); renderAssets();
} else {
  cloud.redirectResult().catch(error => { $('admin-error').textContent = errorMessage(error); $('admin-error').hidden = false; });
  cloud.watchUser(async current => {
    const epoch = ++authEpoch; user = current; operations.clear();events = []; assets = []; sharedAssets = []; school = { school: '', logo: '' }; profileDirty = false; dirty = false; editing = null; document.body.classList.toggle('signed-in', Boolean(current)); switchTab('events');
    $('user-name').textContent = current?.displayName || ''; $('sign-out').hidden = !current; $('login-card').hidden = Boolean(current); $('admin-workspace').hidden = !current; $('event-editor').hidden = true;
    $('operations-tab').hidden=!cloud.isSiteAdmin(current);if (!current) return;
    try {
      await cloud.recordOperatorUser(current).catch(()=>{});
      const [nextEvents, nextAssets, nextSchool, nextShared] = await Promise.all([cloud.listEvents(current.uid), cloud.listAssets(current.uid), cloud.loadSchool(current.uid), cloud.listSharedAssets(cloud.isSiteAdmin(current))]); if (epoch !== authEpoch) return; events = nextEvents; assets = nextAssets; school = nextSchool; sharedAssets = nextShared; renderEvents(); renderAssets(); renderSchool();
      try { const restored = JSON.parse(sessionStorage.getItem('moment-admin-editor') || 'null'); sessionStorage.removeItem('moment-admin-editor'); if (restored && (restored.ownerId === current.uid || !restored.ownerId)) { await openEditor(restored); dirty = true; } } catch { /* 복구할 편집 내용 없음 */ }
    } catch (error) { if (epoch === authEpoch) { $('admin-error').textContent = errorMessage(error); $('admin-error').hidden = false; } }
  });
}

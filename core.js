export const DEFAULT_FRAMES = [
  { id: 'ivory', name: '밀크 아이보리', bg: '#fffdf6', ink: '#34372f' },
  { id: 'black', name: '클래식 블랙', bg: '#242622', ink: '#fffdf6' },
  { id: 'sage', name: '소프트 세이지', bg: '#cbd7bf', ink: '#3e5134' },
  { id: 'pink', name: '피치 핑크', bg: '#f5d5d2', ink: '#79524d' },
  { id: 'blue', name: '클라우드 블루', bg: '#d5e3ed', ink: '#3e5969' },
  { id: 'butter', name: '버터 옐로', bg: '#f5e7a9', ink: '#706130' },
  { id: 'lilac', name: '라일락', bg: '#e0d8ee', ink: '#635075' },
  { id: 'lime', name: '프레시 라임', bg: '#c5f564', ink: '#354822' },
];
export const DEFAULT_STICKERS = [
  ...[['camera', '찰칵 카메라'], ['friendship', '선생님과 우리'], ['school', '우리 학교'], ['flower', '웃음꽃']].map(([id, name]) => ({ id: `image-${id}`, name, url: `/stickers/${id}.webp` })),
  ...['♡', '✦', '✿', '☺', '♥', '✧', '★', '☘'].map((text, i) => ({ id: `symbol-${i}`, name: text, text })),
];
export const DEFAULT_EVENT = { title: '사제동행 찰칵! 포토', school: '', schedule: '', logo: '', logoPosition: 'top', frames: DEFAULT_FRAMES, stickers: DEFAULT_STICKERS };
export const FILTERS = [
  { id: 'original', name: '오리지널', css: 'none' },
  { id: 'mono', name: '흑백', css: 'grayscale(1) contrast(1.08)' },
  { id: 'warm', name: '따뜻하게', css: 'sepia(.25) saturate(.9) brightness(1.05)' },
  { id: 'vintage', name: '빈티지', css: 'sepia(.4) contrast(.9) saturate(.8)' },
  { id: 'clear', name: '선명하게', css: 'contrast(1.12) saturate(1.18)' },
];
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export const BRAND_KEYS = ['logo', 'school', 'title', 'schedule'];
export const BRAND_LABELS = { logo: '로고', school: '학교명', title: '행사명', schedule: '행사 날짜' };
export const BRAND_SIZES = { logo: .105, school: .032, title: .027, schedule: .021 };
export function brandingModel(event = DEFAULT_EVENT) {
  const raw = event.branding && typeof event.branding === 'object' ? event.branding : {};
  const number = (n, fallback, min, max) => Number.isFinite(n) ? clamp(n, min, max) : fallback;
  const contents = { logo: event.logo, school: event.school, title: event.title !== DEFAULT_EVENT.title || event.branding ? event.title : '', schedule: event.schedule };
  const visible = BRAND_KEYS.filter(key => contents[key] && raw[key]?.visible !== false);
  const position = key => ['top', 'bottom', 'free'].includes(raw[key]?.position) ? raw[key].position : event.logoPosition === 'bottom' ? 'bottom' : 'top';
  const model = { height: number(raw.height, .14, .08, .24), captureDate: raw.captureDate === true };
  for (const key of BRAND_KEYS) {
    const item = raw[key] && typeof raw[key] === 'object' ? raw[key] : {};
    const group = visible.filter(k => position(k) === position(key)), textKeys = group.filter(k => k !== 'logo'), hasLogo = group.includes('logo');
    const index = textKeys.indexOf(key);
    const defaultY = key === 'logo' ? .5 : index >= 0 ? (index + 1) / (textKeys.length + 1) : .5;
    const defaultX = hasLogo && textKeys.length ? key === 'logo' ? .28 : .60 : .5;
    model[key] = { visible: item.visible !== false, position: position(key), x: number(item.x, defaultX, .05, .95), y: number(item.y, position(key) === 'free' ? .5 : defaultY, 0, 1), size: number(item.size, BRAND_SIZES[key], key === 'logo' ? .035 : .012, key === 'logo' ? .35 : .10), color: /^#[0-9a-f]{6}$/i.test(item.color || '') ? item.color : '' };
  }
  model.hasContent = visible.length > 0;
  model.hasTop = visible.some(key => position(key) === 'top');
  model.hasBottom = visible.some(key => position(key) === 'bottom');
  return model;
}
export function layout(count, event = DEFAULT_EVENT, options = {}) {
  if (![2,4,6,8].includes(count)) throw new Error('지원하지 않는 컷 수');
  const orientation = options.orientation || (options.frame?.layoutCount ? options.frame.orientation : event.orientation) || 'portrait';
  const landscape = orientation === 'landscape', width = landscape ? 1800 : 1200, height = landscape ? 1200 : 1800;
  const pad = 48, gap = 24, cols = landscape ? ({2:2,4:2,6:3,8:4}[count]) : count === 2 ? 1 : 2, rows = count / cols;
  const branding = brandingModel(event), fixed = Boolean(options.frame?.layoutCount);
  const brandH = Math.round(height * (fixed ? .14 : branding.height));
  const photoW = (width - pad * 2 - gap * (cols - 1)) / cols, photoH = (height - pad * 2 - brandH * 2 - gap * (rows - 1)) / rows;
  const top = pad + brandH, bottomY = height - pad - brandH;
  return { width, height, orientation, cols, rows, photoW, photoH, pad, brandH, footerH:100, brandY:event.logoPosition === 'bottom' ? bottomY : pad, brandAreas:{top:{y:pad,h:brandH},bottom:{y:bottomY,h:brandH},free:{y:0,h:height}}, footerY:height-pad-100, slots:Array.from({length:count},(_,i)=>({x:pad+(i%cols)*(photoW+gap),y:top+Math.floor(i/cols)*(photoH+gap),w:photoW,h:photoH})) };
}
export function templateGeometry(count, orientation = 'portrait') { return layout(count, DEFAULT_EVENT, { frame: { layoutCount: count, orientation }, orientation }); }
export function compatibleFrame(frame, count, orientation) { return !frame.layoutCount || (frame.layoutCount === count && (!orientation || (frame.orientation || 'portrait') === orientation)); }
export function crop(imageW, imageH, targetW, targetH, zoom = 1, panX = 0, panY = 0) {
  const scale = Math.max(targetW / imageW, targetH / imageH) * zoom;
  const w = targetW / scale, h = targetH / scale;
  return { x: (imageW - w) * (clamp(panX, -1, 1) + 1) / 2, y: (imageH - h) * (clamp(panY, -1, 1) + 1) / 2, w, h };
}
export function eventURL(base, id) {
  const url = new URL(base);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('올바른 웹 주소를 입력해 주세요.');
  url.pathname = url.pathname.replace(/(?:admin|index|booth)\.html$/, '');
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  url.pathname += 'booth.html';
  url.search = ''; url.hash = ''; url.searchParams.set('event', id);
  return url.href;
}
export function normalizeEvent(value) {
  const text = (v, max) => typeof v === 'string' ? v.slice(0, max) : '';
  const color = (v, fallback) => /^#[0-9a-f]{6}$/i.test(v || '') ? v : fallback;
  const safeURL = v => typeof v === 'string' && (/^https:\/\//.test(v) || /^data:image\/(png|jpeg|webp);base64,/.test(v) || /^\/stickers\/[a-z-]+\.webp$/.test(v)) ? v : '';
  const frames = Array.isArray(value.frames) ? value.frames.slice(0, 32).map((f, i) => ({ id: text(f.id, 100) || `frame-${i}`, name: text(f.name, 30), bg: color(f.bg, '#fffdf6'), ink: color(f.ink, '#34372f'), overlay: safeURL(f.overlay), layoutCount: [2,4,6,8].includes(f.layoutCount) ? f.layoutCount : 0, orientation: f.orientation === 'landscape' ? 'landscape' : 'portrait' })) : [];
  const stickers = Array.isArray(value.stickers) ? value.stickers.slice(0, 64).map((s, i) => ({ id: text(s.id, 100) || `sticker-${i}`, name: text(s.name, 40), text: text(s.text, 8), url: safeURL(s.url) })).filter(s => s.text || s.url) : [];
  const event = { title: text(value.title, 80) || DEFAULT_EVENT.title, school: text(value.school, 60), schedule: text(value.schedule, 100), logo: safeURL(value.logo), logoPosition: value.logoPosition === 'bottom' ? 'bottom' : 'top', orientation: value.orientation === 'landscape' ? 'landscape' : 'portrait', frames: frames.length ? frames : DEFAULT_FRAMES, stickers };
  const { hasContent, hasTop, hasBottom, ...branding } = brandingModel({ ...event, branding: value.branding });
  return { ...event, branding };
}
export function imageFromURL(url) {
  return new Promise((resolve, reject) => { const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => resolve(img); img.onerror = () => reject(new Error('이미지를 불러오지 못했어요.')); img.src = url; });
}
export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
}

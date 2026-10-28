import {textColorSettings} from './text-colors.js';
import {STICKER_PRESETS} from './sticker-presets.js';
import {normalizeFont} from './fonts.js';
import {frameSize,normalizeFrameFormat} from './frame-sizes.js';
import { normalizeSharing } from './sharing.js';
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
  ...[['camera', '찰칵 카메라'], ['friendship', '선생님과 우리'], ['school', '우리 학교'], ['flower', '웃음꽃']].map(([id, name]) => ({ id: `image-${id}`, name, category: '마스코트', url: `/stickers/${id}.webp` })),
  ...STICKER_PRESETS,
];
export const DEFAULT_EVENT = { title: '사제동행 찰칵! 포토', school: '', schedule: '', logo: '', logoPosition: 'top', frames: DEFAULT_FRAMES, stickers: DEFAULT_STICKERS };
export const FILTERS = [
 {id:'original',name:'오리지널',group:'자연스러움',css:'none'},
 {id:'clear',name:'선명하게',group:'자연스러움',css:'contrast(1.12) saturate(1.18)'},
 {id:'warm',name:'따뜻하게',group:'색온도',css:'sepia(.25) saturate(.9) brightness(1.05)'},
 {id:'cool',name:'시원하게',group:'색온도',css:'saturate(.85) hue-rotate(15deg) brightness(1.04)'},
 {id:'soft',name:'소프트',group:'부드러움',css:'contrast(.85) brightness(1.08) saturate(.9)'},
 {id:'pastel',name:'파스텔',group:'부드러움',css:'contrast(.8) saturate(.65) brightness(1.15)'},
 {id:'vintage',name:'빈티지',group:'필름',css:'sepia(.4) contrast(.9) saturate(.8)'},
 {id:'sepia',name:'세피아',group:'필름',css:'sepia(.85) saturate(.7) contrast(1.05)'},
 {id:'mono',name:'흑백',group:'흑백',css:'grayscale(1) contrast(1.08)'},
 {id:'dramatic',name:'진한 흑백',group:'흑백',css:'grayscale(1) contrast(1.55) brightness(.94)'}
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
    model[key] = { visible: item.visible !== false, position: position(key), x: number(item.x, defaultX, position(key)==='free'?0:.05, position(key)==='free'?1:.95), y: number(item.y, position(key) === 'free' ? .5 : defaultY, 0, 1), size: number(item.size, BRAND_SIZES[key], key === 'logo' ? .035 : .012, key === 'logo' ? .35 : .10), font:normalizeFont(item.font), color: /^#[0-9a-f]{6}$/i.test(item.color || '') ? item.color : '', anchor:position(key)==='free'&&['top','bottom'].includes(item.anchor)?item.anchor:'', ...(key==='logo'?{}:textColorSettings(contents[key]||'',item)) };
  }
  model.texts=(Array.isArray(raw.texts)?raw.texts:[]).slice(0,8).map((item,index)=>{
    const text=typeof item?.text==='string'?item.text.slice(0,100):'',position=['top','bottom','free'].includes(item?.position)?item.position:'free';
    return {id:/^extra-[a-zA-Z0-9-]{1,80}$/.test(item?.id||'')?item.id:`extra-${index+1}`,text,visible:item?.visible!==false,position,anchor:position==='free'&&['top','bottom'].includes(item?.anchor)?item.anchor:'',x:number(item?.x,.5,0,1),y:number(item?.y,.65,0,1),size:number(item?.size,.027,.012,.1),font:normalizeFont(item?.font),color:/^#[0-9a-f]{6}$/i.test(item?.color||'')?item.color:'',...textColorSettings(text,item||{})};
  }).filter((item,index,all)=>all.findIndex(other=>other.id===item.id)===index);
  model.hasContent = visible.length > 0 || model.texts.some(t=>t.visible&&t.text);
  model.hasTop = visible.some(key => position(key) === 'top' || model[key].anchor === 'top') || model.texts.some(t=>t.visible&&t.text&&(t.position==='top'||t.anchor==='top'));
  model.hasBottom = visible.some(key => position(key) === 'bottom' || model[key].anchor === 'bottom') || model.texts.some(t=>t.visible&&t.text&&(t.position==='bottom'||t.anchor==='bottom'));
  return model;
}
export function brandEntries(event=DEFAULT_EVENT){
 event=event||DEFAULT_EVENT;
 const model=brandingModel(event);
 return [...BRAND_KEYS.map(key=>({key,label:BRAND_LABELS[key],content:key==='title'&&event.title===DEFAULT_EVENT.title&&!event.branding?'':event[key],settings:model[key]})),...model.texts.map((item,i)=>({key:item.id,label:`추가 문구 ${i+1}`,content:item.text,settings:item}))];
}
export function brandPart(event,key){return brandEntries(event).find(item=>item.key===key);}
export function changeBrandPart(event,key,part){const {hasContent,hasTop,hasBottom,...model}=brandingModel(event);if(BRAND_KEYS.includes(key))model[key]={...model[key],...part};else model.texts=model.texts.map(item=>item.id===key?{...item,...part}:item);return model;}
export function normalizeSlots(slots, count) {
  if (!Array.isArray(slots) || slots.length !== count) return null;
  if (!slots.every(s => s && ['x','y','w','h'].every(k => Number.isFinite(s[k])) && s.x >= 0 && s.y >= 0 && s.w >= .025 && s.h >= .025 && s.x + s.w <= 1.000001 && s.y + s.h <= 1.000001)) return null;
  return slots.map(({x,y,w,h}) => ({x,y,w,h}));
}
export function layout(count, event = DEFAULT_EVENT, options = {}) {
  if (![2,4,6,8].includes(count)) throw new Error('지원하지 않는 컷 수');
  const orientation = options.orientation || (options.frame?.layoutCount ? options.frame.orientation : event.orientation) || 'portrait';
  const landscape = orientation === 'landscape', fixed = Boolean(options.frame?.layoutCount), preserve = options.frame?.preserveAspect === true;
  const dimensions=frameSize(options.frame?.frameFormat,preserve ? options.frame.orientation : orientation);
  const width = !fixed && !preserve && options.width || dimensions.width, height = !fixed && !preserve && options.height || dimensions.height;
  const pad = fixed ? 48 : Math.round(Math.min(width,height) * Math.max(.02, preserve ? 0 : options.padding || 0)), gap = fixed ? 24 : Math.round(Math.min(width,height) * .015), cols = landscape ? ({2:2,4:2,6:3,8:4}[count]) : count === 2 ? 1 : 2, rows = count / cols;
  const branding = brandingModel(event);
  // Always start with the teacher's canvas, even when the student changes orientation.
  const brandReference = !fixed && !preserve && options.brandReference !== false && (options.width || options.height || options.padding || orientation !== (event.orientation || 'portrait'))
    ? layout(count,event,{...options,orientation:event.orientation || 'portrait',width:undefined,height:undefined,padding:undefined,brandReference:false}) : null;
  const footerH = options.caption || options.captureDate ? 100 : 0;
  const bandCount = Number(branding.hasTop) + Number(branding.hasBottom);
  const brandScale = brandReference ? Math.min((width-2*pad)/(brandReference.width-2*brandReference.pad), bandCount ? (height-2*pad-footerH)*.45/(bandCount*brandReference.brandH) : Infinity) : 1;
  const brandH = brandReference ? brandReference.brandH*brandScale : Math.round(height * (fixed ? .14 : branding.height));
  const topH = fixed || branding.hasTop ? brandH : 0, bottomH = fixed || branding.hasBottom ? brandH : 0;
  const bottomSpace = fixed ? brandH : bottomH + footerH;
  const photoW = (width - pad * 2 - gap * (cols - 1)) / cols, photoH = (height - pad * 2 - topH - bottomSpace - gap * (rows - 1)) / rows;
  const top = pad + topH, bottomY = height - pad - bottomSpace;
  return { brandReference, brandScale, width, height, orientation, cols, rows, photoW, photoH, pad, brandH, footerH, brandY:event.logoPosition === 'bottom' ? bottomY : pad, brandAreas:{top:{y:pad,h:topH},bottom:{y:bottomY,h:bottomH},free:{y:0,h:height}}, footerY:height-pad-100, slots:normalizeSlots(options.frame?.photoSlots,count)?.map(s=>({x:s.x*width,y:s.y*height,w:s.w*width,h:s.h*height})) || Array.from({length:count},(_,i)=>({x:pad+(i%cols)*(photoW+gap),y:top+Math.floor(i/cols)*(photoH+gap),w:photoW,h:photoH})) };
}
export function templateGeometry(count, orientation = 'portrait', frameFormat='print-4x6') { return layout(count, DEFAULT_EVENT, { frame: { layoutCount: count, orientation,frameFormat }, orientation }); }
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
  url.pathname += 'e/' + encodeURIComponent(id);
  url.search = ''; url.hash = '';
  return url.href;
}
export function normalizeEvent(value) {
  const text = (v, max) => typeof v === 'string' ? v.slice(0, max) : '';
  const color = (v, fallback) => /^#[0-9a-f]{6}$/i.test(v || '') ? v : fallback;
  const safeURL = v => typeof v === 'string' && (/^https:\/\//.test(v) || /^data:image\/(png|jpeg|webp);base64,/.test(v) || /^\/stickers\/[a-z-]+\.(?:webp|svg)$/.test(v)) ? v : '';
  const frames = Array.isArray(value.frames) ? value.frames.slice(0, 32).map((f, i) => ({ id: text(f.id, 100) || `frame-${i}`, name: text(f.name, 30), bg: color(f.bg, '#fffdf6'), ink: color(f.ink, '#34372f'), overlay: safeURL(f.overlay), layoutCount: [2,4,6,8].includes(f.layoutCount) ? f.layoutCount : 0, orientation: f.orientation === 'landscape' ? 'landscape' : 'portrait', frameFormat:normalizeFrameFormat(f.frameFormat), ...(f.preserveAspect === true ? {preserveAspect:true,clearPhotoSlots:f.clearPhotoSlots === true} : {}), ...(normalizeSlots(f.photoSlots,f.layoutCount) ? {photoSlots:normalizeSlots(f.photoSlots,f.layoutCount)} : {}) })) : [];
  const stickers = Array.isArray(value.stickers) ? value.stickers.slice(0, 256).map((s, i) => ({ id: text(s.id, 100) || `sticker-${i}`, name: text(s.name, 40), category: text(s.category,16), text: text(s.text, 8), url: safeURL(s.url) })).filter(s => s.url) : [];
  const event = { title: text(value.title, 80) || DEFAULT_EVENT.title, school: text(value.school, 60), schedule: text(value.schedule, 100), logo: safeURL(value.logo), logoPosition: value.logoPosition === 'bottom' ? 'bottom' : 'top', orientation: value.orientation === 'landscape' ? 'landscape' : 'portrait', frames: frames.length ? frames : DEFAULT_FRAMES, stickers };
  const { hasContent, hasTop, hasBottom, ...branding } = brandingModel({ ...event, branding: value.branding });
  return { ...event, branding, sharing:normalizeSharing(value.sharing) };
}
export function imageFromURL(url) {
  return new Promise((resolve, reject) => { const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => resolve(img); img.onerror = () => reject(new Error('이미지를 불러오지 못했어요.')); img.src = url; });
}
export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
}

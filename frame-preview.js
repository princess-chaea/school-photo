import {transformPhotoSlot,orderedPhotoSlots} from './photo-slots.js';
import {drawFrameOverlay} from './frame-overlay.js';
import {loadFont,loadTextFonts} from './fonts.js';
import { layout, imageFromURL, brandingModel, brandEntries } from './core.js';
import { drawBranding } from './branding.js';
function scaledGeometry(g,s){return{...g,...Object.fromEntries(['width','height','pad','brandH','brandY','footerH','footerY','photoW','photoH'].map(k=>[k,g[k]*s])),slots:g.slots.map(r=>({...r,x:r.x*s,y:r.y*s,w:r.w*s,h:r.h*s})),brandAreas:Object.fromEntries(Object.entries(g.brandAreas).map(([key,r])=>[key,{...r,y:r.y*s,h:r.h*s}])),brandReference:g.brandReference?scaledGeometry(g.brandReference,s):null};}
const images = new Map(), loading = new Map(), versions = new WeakMap();
async function load(url) { if (!url || images.has(url)) return; if (!loading.has(url)) loading.set(url, imageFromURL(url).then(img => images.set(url, img)).catch(() => {}).finally(() => loading.delete(url))); await loading.get(url); }
export async function paintFramePreview(canvas, event, { count = 4, frameIndex = 0, selected = null, guides = false, orientation, preset = {}, maxDimension=0 } = {}) {
  const version = (versions.get(canvas) || 0) + 1; versions.set(canvas, version);
  const frame = event.frames[Math.min(frameIndex, event.frames.length - 1)];
  if (frame.layoutCount&&!frame.photoLayouts?.[count]) count = frame.layoutCount;
  let g = layout(count, event, { frame, orientation, width:preset.width, height:preset.height, padding:preset.padding, captureDate: brandingModel(event).captureDate });
  if(maxDimension>0&&Math.max(g.width,g.height)>maxDimension)g=scaledGeometry(g,maxDimension/Math.max(g.width,g.height));
  await Promise.all([load(event.logo), load(frame.overlay),...brandEntries(event).filter(item=>item.key!=='logo').map(item=>loadTextFonts(item.settings))]); if (versions.get(canvas) !== version) return null;
  canvas.width = g.width; canvas.height = g.height; const ctx = canvas.getContext('2d');
  ctx.fillStyle = frame.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const {slot,index:i} of orderedPhotoSlots(g.slots)) { ctx.save();transformPhotoSlot(ctx,slot);ctx.fillStyle = ['#dce5d0', '#e8d6ca', '#d9e3ee', '#e2d9eb'][i % 4]; ctx.fillRect(slot.x, slot.y, slot.w, slot.h); ctx.fillStyle = '#9eaf8b'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${slot.w * .12}px KerisBaeum, Arial`; ctx.fillText(['✿', '☺', '✧', '♡'][i % 4], slot.x + slot.w / 2, slot.y + slot.h / 2);ctx.restore(); }
  if (images.has(frame.overlay)) drawFrameOverlay(ctx,images.get(frame.overlay),frame,g);
  if (guides && g.brandH) { ctx.save(); ctx.strokeStyle = '#85a85e'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); for (const key of ['top', 'bottom']) { const area = g.brandAreas[key]; if (area.h) ctx.strokeRect(g.pad / 2, area.y, g.width - g.pad, area.h); } ctx.restore(); }
  const items = drawBranding(ctx, event, g, images, frame.ink);
  ctx.fillStyle = frame.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (brandingModel(event).captureDate) { ctx.font = '13px KerisBaeum, Arial'; ctx.fillText(new Date().toLocaleDateString('sv-SE').replaceAll('-', '. '), g.width / 2, g.footerY + 82); }
  const item = items.find(i => i.key === selected);
  if (item) { const scale = g.width / Math.max(1, canvas.getBoundingClientRect().width), gap = 4 * scale, handle = 5 * scale; ctx.save(); ctx.strokeStyle = '#54802e'; ctx.lineWidth = 1.4 * scale; ctx.setLineDash([4 * scale, 3 * scale]); ctx.strokeRect(item.x - item.w / 2 - gap, item.y - item.h / 2 - gap, item.w + gap * 2, item.h + gap * 2); ctx.setLineDash([]); for (const x of [-1, 1]) for (const y of [-1, 1]) { ctx.fillStyle = '#c5f564'; const cx = item.x + x * (item.w / 2 + gap), cy = item.y + y * (item.h / 2 + gap); ctx.fillRect(cx - handle, cy - handle, handle * 2, handle * 2); ctx.strokeRect(cx - handle, cy - handle, handle * 2, handle * 2); } ctx.restore(); }
  return { geometry: g, items };
}

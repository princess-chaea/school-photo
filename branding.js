import {paintColoredText,measureStyledText} from './text-colors.js';
import {fontFamily} from './fonts.js';
import { brandingModel, brandEntries, DEFAULT_EVENT, clamp } from './core.js';

export function brandItems(ctx, event, geometry, images) {
  const g = geometry, model = brandingModel(event), items = [];
  if (!g.brandH) return items;
  // Free-positioned text placed in a header/footer belongs to that physical group.
  // Use the same transform for its neighbours instead of scaling it by canvas height.
  if(g.brandReference){
    const reference=g.brandReference;
    return brandItems(ctx,event,reference,images).map(item=>{
      let position=item.settings.position;
      if(position==='free'){
        for(const band of ['top','bottom']){
          const area=reference.brandAreas[band];
          if(area.h && item.y>=area.y && item.y<=area.y+area.h){position=band;break;}
        }
      }
      const sourceArea=reference.brandAreas[position],targetArea=g.brandAreas[position];
      const scale=position==='free' ? Math.min((g.width-2*g.pad)/(reference.width-2*reference.pad),g.height/reference.height) : g.brandScale;
      return {...item,x:g.width/2+(item.x-reference.width/2)*scale,y:targetArea.y+targetArea.h/2+(item.y-sourceArea.y-sourceArea.h/2)*scale,w:item.w*scale,h:item.h*scale,size:item.size*scale};
    });
  }
  for (const {key,settings,content} of brandEntries(event)) {
    if (!settings.visible || !content) continue;
    const area = g.brandAreas[settings.position];
    let w, h, size = settings.size * Math.min(g.width, g.height), image;
    if (key === 'logo') {
      image = images.get(event.logo); if (!image) continue;
      w = size; h = w * image.height / image.width;
      const scale = Math.min(1, (g.width - 2 * g.pad) / w, area.h * .9 / h); w *= scale; h *= scale;
    } else {
      do { ctx.font = `${key === 'school' ? 700 : 500} ${size}px ${fontFamily(settings.font)}, Arial, sans-serif`; w = measureStyledText(ctx,content,settings).width; if (w <= g.width - g.pad * 2) break; size -= 1; } while (size > 9);
      w = Math.min(w, g.width - 2 * g.pad); h = measureStyledText(ctx,content,settings).height;
    }
    const x = clamp(settings.x * g.width, g.pad + w / 2, g.width - g.pad - w / 2);
    const y = clamp(area.y + settings.y * area.h, area.y + h / 2, area.y + area.h - h / 2);
    items.push({ key, content, image, x, y, w, h, size, settings });
  }
  return items;
}
export function drawBranding(ctx, event, geometry, images, ink) {
  const items = brandItems(ctx, event, geometry, images);
  ctx.save(); ctx.filter = 'none'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const item of items) {
    if (item.image) ctx.drawImage(item.image, item.x - item.w / 2, item.y - item.h / 2, item.w, item.h);
    else { ctx.font = `${item.key === 'school' ? 700 : 500} ${item.size}px ${fontFamily(item.settings.font)}, Arial, sans-serif`; paintColoredText(ctx,item.content,item.x,item.y,geometry.width-geometry.pad*2,item.settings,ink); }
  }
  ctx.restore(); return items;
}

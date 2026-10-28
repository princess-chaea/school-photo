import { brandingModel, BRAND_KEYS, DEFAULT_EVENT, clamp } from './core.js';

export function brandItems(ctx, event, geometry, images) {
  const g = geometry, model = brandingModel(event), items = [];
  if (!g.brandH) return items;
  for (const key of BRAND_KEYS) {
    const settings = model[key], content = key === 'logo' ? event.logo : key === 'title' && event.title === DEFAULT_EVENT.title && !event.branding ? '' : event[key];
    if (!settings.visible || !content) continue;
    const area = g.brandAreas[settings.position];
    let w, h, size = settings.size * Math.min(g.width, g.height), image;
    if (key === 'logo') {
      image = images.get(event.logo); if (!image) continue;
      w = size; h = w * image.height / image.width;
      const scale = Math.min(1, (g.width - 2 * g.pad) / w, area.h * .9 / h); w *= scale; h *= scale;
    } else {
      do { ctx.font = `${key === 'school' ? 700 : 500} ${size}px KerisBaeum, Arial, sans-serif`; w = ctx.measureText(content).width; if (w <= g.width - g.pad * 2) break; size -= 1; } while (size > 9);
      w = Math.min(w, g.width - 2 * g.pad); h = size * 1.25;
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
    else { ctx.font = `${item.key === 'school' ? 700 : 500} ${item.size}px KerisBaeum, Arial, sans-serif`; ctx.fillStyle = item.settings.color || ink; ctx.fillText(item.content, item.x, item.y, geometry.width - geometry.pad * 2); }
  }
  ctx.restore(); return items;
}

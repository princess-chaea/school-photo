import {transformPhotoSlot} from './photo-slots.js';
// The source remains intact; photo holes follow the student's actual layout.
const cache = new WeakMap();
export function drawFrameOverlay(ctx, image, frame, geometry) {
  const {width,height,slots}=geometry;
  if (!frame.clearPhotoSlots) { ctx.drawImage(image,0,0,width,height); return; }
  const key=JSON.stringify([width,height,slots]);
  let saved=cache.get(image);
  if (!saved || saved.key!==key) {
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const layer=canvas.getContext('2d');layer.drawImage(image,0,0,width,height);
    for(const s of slots){layer.save();transformPhotoSlot(layer,s);layer.clearRect(s.x,s.y,s.w,s.h);layer.restore();}
    saved={key,canvas};cache.set(image,saved);
  }
  ctx.drawImage(saved.canvas,0,0);
}

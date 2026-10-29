import {transformPhotoSlot} from './photo-slots.js';
// 실제 출력과 같은 공통 좌표로 사진 영역을 표시합니다.
export function drawLayoutGuide(canvas, geometry, { background = '#fffdf6', ink = '#41572c', numbers = true } = {}) {
  const ctx = canvas.getContext('2d'), g = geometry;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const scale = Math.min(canvas.width / g.width, canvas.height / g.height);
  ctx.save(); ctx.translate((canvas.width-g.width*scale)/2,(canvas.height-g.height*scale)/2);ctx.scale(scale,scale);
  ctx.fillStyle=background;ctx.fillRect(0,0,g.width,g.height);
  for (const [i,s] of g.slots.entries()) {
    ctx.save();transformPhotoSlot(ctx,s);ctx.fillStyle=['#dce8cf','#ecdbd1','#d7e4ed','#e6dcef'][i%4];ctx.fillRect(s.x,s.y,s.w,s.h);
    ctx.strokeStyle=ink;ctx.lineWidth=1/scale;ctx.strokeRect(s.x,s.y,s.w,s.h);
    if(numbers){ctx.fillStyle=ink;ctx.font=`${Math.min(s.w,s.h)*.20}px KerisBaeum,Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(i+1,s.x+s.w/2,s.y+s.h/2);}
    ctx.restore();
  }
  ctx.restore();
}
// 고정 사진 창이 있는 업로드 프레임은 출력 여백까지 포함해 안내합니다.
export function fitLayoutGuide(geometry, preset = {}) {
  if (!preset.width || !preset.height) return geometry;
  const g=geometry,width=preset.width,height=preset.height,padding=preset.padding||0;
  const scale=Math.min(width*(1-padding*2)/g.width,height*(1-padding*2)/g.height);
  const x=(width-g.width*scale)/2,y=(height-g.height*scale)/2;
  return {...g,width,height,slots:g.slots.map(s=>({...s,x:x+s.x*scale,y:y+s.y*scale,w:s.w*scale,h:s.h*scale}))};
}

import {test} from 'node:test';import assert from 'node:assert/strict';import {FRAME_SIZES} from '../frame-sizes.js';import {templateGeometry,layout,normalizeEvent,DEFAULT_EVENT} from '../core.js';
test('교사 제작 규격은 행사 저장과 학생 출력에서도 유지된다',()=>{for(const format of FRAME_SIZES)for(const orientation of ['portrait','landscape'])for(const count of [2,4,6,8]){const g=templateGeometry(count,orientation,format.id),frame={layoutCount:count,orientation,frameFormat:format.id,photoSlots:g.slots.map(s=>({x:s.x/g.width,y:s.y/g.height,w:s.w/g.width,h:s.h/g.height}))};const event=normalizeEvent({...DEFAULT_EVENT,frames:[frame]});const out=layout(count,event,{frame:event.frames[0],orientation});assert.equal(out.width,g.width);assert.equal(out.height,g.height);assert(g.slots.every(s=>s.w>0&&s.h>0&&s.x+s.w<=g.width+.001&&s.y+s.h<=g.height+.001));assert.equal(g.width,orientation==='portrait'?format.width:format.height);}});

test('새 이미지 프레임은 미리보기 컷·방향과 무관하게 등록 규격을 보존하고 모든 배치에 사용한다',async()=>{
 const {compatibleFrame}=await import('../core.js');
 for(const format of FRAME_SIZES){
  const event=normalizeEvent({...DEFAULT_EVENT,frames:[{id:'universal',frameFormat:format.id,preserveAspect:true,clearPhotoSlots:true,layoutCount:0,orientation:'portrait'}]});
  const frame=event.frames[0];assert.equal(frame.clearPhotoSlots,true);
  for(const orientation of ['portrait','landscape'])for(const count of [2,4,6,8]){
   const g=layout(count,event,{frame,orientation,width:1080,height:1080,padding:.08});
   assert.equal(g.width,format.width);assert.equal(g.height,format.height);assert.equal(g.slots.length,count);assert(compatibleFrame(frame,count,orientation));
   assert(g.slots.every(s=>s.w>0&&s.h>0&&s.x>=0&&s.y>=0&&s.x+s.w<=g.width+.001&&s.y+s.h<=g.height+.001));
  }
 }
});

test('100개 기본 스티커와 보관함 디자인은 저장 정규화에서 잘리지 않고 전체 해제도 유지한다',()=>{
 assert.equal(DEFAULT_EVENT.stickers.length,100);
 const stickers=[...DEFAULT_EVENT.stickers,...Array.from({length:156},(_,i)=>({id:'own-'+i,name:'내 스티커',url:'/stickers/preset-heart.svg'}))];
 const event=normalizeEvent({...DEFAULT_EVENT,stickers});assert.equal(event.stickers.length,256);assert.equal(event.stickers[0].category,'마스코트');
 assert.equal(normalizeEvent({...event,stickers:[]}).stickers.length,0);
 assert.equal(normalizeEvent({...event,stickers:[...stickers,stickers[0]]}).stickers.length,256);
});

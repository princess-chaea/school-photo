import {test}from'node:test';import assert from'node:assert/strict';
import {layout,DEFAULT_EVENT}from'../core.js';import {brandItems}from'../branding.js';import {EXPORT_FORMATS}from'../export-formats.js';
const ctx={font:'',measureText(text){return {width:text.length*parseFloat(this.font.split(' ')[1])*.55};}};
const event={...DEFAULT_EVENT,title:'우정콘서트',school:'하주초등학교',schedule:'2026. 11. 4(수)',logo:'https://example.com/logo.png',branding:{height:.14,logo:{x:.10,y:.5,size:.06},school:{x:.28,y:.5,size:.032},title:{x:.6,y:.24,size:.06},schedule:{x:.6,y:.8,size:.023}}};
const images=new Map([[event.logo,{width:100,height:100}]]);
test('카톡 등 모든 비율에서 로고·학교·행사·일정의 상대 위치와 크기를 함께 축소한다',()=>{
 for(const position of ['top','bottom','free']){
  const sourceEvent={...event,branding:{...event.branding,...Object.fromEntries(['logo','school','title','schedule'].map(k=>[k,{...event.branding[k],position}]))}};
  const reference=layout(6,sourceEvent),original=brandItems(ctx,sourceEvent,reference,images);
  for(const preset of EXPORT_FORMATS.filter(f=>f.width)){
   const g=layout(6,sourceEvent,{width:preset.width,height:preset.height,padding:preset.padding}),items=brandItems(ctx,sourceEvent,g,images),scale=items[0].w/original[0].w;
   for(let i=0;i<items.length;i++){
    assert(Math.abs(items[i].size-original[i].size*scale)<1e-6);
    assert(Math.abs(items[i].h-original[i].h*scale)<1e-6);
    for(let j=0;j<i;j++){
     assert(Math.abs((items[i].x-items[j].x)-(original[i].x-original[j].x)*scale)<1e-6);
     assert(Math.abs((items[i].y-items[j].y)-(original[i].y-original[j].y)*scale)<1e-6);
    }
   }
   const logo=items.find(i=>i.key==='logo'),school=items.find(i=>i.key==='school');assert(logo.x+logo.w/2<school.x-school.w/2);
  }
 }
});
test('이미지 프레임의 고정 정보 배치는 출력용 재배치 대상이 아니다',()=>{
 const g=layout(6,event,{frame:{layoutCount:6},width:1080,height:1080,padding:.08});assert.equal(g.brandReference,null);assert.equal(g.width,1200);
});
test('상단에 자유 배치한 행사명도 로고·학교·날짜와 함께 변환하고 사진 밖에 유지한다',()=>{
 const mixed={...event,orientation:'portrait',branding:{height:.08,
  logo:{position:'top',x:.05,y:.021056,size:.053637},
  school:{position:'top',x:.163299,y:.207636,size:.030177},
  title:{position:'free',x:.495715,y:.044412,size:.063248},
  schedule:{position:'top',x:.494731,y:.822365,size:.021}}};
 const source=layout(4,mixed),original=brandItems(ctx,mixed,source,images);
 for(const orientation of ['portrait','landscape']) for(const count of [2,4,6,8]) for(const preset of EXPORT_FORMATS.filter(f=>f.width)){
  const g=layout(count,mixed,{orientation,width:preset.width,height:preset.height,padding:preset.padding}),items=brandItems(ctx,mixed,g,images);
  const scale=g.brandScale;
  for(let i=0;i<items.length;i++){
   assert(Math.abs(items[i].size-original[i].size*scale)<1e-6);
   assert(items[i].y-items[i].h/2>=g.pad-1e-6);
   assert(items[i].y+items[i].h/2<=g.slots[0].y+1e-6);
   for(let j=0;j<i;j++){
    assert(Math.abs(items[i].x-items[j].x-(original[i].x-original[j].x)*scale)<1e-6);
    assert(Math.abs(items[i].y-items[j].y-(original[i].y-original[j].y)*scale)<1e-6);
   }
  }
  assert(g.slots.every(s=>s.w>0 && s.h>0 && s.y+s.h<=g.height));
  if(preset.id==='screen') assert(items.find(i=>i.key==='title').size>original.find(i=>i.key==='title').size);
 }
});
test('사진 중앙의 자유 배치는 상단 정보로 끌어올리지 않는다',()=>{
 const middle={...event,branding:{...event.branding,title:{position:'free',x:.5,y:.5,size:.05}}};
 const g=layout(4,middle,{width:1080,height:1920});
 const title=brandItems(ctx,middle,g,images).find(i=>i.key==='title');
 assert.equal(title.y,g.height/2);
 assert(title.y>g.slots[0].y);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layout, crop, eventURL, normalizeEvent, DEFAULT_EVENT, brandingModel, BRAND_KEYS, templateGeometry, compatibleFrame } from '../core.js';
test('모든 컷 수에서 사진이 겹치거나 캔버스 밖으로 나가지 않는다', () => {
  for (const count of [2, 4, 6, 8]) for (const position of ['top', 'bottom']) {
    const g = layout(count, { ...DEFAULT_EVENT, school: '모먼트고등학교', logoPosition: position });
    assert.equal(g.slots.length, count);
    for (const s of g.slots) { assert(s.x >= 0 && s.y >= 0); assert(s.x + s.w <= g.width); assert(s.y + s.h < g.height); }
    for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) { const a = g.slots[i], b = g.slots[j]; assert(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y); }
    if (position === 'top') assert(g.slots[0].y >= g.brandY + g.brandH);
    else assert(g.brandY >= g.slots.at(-1).y + g.photoH);
    assert(g.footerY + g.footerH <= g.height);
  }
});
test('표시 설정을 모두 끄면 정보 영역을 비우고 상·하단 및 자유 배치를 따로 유지한다', () => {
  const event = { ...DEFAULT_EVENT, title: '축제', school: '학교', schedule: '오늘', logo: 'https://example.com/logo.png', branding: Object.fromEntries(BRAND_KEYS.map(key => [key, { visible: false }])) };
  const empty = layout(4, event); assert.equal(brandingModel(event).hasContent, false); assert.deepEqual(empty.slots, layout(4).slots);
  event.branding = { logo: { position: 'top' }, school: { position: 'bottom' }, title: { position: 'free' }, schedule: { visible: false } };
  const mixed = layout(8, event); assert(mixed.brandAreas.top.h > 0); assert(mixed.brandAreas.bottom.h > 0);
  assert.equal(brandingModel(event).title.position, 'free');
  const normalized = normalizeEvent({ ...event, branding: { school: { x: 999, y: -5, size: 2, color: 'bad' } } });
  assert.equal(normalized.branding.school.x, .95); assert.equal(normalized.branding.school.y, 0); assert.equal(normalized.branding.school.size, .10); assert.equal(normalized.branding.school.color, '');
});
test('세로·가로 사진의 확대 및 이동은 원본 경계를 넘지 않는다', () => {
  for (const [w, h] of [[3000, 1000], [1000, 3000], [1500, 1500]]) for (const z of [1, 1.5, 2.5]) for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) {
    const c = crop(w, h, 600, 450, z, x, y); assert(c.x >= 0 && c.y >= 0); assert(c.x + c.w <= w + .001); assert(c.y + c.h <= h + .001); assert(Math.abs(c.w / c.h - 600 / 450) < .00001);
  }
});
test('QR은 관리 화면이 아닌 행사 URL을 가리킨다', () => {
  assert.equal(eventURL('https://school.web.app/admin.html?old=1#top', 'spring-2026'), 'https://school.web.app/e/spring-2026');
  assert.equal(eventURL('https://example.com/booth/index.html', 'abc'), 'https://example.com/booth/e/abc');
  assert.throws(() => eventURL('javascript:alert(1)', 'x'));
});
test('외부 행사 데이터에서 실행 가능한 URL과 잘못된 색상을 제거한다', () => {
  const event = normalizeEvent({ title: '축제', logo: 'javascript:alert(1)', frames: [{ id: 'a', bg: 'red;display:none', ink: '#ffffff', overlay: 'http://bad.test/x' }], stickers: [{ text: '♡', url: 'javascript:x' }] });
  assert.equal(event.logo, ''); assert.equal(event.frames[0].bg, '#fffdf6'); assert.equal(event.frames[0].overlay, ''); assert.equal(event.stickers.length,0);
});
test('업로드 프레임의 제작 규격과 사진 칸은 정보 표시 설정이 바뀌어도 유지된다', () => {
  for (const n of [2,4,6,8]) {
    const original = templateGeometry(n);
    const changed = layout(n, { ...DEFAULT_EVENT, title: '가을축제', school: '우리학교', branding: { height: .6, school: { position: 'free', x: .2, y: .4 } } }, { frame: { layoutCount: n }, caption: true });
    assert.equal(changed.width, original.width); assert.equal(changed.height, original.height); assert.deepEqual(changed.slots, original.slots);
    assert.equal(compatibleFrame({ layoutCount: n }, n), true); assert.equal(compatibleFrame({ layoutCount: n }, n === 4 ? 2 : 4), false);
  }
  for (const count of [2,4,6,8]) for (const orientation of ['portrait','landscape']) { const g=templateGeometry(count,orientation); assert.equal(g.width,orientation==='portrait'?1200:1800); assert.equal(g.height,orientation==='portrait'?1800:1200); assert.equal(g.slots.length,count); assert(g.slots.every(s=>s.w>0&&s.h>0&&s.y+s.h<g.height)); }
});
test('사용자 지정 사진 칸은 저장 정규화 후에도 동일하게 렌더링하고 잘못된 칸은 기본 배치로 복구한다', () => {
  for (const orientation of ['portrait','landscape']) {
    const frame={id:'custom',layoutCount:2,orientation,photoSlots:[{x:.07,y:.11,w:.73,h:.29},{x:.16,y:.61,w:.55,h:.32}]};
    const event=normalizeEvent({...DEFAULT_EVENT,frames:[frame]});const g=layout(2,event,{frame:event.frames[0]});
    assert.deepEqual(event.frames[0].photoSlots,frame.photoSlots);
    for(let i=0;i<2;i++){assert.equal(g.slots[i].x,frame.photoSlots[i].x*g.width);assert.equal(g.slots[i].h,frame.photoSlots[i].h*g.height);}
    const invalid=normalizeEvent({...DEFAULT_EVENT,frames:[{...frame,photoSlots:[{x:NaN,y:0,w:2,h:-1}]}]});assert.equal(invalid.frames[0].photoSlots,undefined);
    assert.deepEqual(layout(2,invalid,{frame:invalid.frames[0]}).slots,templateGeometry(2,orientation).slots);
  }
});
import { EXPORT_FORMATS, exportGeometry } from '../export-formats.js';
test('용도별 저장은 프레임 전체를 유지하고 출력 범위를 넘지 않는다',()=>{
 for(const f of EXPORT_FORMATS)for(const [w,h] of [[1200,1800],[1800,1200]]){const g=exportGeometry(w,h,f.id);assert(g.x>=0&&g.y>=0);assert(g.x+g.w<=g.width+.001);assert(g.y+g.h<=g.height+.001);assert(Math.abs(g.w/g.h-w/h)<.00001);if(f.width){assert.equal(g.width,f.width);assert.equal(g.height,f.height);}}
});

test('기본 프레임은 처음 선택한 용도의 규격과 정보가 있는 쪽만 확보한다', () => {
  for (const preset of EXPORT_FORMATS.filter(f => f.width)) for (const count of [2,4,6,8]) {
    const options = { width:preset.width, height:preset.height, padding:preset.padding };
    const empty = layout(count, DEFAULT_EVENT, options);
    assert.equal(empty.width,preset.width); assert.equal(empty.height,preset.height);
    assert.equal(empty.slots[0].y,empty.pad);
    assert.equal(empty.slots.at(-1).y+empty.photoH,empty.height-empty.pad);
    for (const position of ['top','bottom']) {
      const g=layout(count,{...DEFAULT_EVENT,school:'우리학교',logoPosition:position},options);
      assert.equal(g.brandAreas[position].h,g.brandH);
      assert.equal(g.brandAreas[position==='top'?'bottom':'top'].h,0);
      assert(g.photoH<empty.photoH);
      assert(g.slots.every(s=>s.w>0&&s.h>0&&s.x>=0&&s.y>=0&&s.x+s.w<=g.width+.001&&s.y+s.h<=g.height+.001));
      const footer=layout(count,{...DEFAULT_EVENT,school:'우리학교',logoPosition:position},{...options,caption:true,captureDate:true});
      assert(footer.slots.at(-1).y+footer.photoH<=footer.footerY+.001);
      if(position==='bottom')assert(footer.brandAreas.bottom.y+footer.brandAreas.bottom.h<=footer.footerY+.001);
    }
  }
});

import { fitLayoutGuide } from '../layout-guide.js';
test('업로드 프레임의 사진 공간 안내는 실제 저장 여백과 위치·크기가 일치한다',()=>{
  const source=templateGeometry(4);
  for(const preset of EXPORT_FORMATS){
    const guide=fitLayoutGuide(source,preset),output=exportGeometry(source.width,source.height,preset.id);
    assert.equal(guide.width,output.width);assert.equal(guide.height,output.height);
    for(const [i,s] of source.slots.entries()){
      const slot=guide.slots[i];assert(Math.abs(slot.x-(output.x+s.x*output.w/source.width))<.00001);
      assert(Math.abs(slot.y-(output.y+s.y*output.h/source.height))<.00001);
      assert(Math.abs(slot.w-s.w*output.w/source.width)<.00001);
      assert(Math.abs(slot.h-s.h*output.h/source.height)<.00001);
    }
  }
});

test('이미지 프레임은 저장한 비율·컷·방향만 지원하고 단색은 모든 용도에 맞춘다',()=>{
 const frame=normalizeEvent({...DEFAULT_EVENT,frames:[{id:'teacher',name:'교사 제작',layoutCount:6,orientation:'landscape',frameFormat:'print-4x6',preserveAspect:true,clearPhotoSlots:true,photoSlots:Array.from({length:6},(_,i)=>({x:.05+(i%3)*.31,y:.2+Math.floor(i/3)*.3,w:.2,h:.2}))}]}).frames[0];
 assert(compatibleFrame(frame,6,'landscape',{width:1800,height:1200}));
 assert(compatibleFrame(frame,6,'landscape',{width:1620,height:1080}));
 assert(!compatibleFrame(frame,4,'landscape',{width:1800,height:1200}));
 assert(!compatibleFrame(frame,6,'portrait',{width:1800,height:1200}));
 assert(!compatibleFrame(frame,6,'landscape',{width:1080,height:1080}));
 assert(compatibleFrame({layoutCount:0},8,'portrait',{width:1080,height:1920}));
 const g=layout(6,DEFAULT_EVENT,{frame,orientation:'landscape'});assert.equal(g.slots[0].w,g.width*.2);assert.equal(g.slots[5].h,g.height*.2);
});

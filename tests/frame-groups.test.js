import{test}from'node:test';import assert from'node:assert/strict';
import{DEFAULT_FRAMES,DEFAULT_EVENT,normalizeEvent}from'../core.js';
import{frameSource,groupFrames}from'../frame-groups.js';
test('기본 색상 14종은 기존 ID·색상을 보존하며 이름과 색상이 중복되지 않는다',()=>{
 assert.equal(DEFAULT_FRAMES.length,14);assert.equal(new Set(DEFAULT_FRAMES.map(f=>f.id)).size,14);assert.equal(new Set(DEFAULT_FRAMES.map(f=>f.bg)).size,14);
 assert.deepEqual(DEFAULT_FRAMES.slice(0,8).map(f=>f.id),['ivory','black','sage','pink','blue','butter','lilac','lime']);
 assert(DEFAULT_FRAMES.every(f=>frameSource(f)==='base'&&/^#[0-9a-f]{6}$/i.test(f.bg)&&/^#[0-9a-f]{6}$/i.test(f.ink)));
});
test('행사를 저장하고 다시 읽어도 공용 테마와 교사 프레임을 구분하고 원래 선택 인덱스를 유지한다',()=>{
 const frames=[DEFAULT_FRAMES[2],{id:'shared-old',name:'기존 공용',bg:'#ffeedd',ink:'#222222'},{id:'new-theme',source:'theme',name:'새 테마',bg:'#ddeeff',ink:'#222222'},{id:'personal',name:'내 프레임',bg:'#abcdef',ink:'#222222'}];
 const event=normalizeEvent(JSON.parse(JSON.stringify({...DEFAULT_EVENT,frames}))),again=normalizeEvent(JSON.parse(JSON.stringify(event))),groups=groupFrames(again.frames);
 assert.deepEqual(groups.map(g=>g.items.map(i=>i.index)),[[0],[1,2],[3]]);
 assert.deepEqual(groups[1].items.map(i=>i.frame.source),['theme','theme']);assert.equal(again.frames[3].source,'personal');
 assert.equal(frameSource({id:'shared-older',source:'invalid'}),'theme');assert.equal(frameSource({id:'ivory',overlay:'https://example.com/image.webp'}),'personal');
 assert.equal(frameSource({id:'custom-shared',shared:true}),'theme');assert.equal(frameSource({id:123}),'personal');
});

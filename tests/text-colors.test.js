import {test} from 'node:test';import assert from 'node:assert/strict';
import {textLetters,reconcileLetterColors,paintColoredText} from '../text-colors.js';
import {normalizeEvent,brandingModel,layout,DEFAULT_EVENT} from '../core.js';
import {brandItems} from '../branding.js';
test('글자별 색상은 이모지·결합 글자를 나누지 않고 문구 삽입·삭제 뒤에도 유지한다',()=>{
 assert.equal(textLetters('가👨‍👩‍👧‍👦나').length,3);
 assert.deepEqual(reconcileLetterColors('우정','새우정',['#ff0000','#0000ff']),['','#ff0000','#0000ff']);
 assert.deepEqual(reconcileLetterColors('가나다','가다',['#ff0000','#00ff00','#0000ff']),['#ff0000','#0000ff']);
});
test('서로 다른 글자 색상·크기는 행사 저장 후 유지하고 임의 색상 코드는 제거한다',()=>{
 const e=normalizeEvent({...DEFAULT_EVENT,title:'우정',branding:{title:{size:.07,styledText:'우정',letterColors:['#ff0000','#0000ff']},school:{letterColors:['url(evil)']}}});
 const saved=normalizeEvent(e);assert.equal(saved.branding.title.size,.07);assert.deepEqual(saved.branding.title.letterColors,['#ff0000','#0000ff']);
 assert.deepEqual(brandingModel({...e,title:'새우정'}).title.letterColors,['','#ff0000','#0000ff']);
});
test('여러 색상의 텍스트는 각 글자 색과 기본 색으로 캔버스에 그린다',()=>{
 const drawn=[],ctx={font:'500 20px Arial',fillStyle:'',textAlign:'center',save(){},restore(){},translate(){},scale(){},measureText(s){return{width:textLetters(s).length*10}},fillText(text,x,y){drawn.push({text,color:this.fillStyle,x,y})}};
 paintColoredText(ctx,'우정!',50,20,100,{color:'#111111',letterColors:['#ff0000','#0000ff','']},'#222222');
 assert.deepEqual(drawn.map(d=>d.color),['#ff0000','#0000ff','#111111']);assert.deepEqual(drawn.map(d=>d.text),['우','정','!']);
});
test('상단에서 자유롭게 옮긴 텍스트는 지정한 전체 프레임 좌표를 유지한다',()=>{
 const e={...DEFAULT_EVENT,title:'축제',branding:{title:{position:'free',anchor:'top',x:.5,y:.05,size:.04}}};
 assert(brandingModel(e).hasTop);const g=layout(4,e),ctx={font:'',measureText(){return{width:80}}};
 const item=brandItems(ctx,e,g,new Map())[0];assert.equal(item.y,g.height*.05);
 const middle={...e,branding:{title:{...e.branding.title,anchor:'',y:.5}}};assert.equal(brandingModel(middle).hasTop,false);assert.equal(brandItems(ctx,middle,layout(4,middle),new Map())[0].y,900);
});
test('추가 문구 상자와 글자별 크기는 정규화·재편집 뒤에도 유지된다',()=>{
 const e=normalizeEvent({...DEFAULT_EVENT,branding:{texts:[{id:'extra-test',text:'추억',x:.4,y:.6,size:.04,styledText:'추억',letterColors:['#ff0000','#0000ff'],letterSizes:[2,.5]}]}});
 const again=normalizeEvent(e);assert.equal(again.branding.texts.length,1);assert.deepEqual(again.branding.texts[0].letterSizes,[2,.5]);assert.deepEqual(again.branding.texts[0].letterColors,['#ff0000','#0000ff']);
 const edited=brandingModel({...e,branding:{...e.branding,texts:[{...e.branding.texts[0],text:'새추억'}]}}).texts[0];assert.deepEqual(edited.letterSizes,[1,2,.5]);
});

test('추가 문구의 알 수 없는 필드와 글꼴·색상·크기는 안전하게 정규화한다',()=>{const e=normalizeEvent({...DEFAULT_EVENT,branding:{texts:[{id:'extra-test',text:'문구',apiKey:'private',font:'javascript:evil',color:'url(evil)',letterColors:['javascript:evil'],letterSizes:[Infinity,-1]}]}});const item=e.branding.texts[0];assert(!('apiKey' in item));assert.equal(item.font,'baeum');assert.equal(item.color,'');assert.deepEqual(item.letterColors,['','']);assert.deepEqual(item.letterSizes,[1,.5]);});

test('부분 글꼴은 저장·삽입·삭제 뒤 유지하고 잘못된 글꼴은 제거한다',()=>{
 const e=normalizeEvent({...DEFAULT_EVENT,title:'우정!',branding:{title:{styledText:'우정!',letterFonts:['night','edge','url(evil)']}}});
 assert.deepEqual(e.branding.title.letterFonts,['night','edge','']);
 assert.deepEqual(brandingModel({...e,title:'새우정!'}).title.letterFonts,['','night','edge','']);
 const drawn=[],ctx={font:'500 20px KerisBaeum',fillStyle:'',save(){},restore(){},translate(){},scale(){},measureText(s){return{width:textLetters(s).length*10}},fillText(text,x,y){drawn.push({text,font:this.font,y})}};
 paintColoredText(ctx,'우정!\n함께',0,0,100,{letterFonts:['night','edge','','','marker','']},'#111111');
 assert(drawn[0].font.includes('School_night'));assert(drawn[1].font.includes('School_edge'));assert(drawn[3].font.includes('School_marker'));assert(drawn[3].y>drawn[0].y);
});

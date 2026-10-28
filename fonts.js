import {SCHOOL_FONTS} from './school-font-catalog.js';
export const FONTS=[{id:'baeum',name:'케리스 배움체',family:'KerisBaeum'},...[
 ['night','학교안심 밤하늘'],['round','학교안심 덩덩이'],['edge','학교안심 엣지'],['poster','학교안심 포스터'],['marker','학교안심 보드마카']
].map(([id,name])=>({id,name,family:'School_'+id})),...SCHOOL_FONTS.sort((a,b)=>a.name.localeCompare(b.name,'ko'))];
export const normalizeFont=id=>FONTS.some(f=>f.id===id)?id:'baeum';
export const fontFamily=id=>(FONTS.find(f=>f.id===id)||FONTS[0]).family;
const pendingFonts=new Map();
export async function loadFont(id){
 if(typeof document==='undefined')return;
 const font=FONTS.find(f=>f.id===normalizeFont(id));
 if(font.source){
  if(!pendingFonts.has(font.id)){
   const request=new FontFace(font.family,`url("/fonts/School-${font.id}.woff2")`).load().then(face=>{document.fonts.add(face);return face;}).catch(error=>{pendingFonts.delete(font.id);throw error;});
   pendingFonts.set(font.id,request);
  }
  await pendingFonts.get(font.id);
 }
 await document.fonts.load(`500 32px ${font.family}`);
 if(!document.fonts.check(`500 32px ${font.family}`))throw new Error('선택한 글꼴을 불러오지 못했어요. 네트워크를 확인해 주세요.');
}
export function fillFontSelect(select){
 select.replaceChildren();
 for(const [label,fonts] of [['기본·추천 글꼴',FONTS.slice(0,6)],['학교안심·공유 OFL 글꼴',FONTS.slice(6)]]){
  const group=document.createElement('optgroup');group.label=label;
  for(const font of fonts){const option=document.createElement('option');option.value=font.id;option.textContent=font.name;group.append(option);}
  select.append(group);
 }
}

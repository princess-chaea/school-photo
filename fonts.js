export const FONTS=[{id:'baeum',name:'케리스 배움체',family:'KerisBaeum'},...[
 ['night','학교안심 밤하늘'],['round','학교안심 덩덩이'],['edge','학교안심 엣지'],['poster','학교안심 포스터'],['marker','학교안심 보드마커']
].map(([id,name])=>({id,name,family:'School_'+id}))];
export const normalizeFont=id=>FONTS.some(f=>f.id===id)?id:'baeum';
export const fontFamily=id=>(FONTS.find(f=>f.id===id)||FONTS[0]).family;
export async function loadFont(id){if(typeof document==='undefined')return;const family=fontFamily(id);await document.fonts.load(`500 32px ${family}`);if(!document.fonts.check(`500 32px ${family}`))throw new Error('선택한 글꼴을 불러오지 못했어요. 네트워크를 확인해 주세요.');}
export function fillFontSelect(select){select.replaceChildren(...FONTS.map(f=>{const option=document.createElement('option');option.value=f.id;option.textContent=f.name;option.style.fontFamily=f.family;return option;}));}

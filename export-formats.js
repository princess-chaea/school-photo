export const EXPORT_FORMATS=[
 {id:'original',name:'선택한 프레임 그대로 · 원본',group:'기본'},
 {id:'print-4x6',name:'4×6인치 인화용 · 세로 2:3',width:1200,height:1800,group:'인화·출력용'},
 {id:'print-6x4',name:'4×6인치 인화용 · 가로 3:2',width:1800,height:1200,group:'인화·출력용'},
 {id:'print-3x5',name:'3×5인치 사진 인화용',width:900,height:1500,group:'인화·출력용'},
 {id:'print-5x7',name:'5×7인치 사진 인화용',width:1500,height:2100,group:'인화·출력용'},
 {id:'a4',name:'A4 문서 출력용 · 세로',width:2480,height:3508,group:'인화·출력용'},
 {id:'kakao',name:'1:1 · 카톡 프로필용 (안전 여백)',width:1080,height:1080,padding:.08,group:'대표 비율·SNS용'},
 {id:'instagram-square',name:'1:1 · 인스타 정사각 피드용',width:1080,height:1080,group:'대표 비율·SNS용'},
 {id:'instagram-feed',name:'4:5 · 인스타 세로 피드용',width:1080,height:1350,group:'대표 비율·SNS용'},
 {id:'story',name:'9:16 · 스토리·릴스 배경용',width:1080,height:1920,group:'대표 비율·SNS용'},
 {id:'ratio-3x4',name:'3:4 · 세로 사진용',width:1080,height:1440,group:'대표 비율·SNS용'},
 {id:'ratio-4x3',name:'4:3 · 가로 사진용',width:1440,height:1080,group:'대표 비율·SNS용'},
 {id:'ratio-2x3',name:'2:3 · 세로 사진용',width:1080,height:1620,group:'대표 비율·SNS용'},
 {id:'ratio-3x2',name:'3:2 · 가로 사진용',width:1620,height:1080,group:'대표 비율·SNS용'},
 {id:'screen',name:'16:9 · 가로 화면·영상 배경용',width:1920,height:1080,group:'대표 비율·SNS용'}
];
export function exportGeometry(sourceW,sourceH,id='original'){
 const preset=EXPORT_FORMATS.find(f=>f.id===id)||EXPORT_FORMATS[0],width=preset.width||sourceW,height=preset.height||sourceH,pad=preset.padding||0;
 const scale=Math.min(width*(1-pad*2)/sourceW,height*(1-pad*2)/sourceH),w=sourceW*scale,h=sourceH*scale;
 return {width,height,x:(width-w)/2,y:(height-h)/2,w,h};
}
export function paintExport(source,target,id,background='#fffdf6'){
 const g=exportGeometry(source.width,source.height,id);if(target.width!==g.width||target.height!==g.height){target.width=g.width;target.height=g.height;}const ctx=target.getContext('2d');ctx.fillStyle=background;ctx.fillRect(0,0,g.width,g.height);ctx.imageSmoothingQuality='high';ctx.drawImage(source,g.x,g.y,g.w,g.h);return g;
}
export function createExportPicker(getSource,onChange){
 const select=document.getElementById('export-format'),button=document.getElementById('choose-export-format'),dialog=document.getElementById('export-format-dialog'),list=document.getElementById('export-format-options');
 function shape(f){const source=getSource(),w=f.width||source.width,h=f.height||source.height,box=document.createElement('span');box.className='format-shape-box';const rect=document.createElement('span');rect.className='format-shape';const scale=36/Math.max(w,h);rect.style.width=w*scale+'px';rect.style.height=h*scale+'px';box.append(rect);box.setAttribute('aria-hidden','true');return box;}
 function refresh(){const f=EXPORT_FORMATS.find(f=>f.id===select.value)||EXPORT_FORMATS[0],label=document.createElement('span');label.textContent=f.name;button.replaceChildren(shape(f),label);}
 function open(){list.replaceChildren();for(const group of ['대표 비율·SNS용','인화·출력용','기본']){const heading=document.createElement('h3');heading.textContent=group;const grid=document.createElement('div');grid.className='format-preset-grid';for(const f of EXPORT_FORMATS.filter(f=>f.group===group)){const b=document.createElement('button');b.type='button';b.className='format-preset';b.setAttribute('aria-pressed',String(select.value===f.id));const name=document.createElement('strong');name.textContent=f.name;const dimensions=document.createElement('small'),source=getSource();dimensions.textContent=(f.width||source.width)+' × '+(f.height||source.height)+'px';b.append(shape(f),name,dimensions);b.onclick=()=>{select.value=f.id;dialog.close();refresh();onChange();};grid.append(b);}list.append(heading,grid);}dialog.showModal();}
 button.onclick=open;document.getElementById('close-export-format').onclick=()=>dialog.close();refresh();return {refresh};
}

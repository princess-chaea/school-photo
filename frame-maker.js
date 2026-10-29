import {FRAME_SIZES} from './frame-sizes.js';
import {templateGeometry,imageFromURL} from './core.js';
import {drawLayoutGuide} from './layout-guide.js';
import {drawFrameOverlay} from './frame-overlay.js';
const PURPOSES={
 'print-4x6':['사진 인화 · 기본','추억을 사진으로 뽑아요'],
 'print-3x5':['사진 인화 · 슬림','길쭉한 기념사진'],
 'print-5x7':['사진 인화 · 와이드','넉넉한 기념사진'],
 square:['정사각형 · 프로필','카톡 프로필·정사각 피드'],
 feed:['인스타 세로 피드','SNS에 올리는 세로 사진'],
 story:['스토리 · 릴스','휴대폰 화면에 길게'],
 a4:['문서 · 학습지','A4로 출력해요'],
 screen:['발표 · 영상 화면','발표 자료·화면 배경']
};
export function createFrameMaker({onChange,onDownload}){
 const $=id=>document.getElementById(id),format=$('template-format'),orientation=$('template-orientation'),preview=$('maker-preview');
 document.querySelector('.maker-choices').append(document.querySelector('.maker-image-instructions'),$('frame-form'),$('palette-workspace'));
 let kind='',count=4,photoScale=1,draftImage=null,draftClear=true,version=0;
 const selection=()=>{const g=geometry();return{frameFormat:format.value,orientation:orientation.value,layoutCount:count,kind,photoSlots:g.slots.map(s=>({x:s.x/g.width,y:s.y/g.height,w:s.w/g.width,h:s.h/g.height}))};};
 function geometry(){const g=templateGeometry(count,orientation.value,format.value);return{...g,slots:g.slots.map(s=>({x:s.x+s.w*(1-photoScale)/2,y:s.y+s.h*(1-photoScale)/2,w:s.w*photoScale,h:s.h*photoScale}))};}
 function refresh(){
  $('maker-workspace').hidden=!kind;$('maker-photo-area').hidden=kind!=='image';$('maker-photo-scale').textContent=Math.round(photoScale*100)+'%';$('maker-photo-smaller').disabled=photoScale<=.55;$('maker-photo-larger').disabled=photoScale>=1;$('frame-form').hidden=kind!=='image';$('palette-workspace').hidden=kind!=='palette';$('maker-image-guide').hidden=kind!=='image';document.querySelector('.maker-image-instructions').hidden=kind!=='image';
  for(const button of document.querySelectorAll('[data-maker-kind]'))button.setAttribute('aria-pressed',String(button.dataset.makerKind===kind));
  $('frame-upload-format').value=format.value;
  $('maker-purposes').replaceChildren(...FRAME_SIZES.map(size=>{
   const button=document.createElement('button');button.type='button';button.className='maker-purpose';button.dataset.format=size.id;button.setAttribute('aria-pressed',String(size.id===format.value));
   const canvas=document.createElement('canvas');canvas.width=100;canvas.height=110;canvas.setAttribute('aria-hidden','true');drawLayoutGuide(canvas,templateGeometry(count,orientation.value,size.id));
   const name=document.createElement('strong');name.textContent=PURPOSES[size.id][0];const note=document.createElement('small');note.textContent=PURPOSES[size.id][1];button.append(canvas,name,note);button.onclick=()=>{format.value=size.id;changed();};return button;
  }));
  $('maker-cuts').replaceChildren(...[2,4,6,8].map(n=>{
   const button=document.createElement('button');button.type='button';button.className='maker-cut';button.dataset.count=n;button.setAttribute('aria-pressed',String(n===count));const canvas=document.createElement('canvas');canvas.width=100;canvas.height=92;canvas.setAttribute('aria-hidden','true');drawLayoutGuide(canvas,templateGeometry(n,orientation.value,format.value));const label=document.createElement('strong');label.textContent=n+'컷';button.append(canvas,label);button.onclick=()=>{count=n;changed();};return button;
  }));
  for(const button of document.querySelectorAll('[data-maker-orientation]'))button.setAttribute('aria-pressed',String(button.dataset.makerOrientation===orientation.value));
  const g=geometry(),color=kind==='palette'?$('palette-bg').value:'#fffdf6',ink=kind==='palette'?$('palette-ink').value:'#41572c';
  drawLayoutGuide(preview,g,{background:color,ink});
  if(kind==='image'&&draftImage){const scale=Math.min(preview.width/g.width,preview.height/g.height),ctx=preview.getContext('2d');ctx.save();ctx.translate((preview.width-g.width*scale)/2,(preview.height-g.height*scale)/2);ctx.scale(scale,scale);drawFrameOverlay(ctx,draftImage,{clearPhotoSlots:draftClear},g);ctx.restore();}
  const purpose=PURPOSES[format.value][0],direction=orientation.value==='landscape'?'가로':'세로';
  $('maker-summary').textContent=`${purpose} · ${count}컷 · ${direction} 배치`;
  $('maker-dimensions').textContent=`${g.width} × ${g.height}px · ${FRAME_SIZES.find(s=>s.id===format.value).name}`;
  $('maker-scope').textContent=kind==='image'?'이 이미지 프레임은 같은 비율·컷 수·가로/세로 배치를 고른 학생에게만 표시돼요.':'단색 프레임은 학생이 고른 모든 용도·컷 수·배치에 맞춰 사용할 수 있어요. 아래 배치는 확인용이에요.';
 }
 function clearDraft(){version++;draftImage=null;refresh();}
 function changed(){clearDraft();onChange(selection());}
 $('maker-photo-smaller').onclick=()=>{photoScale=Math.max(.55,Math.round((photoScale-.05)*100)/100);changed();};$('maker-photo-larger').onclick=()=>{photoScale=Math.min(1,Math.round((photoScale+.05)*100)/100);changed();};
 for(const button of document.querySelectorAll('[data-maker-kind]'))button.onclick=()=>{kind=button.dataset.makerKind;refresh();};
 for(const button of document.querySelectorAll('[data-maker-orientation]'))button.onclick=()=>{orientation.value=button.dataset.makerOrientation;changed();};
 $('maker-guide-download').onclick=()=>onDownload(count,true);$('maker-blank-download').onclick=()=>onDownload(count,false);
 for(const id of ['palette-bg','palette-ink'])$(id).addEventListener('input',refresh);
 refresh();
 return{selection,refresh,clearDraft,begin(){kind='';refresh();},async setDraft(draft){const ticket=++version,url=URL.createObjectURL(draft.file);try{const image=await imageFromURL(url);if(ticket===version){draftImage=image;draftClear=draft.clearPhotoSlots;refresh();}}finally{URL.revokeObjectURL(url);}}};
}

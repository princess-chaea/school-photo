import {supportedFrameCounts} from './core.js';
import './frame-comparison.css';
import {compatibleFrame} from './core.js';
import {EXPORT_FORMATS,paintExport} from './export-formats.js';
import {paintFramePreview} from './frame-preview.js';
const $=id=>document.getElementById(id);
export function createFrameComparison({getEvent,getSelection}){
 const dialog=$('frame-comparison'),framePicker=$('comparison-frame'),formatPicker=$('comparison-format');let count=4,frameIndex=0,version=0;
 const option=(value,label)=>Object.assign(document.createElement('option'),{value,textContent:label});
 formatPicker.append(option('original','기본 프레임 규격 · 방향별 비교'));
 for(const group of [...new Set(EXPORT_FORMATS.filter(f=>f.width).map(f=>f.group))]){const options=document.createElement('optgroup');options.label=group;for(const f of EXPORT_FORMATS.filter(f=>f.width&&f.group===group))options.append(option(f.id,f.name));formatPicker.append(options);}
 function choices(event){
  framePicker.replaceChildren(...event.frames.map((f,i)=>option(i,f.name+(f.layoutCount?` · ${f.layoutCount}컷 ${f.orientation==='landscape'?'가로':'세로'} 전용`:''))));framePicker.value=String(frameIndex);
  const frame=event.frames[frameIndex];if(!supportedFrameCounts(frame).includes(count))count=supportedFrameCounts(frame)[0];
  $('comparison-cuts').replaceChildren(...[2,4,6,8].map(n=>{const button=document.createElement('button');button.type='button';button.textContent=n+'컷';button.className='button';button.setAttribute('aria-pressed',String(count===n));button.disabled=!supportedFrameCounts(frame).includes(n);button.onclick=()=>{count=n;refresh();};return button;}));
 }
 async function refresh(){
  const event=getEvent();if(!event||!dialog.open)return;const ticket=++version;choices(event);const frame=event.frames[frameIndex],preset=EXPORT_FORMATS.find(f=>f.id===formatPicker.value)||EXPORT_FORMATS[0];$('comparison-status').textContent='미리보기를 불러오는 중…';
  try{
   await Promise.all(['portrait','landscape'].map(async orientation=>{
    const canvas=$('comparison-'+orientation),empty=$('comparison-'+orientation+'-unavailable'),info=$('comparison-'+orientation+'-info');
    const available=compatibleFrame(frame,count,orientation);canvas.hidden=!available;empty.hidden=available;
    if(!available){info.textContent='제작 방향 전용 이미지 프레임';empty.textContent=`이 프레임은 ${frame.orientation==='landscape'?'가로':'세로'} 배치 전용이에요. 반대 방향으로 사용할 이미지 프레임을 행사에 추가해 주세요.`;return;}
    empty.textContent='';const fixedOutput=Boolean((frame.layoutCount||frame.preserveAspect)&&preset.width),source=fixedOutput?document.createElement('canvas'):canvas;
    const result=await paintFramePreview(source,event,{count,frameIndex,orientation,preset});if(!result||ticket!==version||!dialog.open)return;
    let dimensions=result.geometry;if(fixedOutput)dimensions=paintExport(source,canvas,preset.id,frame.bg);
    info.textContent=`${count}컷 · ${result.geometry.cols} × ${result.geometry.rows} 배치 · ${dimensions.width} × ${dimensions.height}px`;
   }));
   if(ticket===version&&dialog.open)$('comparison-status').textContent=preset.width?'선택한 출력 크기 안에서 세로·가로 배치를 비교해요.':'기본 프레임은 배치 방향에 맞는 세로·가로 규격으로 보여요.';
  }catch(error){if(ticket===version)$('comparison-status').textContent='미리보기를 불러오지 못했어요. '+error.message;}
 }
 function open(){const event=getEvent();if(!event)return;({count,frameIndex}=getSelection());frameIndex=Math.max(0,Math.min(frameIndex,event.frames.length-1));formatPicker.value='original';dialog.showModal();refresh();}
 function close(){version++;dialog.close();}
 $('open-frame-comparison').onclick=open;$('close-frame-comparison').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 framePicker.onchange=()=>{frameIndex=Number(framePicker.value);refresh();};formatPicker.onchange=refresh;
}

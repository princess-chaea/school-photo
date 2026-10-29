import { clamp } from './core.js';
export function createEditorView(editor,canvas,{isDecorationTarget=()=>false}={}){
 const stage=document.getElementById('expanded-stage'),wrap=document.getElementById('editor-viewport'),bar=document.getElementById('editor-view-controls'),output=document.getElementById('editor-view-value');let zoom=1,drag=null;const points=new Map();
 function refresh(){
  if(editor.hidden)return;
  const photo=editor.dataset.tool==='photo';bar.hidden=photo;
  if(photo){
   const cropCanvas=document.getElementById('crop-preview'),inset=12;
   wrap.style.width=stage.clientWidth+'px';wrap.style.height=stage.clientHeight+'px';
   const fit=Math.max(.01,Math.min((stage.clientWidth-inset)/cropCanvas.width,(stage.clientHeight-inset)/cropCanvas.height));
   cropCanvas.style.width=cropCanvas.width*fit+'px';cropCanvas.style.height=cropCanvas.height*fit+'px';
   stage.scrollLeft=0;stage.scrollTop=0;
  }else{
   const fit=Math.max(.01,Math.min((stage.clientWidth-24)/canvas.width,(stage.clientHeight-24)/canvas.height));
   wrap.style.width=Math.max(stage.clientWidth,canvas.width*fit*zoom+24)+'px';wrap.style.height=Math.max(stage.clientHeight,canvas.height*fit*zoom+24)+'px';
   canvas.style.width=canvas.width*fit*zoom+'px';canvas.style.height=canvas.height*fit*zoom+'px';
  }
  output.textContent=Math.round(zoom*100)+'%';stage.classList.toggle('view-pan',points.size>0);
 }
 function setZoom(value){const x=(stage.scrollLeft+stage.clientWidth/2)/Math.max(1,wrap.clientWidth),y=(stage.scrollTop+stage.clientHeight/2)/Math.max(1,wrap.clientHeight);zoom=clamp(value,1,4);refresh();stage.scrollLeft=x*wrap.clientWidth-stage.clientWidth/2;stage.scrollTop=y*wrap.clientHeight-stage.clientHeight/2;}
 document.getElementById('editor-view-plus').onclick=()=>setZoom(zoom+.25);document.getElementById('editor-view-minus').onclick=()=>setZoom(zoom-.25);document.getElementById('editor-view-fit').onclick=()=>setZoom(1);
 stage.addEventListener('pointerdown',e=>{
  if(editor.dataset.tool==='photo'||(e.pointerType==='mouse'&&e.button!==0))return;
  const background=e.target===stage||e.target===wrap,onCanvas=e.target===canvas;
  if(!background&&!onCanvas)return;
  // Decorations keep their own drag/resize gestures; all remaining canvas pixels pan the view.
  if(!points.size&&onCanvas&&isDecorationTarget(e))return;
  canvas.dispatchEvent(new Event('clear-selection'));e.preventDefault();e.stopImmediatePropagation();stage.setPointerCapture(e.pointerId);points.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(points.size===2){const[a,b]=[...points.values()];const rect=stage.getBoundingClientRect();drag={pinch:true,distance:Math.hypot(a.x-b.x,a.y-b.y),zoom,anchorX:(stage.scrollLeft+(a.x+b.x)/2-rect.left-stage.clientLeft)/Math.max(1,wrap.clientWidth),anchorY:(stage.scrollTop+(a.y+b.y)/2-rect.top-stage.clientTop)/Math.max(1,wrap.clientHeight)};}else drag={x:e.clientX,y:e.clientY,left:stage.scrollLeft,top:stage.scrollTop};refresh();
 },true);
 stage.addEventListener('pointermove',e=>{if(!points.has(e.pointerId)||!drag)return;e.preventDefault();e.stopImmediatePropagation();points.set(e.pointerId,{x:e.clientX,y:e.clientY});if(drag.pinch&&points.size===2){const[a,b]=[...points.values()];const rect=stage.getBoundingClientRect();zoom=clamp(drag.zoom*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,drag.distance),1,4);refresh();stage.scrollLeft=drag.anchorX*wrap.clientWidth-((a.x+b.x)/2-rect.left-stage.clientLeft);stage.scrollTop=drag.anchorY*wrap.clientHeight-((a.y+b.y)/2-rect.top-stage.clientTop);}else if(!drag.pinch){stage.scrollLeft=drag.left-(e.clientX-drag.x);stage.scrollTop=drag.top-(e.clientY-drag.y);}},true);
 for(const type of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(type,e=>{if(!points.has(e.pointerId))return;e.stopImmediatePropagation();points.delete(e.pointerId);const remaining=[...points.values()][0];drag=remaining?{x:remaining.x,y:remaining.y,left:stage.scrollLeft,top:stage.scrollTop}:null;refresh();},true);
 stage.addEventListener('wheel',e=>{if(editor.dataset.tool==='photo')return;e.preventDefault();setZoom(zoom*(e.deltaY<0?1.1:1/1.1));},{passive:false});
 new ResizeObserver(refresh).observe(stage);
 return {refresh,reset(){zoom=1;points.clear();refresh();},clear(){canvas.style.width='';canvas.style.height='';points.clear();drag=null;}};
}

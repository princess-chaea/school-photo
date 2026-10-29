import { clamp } from './core.js';
export function createEditorView(editor,canvas,{isDecorationTarget=()=>false}={}){
 const stage=document.getElementById('expanded-stage'),wrap=document.getElementById('editor-viewport'),bar=document.getElementById('editor-view-controls'),output=document.getElementById('editor-view-value');let zoom=1,drag=null;const points=new Map();
 function refresh(){if(editor.hidden)return;const photo=editor.dataset.tool==='photo';bar.hidden=photo;wrap.style.width=photo?'100%':Math.max(stage.clientWidth,canvas.width*Math.min((stage.clientWidth-24)/canvas.width,(stage.clientHeight-24)/canvas.height)*zoom+24)+'px';wrap.style.height=photo?'100%':Math.max(stage.clientHeight,canvas.height*Math.min((stage.clientWidth-24)/canvas.width,(stage.clientHeight-24)/canvas.height)*zoom+24)+'px';if(!photo){const fit=Math.min((stage.clientWidth-24)/canvas.width,(stage.clientHeight-24)/canvas.height);canvas.style.width=canvas.width*fit*zoom+'px';canvas.style.height=canvas.height*fit*zoom+'px';}output.textContent=Math.round(zoom*100)+'%';stage.classList.toggle('view-pan',points.size>0);}
 function setZoom(value){const x=(stage.scrollLeft+stage.clientWidth/2)/Math.max(1,wrap.clientWidth),y=(stage.scrollTop+stage.clientHeight/2)/Math.max(1,wrap.clientHeight);zoom=clamp(value,1,4);refresh();stage.scrollLeft=x*wrap.clientWidth-stage.clientWidth/2;stage.scrollTop=y*wrap.clientHeight-stage.clientHeight/2;}
 document.getElementById('editor-view-plus').onclick=()=>setZoom(zoom+.25);document.getElementById('editor-view-minus').onclick=()=>setZoom(zoom-.25);document.getElementById('editor-view-fit').onclick=()=>setZoom(1);
 stage.addEventListener('pointerdown',e=>{
  if(editor.dataset.tool==='photo'||(e.pointerType==='mouse'&&e.button!==0))return;
  const background=e.target===stage||e.target===wrap,onCanvas=e.target===canvas;
  if(!background&&!onCanvas)return;
  // Decorations keep their own drag/resize gestures; all remaining canvas pixels pan the view.
  if(!points.size&&onCanvas&&isDecorationTarget(e))return;
  canvas.dispatchEvent(new Event('clear-selection'));e.preventDefault();e.stopImmediatePropagation();stage.setPointerCapture(e.pointerId);points.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(points.size===2){const[a,b]=[...points.values()];drag={pinch:true,distance:Math.hypot(a.x-b.x,a.y-b.y),zoom};}else drag={x:e.clientX,y:e.clientY,left:stage.scrollLeft,top:stage.scrollTop};refresh();
 },true);
 stage.addEventListener('pointermove',e=>{if(!points.has(e.pointerId)||!drag)return;e.preventDefault();e.stopImmediatePropagation();points.set(e.pointerId,{x:e.clientX,y:e.clientY});if(drag.pinch&&points.size===2){const[a,b]=[...points.values()];setZoom(drag.zoom*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,drag.distance));}else if(!drag.pinch){stage.scrollLeft=drag.left-(e.clientX-drag.x);stage.scrollTop=drag.top-(e.clientY-drag.y);}},true);
 for(const type of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(type,e=>{if(!points.has(e.pointerId))return;e.stopImmediatePropagation();points.delete(e.pointerId);const remaining=[...points.values()][0];drag=remaining?{x:remaining.x,y:remaining.y,left:stage.scrollLeft,top:stage.scrollTop}:null;refresh();},true);
 stage.addEventListener('wheel',e=>{if(editor.dataset.tool==='photo')return;e.preventDefault();setZoom(zoom*(e.deltaY<0?1.1:1/1.1));},{passive:false});
 new ResizeObserver(refresh).observe(stage);
 return {refresh,reset(){zoom=1;points.clear();refresh();},clear(){canvas.style.width='';canvas.style.height='';points.clear();drag=null;}};
}

import {containPhotoSlot,transformPhotoSlot,orderedPhotoSlots} from './photo-slots.js';
export function createPhotoSlotEditor(canvas,{geometry,getIndex,setIndex,change,refresh}){
 const points=new Map();let gesture=null;
 const scale=g=>Math.min(canvas.width/g.width,canvas.height/g.height);
 function point(e){const g=geometry(),r=canvas.getBoundingClientRect(),fit=Math.min(r.width/canvas.width,r.height/canvas.height),x=(e.clientX-r.left-(r.width-canvas.width*fit)/2)/fit,y=(e.clientY-r.top-(r.height-canvas.height*fit)/2)/fit,k=scale(g);return{x:(x-(canvas.width-g.width*k)/2)/k,y:(y-(canvas.height-g.height*k)/2)/k};}
 const local=(p,s)=>{const r=-(s.rotation||0)*Math.PI/180,x=p.x-s.x-s.w/2,y=p.y-s.y-s.h/2;return{x:x*Math.cos(r)-y*Math.sin(r),y:x*Math.sin(r)+y*Math.cos(r)};};
 function mode(p,s,g){const q=local(p,s),hit=18/scale(g);if(Math.hypot(q.x,q.y+s.h/2+30/scale(g))<hit)return'rotate';for(const x of[-1,1])for(const y of[-1,1])if(Math.hypot(q.x-x*s.w/2,q.y-y*s.h/2)<hit)return'resize';return Math.abs(q.x)<=s.w/2&&Math.abs(q.y)<=s.h/2?'move':null;}
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 function update(next,g){const n=containPhotoSlot({x:next.x/g.width,y:next.y/g.height,w:next.w/g.width,h:next.h/g.height,rotation:next.rotation||0,...(next.z!==undefined?{z:next.z}:{})},g.width/g.height);change(getIndex(),n);}
 canvas.addEventListener('pointerdown',e=>{const g=geometry(),p=point(e);if(!g)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);points.set(e.pointerId,p);let index=getIndex(),s=g.slots[index],action=s&&mode(p,s,g);
  if(points.size===2&&s){const[a,b]=[...points.values()];gesture={action:'pinch',slot:{...s},distance:distance(a,b),angle:Math.atan2(b.y-a.y,b.x-a.x)};return;}
  if(points.size>1)return;
  if(!action||action==='move'){index=orderedPhotoSlots(g.slots).findLast(({slot:s})=>{const q=local(p,s);return Math.abs(q.x)<=s.w/2&&Math.abs(q.y)<=s.h/2;})?.index??-1;if(index<0){gesture=null;return;}setIndex(index);s=g.slots[index];action='move';}
  gesture={action,point:p,slot:{...s},distance:distance(p,{x:s.x+s.w/2,y:s.y+s.h/2}),angle:Math.atan2(p.y-s.y-s.h/2,p.x-s.x-s.w/2)};refresh();
 });
 canvas.addEventListener('pointermove',e=>{if(!points.has(e.pointerId)||!gesture)return;e.preventDefault();const p=point(e),g=geometry(),s=gesture.slot;points.set(e.pointerId,p);let next={...s};
  if(gesture.action==='move'){next.x+=p.x-gesture.point.x;next.y+=p.y-gesture.point.y;}
  else if(gesture.action==='rotate')next.rotation=Math.max(-180,Math.min(180,(s.rotation||0)+(Math.atan2(p.y-s.y-s.h/2,p.x-s.x-s.w/2)-gesture.angle)*180/Math.PI));
  else{let factor;if(gesture.action==='pinch'&&points.size===2){const[a,b]=[...points.values()];factor=distance(a,b)/Math.max(1,gesture.distance);next.rotation=Math.max(-180,Math.min(180,(s.rotation||0)+(Math.atan2(b.y-a.y,b.x-a.x)-gesture.angle)*180/Math.PI));}else if(gesture.action==='resize')factor=distance(p,{x:s.x+s.w/2,y:s.y+s.h/2})/Math.max(1,gesture.distance);else return;factor=Math.max(.08,factor);next.w=Math.max(g.width*.03,s.w*factor);next.h=Math.max(g.height*.03,s.h*factor);next.x=s.x+(s.w-next.w)/2;next.y=s.y+(s.h-next.h)/2;}
  update(next,g);
 });
 for(const type of['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>{points.delete(e.pointerId);gesture=null;});
 return{draw(){const g=geometry(),s=g.slots[getIndex()];if(!s)return;const c=canvas.getContext('2d'),k=scale(g);c.save();c.translate((canvas.width-g.width*k)/2,(canvas.height-g.height*k)/2);c.scale(k,k);transformPhotoSlot(c,s);c.strokeStyle='#3d6f21';c.fillStyle='#c5f564';c.lineWidth=2/k;c.setLineDash([6/k,4/k]);c.strokeRect(s.x,s.y,s.w,s.h);c.setLineDash([]);for(const x of[s.x,s.x+s.w])for(const y of[s.y,s.y+s.h]){c.fillRect(x-5/k,y-5/k,10/k,10/k);c.strokeRect(x-5/k,y-5/k,10/k,10/k);}const x=s.x+s.w/2,y=s.y-30/k;c.beginPath();c.moveTo(x,s.y);c.lineTo(x,y);c.stroke();c.beginPath();c.arc(x,y,9/k,0,Math.PI*2);c.fill();c.stroke();c.restore();}};
}

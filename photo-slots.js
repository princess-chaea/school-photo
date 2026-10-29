// Apply a photo window's rotation around its own center, without changing its crop ratio.
export function transformPhotoSlot(ctx,s){if(!s.rotation)return;const x=s.x+s.w/2,y=s.y+s.h/2;ctx.translate(x,y);ctx.rotate(s.rotation*Math.PI/180);ctx.translate(-x,-y);}
export function containPhotoSlot(slot,aspect=1){
 const s={...slot,w:Math.max(.025,Math.min(.98,slot.w)),h:Math.max(.025,Math.min(.98,slot.h))},r=(s.rotation||0)*Math.PI/180,c=Math.abs(Math.cos(r)),n=Math.abs(Math.sin(r));
 const bounds=()=>({hx:Math.max(s.w/2,(s.w*aspect*c+s.h*n)/2/aspect),hy:Math.max(s.h/2,(s.w*aspect*n+s.h*c)/2)});
 for(let i=0;i<8;i++){const{hx,hy}=bounds(),fit=Math.min(1,.98/(2*hx),.98/(2*hy));if(fit>=1)break;s.w=Math.max(.025,s.w*fit);s.h=Math.max(.025,s.h*fit);}
 const{hx,hy}=bounds(),cx=Math.min(1-hx,Math.max(hx,slot.x+slot.w/2)),cy=Math.min(1-hy,Math.max(hy,slot.y+slot.h/2));s.x=cx-s.w/2;s.y=cy-s.h/2;return s;
}
export function orderedPhotoSlots(slots){return slots.map((slot,index)=>({slot,index})).sort((a,b)=>(a.slot.z??a.index)-(b.slot.z??b.index)||a.index-b.index);}
export function movePhotoSlotLayer(slots,index,direction){
 const order=orderedPhotoSlots(slots).map(s=>s.index),from=order.indexOf(index),to=direction==='front'?order.length-1:direction==='back'?0:Math.max(0,Math.min(order.length-1,from+(direction==='up'?1:-1)));
 if(from<0||from===to)return slots.map(s=>({...s}));order.splice(from,1);order.splice(to,0,index);const result=slots.map(s=>({...s}));order.forEach((i,z)=>{result[i].z=z;});return result;
}

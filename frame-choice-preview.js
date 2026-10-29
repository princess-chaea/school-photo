// Keep each choice's ink, surface and palette in one opaque bitmap. Some browsers
// forcibly recolor CSS text independently of its background, ignoring color-scheme.
const painters=new WeakMap();
export function observeFrameChoices(root){new ResizeObserver(()=>{for(const card of root.querySelectorAll('.color-safe-frame'))painters.get(card)?.();}).observe(root);}
export function paintFrameChoice(button,frame,{selected=false,preview}={}){
 const canvas=document.createElement('canvas');canvas.className='frame-choice-bitmap';canvas.setAttribute('aria-hidden','true');button.classList.add('color-safe-frame');
 const text=document.createElement('span');text.className='frame-choice-accessible';text.textContent=frame.name;button.replaceChildren(canvas,text);
 function paint(){
  if(!button.isConnected)return;
  const w=button.clientWidth,h=preview?150:96;if(!w)return;const scale=Math.min(3,devicePixelRatio||1);canvas.width=Math.round(w*scale);canvas.height=h*scale;canvas.style.height=h+'px';
  const c=canvas.getContext('2d');c.scale(scale,scale);c.fillStyle=selected?'#f0f6e5':'#fffefa';c.fillRect(0,0,w,h);
  c.strokeStyle=selected?'#607f40':'#c8ccbf';c.lineWidth=selected?2:1;c.beginPath();c.roundRect(1,1,w-2,h-2,11);c.stroke();
  if(preview?.width&&preview?.height){const fit=Math.min((w-12)/preview.width,90/preview.height);c.drawImage(preview,(w-preview.width*fit)/2,6,preview.width*fit,preview.height*fit);}
  else{c.beginPath();c.arc(w/2,29,14,0,Math.PI*2);c.fillStyle=frame.bg;c.fill();c.strokeStyle='#7a8172';c.lineWidth=1;c.stroke();}
  c.font='600 11px Arial, "Malgun Gothic", sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#252820';
  const lines=[];let line='';for(const word of frame.name.split(/\s+/)){
   const next=line?line+' '+word:word;if(c.measureText(next).width<=w-12){line=next;continue;}
   if(line){lines.push(line);line='';}for(const char of Array.from(word)){if(line&&c.measureText(line+char).width>w-12){lines.push(line);line='';}line+=char;}
  }if(line)lines.push(line);
  const y=preview?110:66;lines.slice(0,3).forEach((label,i)=>c.fillText(label,w/2,y+(i-(Math.min(3,lines.length)-1)/2)*14,w-10));
  if(frame.layoutCount){c.font='10px Arial, "Malgun Gothic", sans-serif';c.fillText(`${frame.layoutCount}컷 · ${frame.orientation==='landscape'?'가로':'세로'}`,w/2,138,w-10);}
  if(selected){c.fillStyle='#4b6b2f';c.font='bold 13px Arial';c.textAlign='right';c.fillText('✓',w-6,12);}
 }
 painters.set(button,paint);requestAnimationFrame(paint);return paint;
}

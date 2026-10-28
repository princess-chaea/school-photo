import {FRAME_PALETTES} from './frame-palettes.js';
const baseIds=new Set(FRAME_PALETTES.map(f=>f.id));
export const FRAME_GROUPS=[{id:'base',name:'기본 색상 프레임'},{id:'theme',name:'테마 프레임'},{id:'personal',name:'내 프레임'}];
export function frameSource(frame){
 if(['base','theme','personal'].includes(frame.source))return frame.source;
 // Older events didn't store the source. Shared IDs retain their stable prefix.
 if(frame.shared===true||(typeof frame.id==='string'&&frame.id.startsWith('shared-')))return 'theme';
 return baseIds.has(frame.id)&&!frame.overlay&&!frame.url?'base':'personal';
}
export function groupFrames(frames){return FRAME_GROUPS.map(group=>({...group,items:frames.map((frame,index)=>({frame,index})).filter(item=>frameSource(item.frame)===group.id)}));}
export function renderFrameGroups(root,frames,{renderCard,filter=()=>true,student=false,library=false}={}){
 root.classList.remove('selection-grid','frame-grid','asset-library');root.classList.add('frame-groups');root.replaceChildren();
 for(const group of groupFrames(frames)){
  const section=document.createElement('section');section.className=`frame-group frame-group--${group.id}${library?' frame-group--library':''}`;section.dataset.frameGroup=group.id;
  const title=document.createElement('h3');title.className='frame-group-heading';title.textContent=group.name;const grid=document.createElement('div');grid.className='frame-group-grid';grid.setAttribute('role','group');grid.setAttribute('aria-label',group.name);
  const entries=group.items.filter(({frame})=>filter(frame));const count=document.createElement('span');count.textContent=entries.length+'개';title.append(count);section.append(title,grid);
  for(const {frame,index}of entries)grid.append(renderCard(frame,index,group.id));
  if(!entries.length){const empty=document.createElement('p');empty.className='frame-group-empty';empty.textContent=group.items.length?'선택한 컷 수·배치에서 사용할 수 있는 프레임이 없어요.':group.id==='theme'?'준비된 테마 프레임이 없어요.':group.id==='personal'?(student?'선생님이 추가한 프레임이 없어요.':'프레임 보관함에 직접 추가한 프레임이 여기에 표시돼요.'):'선택된 기본 색상 프레임이 없어요.';grid.append(empty);}
  root.append(section);
 }
}

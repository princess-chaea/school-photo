import{normalizePhotoLayouts}from'./core.js';
import{FRAME_SIZES}from'./frame-sizes.js';
export function normalizeFrameDraft(value){
 if(typeof value==='string'){if(value.length>16000)return null;try{value=JSON.parse(value);}catch{return null;}}
 if(!value||value.version!==1||!FRAME_SIZES.some(f=>f.id===value.format)||!['portrait','landscape'].includes(value.orientation))return null;
 const layouts=normalizePhotoLayouts(value.layouts),enabled=Array.isArray(value.enabled)?[...new Set(value.enabled)]:[];
 if(!layouts||!enabled.length||enabled.length>4||enabled.some(n=>![2,4,6,8].includes(n)||!layouts[n]))return null;
 const count=enabled.includes(value.count)?value.count:enabled[0],index=Number.isInteger(value.index)&&value.index>=0&&value.index<count?value.index:0;
 return{version:1,format:value.format,orientation:value.orientation,count,index,enabled,layouts};
}

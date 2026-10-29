import {normalizeFont,fontFamily} from './fonts.js';
const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter('ko',{granularity:'grapheme'}):null;
export const textLetters=text=>segmenter?[...segmenter.segment(String(text))].map(part=>part.segment):Array.from(String(text));
export const safeTextColor=value=>/^#[0-9a-f]{6}$/i.test(value||'')?value:'';
function reconcile(before,after,values,empty,normalize){
 const old=textLetters(before),next=textLetters(after),result=next.map(()=>empty),safe=old.map((_,i)=>normalize(values[i]));
 let prefix=0;while(prefix<old.length&&prefix<next.length&&old[prefix]===next[prefix]){result[prefix]=safe[prefix];prefix++;}
 let suffix=0;while(suffix<old.length-prefix&&suffix<next.length-prefix&&old[old.length-1-suffix]===next[next.length-1-suffix]){result[next.length-1-suffix]=safe[old.length-1-suffix];suffix++;}
 return result;
}
export const reconcileLetterColors=(before,after,colors=[])=>reconcile(before,after,colors,'',safeTextColor);
const safeSize=value=>Number.isFinite(value)?Math.min(3,Math.max(.5,value)):1;
export function textColorSettings(text,settings={}){
 const styledText=String(text).slice(0,100),before=typeof settings.styledText==='string'?settings.styledText.slice(0,100):styledText;
 return {styledText,letterColors:reconcileLetterColors(before,styledText,Array.isArray(settings.letterColors)?settings.letterColors:[]),letterSizes:reconcile(before,styledText,Array.isArray(settings.letterSizes)?settings.letterSizes:[],1,safeSize),letterFonts:reconcile(before,styledText,Array.isArray(settings.letterFonts)?settings.letterFonts:[],'',value=>typeof value==='string'&&value&&normalizeFont(value)===value?value:'')};
}
export function measureStyledText(ctx,text,settings={}){
 const original=ctx.font,baseSize=parseFloat(original.match(/([\d.]+)px/)?.[1]||'16'),letters=textLetters(text),varied=settings.letterSizes?.some(n=>n!==1)||settings.letterFonts?.some(Boolean),runs=[],lines=[];
 let width=0,prefix='',maxSize=baseSize,line=0;
 for(const [index,letter]of letters.entries()){
  if(letter==='\n'){if(!varied){ctx.font=original;width=ctx.measureText(prefix).width;}lines.push({width,maxSize});width=0;prefix='';maxSize=baseSize;line++;continue;}
  const size=baseSize*safeSize(settings.letterSizes?.[index]);ctx.font=original.replace(/[\d.]+px/,`${size}px`);
  if(settings.letterFonts?.[index])ctx.font=ctx.font.replace(/px\s+.+$/,`px ${fontFamily(settings.letterFonts[index])}, Arial, sans-serif`);
  const x=varied?width:ctx.measureText(prefix+letter).width-ctx.measureText(letter).width;
  const advance=ctx.measureText(letter).width;runs.push({text:letter,x,font:ctx.font,index,line});width+=advance;prefix+=letter;maxSize=Math.max(maxSize,size);
 }
 lines.push({width:varied?width:(ctx.font=original,ctx.measureText(prefix).width),maxSize});ctx.font=original;
 let height=0;for(const row of lines){row.y=height+row.maxSize*.625;height+=row.maxSize*1.25;}
 return {width:Math.max(0,...lines.map(row=>row.width)),height,maxSize:Math.max(...lines.map(row=>row.maxSize)),runs,lines};
}
export function paintColoredText(ctx,text,x,y,maxWidth,settings,fallback){
 const colors=settings.letterColors||[],base=settings.color||fallback;
 if(!colors.some(Boolean)&&!settings.letterSizes?.some(n=>n!==1)&&!settings.letterFonts?.some(Boolean)&&!text.includes('\n')){ctx.fillStyle=base;ctx.fillText(text,x,y,maxWidth);return;}
 const metrics=measureStyledText(ctx,text,settings),scale=metrics.width>maxWidth?maxWidth/metrics.width:1;
 ctx.save();ctx.translate(x,y);ctx.scale(scale,1);ctx.textAlign='left';
 for(const run of metrics.runs){const row=metrics.lines[run.line];ctx.font=run.font;ctx.fillStyle=colors[run.index]||base;ctx.fillText(run.text,run.x-row.width/2,row.y-metrics.height/2);}
 ctx.restore();
}

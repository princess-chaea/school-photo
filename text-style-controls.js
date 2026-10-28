import './text-style-controls.css';
import {BRAND_SIZES,clamp} from './core.js';
import {textLetters} from './text-colors.js';
export function createTextStyleControls(root,{getState,onChange}){
 const selected=new Set();let identity='',renderedText='',letterButtons=[];
 function element(tag,text='',className=''){const el=document.createElement(tag);el.textContent=text;el.className=className;return el;}
 const row=element('div','','text-style-row'),sizeLabel=element('label','크기 (%)'),size=document.createElement('input');size.type='number';size.step='1';sizeLabel.append(size);
 const colorLabel=element('label','전체 색상'),color=document.createElement('input');color.type='color';colorLabel.append(color);
 const auto=element('button','프레임 색에 맞추기','text-button');auto.type='button';row.append(sizeLabel,colorLabel,auto);
 const details=document.createElement('details'),summary=element('summary','글자별 색상'),help=element('p','바꿀 글자를 누른 뒤 색을 고르세요. 여러 글자를 함께 선택할 수 있어요.','small muted'),letters=element('div','','letter-color-options');letters.setAttribute('role','group');letters.setAttribute('aria-label','색을 바꿀 글자 선택');
 const actions=element('div','','letter-color-actions'),all=element('button','전체 선택','text-button'),clear=element('button','선택 글자 색 지우기','text-button'),letterLabel=element('label','선택한 글자 색'),letterColor=document.createElement('input');letterColor.type='color';letterLabel.append(letterColor);const letterSizeLabel=element('label','선택한 글자 크기 (%)'),letterSize=document.createElement('input');letterSize.type='number';letterSize.min=50;letterSize.max=300;letterSize.step=10;letterSizeLabel.append(letterSize);all.type=clear.type='button';actions.append(all,letterLabel,letterSizeLabel,clear);details.append(summary,help,letters,actions);root.append(row,details);
 function state(){return getState();}
 function refresh(){
  const value=state();root.hidden=!value||value.key==='logo';if(root.hidden)return;
  const {key,text,settings,ink}=value,currentIdentity=key;
  if(identity!==currentIdentity){selected.clear();identity=currentIdentity;renderedText='';}
  const base=value.baseSize||BRAND_SIZES[key]||BRAND_SIZES.title;size.min=Math.ceil((value.minSize||.012)/base*100);size.max=Math.floor((value.maxSize||.1)/base*100);size.value=Math.round(settings.size/base*100);size.setAttribute('aria-label',value.label+' 크기 (%)');color.value=settings.color||ink||'#34372f';color.setAttribute('aria-label',value.label+' 전체 색상');
  if(renderedText!==text){selected.clear();renderedText=text;letters.replaceChildren();letterButtons=textLetters(text).map((letter,index)=>{const button=element('button',letter===' '?'␣':letter,'letter-color-button');button.type='button';button.setAttribute('aria-label',`${index+1}번째 글자 ${letter===' '?'공백':letter}`);button.onclick=()=>{selected.has(index)?selected.delete(index):selected.add(index);refresh();};letters.append(button);return button;});}
  letterButtons.forEach((button,i)=>{button.style.color=settings.letterColors?.[i]||color.value;button.setAttribute('aria-pressed',String(selected.has(i)));});
  letterColor.disabled=letterSize.disabled=clear.disabled=selected.size===0;all.disabled=letterButtons.length===0;
  letterSize.value=Math.round((settings.letterSizes?.[[...selected][0]]||1)*100);letterSize.setAttribute('aria-label',value.label+' 선택한 글자 크기 (%)');letterColor.value=settings.letterColors?.[[...selected][0]]||color.value;letterColor.setAttribute('aria-label',value.label+' 선택한 글자 색');
 }
 size.onchange=()=>{const value=state();if(!value)return;const n=Number(size.value);if(Number.isFinite(n))onChange({size:clamp(n*(value.baseSize||BRAND_SIZES[value.key]||BRAND_SIZES.title)/100,value.minSize||.012,value.maxSize||.1)});refresh();};
 color.oninput=()=>{const value=state();if(value)onChange({color:color.value,styledText:value.text,letterColors:[]});};
 auto.onclick=()=>{const value=state();if(value)onChange({color:'',styledText:value.text,letterColors:[]});};
 all.onclick=()=>{letterButtons.forEach((_,i)=>selected.add(i));refresh();};
 function applyLetterColor(value){const current=state();if(!current||!selected.size)return;const colors=textLetters(current.text).map((_,i)=>current.settings.letterColors?.[i]||'');for(const i of selected)colors[i]=value;onChange({styledText:current.text,letterColors:colors});}
 letterSize.onchange=()=>{const current=state();if(!current||!selected.size)return;const sizes=textLetters(current.text).map((_,i)=>current.settings.letterSizes?.[i]||1),factor=clamp(Number(letterSize.value)/100,.5,3);for(const i of selected)sizes[i]=factor;onChange({styledText:current.text,letterSizes:sizes});};
 letterColor.oninput=()=>applyLetterColor(letterColor.value);clear.onclick=()=>applyLetterColor('');
 refresh();return {refresh};
}

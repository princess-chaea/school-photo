import './text-style-controls.css';
import {BRAND_SIZES,clamp} from './core.js';
import {textLetters,textColorSettings} from './text-colors.js';
import {fillFontSelect,refreshFontSelect,fontFamily,loadFont} from './fonts.js';
let nextEditor=0;
// Keep a logical range while toolbar controls (including the font dialog) have focus.
export function createTextStyleControls(root,{getState,onChange,onTextChange,textInput,fontSelect}){
 let identity='',range=null,composing=false,painting=false,fontTicket=0,history=[],future=[];
 const el=(tag,text='',cls='')=>Object.assign(document.createElement(tag),{textContent:text,className:cls});
 const help=el('p','문구를 직접 입력하고, 바꿀 부분을 드래그해 크기·글꼴·색상을 조절하세요.','small muted');
 const editor=el('div','','rich-text-input');editor.contentEditable='true';editor.setAttribute('role','textbox');editor.setAttribute('aria-multiline','true');editor.spellcheck=false;
 const toolbar=el('div','','rich-text-toolbar'),font=document.createElement('select');font.id='rich-font-'+(++nextEditor);fillFontSelect(font);
 const fontLabel=el('label','글꼴');fontLabel.htmlFor=font.id;
 const sizeLabel=el('label','크기 (%)'),size=document.createElement('input');size.type='number';size.step=1;sizeLabel.append(size);
 const colorLabel=el('label','색상'),color=document.createElement('input');color.type='color';colorLabel.append(color);
 const all=el('button','전체 선택','text-button'),auto=el('button','프레임 색에 맞추기','text-button');all.type=auto.type='button';
 const status=el('p','','rich-selection-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 toolbar.append(fontLabel,font,sizeLabel,colorLabel,all,auto);root.replaceChildren(help,editor,toolbar,status);refreshFontSelect(font);
 if(textInput){textInput.hidden=true;const label=[...(textInput.labels||[])][0];if(label){editor.id=textInput.id+'-rich';label.htmlFor=editor.id;}}
 if(fontSelect){const trigger=document.getElementById(fontSelect.id+'-picker');if(trigger){trigger.hidden=true;for(const label of document.querySelectorAll('label'))if(label.htmlFor===trigger.id)label.hidden=true;}}
 const current=()=>getState();
 function offsets(){const selection=window.getSelection();if(!selection?.rangeCount)return null;const r=selection.getRangeAt(0);if(!editor.contains(r.startContainer)||!editor.contains(r.endContainer))return null;const before=r.cloneRange();before.selectNodeContents(editor);before.setEnd(r.startContainer,r.startOffset);return{start:before.toString().length,end:before.toString().length+r.toString().length};}
 function restore(saved){if(!saved)return;const walker=document.createTreeWalker(editor,NodeFilter.SHOW_TEXT);let node,total=0,start=null,end=null;while((node=walker.nextNode())){const limit=total+node.length;if(!start&&saved.start<=limit)start=[node,Math.max(0,saved.start-total)];if(saved.end<=limit){end=[node,Math.max(0,saved.end-total)];break;}total=limit;}const r=document.createRange();if(start&&end){r.setStart(...start);r.setEnd(...end);}else{r.selectNodeContents(editor);r.collapse(false);}const selection=window.getSelection();selection.removeAllRanges();selection.addRange(r);}
 function capture(){if(painting||composing)return;const found=offsets();if(found){range=found;syncToolbar();}}
 function indices(value){let offset=0;return textLetters(value.text).flatMap((letter,i)=>{const start=offset;offset+=letter.length;return range&&range.end>range.start&&offset>range.start&&start<range.end?[i]:[];});}
 function syncToolbar(){const value=current();if(!value)return;const selected=indices(value),i=selected[0],base=value.baseSize||BRAND_SIZES[value.key]||BRAND_SIZES.title;
  status.textContent=selected.length?`${selected.length}글자 선택 · 선택한 부분에만 적용`:'문구 전체에 적용 · 일부만 바꾸려면 글자를 드래그하세요.';
  size.min=selected.length?50:Math.ceil((value.minSize||.012)/base*100);size.max=selected.length?300:Math.floor((value.maxSize||.1)/base*100);
  if(document.activeElement!==size)size.value=Math.round(selected.length?(value.settings.letterSizes?.[i]||1)*100:value.settings.size/base*100);
  if(document.activeElement!==color)color.value=(selected.length?value.settings.letterColors?.[i]:'')||value.settings.color||value.ink||'#34372f';
  font.value=(selected.length?value.settings.letterFonts?.[i]:'')||value.settings.font||'baeum';refreshFontSelect(font);
 }
 function refresh(){if(fontSelect){const trigger=document.getElementById(fontSelect.id+'-picker');if(trigger){trigger.hidden=true;for(const label of document.querySelectorAll('label'))if(label.htmlFor===trigger.id)label.hidden=true;}}const value=current();root.hidden=!value||value.key==='logo';if(root.hidden)return;if(identity!==value.key){identity=value.key;range=null;fontTicket++;history=[];future=[];}
  editor.setAttribute('aria-label',value.label+' 문구 편집');size.setAttribute('aria-label',value.label+' 크기 (%)');color.setAttribute('aria-label',value.label+' 색상');
  if(!composing){const focused=document.activeElement===editor,saved=focused?offsets():null;painting=true;const styles=textColorSettings(value.text,value.settings),fragment=document.createDocumentFragment();for(const [i,letter]of textLetters(value.text).entries()){const span=el('span',letter);span.style.color=styles.letterColors[i]||value.settings.color||value.ink||'#34372f';span.style.fontSize=`${24*(styles.letterSizes[i]||1)}px`;span.style.fontFamily=fontFamily(styles.letterFonts[i]||value.settings.font);fragment.append(span);}if(value.text.endsWith('\n')){const end=document.createElement('br');end.dataset.richEnd='true';fragment.append(end);}editor.replaceChildren(fragment);if(focused)restore(saved);painting=false;}
  syncToolbar();
 }
 function remember(){const value=current();if(!value)return;history.push({text:value.text,settings:structuredClone(value.settings)});if(history.length>80)history.shift();future=[];}
 function restoreEdit(snapshot){const value=current();if(!value)return;if(textInput){textInput.value=snapshot.text;textInput.dispatchEvent(new Event('input',{bubbles:true}));}else onTextChange?.(snapshot.text);onChange(snapshot.settings);range=null;refresh();}
 editor.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())){e.preventDefault();const redo=e.key.toLowerCase()==='y'||e.shiftKey,from=redo?future:history,to=redo?history:future;if(from.length){const value=current();to.push({text:value.text,settings:structuredClone(value.settings)});restoreEdit(from.pop());}}});
 function changeText(text){const value=current();if(!value)return;const limit=textInput?.maxLength>0?textInput.maxLength:100;text=text.replaceAll('\r','').slice(0,limit);if(text!==value.text)remember();const styles=textColorSettings(text,{...value.settings,styledText:value.text});
  if(textInput){textInput.value=text;textInput.dispatchEvent(new Event('input',{bubbles:true}));}
  else onTextChange?.(text);
  onChange(styles);refresh();
 }
 const readText=()=>editor.querySelector('div,p,br:not([data-rich-end])')?editor.innerText:editor.textContent;
 editor.addEventListener('input',()=>{if(!composing)changeText(readText()||'');});editor.addEventListener('compositionstart',()=>{composing=true;});editor.addEventListener('compositionend',()=>{composing=false;changeText(readText()||'');});
 function insertText(text){capture();const value=current();if(!value)return;const selected=range||{start:value.text.length,end:value.text.length},next=value.text.slice(0,selected.start)+text+value.text.slice(selected.end);changeText(next);editor.focus({preventScroll:true});range={start:Math.min(selected.start+text.length,next.length),end:Math.min(selected.start+text.length,next.length)};restore(range);syncToolbar();}
 editor.addEventListener('beforeinput',e=>{if(e.inputType==='insertParagraph'||e.inputType==='insertLineBreak'){e.preventDefault();insertText('\n');}});
 editor.addEventListener('paste',e=>{e.preventDefault();insertText(e.clipboardData.getData('text/plain'));});editor.addEventListener('drop',e=>e.preventDefault());
 editor.addEventListener('pointerup',capture);editor.addEventListener('keyup',capture);editor.addEventListener('selectstart',()=>{range=null;});
 document.addEventListener('selectionchange',()=>{if(root.isConnected&&!root.hidden)capture();});
 toolbar.addEventListener('pointerdown',capture,{capture:true});
 function apply(kind,value){const state=current();if(!state)return;remember();const selected=indices(state);if(selected.length){const defaults={letterColors:'',letterSizes:1,letterFonts:''},values=textLetters(state.text).map((_,i)=>state.settings[kind]?.[i]??defaults[kind]);for(const i of selected)values[i]=value;onChange({styledText:state.text,[kind]:values});}
  else if(kind==='letterColors')onChange({color:value,styledText:state.text,letterColors:[]});else if(kind==='letterFonts')onChange({font:value,styledText:state.text,letterFonts:[]});else{const base=state.baseSize||BRAND_SIZES[state.key]||BRAND_SIZES.title;onChange({size:clamp(value*base,state.minSize||.012,state.maxSize||.1)});}refresh();
 }
 size.onchange=()=>{const value=Number(size.value);if(Number.isFinite(value))apply('letterSizes',clamp(value/100,Number(size.min)/100,Number(size.max)/100));};
 color.oninput=()=>apply('letterColors',color.value);auto.onclick=()=>apply('letterColors','');
 font.onchange=async()=>{const id=font.value,ticket=++fontTicket,key=identity,saved=range?{...range}:null;status.textContent='글꼴을 적용하고 있어요…';try{await loadFont(id);if(ticket!==fontTicket||key!==current()?.key)return;range=saved;apply('letterFonts',id);}catch(error){status.textContent=error.message;}};
 all.onclick=()=>{const value=current();if(!value)return;editor.focus({preventScroll:true});range={start:0,end:value.text.length};restore(range);syncToolbar();};
 refresh();return{refresh,focus(){editor.focus();},selectAll(){all.click();}};
}

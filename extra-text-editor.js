import {brandingModel,brandPart,changeBrandPart} from './core.js';
import {fillFontSelect,refreshFontSelect,loadFont} from './fonts.js';
import {createTextStyleControls} from './text-style-controls.js';
import {confirmAction} from './app-dialog.js';
export function createExtraTextEditor(root,{getEvent,onChange}){
 const cards=new Map(),heading=document.createElement('h3'),note=document.createElement('p'),list=document.createElement('div'),add=document.createElement('button');heading.textContent='추가 문구';note.textContent='문구 상자를 최대 8개 추가하고, 프레임에서 자유롭게 옮겨요.';note.className='small muted';add.type='button';add.className='button';add.textContent='＋ 문구 상자 추가';root.append(heading,note,list,add);
 function model(){const {hasContent,hasTop,hasBottom,...value}=brandingModel(getEvent());return value;}
 function refresh(){
  const event=getEvent();if(!event)return;const texts=brandingModel(event).texts;add.disabled=texts.length>=8;
  for(const [id,card]of cards)if(!texts.some(item=>item.id===id)){card.root.remove();cards.delete(id);}
  for(const [index,item]of texts.entries()){
   let card=cards.get(item.id);
   if(!card){
    const box=document.createElement('section');box.className='extra-text-card';const label=document.createElement('label'),input=document.createElement('textarea'),visible=document.createElement('input'),visibleLabel=document.createElement('label'),fontLabel=document.createElement('label'),font=document.createElement('select'),styles=document.createElement('div'),remove=document.createElement('button');
    input.maxLength=100;input.id=item.id+'-content';label.htmlFor=input.id;label.className='field-label';visible.type='checkbox';visibleLabel.append(visible,document.createTextNode('프레임에 표시'));fontLabel.textContent='글꼴';fontLabel.className='field-label';font.id=item.id+'-font';fontLabel.htmlFor=font.id;fillFontSelect(font);styles.className='text-style-controls';remove.type='button';remove.className='text-button danger';remove.textContent='문구 삭제';box.append(label,input,visibleLabel,fontLabel,font,styles,remove);list.append(box);
    const change=part=>{if(brandPart(getEvent(),item.id))onChange(changeBrandPart(getEvent(),item.id,part));};
    input.oninput=()=>change({text:input.value});visible.onchange=()=>change({visible:visible.checked});font.onchange=async()=>{const id=font.value;try{await loadFont(id);change({font:id});}catch(error){font.value=brandPart(getEvent(),item.id)?.settings.font||'baeum';refreshFontSelect(font);note.textContent=error.message;}};
    remove.onclick=async()=>{if(await confirmAction('이 문구 상자를 삭제할까요?')){const value=model();value.texts=value.texts.filter(t=>t.id!==item.id);onChange(value);}};
    const controls=createTextStyleControls(styles,{textInput:input,fontSelect:font,getState:()=>{const part=brandPart(getEvent(),item.id);return part?{key:item.id,label:'추가 문구',text:part.content,settings:part.settings,ink:getEvent().frames[0]?.ink}:null;},onChange:change});
    card={root:box,label,input,visible,font,controls};cards.set(item.id,card);
   }
   card.label.textContent=`추가 문구 ${index+1}`;if(card.input.value!==item.text)card.input.value=item.text;card.visible.checked=item.visible;card.font.value=item.font;refreshFontSelect(card.font);card.controls.refresh();
  }
 }
 add.onclick=()=>{const value=model();if(value.texts.length>=8)return;const id='extra-'+crypto.randomUUID();value.texts.push({id,text:'추가 문구',position:'free',x:value.texts.length%2?.72:.28,y:.35+Math.floor(value.texts.length/2)*.15,size:.027});onChange(value);cards.get(id)?.controls.focus();cards.get(id)?.controls.selectAll();};
 return {refresh};
}

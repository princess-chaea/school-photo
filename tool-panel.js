// Mobile tools open above the tabs so the canvas does not resize during a gesture.
export function createToolPanel(editor,{onSelect}){
 const media=matchMedia('(max-width: 700px), (pointer: coarse) and (max-width: 1100px) and (max-height: 550px)'),panel=document.getElementById('expanded-tools'),closeButton=document.getElementById('close-mobile-tools'),tabs=[...editor.querySelectorAll('[data-editor-tool]')];
 let open=!media.matches;
 function sync(){
  const compact=media.matches,visible=!compact||open;panel.hidden=!visible;editor.dataset.toolsOpen=String(visible);closeButton.hidden=!compact;if(compact&&!visible)document.getElementById('edit-title').textContent='사진을 자유롭게 꾸며요';
  for(const tab of tabs){const active=tab.dataset.editorTool===editor.dataset.tool&&visible;tab.classList.toggle('selected',active);tab.setAttribute('aria-pressed',String(active));tab.setAttribute('aria-expanded',String(active));tab.setAttribute('aria-controls','expanded-tools');}
 }
 function setOpen(value){open=!media.matches||Boolean(value);sync();}
 function close(){if(!media.matches)return;if(editor.dataset.tool==='photo')onSelect('stickers',{openPanel:false});else setOpen(false);}
 closeButton.onclick=close;
 for(const tab of tabs)tab.onclick=()=>{if(media.matches&&open&&tab.dataset.editorTool===editor.dataset.tool)close();else onSelect(tab.dataset.editorTool,{openPanel:true});};
 media.addEventListener('change',()=>{if(media.matches)close();else onSelect(editor.dataset.tool,{openPanel:true});});
 sync();return{get compact(){return media.matches;},setOpen,close,reset(){if(media.matches&&editor.dataset.tool==='photo')onSelect('stickers',{openPanel:false});else setOpen(!media.matches);}};
}

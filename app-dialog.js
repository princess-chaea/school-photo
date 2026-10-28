import './app-dialog.css';
let pending=Promise.resolve();
export function confirmAction(message,{title='확인해 주세요',confirmLabel='확인',cancelLabel='취소'}={}){
 const show=()=>new Promise(resolve=>{
  const previous=document.activeElement,dialog=document.createElement('dialog');dialog.className='app-confirm-dialog';dialog.setAttribute('aria-labelledby','app-confirm-title');dialog.setAttribute('aria-describedby','app-confirm-message');
  const heading=document.createElement('h2');heading.id='app-confirm-title';heading.textContent=title;
  const description=document.createElement('p');description.id='app-confirm-message';description.textContent=message;
  const form=document.createElement('form');form.method='dialog';form.className='app-confirm-actions';
  for(const [value,label] of [['confirm',confirmLabel],['cancel',cancelLabel]]){const button=document.createElement('button');button.type='submit';button.value=value;button.textContent=label;button.className=value==='confirm'?'button primary':'button';if(value==='cancel')button.autofocus=true;form.append(button);}
  dialog.append(heading,description,form);document.body.append(dialog);
  dialog.addEventListener('close',()=>{const accepted=dialog.returnValue==='confirm';dialog.remove();if(previous?.isConnected)previous.focus({preventScroll:true});resolve(accepted);},{once:true});
  dialog.showModal();
 });
 const answer=pending.then(show,show);pending=answer.then(()=>{},()=>{});return answer;
}

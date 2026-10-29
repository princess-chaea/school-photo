const tabs=[...document.querySelectorAll('[role="tab"]')];
function activate(id){
 const active=id==='terms'?'terms':'privacy';
 for(const tab of tabs){const selected=tab.getAttribute('aria-controls')===active;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;document.getElementById(tab.getAttribute('aria-controls')).hidden=!selected;}
 document.title=(active==='terms'?'이용약관':'개인정보처리방침')+' | 사제동행 찰칵! 포토';
}
function navigate(tab){history.pushState(null,'',tab.hash);activate(tab.hash.slice(1));tab.focus();window.scrollTo({top:0});}
for(const tab of tabs){tab.addEventListener('click',event=>{event.preventDefault();navigate(tab);});tab.addEventListener('keydown',event=>{const index=tabs.indexOf(tab),next=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:null;if(next!==null){event.preventDefault();navigate(tabs[next]);}});}
window.addEventListener('hashchange',()=>{activate(location.hash.slice(1));window.scrollTo({top:0});});
window.addEventListener('popstate',()=>activate(location.hash.slice(1)));
activate(location.hash.slice(1));

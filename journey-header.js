const labels=['프레임','용도·배치','촬영','꾸미기','저장·공유'];
export function createJourneyHeader({onResize=()=>{}}={}){
 const media=matchMedia('(max-width:1100px)'),button=document.getElementById('journey-toggle'),info=document.getElementById('journey-info'),current=document.getElementById('journey-current'),progress=document.getElementById('journey-progress');
 let expanded=false,lastStep=-1;
 function sync(){
  button.hidden=!media.matches;info.hidden=media.matches&&!expanded;
  button.setAttribute('aria-expanded',String(!info.hidden));
  button.querySelector('.journey-toggle-label').firstChild.textContent=expanded?'간단히 보기 ':'행사·단계 보기 ';
  requestAnimationFrame(onResize);
 }
 button.onclick=()=>{expanded=!expanded;sync();};
 media.addEventListener('change',()=>{expanded=false;sync();});sync();
 return{refresh(step){if(step!==lastStep){expanded=false;lastStep=step;}current.textContent=`${step+1} / 5 · ${labels[step]}`;progress.value=step+1;progress.setAttribute('aria-valuetext',`${step+1}단계: ${labels[step]}`);sync();}};
}

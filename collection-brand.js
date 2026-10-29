import {collectionName} from './sharing.js';
import {labelButton} from './icons.js';
export function collectionBrand(sharing){const name=collectionName(sharing);return{name,url:name==='Padlet'?'/brands/padlet.png':name==='Google Drive'?'/brands/google-drive.png':''};}
export function labelCollectionButton(element,sharing,text){
 const brand=collectionBrand(sharing);labelButton(element,'upload',text);
 if(brand.url){const image=document.createElement('img');image.src=brand.url;image.alt='';image.width=image.height=24;image.className='collection-brand-icon';element.firstElementChild.replaceWith(image);}
}
export function renderCollectionBrand(element,sharing){
 const brand=collectionBrand(sharing);element.replaceChildren();element.hidden=!brand.url;if(!brand.url)return;
 const image=document.createElement('img');image.src=brand.url;image.alt='';image.width=image.height=40;const name=document.createElement('strong');name.textContent=brand.name;element.append(image,name);
}

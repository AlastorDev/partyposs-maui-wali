import {SPECIES} from './world.js';
export function artHTML(id,extra=''){
  const s=SPECIES[id];if(!s)return '';
  if(id==='partyposs')return `<div class="critter-art single ${extra}" role="img" aria-label="PartyPoss"><img src="./assets/partyposs.webp" alt="" draggable="false"></div>`;
  return `<div class="critter-art atlas-${s.atlas} cell-${s.cell} ${extra}" role="img" aria-label="${s.name}"></div>`;
}
export function setArt(element,id){element.className='critter-art';const s=SPECIES[id];element.replaceChildren();if(id==='partyposs'){element.classList.add('single');const img=document.createElement('img');img.src='./assets/partyposs.webp';img.alt='';element.append(img);}else element.classList.add(`atlas-${s.atlas}`,`cell-${s.cell}`);}

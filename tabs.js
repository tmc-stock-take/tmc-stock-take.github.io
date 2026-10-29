/* TMC Stock Take V1.3.8 - responsive navigation, UI only */
(()=>{
 'use strict';
 const KEY='tmc_stock_take_page_v136';
 const pages=['sync','import','scan','history','settings'];
 const tabs=[...document.querySelectorAll('[data-page-target]')];
 const views=Object.fromEntries(pages.map(p=>[p,document.getElementById('page-'+p)]));
 function activate(page,opts={}){
  if(!pages.includes(page))page='import';
  const wasScan=views.scan&&!views.scan.hidden;
  if(wasScan&&page!=='scan'&&document.getElementById('scannerPanel')?.classList.contains('active')){
    // Stop camera when leaving the scan page; prevents camera running behind other screens.
    document.getElementById('cameraBtn')?.click();
  }
  for(const id of pages){const isCurrent=(id===page);
   views[id].hidden=!isCurrent;
   const tab=document.getElementById('tab-'+id);
   tab.setAttribute('aria-selected',isCurrent?'true':'false');
   tab.tabIndex=isCurrent?0:-1;
  }
  try{sessionStorage.setItem(KEY,page)}catch(_){}
  if(!opts.initial)window.scrollTo({top:0,behavior:'instant'});
 }
 function keyNav(e){if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  const current=tabs.indexOf(document.activeElement);if(current<0)return;
  e.preventDefault();let next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(current+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
  tabs[next].focus();activate(tabs[next].dataset.pageTarget);
 }
 tabs.forEach(btn=>{btn.addEventListener('click',()=>activate(btn.dataset.pageTarget));btn.addEventListener('keydown',keyNav)});
 document.querySelectorAll('[data-go-page]').forEach(btn=>btn.addEventListener('click',()=>activate(btn.dataset.goPage)));
 let saved='import';try{saved=sessionStorage.getItem(KEY)||'import'}catch(_){}
 activate(saved,{initial:true});
 window.TMCPageNav={activate,get active(){return pages.find(id=>!views[id].hidden)||'import'}};
})();

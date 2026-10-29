/* TMC Stock Take V1.3.2: locally generated scan sounds. No audio files or network calls. */
(()=>{'use strict';
 const KEY='tmc_stocktake_beep_enabled_v132';
 let enabled=true,context=null;
 try{enabled=localStorage.getItem(KEY)!=='off'}catch(_){}
 const AudioEngine=window.AudioContext||window.webkitAudioContext;
 function ensureContext(){if(!AudioEngine)return null;
   try{if(!context)context=new AudioEngine();if(context.state==='suspended')context.resume().catch(()=>{});return context}catch(_){return null}}
 function unlock(){if(enabled)ensureContext()}
 function tone(ctx,when,hz,duration,volume){
  const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.setValueAtTime(hz,when);
  gain.gain.setValueAtTime(0.0001,when);gain.gain.exponentialRampToValueAtTime(volume,when+0.015);gain.gain.exponentialRampToValueAtTime(0.0001,when+duration);
  osc.connect(gain);gain.connect(ctx.destination);osc.start(when);osc.stop(when+duration+0.018);
 }
 function play(type='success'){
  if(!enabled)return;const c=ensureContext();if(!c||c.state!=='running')return;
  const t=c.currentTime+0.005;
  try{
   if(type==='success'){tone(c,t,940,.12,.20)}
   else if(type==='warning'){tone(c,t,830,.10,.16);tone(c,t+.16,1000,.13,.18)}
   else if(type==='duplicate'){tone(c,t,550,.11,.19);tone(c,t+.18,550,.11,.19)}
   else{tone(c,t,400,.15,.21);tone(c,t+.20,290,.19,.20)}
  }catch(e){console.warn('Sound:',e)}
 }
 function setEnabled(next){enabled=!!next;try{localStorage.setItem(KEY,enabled?'on':'off')}catch(_){};if(enabled)unlock();refresh()}
 function refresh(){const box=document.getElementById('soundEnabled');if(box)box.checked=enabled}
 function wire(){refresh();document.getElementById('soundEnabled')?.addEventListener('change',e=>setEnabled(e.target.checked));
   document.getElementById('soundTestBtn')?.addEventListener('click',()=>{unlock();play('success')});
   document.addEventListener('pointerdown',()=>{if(enabled)unlock()},{once:true,passive:true});
 }
 window.StockTakeSound={play,unlock,setEnabled,get enabled(){return enabled}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();

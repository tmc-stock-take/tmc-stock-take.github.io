/* TMC Stock Take V1.3.5 — choose your scan sound; offline Web Audio, no sound files. */
(()=>{'use strict';
 const KEY_ON='tmc_stocktake_beep_enabled_v132';
 const KEY_STYLE='tmc_stocktake_beep_style_v135';
 const KEY_VOL='tmc_stocktake_beep_volume_v135';
 const TYPES=['success','warning','duplicate','error'];
 const STYLES=['crisp','scanner','soft'];
 let enabled=true,style='crisp',volume=60,context=null;
 try{
   enabled=localStorage.getItem(KEY_ON)!=='off';
   const savedStyle=localStorage.getItem(KEY_STYLE);if(STYLES.includes(savedStyle))style=savedStyle;
   const savedVolume=Number(localStorage.getItem(KEY_VOL));if(savedVolume>=10&&savedVolume<=100)volume=savedVolume;
 }catch(_){}
 const AudioEngine=window.AudioContext||window.webkitAudioContext;
 function getContext(){if(!AudioEngine)return null;
   try{if(!context)context=new AudioEngine();return context}catch(_){return null}}
 function unlock(){const c=getContext();if(!c)return Promise.resolve(null);
   if(c.state==='running')return Promise.resolve(c);
   return c.resume().then(()=>c.state==='running'?c:null).catch(()=>null);
 }
 function tone(c,time,frequency,length,amplitude,kind='sine',endFrequency=null){
   const osc=c.createOscillator(),gain=c.createGain();
   osc.type=kind;osc.frequency.setValueAtTime(frequency,time);
   if(endFrequency)osc.frequency.exponentialRampToValueAtTime(endFrequency,time+length);
   const attack=Math.min(.007,length/8),release=Math.min(.035,length/3);
   const level=Math.max(.0001,Math.min(.29,amplitude*(volume/100)));
   gain.gain.setValueAtTime(.0001,time);
   gain.gain.linearRampToValueAtTime(level,time+attack);
   gain.gain.setValueAtTime(level,time+length-release);
   gain.gain.exponentialRampToValueAtTime(.0001,time+length);
   osc.connect(gain);gain.connect(c.destination);osc.start(time);osc.stop(time+length+.015);
 }
 function schedule(c,type){const t=c.currentTime+.012;
   if(type==='success'){
     if(style==='scanner'){
       tone(c,t,1010,.095,.26,'square',920);
       tone(c,t+.002,2020,.075,.055,'sine',1830);
     }else if(style==='soft'){
       tone(c,t,700,.17,.13,'sine',810);
     }else{
       tone(c,t,1320,.085,.25,'sine',1480);
       tone(c,t+.003,2640,.06,.06,'sine',2960);
     }
   }else if(type==='warning'){
     tone(c,t,820,.085,.20,style==='soft'?'sine':'triangle');
     tone(c,t+.14,1000,.105,.21,style==='soft'?'sine':'triangle');
   }else if(type==='duplicate'){
     tone(c,t,485,.085,.20,'triangle');tone(c,t+.135,485,.085,.20,'triangle');
   }else{
     tone(c,t,495,.13,.21,'sawtooth',390);
     tone(c,t+.16,360,.17,.21,'triangle',280);
   }
 }
 function play(type='success'){
   if(!enabled)return;
   const chosen=TYPES.includes(type)?type:'error';
   unlock().then(c=>{if(c){try{schedule(c,chosen)}catch(err){console.warn('Scan sound error:',err)}}});
 }
 function save(k,v){try{localStorage.setItem(k,String(v))}catch(_){}}
 function setEnabled(on){enabled=!!on;save(KEY_ON,enabled?'on':'off');if(enabled)unlock();refresh()}
 function setStyle(next){if(!STYLES.includes(next))return;style=next;save(KEY_STYLE,style);refresh()}
 function setVolume(value){volume=Math.max(10,Math.min(100,Number(value)||60));save(KEY_VOL,volume);refresh()}
 function refresh(){const enabledEl=document.getElementById('soundEnabled'),styleEl=document.getElementById('soundStyle'),volEl=document.getElementById('soundVolume'),volLabel=document.getElementById('soundVolumeValue');
   if(enabledEl)enabledEl.checked=enabled;if(styleEl)styleEl.value=style;
   if(volEl)volEl.value=volume;if(volLabel)volLabel.textContent=volume+'%';
 }
 function wire(){refresh();
   document.getElementById('soundEnabled')?.addEventListener('change',e=>setEnabled(e.target.checked));
   document.getElementById('soundStyle')?.addEventListener('change',e=>{setStyle(e.target.value);if(enabled)play('success')});
   document.getElementById('soundVolume')?.addEventListener('input',e=>setVolume(e.target.value));
   document.getElementById('soundTestBtn')?.addEventListener('click',()=>{
     // A user interaction is required by mobile browsers to unlock audio.
     unlock().then(c=>{if(c){try{schedule(c,document.getElementById('soundTestType')?.value||'success')}catch(_){}}});
   });
   document.addEventListener('pointerdown',()=>{if(enabled)unlock()},{once:true,passive:true});
   document.addEventListener('keydown',()=>{if(enabled)unlock()},{once:true,passive:true});
 }
 window.StockTakeSound={play,unlock,setEnabled,setStyle,setVolume,get enabled(){return enabled},get style(){return style},get volume(){return volume}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();

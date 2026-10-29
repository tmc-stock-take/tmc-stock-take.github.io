/* TMC Stock Take V1.3 — optional Supabase Auth + Realtime client.
 * No credentials are embedded. Cloud mode requires explicit sign-in.
 * The local IndexedDB dataset is not uploaded automatically.
 */
(() => {
'use strict';
const $=id=>document.getElementById(id);
let client=null,user=null,batch=null,enabled=false,channel=null,poller=null,inflight=null,refreshAgain=false,connecting=false;
let localPosition=null;
const CONF_KEY='tmc_stocktake_v13_cloud_config';
const POS_KEY='tmc_stocktake_v13_cloud_position';
const ui=(id,txt)=>{const el=$(id);if(el)el.textContent=txt};
const english=()=>window.StockTakeI18n?.language==='en'||$('languageSelect')?.value==='en';
const t=(zh,en)=>english()?en:zh;
const showError=e=>{console.error('Stock Take Cloud:',e);setStatus('⚠ '+(e?.message||String(e)),true)};
function getConfig(){let saved={};try{saved=JSON.parse(localStorage.getItem(CONF_KEY)||'{}')}catch{}
 const preset=window.TMC_STOCKTAKE_CLOUD||{};
 return {url:((saved.url||preset.url||'')+'').trim().replace(/\/$/,''),key:((saved.key||preset.publishableKey||'')+'').trim()};
}
function isUnsafeKey(k){if(k.startsWith('sb_secret_'))return true;try{const mid=k.split('.')[1];if(mid){const body=JSON.parse(atob(mid.replace(/-/g,'+').replace(/_/g,'/')));return body.role==='service_role'}}catch{}return false}
function setStatus(txt,bad=false){ui('cloudStatus',txt);$('cloudStatus').className='cloud-status'+(bad?' cloud-bad':enabled?' cloud-online':'')}
function paint(){const connected=!!client, signed=!!user;
 $('cloudConfigPanel').hidden=connected; $('cloudAuthPanel').hidden=!connected||signed;
 $('cloudAccountPanel').hidden=!signed; $('cloudInfoPanel').hidden=!signed;
 if(signed){ui('cloudUser',user.email||user.id);ui('cloudBatch',batch?(batch.report_name||t('当前盘点任务','Current stock take')):t('没有云端盘点任务，请先上传 ERP 报表。','No cloud stock take yet. Import an ERP report.'))}
 $('cloudRefreshBtn').disabled=!signed;
}
function beginClient(cfg){
 if(!window.supabase?.createClient)throw Error(t('云端组件未载入，请检查网络。','Cloud SDK failed to load. Check internet connection.'));
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cfg.url))throw Error(t('请输入正确的 Supabase Project URL。','Enter a valid Supabase Project URL.'));
 if(!cfg.key||isUnsafeKey(cfg.key))throw Error(t('只能使用 publishable / anon 公钥，不能使用 secret / service_role。','Use only the publishable/anon key, never a secret/service_role key.'));
 client=window.supabase.createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},realtime:{params:{eventsPerSecond:4}}});
}
async function start(){
 const cfg=getConfig();$('cloudUrl').value=cfg.url;$('cloudKey').value=cfg.key;
 try{localPosition=JSON.parse(localStorage.getItem(POS_KEY)||'null')}catch{localPosition=null}
 if(!cfg.url||!cfg.key){setStatus(t('本机模式 · 如需手机电脑同步，请配置云端连接。','Local mode · Set up cloud connection to sync PC and phone.'));paint();return}
 try{
  beginClient(cfg);
  client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'){leaveCloud().catch(showError)}else if(event==='TOKEN_REFRESHED'&&!session){leaveCloud().catch(showError)}});
  const {data,error}=await client.auth.getUser();if(error&&error.name!=='AuthSessionMissingError')throw error;
  if(data?.user)await enterCloud(data.user);else setStatus(t('云端已连接 · 请登录账号。','Cloud connected · Sign in to start.'));
 }catch(e){showError(e);client=null}
 paint();
}
async function saveConnection(){try{
  const cfg={url:$('cloudUrl').value.trim().replace(/\/$/,''),key:$('cloudKey').value.trim()};
  if(!cfg.url||!cfg.key)throw Error(t('请填写 Supabase URL 与 publishable key。','Enter Supabase URL and publishable key.'));
  if(isUnsafeKey(cfg.key))throw Error('Never use the service_role / secret key in a website.');
  beginClient(cfg);localStorage.setItem(CONF_KEY,JSON.stringify(cfg));
  client.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT')leaveCloud().catch(showError)});
  setStatus(t('云端已连接 · 请登录。','Cloud connected · Sign in.'));paint();
 }catch(e){showError(e)}}
async function signIn(register=false){if(!client){setStatus('Cloud not configured',true);return}
 const email=$('cloudEmail').value.trim(),password=$('cloudPassword').value;
 if(!email||password.length<8){setStatus(t('请输入邮箱及至少 8 位密码。','Enter email and a password with at least 8 characters.'),true);return}
 try{setStatus(t('正在验证登录…','Signing in…'));
  const {data,error}=register ? await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}}) : await client.auth.signInWithPassword({email,password});
  if(error)throw error;
  $('cloudPassword').value='';
  if(data.session&&data.user)await enterCloud(data.user);
  else setStatus(t('账号已申请，请到邮箱验证后再登录。','Check your email to confirm your account, then sign in.'));
 }catch(e){showError(e)}
}
async function enterCloud(nextUser){if(connecting||enabled&&user?.id===nextUser.id)return;
 connecting=true;
 try{user=nextUser;await loadRemote(true);enabled=true;
  const saved=localPosition;
  if(saved&&saved.warehouse&&saved.location)window.StockTakeCore.setPosition(saved);
  subscribe();setStatus(t('● 云端同步已连接','● Cloud sync connected'));paint();
 }catch(e){user=null;enabled=false;showError(e)}finally{connecting=false}}
async function leaveCloud(){if(channel&&client){await client.removeChannel(channel);channel=null}clearInterval(poller);poller=null;
 enabled=false;user=null;batch=null;
 await window.StockTakeCore.restoreLocal();
 setStatus(t('本机模式 · 已退出云端账号。','Local mode · Signed out.'));paint()}
async function signOut(){if(!client)return;try{const {error}=await client.auth.signOut();if(error)throw error;await leaveCloud()}catch(e){showError(e)}}
async function getLatest(){const {data,error}=await client.from('stocktake_batches').select('id,report_name,imported_at,inventory,created_at').eq('owner_id',user.id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(1);
 if(error)throw error;return(data||[])[0]||null}
async function getScans(batchId){let all=[];for(let from=0;from<100000;from+=1000){const {data,error}=await client.from('stocktake_scans').select('id,payload,status,label,created_at').eq('batch_id',batchId).order('created_at',{ascending:true}).order('id',{ascending:true}).range(from,from+999);if(error)throw error;all.push(...(data||[]));if((data||[]).length<1000)break}return all}
async function loadRemote(first=false){
 if(inflight){refreshAgain=true;return inflight}
 inflight=(async()=>{const b=await getLatest();const scans=b?await getScans(b.id):[];
  batch=b;
  const history=scans.map((x,i)=>({...x.payload,status:x.status,id:i+1,cloudId:x.id,cloudAt:x.created_at}));
  window.StockTakeCore.applyRemote({version:2,inventory:b?.inventory||[],history,reportName:b?.report_name||'',importedAt:b?.imported_at||'',nextId:history.length+1});
  if(!first&&enabled)setStatus(t('● 已同步 · '+new Date().toLocaleTimeString(),'● Synced · '+new Date().toLocaleTimeString()));paint();
 })();
 try{await inflight}finally{inflight=null;if(refreshAgain){refreshAgain=false;return loadRemote()}}
}
function subscribe(){if(channel&&client){client.removeChannel(channel);channel=null}clearInterval(poller);
 const f='owner_id=eq.'+user.id;
 channel=client.channel('tmc-stocktake-'+user.id)
  .on('postgres_changes',{event:'*',schema:'public',table:'stocktake_batches',filter:f},()=>loadRemote().catch(showError))
  .on('postgres_changes',{event:'*',schema:'public',table:'stocktake_scans',filter:f},()=>loadRemote().catch(showError))
  .subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')setStatus(t('⚠ 实时连接中断，正在重试','⚠ Realtime disconnected; reconnecting'),true)});
 // Reconcile after missed socket messages, browser sleep or network changes.
 poller=setInterval(()=>{if(enabled&&document.visibilityState==='visible')loadRemote().catch(showError)},15000);
 document.addEventListener('visibilitychange',()=>{if(enabled&&document.visibilityState==='visible')loadRemote().catch(showError)},{passive:true});
}
function ensure(){if(!enabled||!user)throw Error(t('请先登录云端账号。','Sign in to cloud mode first.'));if(!navigator.onLine)throw Error(t('网络离线：本次扫描未保存，请联网后重新扫描。','Offline: scan NOT saved. Please rescan when online.'))}
async function importInventory(data){ensure();if(batch&&!confirm(t('上传新报表会建立一个新的云端盘点任务，旧任务将保留为历史，但不再显示。确定继续？','Importing creates a new cloud stock take. Previous batches stay in the database but are no longer shown. Continue?')))return false;
 const {error}=await client.from('stocktake_batches').insert({owner_id:user.id,report_name:data.reportName,imported_at:data.importedAt,inventory:data.inventory});if(error)throw error;
 await loadRemote();setStatus(t('✓ 云端 ERP 报表已上传','✓ ERP report uploaded to cloud'));return true;
}
async function insertScan(raw,chosenKey=null){ensure();
 // Refresh before validating, so a remote ERP re-import cannot be scanned against a stale batch.
 await loadRemote();if(!batch)throw Error(t('云端没有 ERP 报表，请先用电脑上传。','No ERP report in cloud; import on PC first.'));
 let rec=window.StockTakeCore.prepareScan(raw,chosenKey),currentBatchId=batch.id;
 if(rec.requiresSelection){window.StockTakeCore.showChoice(raw,rec.candidates);return null;}
 async function insert(r){return client.from('stocktake_scans').insert({owner_id:user.id,batch_id:currentBatchId,label:r.label||'',status:r.status,payload:r})}
 let {error}=await insert(rec);
 if(error?.code==='23505'&&['accepted','counted_variance','counted_multi'].includes(rec.status)) {
  rec={...rec,status:'duplicate',message:'Label '+rec.label+' 已有有效盘点记录（云端查重），重量不重复计算'};
  ({error}=await insert(rec));
 }
 if(error)throw error;
 await loadRemote();window.StockTakeCore.showCloudScan(rec);
 return rec;
}
async function deleteScan(cloudId){ensure();if(!batch||!cloudId)throw Error('Missing scan ID');const {error}=await client.from('stocktake_scans').delete().eq('id',cloudId).eq('batch_id',batch.id);if(error)throw error;await loadRemote()}
async function clearScans(){ensure();if(!batch)return;const {error}=await client.from('stocktake_scans').delete().eq('batch_id',batch.id).eq('owner_id',user.id);if(error)throw error;await loadRemote()}
async function clearAll(){ensure();const {error}=await client.from('stocktake_batches').delete().eq('owner_id',user.id);if(error)throw error;batch=null;await loadRemote()}
function savePosition(v){if(!enabled)return;localPosition=v;localStorage.setItem(POS_KEY,JSON.stringify(v))}
function isActive(){return enabled}
function installEvents(){
 $('cloudSaveConfig').addEventListener('click',saveConnection);
 $('cloudReconfigure').addEventListener('click',async()=>{if(enabled&&!confirm(t('修改云端连接将退出当前云端账号，是否继续？','Changing the cloud connection will sign you out. Continue?')))return;try{if(client)await client.auth.signOut();if(channel&&client)await client.removeChannel(channel);clearInterval(poller);poller=null;channel=null;enabled=false;user=null;batch=null;client=null;await window.StockTakeCore.restoreLocal();setStatus(t('请填写云端连接资料。','Enter cloud connection details.'));paint();$('cloudUrl').focus()}catch(e){showError(e)}});
 $('cloudLogin').addEventListener('click',()=>signIn(false));$('cloudRegister').addEventListener('click',()=>signIn(true));
 $('cloudSignOut').addEventListener('click',signOut);$('cloudRefreshBtn').addEventListener('click',()=>{if(enabled)loadRemote().catch(showError)});
 $('cloudPassword').addEventListener('keydown',e=>{if(e.key==='Enter')signIn(false)});
}
window.TMCCloud={start,isActive,importInventory,insertScan,deleteScan,clearScans,clearAll,savePosition};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installEvents);else installEvents();
})();

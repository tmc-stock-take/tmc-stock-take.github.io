/* TMC Stock Take V1.3.8: ERP quantity is authority; shortage is NOT completed. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const FIELDS = [
  ['part','料件編號 / Part No.',true], ['name','品名 / Description',true],
  ['spec','規格 / Specification',false], ['warehouse','倉庫編號 / Warehouse',true],
  ['location','儲位 / Location',true], ['lot','批號 / Lot No.',true],
  ['quantity','庫存數量 / Stock Quantity',true], ['unit','庫存單位 / Unit',false]
];
const ALIASES = {
 part:['料件編號','料件编号','物料編號','物料编号','料號','料号','料件號碼','partno','partnumber','materialno','materialnumber','itemno','itemnumber','sku'],
 name:['品名','物料名稱','物料名称','物品名稱','productname','description','materialdescription','itemdescription'],
 spec:['規格','规格','spec','specification','specifications'],
 warehouse:['倉庫編號','仓库编号','倉庫','仓库','warehouseno','warehousecode','warehouse','wh'],
 location:['儲位','储位','庫位','库位','location','storagelocation','binlocation','binno','bin'],
 lot:['批號','批号','批次','批次號','lotno','lotnumber','batch','batchno','batchnumber'],
 quantity:['庫存數量','库存数量','庫存數','庫存数','stockquantity','stockqty','quantity','qty','onhand','stockbalance','inventoryquantity','淨重','净重'],
 unit:['庫存單位','库存单位','單位','单位','unit','uom','baseunit']
};
const TOLERANCE=0.001;
let db=null, state={version:2,inventory:[],history:[],reportName:'',importedAt:'',nextId:1,activeLocation:null};
let parsed=null, dataFile='', cameraStream=null, videoFrame=null, detector=null, lastScanText='', lastScanAt=0, scanLock=false, deferredInstall=null;
let invFilter='all';
let pendingERPScan=null; // UI-only pending scan; not counted or sent to cloud until a row is selected
let loadPromise;
function normalizeHeader(s){return String(s??'').toLowerCase().normalize('NFKC').replace(/[\s\p{P}\p{S}_]/gu,'')}
function expandScientific(s){s=String(s??'').trim();let m=s.match(/^([+-]?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/);if(!m)return s;
  let sign=m[1],digits=m[2]+(m[3]||''),p=m[2].length+Number(m[4]);if(p>60||p< -20)return s;
  if(p<=0)return sign+'0.'+'0'.repeat(-p)+digits;
  if(p>=digits.length)return sign+digits+'0'.repeat(p-digits.length);
  return sign+digits.slice(0,p)+'.'+digits.slice(p);
}
function cleanCode(s){return expandScientific(String(s??'').trim().replace(/^="(\d+)"$/,'$1')).normalize('NFKC').trim().replace(/^['“”]+|['“”]+$/g,'').replace(/\s+/g,'').toUpperCase()}
function cleanLabel(s){return cleanCode(s).replace(/^(?:NO\.?|LABEL(?:NO\.?)?[:：]?)\s*/i,'').replace(/\D/g,'') || cleanCode(s)}
// A physical label may span several ACTUAL rack positions. Keep each distinct,
// use exact codes only (2A1 never implicitly matches 2A1-01), and never multiply its weight.
function parseActualLocations(raw){
 const src=Array.isArray(raw)?raw.join(','):String(raw??'');
 const chunks=src.split(/[,，;；\n\r]+/).map(cleanCode).filter(Boolean);
 const list=[...new Set(chunks)];
 if(list.length>20)throw Error('实际储位最多 20 个；如需更多，请分开记录并核对');
 if(list.some(x=>x.length>60||!/^[A-Z0-9_./-]+$/.test(x)))throw Error('实际储位格式不正确，请使用编号并以逗号或换行分隔');
 return list;
}
function savedLocations(pos){return parseActualLocations(pos?.locations?.length?pos.locations:pos?.location||'')}
function locationText(locs){return locs.join(', ')}
function sameLocations(a,b){return a.length===b.length&&a.every(x=>b.includes(x))}

function cleanWeight(s){let n=Number(String(s??'').replace(/,/g,'').replace(/\s*kg\s*$/i,'').trim());return Number.isFinite(n)?Math.round(n*1000)/1000:NaN}
function round3(n){return Math.round((n+Number.EPSILON)*1000)/1000}
function keyOf(r){return [r.part,r.warehouse,r.location,r.lot].map(cleanCode).join('\u001f')}
function matches(a,b){return keyOf(a)===keyOf(b)}
function safe(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function displayNumber(n){return round3(n).toFixed(3)}
function now(){return new Date().toLocaleString('zh-MY',{hour12:false})}
function stamp(){const d=new Date();return d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+'_'+String(d.getHours()).padStart(2,'0')+String(d.getMinutes()).padStart(2,'0')}
function msg(message){let el=$('toast');el.textContent=message;el.style.display='block';clearTimeout(msg.t);msg.t=setTimeout(()=>el.style.display='none',3800)}
function notice(title,detail,level=''){const el=$('scanStatus');el.className='statusbox '+level;el.innerHTML='<strong>'+safe(title)+'</strong>'+safe(detail)}
function withConfirm(message){return window.confirm(tr(message))}
function tr(value){return window.StockTakeI18n?.translate(value)??String(value??'')}
async function openDb(){return new Promise(resolve=>{
 if(!('indexedDB'in window)){resolve(null);return}
 let request;try{request=indexedDB.open('tmc_stock_take_v1',1)}catch(e){resolve(null);return}
 request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('store'))request.result.createObjectStore('store')};
 request.onsuccess=()=>resolve(request.result);request.onerror=()=>resolve(null);
})}
async function readStore(){if(db)return new Promise(resolve=>{try{const req=db.transaction('store','readonly').objectStore('store').get('snapshot');req.onsuccess=()=>resolve(req.result??null);req.onerror=()=>resolve(null)}catch(e){resolve(null)}});
 try{return JSON.parse(localStorage.getItem('tmc_stock_take_snapshot'))}catch(e){return null}}
async function saveStore(){if(window.TMCCloud?.isActive()){window.TMCCloud.savePosition(state.activeLocation);return}
 let serialized=JSON.stringify(state);
 if(db){try{await new Promise((resolve,reject)=>{const tx=db.transaction('store','readwrite');tx.objectStore('store').put(state,'snapshot');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});return}catch(e){msg('本机储存失败，请尽快导出 Excel / JSON 备份')}}
 try{localStorage.setItem('tmc_stock_take_snapshot',serialized)}catch(e){msg('浏览器容量不足，请导出数据备份')}
}
async function initialize(){db=await openDb();let restored=await readStore();if(restored&&Array.isArray(restored.inventory)&&Array.isArray(restored.history)){
 state={...state,...restored};state.nextId=Math.max(0,...state.history.map(x=>Number(x.id)||0))+1;
  if(!state.version||state.version<2){
   // V1.0 scans did not verify a physical location; preserve history but never misrepresent it as three-way MATCH.
   state.history=state.history.map(h=>h.status==='accepted'?{...h,status:'legacy',message:'V1.0 旧记录（没有实际位置），请到对应实际储位重新扫描；旧重量不计入 V1.1 三方已盘点数'}:h);
   state.version=2;state.activeLocation=null;await saveStore();
  }
 }restorePositionInputs();render();if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
 await window.TMCCloud?.start();
}
function groupInventory(rows){let map=new Map(),count=0;
 for(const r of rows){let part=cleanCode(r.part),warehouse=cleanCode(r.warehouse),location=cleanCode(r.location),lot=cleanCode(r.lot);let qty=cleanWeight(r.quantity);
 if(!part||!String(r.name??'').trim()||!warehouse||!location||!lot||!Number.isFinite(qty)||qty<0)continue;
 const one={part,warehouse,location,lot,quantity:qty,name:String(r.name??'').trim(),spec:String(r.spec??'').trim(),unit:String(r.unit??'KG').trim()||'KG',lines:1};
 let k=keyOf(one);if(map.has(k)){let prev=map.get(k);prev.quantity=round3(prev.quantity+qty);prev.lines++;if(!prev.name)prev.name=one.name;if(!prev.spec)prev.spec=one.spec}else map.set(k,one);count++;
 }
 return {inventory:[...map.values()],importedLines:count};
}
function decodeCSV(content){let text=content.replace(/^\uFEFF/,'');let lines=[];let row=[],field='',quoted=false;for(let i=0;i<text.length;i++){
 let c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++}else quoted=!quoted}
 else if(!quoted&&(c===','||c==='\t'||c===';'||c==='\n'||c==='\r')){if(c===','||c==='\t'||c===';'){
  if(c!==decodeCSV.delimiter){field+=c;continue}
  row.push(field);field=''
 }else{row.push(field);field='';if(row.some(v=>String(v).trim()))lines.push(row);row=[];if(c==='\r'&&text[i+1]==='\n')i++}}
 else field+=c;
 }
 row.push(field);if(row.some(v=>String(v).trim()))lines.push(row);return lines;
}
function detectDelimiter(text){let first=text.split(/\r?\n/,5).slice(0,3);let score=d=>first.reduce((sum,s)=>sum+(s.match(new RegExp(d==='\t'?'\\t':d==='|'?'\\|':d===';'?';':',','g'))||[]).length,0);
 return [',','\t',';'].sort((a,b)=>score(b)-score(a))[0]}
async function readCsv(file){const buf=await file.arrayBuffer(),b=new Uint8Array(buf);let enc='utf-8';if(b[0]===0xff&&b[1]===0xfe)enc='utf-16le';else if(b[0]===0xfe&&b[1]===0xff)enc='utf-16be';
 let txt=new TextDecoder(enc).decode(b);if(enc==='utf-8'&&txt.includes('\uFFFD')){try{let alt=new TextDecoder('big5').decode(b);if((alt.match(/\uFFFD/g)||[]).length<(txt.match(/\uFFFD/g)||[]).length)txt=alt}catch(e){}}
 decodeCSV.delimiter=detectDelimiter(txt);return decodeCSV(txt);
}
async function readXlsx(file){if(!window.JSZip)throw Error('缺少 Excel 读取元件');const zip=await JSZip.loadAsync(await file.arrayBuffer());
 const getXml=async path=>{let entry=zip.file(path);if(!entry)throw Error('Excel 缺少 '+path);return new DOMParser().parseFromString(await entry.async('string'),'application/xml')};
 const byTag=(node,name)=>[...node.getElementsByTagName('*')].filter(n=>n.localName===name);
 const firstTag=(node,name)=>node.getElementsByTagNameNS('*',name)[0]||null;
 let wb=await getXml('xl/workbook.xml'),rels=await getXml('xl/_rels/workbook.xml.rels');
 let relMap=new Map(byTag(rels,'Relationship').map(e=>[e.getAttribute('Id'),e.getAttribute('Target')]));
 let shared=[];if(zip.file('xl/sharedStrings.xml')){let x=await getXml('xl/sharedStrings.xml');shared=byTag(x,'si').map(si=>byTag(si,'t').map(t=>t.textContent).join(''))}
 let sheetInfo=byTag(wb,'sheet').map(s=>({name:s.getAttribute('name'),target:relMap.get(s.getAttribute('r:id'))})).filter(s=>s.target);
 if(!sheetInfo.length)throw Error('找不到 Excel 工作表');
 let sheets=[];
 for(const s of sheetInfo){let target=s.target.replace(/^\//,'');let path=target.startsWith('xl/')?target:'xl/'+target.replace(/^(\.\.\/)+/,'');
  let xml=await getXml(path),rows=[];
  for(const r of byTag(xml,'row')){let one=[];
   for(const c of [...r.children].filter(n=>n.localName==='c')){let addr=c.getAttribute('r')||'',col=addr.match(/^[A-Za-z]+/),ix=0;
    if(!col)continue;for(const ch of col[0].toUpperCase())ix=ix*26+(ch.charCodeAt(0)-64);ix--;
    let type=c.getAttribute('t')||'',v=firstTag(c,'v'),val=v?v.textContent:'';
    if(type==='s')val=shared[Number(val)]??'';
    else if(type==='inlineStr'){let is=firstTag(c,'is');val=is?byTag(is,'t').map(t=>t.textContent).join(''):''}
    else if(type==='b')val=val==='1'?'TRUE':'FALSE';
    else if(type==='e')val='';
    one[ix]=String(val);
   }
   if(one.some(x=>x!=null&&String(x).trim()))rows.push(one.map(x=>x??''));
  }
  sheets.push({name:s.name,rows});
 }
 return sheets;
}
function headerQuality(row){let values=row.map(normalizeHeader),hits=0;for(let f of FIELDS){if(values.some(v=>(ALIASES[f[0]]||[]).some(a=>v===normalizeHeader(a))))hits++}return hits}
function candidateSheet(s){let best={score:-1,headerIndex:0};for(let i=0;i<Math.min(s.rows.length,50);i++){
 let score=headerQuality(s.rows[i]);if(score>best.score){best={score,headerIndex:i}}}
 return {...s,...best}
}
function autodetect(headers,field){let aliases=ALIASES[field]||[],h=headers.map(normalizeHeader),exact=h.findIndex(x=>aliases.some(a=>x===normalizeHeader(a)));if(exact>=0)return exact;
 let partial=h.findIndex(x=>x&&aliases.some(a=>x.startsWith(normalizeHeader(a))||normalizeHeader(a).startsWith(x)&&x.length>3));return partial;
}
function showMapping(){const s=parsed.current,headers=s.rows[s.headerIndex]||[],box=$('mappingFields');box.innerHTML='';
 for(let [key,title,required] of FIELDS){let wrap=document.createElement('div');wrap.className='map-row';let lab=document.createElement('label');lab.className='field-label';lab.textContent=title+(required?' *':'');let sel=document.createElement('select');sel.id='map_'+key;
 let defaultOpt=new Option('— 不使用此栏 —','');sel.add(defaultOpt);
 headers.forEach((value,i)=>sel.add(new Option(String.fromCharCode(65+Math.min(25,i))+(i>25?'+'+i:'')+' · '+(value||'(无标题)'),'c'+i)));
 let found=autodetect(headers,key);sel.value=found<0?'':'c'+found;wrap.append(lab,sel);box.append(wrap);
 }
 $('mappingInfo').textContent='工作表：'+s.name+' · 表头第 '+(s.headerIndex+1)+' 行 · 共 '+Math.max(0,s.rows.length-s.headerIndex-1)+' 行资料';
 $('mappingPreview').textContent='预览：'+s.rows.slice(s.headerIndex+1,s.headerIndex+3).map(row=>row.slice(0,11).join(' | ')).join(' / ').slice(0,260);
 $('mappingPanel').classList.add('show');
}
async function filePicked(file){if(!file)return;
 try{dataFile=file.name;let sheets;if(/\.xlsx$/i.test(file.name))sheets=await readXlsx(file);else if(/\.csv$/i.test(file.name)||/\.txt$/i.test(file.name))sheets=[{name:'CSV',rows:await readCsv(file)}];else throw Error('请使用 .xlsx 或 .csv 文件');
  let candidates=sheets.map(candidateSheet).sort((a,b)=>b.score-a.score||b.rows.length-a.rows.length);let found=candidates[0];
  if(!found||found.score<3)throw Error('未辨识到 ERP 栏位。请检查报表标题是否包含料号、仓库、储位、批号及库存数量');
  parsed={sheets:candidates,current:found};showMapping();msg('报表已读取，请确认栏位后导入');
 }catch(e){console.error(e);msg('读取失败：'+e.message);$('mappingPanel').classList.remove('show')}
}
async function confirmImport(){if(!parsed)return;
 let map={};for(let [key,title,required] of FIELDS){let v=$('map_'+key).value;if(required&&!v){msg('请指定必要栏位：'+title);return}map[key]=v?Number(v.slice(1)):-1}
 let s=parsed.current,source=s.rows.slice(s.headerIndex+1).map(row=>Object.fromEntries(FIELDS.map(([key])=>[key,map[key]>=0?row[map[key]]??'':''])));
 let result=groupInventory(source);
 if(!result.inventory.length){msg('未找到有效资料：请检查品名、料号、批号、仓库、储位和数量。');return}
 if(window.TMCCloud?.isActive()){try{const ok=await window.TMCCloud.importInventory({inventory:result.inventory,reportName:dataFile,importedAt:now()});if(ok){parsed=null;$('mappingPanel').classList.remove('show');$('reportFile').value='';renderComparison(null);notice('云端 ERP 报表已导入','已同步到云端，可以从手机登录同一账号进行盘点。','good')}}catch(e){msg('云端导入失败：'+e.message)}return}
 if(state.inventory.length&&!withConfirm('导入新 ERP 报表会清除目前盘点记录（'+state.history.length+' 笔）。建议先导出备份。是否继续？'))return;
 closeERPChoice();state.inventory=result.inventory;state.history=[];state.reportName=dataFile;state.importedAt=now();state.nextId=1;state.activeLocation=null;parsed=null;restorePositionInputs();renderComparison(null);
 $('mappingPanel').classList.remove('show');$('reportFile').value='';await saveStore();render();notice('成功导入 ERP 报表',`共读取 ${result.importedLines} 行，合并后 ${result.inventory.length} 项库存。可以开始扫描标签。`,'good');
}
function parseScan(raw){let text=String(raw||'').trim();if(!text)throw Error('扫描内容为空');
 let items=text.split('|').map(x=>x.trim()).filter((x,i,a)=>!(i===a.length-1&&!x));
 if(items.length<6){let arr=text.split(/\r?\n|\t|;/).map(x=>x.trim()).filter(Boolean);if(arr.length>=6)items=arr}
 if(items.length<6){let obj={};const patterns={label:/(?:label|標籤號碼|标签号码|no\.?)[\s:：]*([0-9]{1,12})/i,warehouse:/(?:warehouse|倉庫|仓库)[\s:：]*([\w-]+)/i,location:/(?:location|儲位|储位)[\s:：]*([\w-]+)/i,lot:/(?:lot|批號|批号)[\s:：]*([\w-]+)/i,part:/(?:part|料件編號|料件编号|料號|料号)[\s:：]*([0-9A-Za-z.-]+)/i,weight:/(?:net|weight|淨重|净重)[\s:：]*([0-9,.]+)/i};
  for(let [k,rx] of Object.entries(patterns)){let m=text.match(rx);if(m)obj[k]=m[1]}
  if(Object.keys(obj).length>=5&&obj.part&&obj.lot&&obj.weight)return validated({...obj,raw:text});
  throw Error('无法识别 QR 格式：预期为 Label|Warehouse|Location|Lot|Part|Net 六段资料');
 }
 let [label,warehouse,location,lot,part,weight]=items;
 return validated({label,warehouse,location,lot,part,weight,raw:text});
}
function validated(obj){let data={...obj,label:cleanLabel(obj.label),warehouse:cleanCode(obj.warehouse),location:cleanCode(obj.location),lot:cleanCode(obj.lot),part:cleanCode(obj.part),weight:cleanWeight(obj.weight)};
 if(!data.label||!data.warehouse||!data.location||!data.lot||!data.part||!Number.isFinite(data.weight)||data.weight<=0)throw Error('QR 部分资料缺失，或净重不是有效正数');return data}
function physicalPosition(){
 const wh=cleanCode($('actualWarehouse').value), locs=parseActualLocations($('actualLocation').value);
 const saved=state.activeLocation;
 if(!wh||!locs.length)throw Error('请先填写实际仓库和至少一个实际储位，再点击确认位置');
 if(!saved||saved.warehouse!==wh||!sameLocations(savedLocations(saved),locs))throw Error('实际位置尚未确认，请先确认当前实际储位清单');
 return {warehouse:saved.warehouse,location:locationText(locs),locations:locs};
}
function restorePositionInputs(){
 $('actualWarehouse').value=state.activeLocation?.warehouse||'';
 $('actualLocation').value=locationText(savedLocations(state.activeLocation));
 updatePositionUI();
}
function updatePositionUI(){
 const wh=cleanCode($('actualWarehouse').value);
 let locs=[],invalid=false;try{locs=parseActualLocations($('actualLocation').value)}catch(e){invalid=true}
 const saved=state.activeLocation,confirmed=!!(!invalid&&saved&&wh&&locs.length&&wh===saved.warehouse&&sameLocations(savedLocations(saved),locs));
 const badge=$('activePositionBadge'),note=$('positionNotice');
 badge.className='pill '+(confirmed?'ok':saved?'short':'wait');
 badge.textContent=confirmed?'已确认 '+wh+' / '+locs.length+' 个储位':saved?'位置待重新确认':'尚未设置';
 note.className='position-notice '+(confirmed?'active':saved?'dirty':'');
 note.textContent=confirmed?'✓ 当前盘点位置：'+wh+' / '+locationText(locs)+'。每张标签只记录一次净重；换位置时请重新确认。':saved?'⚠ 实际位置清单已改变，请重新确认后扫描；历史记录不变。':'请先输入实际仓库，再输入一个或多个储位（逗号、分号或换行分隔），点击确认。';
}
async function confirmPhysicalPosition(){
 const wh=cleanCode($('actualWarehouse').value);
 let locs;try{locs=parseActualLocations($('actualLocation').value)}catch(e){msg(e.message);return}
 if(!wh||!locs.length){msg('请输入实际仓库和至少一个实际储位');return}
 if(wh.length>60||!/^[-A-Z0-9_.\/]+$/.test(wh)){msg('仓库编号格式不正确');return}
 state.activeLocation={warehouse:wh,location:locationText(locs),locations:locs};
 $('actualWarehouse').value=wh;$('actualLocation').value=locationText(locs);
 updatePositionUI();await saveStore();
 notice('✓ 实际位置已确认',wh+' / '+locationText(locs)+'（'+locs.length+' 个储位）。扫描时每张标签只计算一次重量。','good');
 $('scanInput').focus();
}
// Printed QR warehouse and rack are historical references only.
// Identify material by Part No. + Lot No.; never select an ERP row by the QR location.
function erpCandidate(scan,actual,chosenKey=null){
 // Barcode supplies Part, Lot, Net KG but does not supply Description.
 // The product description is taken from the uploaded ERP row indexed by Part No.
 const batch=state.inventory.filter(r=>r.part===scan.part&&r.lot===scan.lot);
 if(!batch.length)return {row:null,status:'unmatched',reason:state.inventory.some(r=>r.part===scan.part)?
   'ERP 中有此料号，但无批号 '+scan.lot+'；本次未盘点。':'上传的 ERP 报表找不到料号 '+scan.part+' / 批号 '+scan.lot+'；本次未盘点。'};
 const exact=batch.filter(r=>Math.abs(round3(r.quantity-scan.weight))<=TOLERANCE);
 if(!exact.length){
  const detail=batch.map(r=>r.name+' / '+r.lot+' / '+r.warehouse+'/'+r.location+'：'+displayNumber(r.quantity)+' KG').join('；');
  return {row:null,status:'mismatch',quantityMismatch:true,candidates:batch,
   reason:'ERP 数量不一致 / QUANTITY MISMATCH：QR '+displayNumber(scan.weight)+' KG。ERP 对应品名、批号与单笔数量：'+detail+'。不能累计重量，也不能判定完成。'};
 }
 const valid=new Set(state.history.filter(isCounted).map(countedKey));
 const available=exact.filter(r=>!valid.has(keyOf(r)));
 if(chosenKey!==null){
  const selected=exact.find(r=>keyOf(r)===chosenKey);
  if(!selected)return {row:null,status:'unmatched',reason:'所选 ERP 记录的品名/批号/数量不符合标签，无法计入。'};
  if(valid.has(keyOf(selected)))return {row:null,status:'duplicate',reason:'这笔 ERP 库存项目已经完成盘点，不可用另一张标签再次计入。'};
  return {row:selected,assignment:'manual'};
 }
 if(!available.length)return {row:null,status:'duplicate',reason:'符合品名、批号和数量的 ERP 库存项目已经完成盘点。请检查是否重复扫描。'};
 if(available.length===1)return {row:available[0],assignment:'exact'};
 return {row:null,status:'ambiguous',candidates:available,reason:'有 '+available.length+' 笔相同料号、批号与单笔数量的 ERP 记录。为避免误分配，须选择正确 ERP 仓库和储位。'};
}
function closeERPChoice(){pendingERPScan=null;const el=$('erpChoicePanel');el.classList.add('hide');el.innerHTML='';}
function showERPChoice(raw,candidates){
 let scan;try{scan=parseScan(raw)}catch(e){notice('QR 资料错误',e.message,'bad');return}
 if(!Array.isArray(candidates)||!candidates.length){notice('无法找到对应 ERP 项目','本张标签尚未计入。','bad');return}
 pendingERPScan={raw,candidates:candidates.map(keyOf)};
 const rows=candidates.map((r,i)=>'<div class="choice-row"><div><strong>'+safe(r.name||r.part)+'</strong> <span class="choice-hint">品名/批号/净重符合 ERP</span><div class="muted">'+safe(r.part)+' · '+safe(r.lot)+' · ERP '+displayNumber(r.quantity)+' KG<br>'+safe(r.warehouse)+' / '+safe(r.location)+'</div></div><button type="button" class="btn primary" data-erp-choice="'+i+'">'+safe(tr('选择并计入 / Count here'))+'</button></div>').join('');
 const pane=$('erpChoicePanel');pane.classList.remove('hide');
 pane.innerHTML='<div class="choice-title">'+safe(tr('同样品名、批号、数量出现多个 ERP 项目'))+'</div><div class="muted">Label '+safe(scan.label)+' · '+safe(scan.part)+' / '+safe(scan.lot)+' · '+displayNumber(scan.weight)+' KG</div><p>'+safe(tr('选择实际对应的 ERP 库存行；不同标签重量不能累计。QR 仓库/储位不参与匹配。'))+'</p>'+rows+'<button type="button" class="btn" id="cancelErpChoice">'+safe(tr('取消 / Cancel'))+'</button>';
 notice('⚠ 请选择准确的 ERP 项目','本次尚未计入；需要人工确认同数量不同储位的 ERP 行。','warn');
 pane.scrollIntoView?.({block:'nearest',behavior:'smooth'});
}
async function confirmERPChoice(index){
 if(!pendingERPScan)return;
 const pending=pendingERPScan,chosenKey=pending.candidates[index];
 if(!chosenKey)return;
 closeERPChoice();
 if(window.TMCCloud?.isActive()){
  try{await window.TMCCloud.insertScan(pending.raw,chosenKey)}catch(e){window.StockTakeSound?.play('error');notice('⚠ 云端保存失败',e.message+'；本次未计入，请重新扫描。','bad')}
 }else await performScan(pending.raw,chosenKey);
}

const COUNTABLE_STATUSES=new Set(['accepted','counted_variance','counted_multi']);
function countedKey(h){return keyOf({part:h.part,lot:h.lot,warehouse:h.erpWarehouse||h.warehouse,location:h.erpLocation||h.location})}
let eligibilityCache={history:null,inventory:null,len:-1,last:null,set:new Set()};
function approvedScans(){
 const h=state.history,last=h[h.length-1],c=eligibilityCache;
 if(c.history===h&&c.inventory===state.inventory&&c.len===h.length&&c.last===last)return c.set;
 const inventory=new Map(state.inventory.map(r=>[keyOf(r),r]));
 const labels=new Set(),rows=new Set(),approved=new Set();
 for(const record of h){
  if(!COUNTABLE_STATUSES.has(record.status))continue;
  const row=inventory.get(countedKey(record));
  if(!row||cleanCode(record.part)!==row.part||cleanCode(record.lot)!==row.lot||Math.abs(round3(Number(record.weight)-row.quantity))>TOLERANCE)continue;
  if(rows.has(keyOf(row))||labels.has(record.label))continue;
  rows.add(keyOf(row));labels.add(record.label);approved.add(record);
 }
 eligibilityCache={history:h,inventory:state.inventory,len:h.length,last,set:approved};return approved;
}
function isCounted(record){
 if(!COUNTABLE_STATUSES.has(record.status))return false;
 const approved=approvedScans();
 if(approved.has(record))return true;
 // The cloud insert response is a fresh object, not the loaded row. Match only
 // when its label is already present in the newly reloaded approved history.
 if(state.history.includes(record))return false;
 return [...approved].some(h=>h.label===record.label&&countedKey(h)===countedKey(record)&&round3(h.weight)===round3(record.weight));
}
function recordStatus(h){
 if(h.quantityMismatch||h.status==='mismatch'&&h.message?.includes('数量'))return ['数量不符','bad'];
 if(COUNTABLE_STATUSES.has(h.status)&&!isCounted(h))return ['旧记录需复核','bad'];
 return statusInfo(h.status);
}
function evaluateScan(scan,actual,chosenKey=null){
 const found=erpCandidate(scan,actual,chosenKey),row=found.row;
 if(!row)return {...found,details:[found.reason],positionChecks:null};
 const erpWarehouseMatch=actual.warehouse===row.warehouse;
 const erpInActual=erpWarehouseMatch&&actual.locations.includes(row.location);
 const multiple=actual.locations.length>1;
 const extraLocations=actual.locations.filter(loc=>loc!==row.location);
 const details=[];
 if(!erpWarehouseMatch)details.push('ERP 仓库 '+row.warehouse+' ≠ 实际仓库 '+actual.warehouse);
 if(!erpInActual)details.push('ERP 储位 '+row.location+' 与实际位置 '+locationText(actual.locations)+' 不一致');
 if(multiple)details.push('实际记录多个储位：'+locationText(actual.locations)+'；本张标签尚未指定唯一实际储位，重量只计一次');
 const status=multiple?'counted_multi':erpInActual?'accepted':'counted_variance';
 const reason=details.length?details.join('；'):'料号、批号符合 ERP，实物位置与 ERP 一致；QR 标签旧仓库/储位仅作记录';
 return {row,status,details,reason:(found.assignment==='manual'?'人工选择 ERP 项目；':'')+'ERP 品名 '+row.name+'、批号 '+row.lot+'、单笔数量 '+displayNumber(row.quantity)+' KG 符合 QR；'+reason,positionChecks:{erpInActual,erpWarehouseMatch,qrInActual:null,extraLocations,actualCount:actual.locations.length}};
}
function renderComparison(record){
 const el=$('scanComparison');if(!record){el.classList.add('hide');el.innerHTML='';return}
 const actualLocs=parseActualLocations(record.actualLocations?.length?record.actualLocations:record.actualLocation);
 const erpW=record.erpWarehouse||'',qrW=record.warehouse||'',actualW=record.actualWarehouse||'';
 const erpL=record.erpLocation||'',qrL=record.location||'';
 const valid=!!erpL;
 const rows=[
 '<tr><td>'+safe(tr('仓库'))+'</td><td>'+safe(erpW||'—')+'</td><td class="qr-reference">'+safe(qrW||'—')+'</td><td class="'+(valid&&actualW!==erpW?'diff-cell':'')+'">'+safe(actualW||'—')+'</td></tr>',
 '<tr><td>'+safe(tr('储位 / Racking No.'))+'</td><td>'+safe(erpL||'—')+'</td><td class="qr-reference">'+safe(qrL||'—')+'</td><td class="'+(valid&&(actualLocs.length!==1||!actualLocs.includes(erpL)||actualW!==erpW)?'diff-cell':'')+'">'+(actualLocs.map(loc=>'<span class="location-chip '+(loc===erpL&&actualW===erpW?'erp-chip':'extra-chip')+'">'+safe(loc)+'</span>').join(' ')||'—')+'</td></tr>'
 ].join('');
 let flags='';if(valid){const erpYes=actualW===erpW&&actualLocs.includes(erpL),extras=actualLocs.filter(loc=>loc!==erpL);
 flags='<div class="position-flags"><span class="'+(erpYes?'flag-yes':'flag-no')+'">'+safe(tr('ERP 储位在实际清单中'))+'：'+safe(erpYes?tr('是'):tr('否'))+'</span><span class="flag-reference">'+safe(tr('QR 仓库和储位仅供记录，不参与比对'))+'</span>'+(extras.length?'<span class="flag-no">'+safe(tr('额外实际储位'))+'：'+safe(locationText(extras))+'</span>':'')+'</div>';
 }
 el.innerHTML='<div class="comparison-title">'+safe(tr('ERP × 实际位置（QR 仅供识别）'))+'</div><div class="scrolltable"><table class="data-table"><thead><tr><th>'+safe(tr('比对字段'))+'</th><th>'+safe(tr('ERP 系统'))+'</th><th>'+safe(tr('QR 标签（仅参考）'))+'</th><th>'+safe(tr('实际位置'))+'</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+flags+'<div class="comparison-detail">'+safe(tr(record.message||''))+' · Label '+safe(record.label||'—')+' · '+safe(record.part||'—')+' / '+safe(record.lot||'—')+'</div>';
 el.classList.remove('hide');
}
function scannedSum(){let map=new Map();for(const h of state.history){if(!isCounted(h))continue;const k=countedKey(h);if(map.has(k))continue;map.set(k,{sum:round3(h.weight),count:1})}return map}
function classify(row,counted){let diff=round3(counted-row.quantity);if(counted===0)return'pending';if(Math.abs(diff)<=TOLERANCE)return'done';if(diff<0)return'short';return'over'}
// ERP inventory quantity is the authority for completion. Scan *presence* is
// not the same as quantity MATCH: multiple labels may fill one ERP inventory row.
// Derive the running balance for every counted label, including old saved/cloud
// records. A later label can clear an earlier shortage; deleting a label updates
// the history and reconciliation together.
function historicalQuantityChecks(){
 const rows=new Map(state.inventory.map(r=>[keyOf(r),r]));
 return state.history.map(h=>{
  const row=rows.get(countedKey(h));
  if(!row)return {status:'unmatched',erp:null,scanned:0,diff:null};
  const valid=isCounted(h),actual=Number(h.weight)||0,diff=round3(actual-row.quantity);
  return {status:valid?'done':'mismatch',erp:row.quantity,scanned:valid?actual:0,diff,actual,valid};
 });
}
function scanQuantityPill(record,check){
 const [label,cl]=recordStatus(record);
 return '<span class="pill '+cl+'">'+safe(label)+'</span>';
}
function countedQuantityNotice(record,row,counted){
 const posDiff=record.status!=='accepted';
 notice('✓ 完成 / MATCH · ERP 单笔数量符合',
  '品名：'+row.name+' · 批号：'+row.lot+' · ERP：'+displayNumber(row.quantity)+' KG · QR：'+displayNumber(record.weight)+' KG · Label '+record.label+(posDiff?'；ERP 与实际位置另行记录差异（不影响数量匹配）。':''),
  posDiff?'warn':'good');
 window.StockTakeSound?.play(posDiff?'warning':'success');navigator.vibrate?.(posDiff?[60,70,60]:75);
}
async function performScan(raw,chosenKey=null){
 if(window.TMCCloud?.isActive()){try{await window.TMCCloud.insertScan(raw,chosenKey)}catch(e){window.StockTakeSound?.play('error');notice('⚠ 云端扫描未保存',e.message+'。请检查网络并重新扫描，避免遗漏。','bad');msg('云端保存失败：'+e.message)}return}
 if(!state.inventory.length){window.StockTakeSound?.play('error');notice('请先导入 ERP 报表','尚未读取库存清单，无法比对扫描标签。','warn');return}
 let actual;try{actual=physicalPosition()}catch(e){window.StockTakeSound?.play('error');notice('请先确认实际盘点位置',e.message,'warn');msg(e.message);return}
 let record,scan;
 try{scan=parseScan(raw)}catch(e){
  record={id:state.nextId++,at:now(),status:'invalid',message:e.message,raw:String(raw).slice(0,500),actualWarehouse:actual.warehouse,actualLocation:actual.location,actualLocations:actual.locations};
  state.history.push(record);await saveStore();render();renderComparison(null);window.StockTakeSound?.play('error');notice('QR 资料格式错误',e.message,'bad');return;
 }
 // Duplicate labels must be detected BEFORE trying to allocate between ERP locations.
 if(state.history.some(h=>h.label===scan.label&&h.label&&isCounted(h))){
  closeERPChoice();
  const dup={...scan,id:state.nextId++,at:now(),status:'duplicate',message:'Label '+scan.label+' 已盘点，重量不会重复计入',actualWarehouse:actual.warehouse,actualLocation:actual.location,actualLocations:actual.locations};
  state.history.push(dup);await saveStore();render();renderComparison(dup);window.StockTakeSound?.play('duplicate');notice('重复标签 / DUPLICATE',dup.message,'warn');return;
 }
 const result=evaluateScan(scan,actual,chosenKey);
 if(result.status==='ambiguous'&&result.candidates?.length){showERPChoice(raw,result.candidates);window.StockTakeSound?.play('warning');return}
 closeERPChoice();
 record={...scan,id:state.nextId++,at:now(),actualWarehouse:actual.warehouse,actualLocation:actual.location,actualLocations:actual.locations,positionChecks:result.positionChecks||null,
         erpWarehouse:result.row?.warehouse||'',erpLocation:result.row?.location||'',status:result.status,quantityMismatch:!!result.quantityMismatch,message:result.reason};
 if(state.history.some(h=>h.label===scan.label&&h.label&&isCounted(h))){
  record.status='duplicate';record.message='Label '+scan.label+' 已完成盘点，重量不会重复计算';
 }
 state.history.push(record);await saveStore();render();renderComparison(record);
 if(isCounted(record)){
  const row=result.row,c=scannedSum().get(keyOf(row))?.sum||0;
  countedQuantityNotice(record,row,c);
 }else if(record.status==='duplicate'){window.StockTakeSound?.play('duplicate');notice('重复标签 / DUPLICATE',record.message,'warn')}
 else if(record.status==='duplicate'){window.StockTakeSound?.play('duplicate');notice('重复盘点 / DUPLICATE',record.message,'warn')}
 else{window.StockTakeSound?.play('error');notice(record.quantityMismatch?'✗ ERP 数量不符 / QUANTITY MISMATCH':'⚠ ERP 核对未通过',record.message+'；本次未计入有效盘点。','bad')}

}
function statusInfo(k){let st={done:['完成','ok'],pending:['未盘点','wait'],short:['数量不足','short'],over:['超出','over'],accepted:['COUNTED','ok'],counted_variance:['已盘点·位置差异','short'],counted_multi:['已盘点·多储位','short'],duplicate:['重复','short'],unmatched:['ERP无记录','bad'],invalid:['QR错误','bad'],mismatch:['需复核','bad'],ambiguous:['ERP多位置','bad'],legacy:['旧版待复盘','wait']}[k]||['异常','bad'];return [tr(st[0]),st[1]]}
function pill(k){let [label,cl]=statusInfo(k);return '<span class="pill '+cl+'">'+label+'</span>'}
function render(){const sums=scannedSum(),total=state.inventory.length,items=state.inventory.map(r=>{const s=sums.get(keyOf(r))||{sum:0,count:0};return {...r,scanned:s.sum,count:s.count,difference:round3(s.sum-r.quantity),status:classify(r,s.sum)}});
 let done=items.filter(x=>x.status==='done').length,over=items.filter(x=>x.status==='over').length,exceptions=state.history.filter(h=>!isCounted(h)||h.status!=='accepted').length;
 $('countTotal').textContent=total;$('countDone').textContent=done;$('countPending').textContent=items.filter(x=>x.status==='pending'||x.status==='short').length;
 $('countIssues').textContent=over+exceptions;$('countScans').textContent=state.history.filter(isCounted).length;
 $('progressFill').style.width=(total?done/total*100:0)+'%';$('progressLabel').textContent='完成率 '+(total?Math.round(done/total*100):0)+'%（'+done+' / '+total+' 项）';
 $('warehouseOptions').innerHTML=[...new Set(state.inventory.map(x=>x.warehouse))].sort().map(x=>'<option value="'+safe(x)+'"></option>').join('');
 $('reportInfo').innerHTML=state.reportName?'<span><strong>'+safe(state.reportName)+'</strong><br><span class="muted">'+safe(state.importedAt)+' · '+total+tr(' 个合并库存项目')+'</span></span><span class="pill ok">'+tr('报表已导入')+'</span>':'<span class="muted">尚未导入报表</span>';
 let q=cleanCode($('searchInventory').value||'');let filtered=items.filter(r=>(invFilter==='all'||(invFilter==='issues'?r.status!=='done':r.status===invFilter))&&(!q||[r.part,r.name,r.spec,r.warehouse,r.location,r.lot].some(v=>cleanCode(v).includes(q))));
 $('tableSummary').textContent=filtered.length+' / '+total+' 项记录';
 $('inventoryBody').innerHTML=filtered.length?filtered.slice(0,1500).map(r=>'<tr><td>'+pill(r.status)+'</td><td>'+safe(r.part)+'</td><td class="namecol">'+safe(r.name)+'</td><td>'+safe(r.spec)+'</td><td>'+safe(r.warehouse)+'</td><td>'+safe(r.location)+'</td><td>'+safe(r.lot)+'</td><td class="num">'+displayNumber(r.quantity)+'</td><td class="num">'+displayNumber(r.scanned)+'</td><td class="num '+(r.difference<0?'amber-text':r.difference>0?'red-text':'green-text')+'">'+displayNumber(r.difference)+'</td><td>'+r.count+'</td></tr>').join(''):'<tr><td colspan="11" class="blank">'+(total?'目前筛选没有项目':'请先导入 ERP 报表')+'</td></tr>';
 if(filtered.length>1500)$('tableSummary').textContent+='（画面只显示前 1500 项，导出包含全部）';
 let histFilter=$('historyFilter').value;let history=state.history.filter(h=>histFilter==='all'||(histFilter==='accepted'?isCounted(h):!isCounted(h)||h.status!=='accepted')).slice().reverse();
 const qtyChecks=historicalQuantityChecks(),historyCheckMap=new Map(state.history.map((r,i)=>[r.id,qtyChecks[i]]));
 $('historySummary').textContent=history.length+' 笔记录';
 $('historyBody').innerHTML=history.length?history.slice(0,500).map(h=>'<tr><td>'+safe(h.at)+'</td><td>'+scanQuantityPill(h,historyCheckMap.get(h.id))+'</td><td>'+safe(h.label)+'</td><td>'+safe(h.part)+'</td><td>'+safe(h.warehouse)+'</td><td>'+safe(h.location)+'</td><td>'+safe(h.actualWarehouse||'—')+'</td><td>'+safe(h.actualLocation||'—')+'</td><td>'+safe(h.erpWarehouse||'—')+'</td><td>'+safe(h.erpLocation||'—')+'</td><td>'+safe(h.lot)+'</td><td class="num">'+(Number.isFinite(h.weight)?displayNumber(h.weight):'—')+'</td><td class="namecol">'+safe(tr(h.message))+(historyCheckMap.get(h.id)&&historyCheckMap.get(h.id).erp!==null?' · ERP '+displayNumber(historyCheckMap.get(h.id).erp)+' KG / 标签 '+displayNumber(h.weight)+' KG / 差异 '+displayNumber(historyCheckMap.get(h.id).diff)+' KG':'')+'</td><td><button class="btn small-btn danger" data-delete-id="'+h.id+'">'+tr('删除')+'</button></td></tr>').join(''):'<tr><td colspan="14" class="blank">暂无扫描记录</td></tr>';
 if(history.length>500)$('historySummary').textContent+='（仅显示最新 500 笔，导出包含全部）';
}
function revokeUrl(blob,name){let url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
function exportRows(){const sums=scannedSum();return state.inventory.map(r=>{let s=sums.get(keyOf(r))||{sum:0,count:0},diff=round3(s.sum-r.quantity);return {...r,scanned:s.sum,difference:diff,count:s.count,status:classify(r,s.sum)}})}
function csvCell(v){let s=String(v??'');if(!/^="\d{10,}"$/.test(s)&&(/^[=+@\t\r]/.test(s)||s.startsWith('-')&&!/^-\d+(?:\.\d+)?$/.test(s)))s="'"+s;return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
// Reconciliation is per ERP row. Only a SCANNED label whose actual warehouse
// AND one of its actual rack codes exactly match this ERP row may populate the
// matched-position field. Do not copy an entire multi-rack group into each row.
function matchedActualPosition(r,history){
 const wh=cleanCode(r.warehouse),loc=cleanCode(r.location);
 const matches=history.filter(h=>isCounted(h)&&cleanCode(h.part)===cleanCode(r.part)&&cleanCode(h.lot)===cleanCode(r.lot)
   &&cleanCode(h.erpWarehouse)===wh&&cleanCode(h.erpLocation)===loc&&cleanCode(h.actualWarehouse)===wh
   &&parseActualLocations(h.actualLocations?.length?h.actualLocations:h.actualLocation||'').includes(loc));
 return matches.length?wh+'/'+loc:'';
}
function locationExceptionCount(r,history){
 return history.filter(h=>isCounted(h)&&cleanCode(h.part)===cleanCode(r.part)&&cleanCode(h.lot)===cleanCode(r.lot)
   &&cleanCode(h.erpWarehouse)===cleanCode(r.warehouse)&&cleanCode(h.erpLocation)===cleanCode(r.location)
   &&['counted_variance','counted_multi','mismatch'].includes(h.status)).length;
}
// Excel automatically turns long all-numeric CSV fields into scientific
// notation. The formula contains ONLY validated digits and evaluates to text
// when opening the CSV directly in Excel; true XLSX exports use text cells.
function csvTextId(value){const s=String(value??'');return /^\d{10,}$/.test(s)?'="'+s+'"':s}
function exportCsv(){if(!state.inventory.length){msg('请先导入 ERP 报表');return}
 let head=['状态 Status','料件編號 Part No.','品名 Description','規格 Spec','倉庫 Warehouse','儲位 Location','批號 Lot','ERP Qty (KG)','Scanned Qty (KG)','Variance (KG)','Scanned Labels','Location Exception Labels','Actual Warehouse / Location (Exceptions)'];
 let history=state.history;
 let rows=exportRows().map(r=>[
  statusInfo(r.status)[0],csvTextId(r.part),r.name,r.spec,r.warehouse,r.location,r.lot,
  displayNumber(r.quantity),displayNumber(r.scanned),displayNumber(r.difference),r.count,
  locationExceptionCount(r,history),matchedActualPosition(r,history)
 ]);
 let content='\uFEFF'+[head,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n');
 revokeUrl(new Blob([content],{type:'text/csv;charset=utf-8'}),'TMC_Stock_Take_'+stamp()+'.csv');
 msg('已导出 CSV：料号保留完整数字；Excel 彩色状态请使用「导出 Excel」');
}
function xesc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')}
function excelCol(i){let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s}
// XLSX styles: 0 normal, 1 header, 2 numeric, 3 plain-text ID,
// 4 completed/green, 5 over/red, 6 short/amber, 7 not-counted/gray.
function sheetXML(data,widths,opts={}){
 let cols=widths.map((w,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>').join('');
 const textCols=new Set(opts.textColumns||[]);
 const statusStyles={done:4,over:5,short:6,pending:7};
 let rows=data.map((row,ri)=>'<row r="'+(ri+1)+'"'+(ri===0?' ht="28" customHeight="1"':'')+'>'+row.map((v,ci)=>{
  let ref=excelCol(ci)+(ri+1);if(v===null||v===undefined||v==='')return '';
  if(ri>0&&typeof v==='number'&&Number.isFinite(v)&&!textCols.has(ci))return '<c r="'+ref+'" s="2"><v>'+v+'</v></c>';
  let style=ri===0?1:(ci===0&&opts.statusKeys?statusStyles[opts.statusKeys[ri-1]]??0:textCols.has(ci)?3:0);
  return '<c r="'+ref+'" s="'+style+'" t="inlineStr"><is><t xml:space="preserve">'+xesc(v)+'</t></is></c>';
 }).join('')+'</row>').join('');
 let filter=data.length>1?'<autoFilter ref="A1:'+excelCol(data[0].length-1)+data.length+'"/>':'';
 return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="16"/><cols>'+cols+'</cols><sheetData>'+rows+'</sheetData>'+filter+'</worksheet>';
}
async function exportExcel(){if(!state.inventory.length){msg('请先导入 ERP 报表');return}
 try{
 const rows=exportRows(),history=state.history,qtyChecks=historicalQuantityChecks();
 const counts={done:rows.filter(r=>r.status==='done').length,pending:rows.filter(r=>r.status==='pending').length,short:rows.filter(r=>r.status==='short').length,over:rows.filter(r=>r.status==='over').length};
 const summary=[['Stock Take Summary','Value'],['ERP file',state.reportName],['Import time',state.importedAt],['Export time',now()],['ERP inventory lines',rows.length],['Completed',counts.done],['Not yet counted',counts.pending],['Unmatched single label quantities',history.filter(h=>recordStatus(h)[0]==='数量不符').length],['Over quantity',counts.over],['Counted scans (incl. location variance)',history.filter(isCounted).length],['Records requiring review',history.filter(h=>!isCounted(h)||h.status!=='accepted').length],['Counted location variances',history.filter(h=>isCounted(h)&&h.status==='counted_variance').length],['Counted multi-location groups',history.filter(h=>isCounted(h)&&h.status==='counted_multi').length],['Ambiguous ERP row',history.filter(h=>h.status==='ambiguous').length],['Older scans requiring recheck',history.filter(h=>COUNTABLE_STATUSES.has(h.status)&&!isCounted(h)).length],['Quantity tolerance (kg)',TOLERANCE],['Source',window.TMCCloud?.isActive()?'Supabase cloud':'Local browser data'],['Multiple actual rack groups',history.filter(h=>h.actualLocations?.length>1&&h.status!=='duplicate').length],['Note','Strict ONE ERP row = ONE label. Part No. identifies ERP Description, then Lot and exact single-line Net KG must match. No accumulation.']];
 const rec=[['状态 Status','料件編號 Part No.','品名 Description','規格 Spec','倉庫 Warehouse','儲位 Location','批號 Lot','ERP Qty (KG)','Scanned Qty (KG)','Variance (KG)','Scanned Labels','Location Exception Labels','Actual Warehouse / Location (Exceptions)'],...rows.map(r=>[statusInfo(r.status)[0],r.part,r.name,r.spec,r.warehouse,r.location,r.lot,r.quantity,r.scanned,r.difference,r.count,locationExceptionCount(r,history),matchedActualPosition(r,history)])];
 const scan=[['Scanned At','Status','Label No.','Part No.','Lot No.','QR Warehouse (reference)','QR Location (reference)','Actual Warehouse','Actual Locations (all)','ERP Warehouse','ERP Location','ERP in Actual','QR location not compared','Additional Locations','Net Weight (KG)','Reason','Raw QR','ERP Quantity (KG)','Matched Single Label Qty (KG)','QR minus ERP (KG)','Exact Quantity Result'],...history.map((h,i)=>[h.at,recordStatus(h)[0],h.label||'',h.part||'',h.lot||'',h.warehouse||'',h.location||'',h.actualWarehouse||'',h.actualLocation||'',h.erpWarehouse||'',h.erpLocation||'',h.positionChecks?(h.positionChecks.erpInActual?'YES':'NO'):'','NOT COMPARED',h.positionChecks?.extraLocations?.join(', ')||'',Number.isFinite(h.weight)?h.weight:'',tr(h.message||''),h.raw||'',qtyChecks[i]?.erp??'',qtyChecks[i]?.scanned??'',qtyChecks[i]?.diff??'',qtyChecks[i]?(qtyChecks[i].valid?'MATCH':'NOT MATCHED'):''])];
 const exception=[['Type','Scan Time','Label No.','Part No.','Lot No.','QR Warehouse (reference)','QR Location (reference)','Actual Warehouse','Actual Locations (all)','ERP Warehouse','ERP Location','ERP in Actual','QR location not compared','Additional Locations','Net Weight (KG)','Note','ERP Quantity (KG)','Matched Single Label Qty (KG)','Exact Quantity Result'],...history.map((h,i)=>({...h,_qtyCheck:qtyChecks[i]})).filter(h=>!isCounted(h)||h.status!=='accepted').map(h=>[recordStatus(h)[0],h.at,h.label||'',h.part||'',h.lot||'',h.warehouse||'',h.location||'',h.actualWarehouse||'',h.actualLocation||'',h.erpWarehouse||'',h.erpLocation||'',h.positionChecks?(h.positionChecks.erpInActual?'YES':'NO'):'','NOT COMPARED',h.positionChecks?.extraLocations?.join(', ')||'',Number.isFinite(h.weight)?h.weight:'',tr(h.message||''),h._qtyCheck?.erp??'',h._qtyCheck?.scanned??'',h._qtyCheck?(h._qtyCheck.valid?'MATCH':'NOT MATCHED'):''])];
 const actualSummary=[['Actual Warehouse','Actual Racking No. (group, not split weight)','Part No.','Lot No.','Labels Scanned','Physical Weight (KG)','Counted Weight (KG)','Exception Weight (KG)','Statuses'],...(()=>{
   const map=new Map(),seenLabels=new Set();for(const h of history){if(!h.part||!h.actualWarehouse||!h.actualLocation||!Number.isFinite(h.weight)||h.status==='duplicate'||h.status==='legacy')continue;
     if(h.label&&seenLabels.has(h.label))continue;if(h.label)seenLabels.add(h.label);
     const key=[h.actualWarehouse,h.actualLocation,h.part,h.lot].join('\u001f');if(!map.has(key))map.set(key,{wh:h.actualWarehouse,loc:h.actualLocation,part:h.part,lot:h.lot,labels:new Set(),weight:0,accepted:0,exception:0,statuses:new Set()});
     const x=map.get(key);if(x.labels.has(h.label))continue;x.labels.add(h.label);x.weight=round3(x.weight+h.weight);if(isCounted(h))x.accepted=round3(x.accepted+h.weight);else x.exception=round3(x.exception+h.weight);x.statuses.add(recordStatus(h)[0]);
   }return [...map.values()].map(x=>[x.wh,x.loc,x.part,x.lot,x.labels.size,x.weight,x.accepted,x.exception,[...x.statuses].join(', ')]);
  })()];
  const locationsDetail=[['Scanned At','Label No.','Part No.','Lot No.','Actual Warehouse','One of Actual Locations','ERP Location Exact','QR Location (not compared)','Status','Note (Weight)'],
   ...history.filter(h=>h.actualWarehouse&&h.actualLocation&&h.status!=='duplicate').flatMap(h=>parseActualLocations(h.actualLocations?.length?h.actualLocations:h.actualLocation).map(loc=>[
     h.at||'',h.label||'',h.part||'',h.lot||'',h.actualWarehouse,loc,(h.actualWarehouse===h.erpWarehouse&&loc===h.erpLocation)?'YES':'NO','NOT COMPARED',recordStatus(h)[0],'Location reference only. Net KG is NOT allocated to each rack.'
   ]))];
  const locationVariance=[['Scanned At','Label No.','Part No.','Lot No.','ERP Warehouse','ERP Location','Actual Warehouse','Actual Rack Group','Location Finding','Counted Weight (KG)','Follow-up'],...history.filter(h=>isCounted(h)&&['counted_variance','counted_multi'].includes(h.status)).map(h=>[h.at,h.label||'',h.part||'',h.lot||'',h.erpWarehouse||'',h.erpLocation||'',h.actualWarehouse||'',h.actualLocation||'',recordStatus(h)[0],Number.isFinite(h.weight)?h.weight:'',tr(h.message||'')])];
 const sheets=[['LocationVariance',locationVariance,[24,18,23,22,21,21,21,45,28,24,80],{textColumns:[2,3]}],['Summary',summary,[29,53]],['Reconciliation',rec,[17,23,43,40,16,18,22,18,20,20,16,20,38],{textColumns:[1,6],statusKeys:rows.map(r=>r.status)}],['ScanHistory',scan,[23,17,17,21,19,16,18,18,35,18,18,17,17,31,19,60,65,23,25,25,22],{textColumns:[2,3,4]}],['Exceptions',exception,[18,24,17,21,19,18,18,18,35,18,18,17,17,31,20,72,20,24,22],{textColumns:[2,3,4]}],['ActualLocations',actualSummary,[21,44,21,19,19,21,26,25,30],{textColumns:[2,3]}],['LocationDetails',locationsDetail,[22,17,21,18,20,26,22,22,18,66],{textColumns:[1,2,3]}]];
 const zip=new JSZip();
 zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+sheets.map((_,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'</Types>');
 zip.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
 zip.file('xl/workbook.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>'+sheets.map(([name],i)=>'<sheet name="'+xesc(name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets></workbook>');
 zip.file('xl/_rels/workbook.xml.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheets.map((_,i)=>'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+'<Relationship Id="rId'+(sheets.length+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
 zip.file('xl/styles.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="6"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font><font><b/><sz val="11"/><color rgb="FF076B4C"/><name val="Aptos"/></font><font><b/><sz val="11"/><color rgb="FFAE1B35"/><name val="Aptos"/></font><font><b/><sz val="11"/><color rgb="FF8B590C"/><name val="Aptos"/></font><font><sz val="11"/><color rgb="FF64748B"/><name val="Aptos"/></font></fonts><fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF123454"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDCFCE7"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFE2E5"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF0C9"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF0F3F8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="3" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="4" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="5" fillId="6" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>');
 sheets.forEach(([,data,widths,opts],i)=>zip.file('xl/worksheets/sheet'+(i+1)+'.xml',sheetXML(data,widths,opts)));
 // A genuine Office Open XML spreadsheet is a ZIP *container* internally.  Wrap
 // it with the XLSX media type, rather than JSZip's default application/zip.
 // This downloads ONE workbook (seven tabs), never seven sheet files.
 const bytes=await zip.generateAsync({type:'uint8array',compression:'DEFLATE',compressionOptions:{level:6}});
 if(bytes.length<4||bytes[0]!==0x50||bytes[1]!==0x4b||bytes[2]!==0x03||bytes[3]!==0x04)throw Error('Excel 工作簿格式验证失败');
 const xlsxType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
 const workbook=new Blob([bytes],{type:xlsxType});
 revokeUrl(workbook,'TMC_Stock_Take_'+stamp()+'.xlsx');
 msg('已直接下载一个 Excel (.xlsx) 文件，内含 7 个工作表。请用 Microsoft Excel 或 Excel Online 打开，不要解压。');
 }catch(e){console.error(e);msg('Excel 导出失败：'+e.message)}
}
function exportJson(){revokeUrl(new Blob([JSON.stringify({version:2,exportedAt:now(),state},null,2)],{type:'application/json'}),'TMC_StockTake_Backup_'+stamp()+'.json');msg('JSON 备份已下载')}
async function importJson(file){if(window.TMCCloud?.isActive()){msg('云端模式不直接恢复 JSON，请先退出云端并在本机模式恢复。');$('backupInput').value='';return}
 try{let obj=JSON.parse(await file.text());let incoming=obj.state||obj;if(!Array.isArray(incoming.inventory)||!Array.isArray(incoming.history))throw Error('备份格式不正确');
 if(!withConfirm('恢复 JSON 备份会覆盖目前报表与盘点记录。确定继续？'))return;
 state={version:2,inventory:incoming.inventory,history:incoming.history.map(h=>(!incoming.version||incoming.version<2)&&h.status==='accepted'?{...h,status:'legacy',message:'旧版未验证实际位置；需重新盘点'}:h),reportName:incoming.reportName||'',importedAt:incoming.importedAt||'',nextId:incoming.nextId||1,activeLocation:incoming.version>=2?incoming.activeLocation||null:null};
  state.nextId=Math.max(0,...state.history.map(x=>Number(x.id)||0))+1;
  await saveStore();restorePositionInputs();render();msg('成功恢复 '+state.inventory.length+' 项库存和 '+state.history.length+' 笔扫描记录');
 }catch(e){msg('备份恢复失败：'+e.message)}finally{$('backupInput').value=''}}
async function deleteHistory(id){const found=state.history.find(h=>h.id===id);if(!found||!withConfirm('删除这笔 '+(found.label||'异常')+' 扫描记录？有效记录的重量会重新计算。'))return;
 if(window.TMCCloud?.isActive()){try{await window.TMCCloud.deleteScan(found.cloudId);notice('云端记录已删除','已同步盘点重量。','warn')}catch(e){msg('删除失败：'+e.message)}return}
 state.history=state.history.filter(h=>h.id!==id);await saveStore();render();notice('记录已删除','盘点重量已经重新计算。','warn')}
async function undo(){if(!state.history.length){msg('暂无扫描记录可以撤销');return}let last=state.history[state.history.length-1];if(!withConfirm('撤销最后扫描记录 Label '+(last.label||'(无效QR)')+'？'))return;
 if(window.TMCCloud?.isActive()){try{await window.TMCCloud.deleteScan(last.cloudId);notice('云端扫描已撤销','已同步到所有设备。','warn')}catch(e){msg('撤销失败：'+e.message)}return}
 state.history.pop();await saveStore();render();notice('已撤销扫描','最近一笔扫描记录已经移除。','warn')}
async function clearScans(){if(!state.history.length){msg('没有需要清空的扫描记录');return}if(!withConfirm('清空 '+state.history.length+' 笔扫描记录？ERP 报表将保留，无法撤销。'))return;
 if(window.TMCCloud?.isActive()){try{await window.TMCCloud.clearScans();notice('已清空云端扫描','此操作已同步到其他设备。','warn')}catch(e){msg('清空失败：'+e.message)}return}
 state.history=[];await saveStore();render();notice('已清空扫描','ERP 库存资料保留，可以重新盘点。','warn')}
async function clearAll(){if(!state.inventory.length&&!state.history.length){msg('目前没有盘点资料');return}if(!withConfirm('确定删除本机 ERP 报表以及所有扫描记录？建议先导出 Excel/JSON 备份。'))return;
 if(window.TMCCloud?.isActive()){if(!withConfirm('云端模式：此操作将删除当前账号的所有盘点任务及扫描记录，所有设备都会受到影响。确定永久删除？'))return;try{await window.TMCCloud.clearAll();notice('已清空云端盘点','所有设备上的云端盘点任务已删除。','warn')}catch(e){msg('清空云端失败：'+e.message)}return}
 await stopCamera();closeERPChoice();state={version:2,inventory:[],history:[],reportName:'',importedAt:'',nextId:1,activeLocation:null};await saveStore();restorePositionInputs();render();notice('盘点资料已清空','请重新导入 ERP 库存报表。','warn')}
function photoError(){msg('本浏览器未提供照片 QR 识别功能。请改用 Chrome Android 相机或 2D 扫描枪。')}
async function detectPhoto(file){if(!file)return;
 try{if(!('BarcodeDetector'in window))return photoError();const bmp=await createImageBitmap(file);let dec=new BarcodeDetector({formats:['qr_code']});let found=await dec.detect(bmp);bmp.close?.();if(!found.length)throw Error('照片内未侦测到清晰的 QR Code');await performScan(found[0].rawValue)}catch(e){msg('照片读取失败：'+e.message)}finally{$('photoInput').value=''}
}
async function stopCamera(){if(videoFrame)cancelAnimationFrame(videoFrame);videoFrame=null;if(cameraStream){for(const t of cameraStream.getTracks())t.stop();cameraStream=null}
 $('scannerPanel').classList.remove('active');$('cameraBtn').textContent='开启相机扫描';$('cameraVideo').srcObject=null;}
async function scanFrames(){if(!cameraStream)return;
 try{let video=$('cameraVideo');if(video.readyState>=2&&!scanLock&&!pendingERPScan){let rs=await detector.detect(video);if(rs.length){let value=rs[0].rawValue,t=Date.now();if(value&&(value!==lastScanText||t-lastScanAt>12000)){
 lastScanText=value;lastScanAt=t;scanLock=true;await performScan(value);scanLock=false;
 }}}
 }catch(e){console.warn('Camera QR detection:',e)}
 if(cameraStream)videoFrame=requestAnimationFrame(scanFrames)
}
async function toggleCamera(){if(cameraStream){await stopCamera();return}
 if(!state.inventory.length){msg('请先导入 ERP 库存报表');return}
 try{physicalPosition()}catch(e){msg(e.message);return}
 if(!window.isSecureContext){msg('相机需要 HTTPS；请部署至 GitHub Pages，再用手机打开');return}
 if(!('BarcodeDetector'in window)){msg('此浏览器不支持内建 QR 识别。请使用新版 Android Chrome 或扫描枪。');return}
 if(!navigator.mediaDevices?.getUserMedia){msg('无法使用相机，请检查浏览器权限');return}
 try{detector=new BarcodeDetector({formats:['qr_code']});cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
 $('cameraVideo').srcObject=cameraStream;await $('cameraVideo').play();$('scannerPanel').classList.add('active');$('cameraBtn').textContent='关闭相机';scanFrames();
 }catch(e){await stopCamera();msg('相机无法启动：'+(e.name==='NotAllowedError'?'请允许浏览器使用相机':e.message))}
}
function addBackupButtons(){let buttons=document.querySelector('.headrow>.buttons');let btn=document.createElement('button');btn.className='btn';btn.textContent=tr('↓ JSON 备份');btn.id='backupBtn';
 let trigger=document.createElement('label');trigger.className='btn';trigger.textContent=tr('↑ 恢复 JSON');trigger.htmlFor='backupInput';
 let input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.id='backupInput';input.hidden=true;buttons.insertBefore(btn,$('resetAll'));buttons.insertBefore(trigger,$('resetAll'));buttons.append(input);
 btn.addEventListener('click',exportJson);input.addEventListener('change',()=>importJson(input.files[0]));
}
function hookEvents(){addBackupButtons();$('reportFile').addEventListener('change',e=>filePicked(e.target.files[0]));$('confirmImport').addEventListener('click',confirmImport);
 $('cancelImport').addEventListener('click',()=>{parsed=null;$('mappingPanel').classList.remove('show')});
 $('demoBtn').addEventListener('click',async()=>{dataFile='示例ERP报表.csv';parsed={current:candidateSheet({name:'Demo',rows:[['料件編號','品名','規格','倉庫編號','儲位','批號','庫存數量','庫存單位'],['5899951013108','Sweep keep Sample (-35 mesh)-Slag TRC-Mixed','Mixed','L002','3A1-113','20260617','190.300','KG']]})};showMapping();msg('示例报表已读取，请确认导入')});
 $('actualWarehouse').addEventListener('input',updatePositionUI);$('actualLocation').addEventListener('input',updatePositionUI);
 $('confirmPosition').addEventListener('click',confirmPhysicalPosition);
 $('actualWarehouse').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('confirmPosition').click()}});
 $('actualLocation').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();$('confirmPosition').click()}});
 $('cameraBtn').addEventListener('click',()=>{window.StockTakeSound?.unlock();toggleCamera()});$('scanBtn').addEventListener('click',async()=>{window.StockTakeSound?.unlock();let s=$('scanInput').value.trim();if(s){$('scanInput').value='';await performScan(s)}else msg('请输入 QR 标签内容')});
 $('scanInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('scanBtn').click()}});
 $('erpChoicePanel').addEventListener('click',e=>{let b=e.target.closest('[data-erp-choice]');if(b){confirmERPChoice(Number(b.dataset.erpChoice));return}if(e.target.closest('#cancelErpChoice'))closeERPChoice()});
 $('photoInput').addEventListener('change',e=>detectPhoto(e.target.files[0]));
 $('demoScanBtn').addEventListener('click',()=>performScan('NO.009998|L002|3A1-113|20260617|5899951013108|190.300'));
 $('undoBtn').addEventListener('click',undo);$('resetAll').addEventListener('click',clearAll);$('clearScans').addEventListener('click',clearScans);
 $('exportCsv').addEventListener('click',exportCsv);$('exportExcel').addEventListener('click',exportExcel);
 $('searchInventory').addEventListener('input',render);$('statusFilter').addEventListener('change',e=>{invFilter=e.target.value;render()});
 $('historyFilter').addEventListener('change',render);
 $('showDiscrepancy').addEventListener('click',()=>{invFilter='issues';$('statusFilter').value='all';render()});
 $('showAllRows').addEventListener('click',()=>{invFilter='all';$('statusFilter').value='all';$('searchInventory').value='';render()});
 $('historyBody').addEventListener('click',e=>{let btn=e.target.closest('button[data-delete-id]');if(btn)deleteHistory(Number(btn.dataset.deleteId))});
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;$('installBtn').hidden=false});
 $('installBtn').addEventListener('click',async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$('installBtn').hidden=true});
 window.addEventListener('pagehide',stopCamera);
}

// V1.3 Cloud bridge. Local state is isolated from server-side stock-take batches.
// Cloud writes go to Supabase first; only committed server records are counted.
window.StockTakeCore={
  getState:()=>state,
  applyRemote:remote=>{
    const position=state.activeLocation;
    state={...state,...remote,activeLocation:position};
    render();renderComparison(null);
  },
  setPosition:position=>{state.activeLocation=position;restorePositionInputs()},
  restoreLocal:async()=>{
    const restored=await readStore();
    state=restored&&Array.isArray(restored.inventory)&&Array.isArray(restored.history)?{...state,...restored}:{version:2,inventory:[],history:[],reportName:'',importedAt:'',nextId:1,activeLocation:null};
    state.nextId=Math.max(0,...state.history.map(h=>Number(h.id)||0))+1;
    restorePositionInputs();render();renderComparison(null);
  },
  showChoice:(raw,candidates)=>showERPChoice(raw,candidates),
  prepareScan:(raw,chosenKey=null)=>{
    if(!state.inventory.length)throw Error('云端尚未导入 ERP 报表');
    const actual=physicalPosition();let scan,record;
    try{scan=parseScan(raw)}catch(e){return {id:0,at:now(),status:'invalid',label:'',message:e.message,raw:String(raw).slice(0,500),actualWarehouse:actual.warehouse,actualLocation:actual.location,actualLocations:actual.locations}}
    const already=state.history.some(h=>h.label===scan.label&&h.label&&isCounted(h));
    const result=already?{row:null,status:'duplicate',reason:'Label '+scan.label+' 已有盘点记录，重量不会重复计算'}:evaluateScan(scan,actual,chosenKey);
    if(result.status==='ambiguous'&&result.candidates?.length)return {requiresSelection:true,candidates:result.candidates};
    record={...scan,id:0,at:now(),actualWarehouse:actual.warehouse,actualLocation:actual.location,actualLocations:actual.locations,positionChecks:result.positionChecks||null,erpWarehouse:result.row?.warehouse||'',erpLocation:result.row?.location||'',status:result.status,quantityMismatch:!!result.quantityMismatch,message:result.reason};
    if(state.history.some(h=>h.label===scan.label&&h.label&&isCounted(h))){
      record.status='duplicate';record.message='Label '+scan.label+' 已有盘点记录，重量不会重复计算';
    }
    return record;
  },
  showCloudScan:record=>{
    renderComparison(record);
    if(isCounted(record)){
      const sums=scannedSum(),row=state.inventory.find(r=>keyOf(r)===countedKey(record));
      const counted=sums.get(countedKey(record))?.sum||0;
      const stat=row?classify(row,counted):'';
      if(row)countedQuantityNotice(record,row,counted);
      else{notice('⚠ ERP 匹配需复查','云端已保存标签，但当前 ERP 无对应库存项目，请核查。','bad');window.StockTakeSound?.play('error')}
    }else if(record.status==='duplicate'){window.StockTakeSound?.play('duplicate');notice('重复标签 / DUPLICATE',record.message,'warn')}
    else{window.StockTakeSound?.play('error');notice(record.quantityMismatch?'✗ ERP 数量不符 / QUANTITY MISMATCH':'⚠ 扫描待核对 / SCAN EXCEPTION',record.message||record.status,'bad')}
  }
};
window.StockTakeRender=()=>{render();updatePositionUI();window.StockTakeI18n?.apply()};
hookEvents();loadPromise=initialize();
})();

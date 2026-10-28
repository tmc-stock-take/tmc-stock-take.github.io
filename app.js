/* TMC Stock Take V1.2 bilingual - ERP x QR label x actual physical warehouse/racking reconciliation */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const FIELDS = [
  ['part','料件編號 / Part No.',true], ['name','品名 / Description',false],
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
let loadPromise;
function normalizeHeader(s){return String(s??'').toLowerCase().normalize('NFKC').replace(/[\s\p{P}\p{S}_]/gu,'')}
function expandScientific(s){s=String(s??'').trim();let m=s.match(/^([+-]?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/);if(!m)return s;
  let sign=m[1],digits=m[2]+(m[3]||''),p=m[2].length+Number(m[4]);if(p>60||p< -20)return s;
  if(p<=0)return sign+'0.'+'0'.repeat(-p)+digits;
  if(p>=digits.length)return sign+digits+'0'.repeat(p-digits.length);
  return sign+digits.slice(0,p)+'.'+digits.slice(p);
}
function cleanCode(s){return expandScientific(s).normalize('NFKC').trim().replace(/^['“”]+|['“”]+$/g,'').replace(/\s+/g,'').toUpperCase()}
function cleanLabel(s){return cleanCode(s).replace(/^(?:NO\.?|LABEL(?:NO\.?)?[:：]?)\s*/i,'').replace(/\D/g,'') || cleanCode(s)}
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
async function saveStore(){let serialized=JSON.stringify(state);
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
}
function groupInventory(rows){let map=new Map(),count=0;
 for(const r of rows){let part=cleanCode(r.part),warehouse=cleanCode(r.warehouse),location=cleanCode(r.location),lot=cleanCode(r.lot);let qty=cleanWeight(r.quantity);
 if(!part||!warehouse||!location||!lot||!Number.isFinite(qty)||qty<0)continue;
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
 if(!result.inventory.length){msg('未找到有效资料，请检查栏位和数量');return}
 if(state.inventory.length&&!withConfirm('导入新 ERP 报表会清除目前盘点记录（'+state.history.length+' 笔）。建议先导出备份。是否继续？'))return;
 state.inventory=result.inventory;state.history=[];state.reportName=dataFile;state.importedAt=now();state.nextId=1;state.activeLocation=null;parsed=null;restorePositionInputs();renderComparison(null);
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
 const wh=cleanCode($('actualWarehouse').value),loc=cleanCode($('actualLocation').value);
 const saved=state.activeLocation;
 if(!wh||!loc)throw Error('请先填写实际仓库和实际储位，再点击确认位置');
 if(!saved||saved.warehouse!==wh||saved.location!==loc)throw Error('实际位置尚未确认，点击「确认当前盘点位置」后再扫描');
 return {warehouse:saved.warehouse,location:saved.location};
}
function restorePositionInputs(){
 $('actualWarehouse').value=state.activeLocation?.warehouse||'';
 $('actualLocation').value=state.activeLocation?.location||'';
 updatePositionUI();
}
function updatePositionUI(){
 const wh=cleanCode($('actualWarehouse').value),loc=cleanCode($('actualLocation').value);
 const saved=state.activeLocation,confirmed=!!(saved&&wh&&loc&&wh===saved.warehouse&&loc===saved.location);
 const badge=$('activePositionBadge'),note=$('positionNotice');
 badge.className='pill '+(confirmed?'ok':saved?'short':'wait');badge.textContent=confirmed?'已确认 '+wh+' / '+loc:saved?'位置待重新确认':'尚未设置';
 note.className='position-notice '+(confirmed?'active':saved?'dirty':'');
 note.textContent=confirmed?'✓ 当前盘点位置：'+wh+' / '+loc+'。连续扫描将保留该位置；换货架时请重新确认。':saved?'⚠ 位置输入已改变。请确认新位置后再继续扫描；旧的盘点记录不会被更改。':'请先输入仓库编号及实际储位，再点击「确认当前盘点位置」。';
}
async function confirmPhysicalPosition(){
 const wh=cleanCode($('actualWarehouse').value),loc=cleanCode($('actualLocation').value);
 if(!wh||!loc){msg('请输入实际仓库和实际储位');return}
 if(wh.length>60||loc.length>80||/[|\r\n]/.test(wh+loc)){msg('位置格式不正确，请检查仓库及储位编号');return}
 state.activeLocation={warehouse:wh,location:loc};
 $('actualWarehouse').value=wh;$('actualLocation').value=loc;
 updatePositionUI();await saveStore();notice('✓ 实际位置已确认',wh+' / '+loc+'。现在可以连续扫描该货架的标签。','good');
 $('scanInput').focus();
}
function erpCandidate(scan,actual){
 const candidates=state.inventory.filter(r=>r.part===scan.part&&r.lot===scan.lot);
 if(!candidates.length){return {row:null,reason:state.inventory.some(r=>r.part===scan.part)?'ERP 有此料号，但找不到相同批号 '+scan.lot:'ERP 中找不到该料号及批号',status:'unmatched'}}
 const labelMatch=candidates.filter(r=>r.warehouse===scan.warehouse&&r.location===scan.location);
 const physicalMatch=candidates.filter(r=>r.warehouse===actual.warehouse&&r.location===actual.location);
 // A scan can correspond to two different ERP lines. Never silently assign stock to one of them.
 const possible=[...new Set([...labelMatch,...physicalMatch])];
 if(possible.length>1)return {row:null,status:'ambiguous',reason:'ERP 同料号/批号存在多个位置，标签位置和实际位置对应不同 ERP 项目：'+possible.map(r=>r.warehouse+'/'+r.location).join('、')};
 if(possible.length===1)return {row:possible[0]};
 if(candidates.length===1)return {row:candidates[0]};
 return {row:null,status:'ambiguous',reason:'ERP 同料号/批号有 '+candidates.length+' 个储位，无法确认对应哪一行：'+candidates.map(r=>r.warehouse+'/'+r.location).join('、')};
}
function evaluateScan(scan,actual){
 const found=erpCandidate(scan,actual),row=found.row;
 if(!row)return {...found,details:[found.reason]};
 const details=[];
 for(const [field,title] of [['warehouse','仓库'],['location','储位']]){
  const a=row[field],b=scan[field],c=actual[field];
  if(a===b&&a===c)continue;
  const mismatches=[];
  if(a!==b)mismatches.push('ERP≠标签');
  if(a!==c)mismatches.push('ERP≠实际');
  if(b!==c)mismatches.push('标签≠实际');
  details.push(title+'不符：ERP '+a+' / 标签 '+b+' / 实际 '+c+'（'+mismatches.join('、')+'）');
 }
 return {row,status:details.length?'mismatch':'accepted',details,reason:details.join('；')||'ERP、QR 标签和实际存放位置三方一致'};
}
function renderComparison(record){
 const el=$('scanComparison');if(!record){el.classList.add('hide');el.innerHTML='';return}
 const fields=[['仓库','warehouse'],['储位 / Racking No.','location']];
 const result=fields.map(([title,key])=>{
  const erp=record['erp'+(key==='warehouse'?'Warehouse':'Location')]||'未确认';
  const label=record[key]||'—',actual=record['actual'+(key==='warehouse'?'Warehouse':'Location')]||'—';
  const valid=erp!=='未确认';
  return '<tr><td>'+safe(title)+'</td><td class="'+(valid&&erp!==label?'diff-cell':'')+'">'+safe(erp)+'</td><td class="'+(valid&&label!==erp?'diff-cell':'')+'">'+safe(label)+'</td><td class="'+((valid&&actual!==erp)||actual!==label?'diff-cell':'')+'">'+safe(actual)+'</td></tr>';
 }).join('');
 el.innerHTML='<div class="comparison-title">ERP × QR 标签 × 实际位置</div><div class="scrolltable"><table class="data-table"><thead><tr><th>比对字段</th><th>ERP 系统</th><th>QR 标签</th><th>实际位置</th></tr></thead><tbody>'+result+'</tbody></table></div><div class="comparison-detail">'+safe(tr(record.message||''))+' · Label '+safe(record.label||'—')+' · '+safe(record.part||'—')+' / '+safe(record.lot||'—')+'</div>';
 el.classList.remove('hide');
}
function scannedSum(){let map=new Map();for(let h of state.history){if(h.status!=='accepted')continue;let k=keyOf(h);map.set(k,{sum:round3((map.get(k)?.sum||0)+h.weight),count:(map.get(k)?.count||0)+1})}return map}
function classify(row,counted){let diff=round3(counted-row.quantity);if(counted===0)return'pending';if(Math.abs(diff)<=TOLERANCE)return'done';if(diff<0)return'short';return'over'}
async function performScan(raw){
 if(!state.inventory.length){notice('请先导入 ERP 报表','尚未读取库存清单，无法比对扫描标签。','warn');return}
 let actual;try{actual=physicalPosition()}catch(e){notice('请先确认实际盘点位置',e.message,'warn');msg(e.message);return}
 let record,scan;
 try{scan=parseScan(raw)}catch(e){
  record={id:state.nextId++,at:now(),status:'invalid',message:e.message,raw:String(raw).slice(0,500),actualWarehouse:actual.warehouse,actualLocation:actual.location};
  state.history.push(record);await saveStore();render();renderComparison(null);notice('QR 资料格式错误',e.message,'bad');return;
 }
 const result=evaluateScan(scan,actual);
 record={...scan,id:state.nextId++,at:now(),actualWarehouse:actual.warehouse,actualLocation:actual.location,
         erpWarehouse:result.row?.warehouse||'',erpLocation:result.row?.location||'',status:result.status,message:result.reason};
 if(state.history.some(h=>h.label===scan.label&&h.status==='accepted')){
  record.status='duplicate';record.message='Label '+scan.label+' 已有三方 MATCH 记录，重量不会重复计算'+(result.status==='mismatch'?'；本次位置异常：'+result.reason:'');
 }else if(result.status==='accepted'){
  record.message='ERP、QR 标签和实际存放位置三方一致';
 }
 state.history.push(record);await saveStore();render();renderComparison(record);
 if(record.status==='accepted'){
  const row=result.row,c=scannedSum().get(keyOf(row)).sum,stat=classify(row,c);
  if(stat==='done')notice('✓ MATCH · 三方一致 / 盘点完成',`Label ${record.label} | ERP ${displayNumber(row.quantity)} KG / 已扫描 ${displayNumber(c)} KG`,'good');
  else if(stat==='over')notice('⚠ 三方一致，但数量超出',`Label ${record.label} | ERP ${displayNumber(row.quantity)} KG / 已扫描 ${displayNumber(c)} KG。请核查标签与重量。`,'bad');
  else notice('✓ MATCH · 三方一致 / 重量累计中',`Label ${record.label} | 本张 ${displayNumber(record.weight)} KG | 已累计 ${displayNumber(c)} / ERP ${displayNumber(row.quantity)} KG`,'good');
  if(navigator.vibrate)navigator.vibrate(85);
 }else if(record.status==='duplicate')notice('重复标签 / DUPLICATE',record.message,'warn');
 else if(record.status==='mismatch')notice('⚠ 三方位置不一致 / LOCATION MISMATCH',record.message+'。此重量暂不计入有效盘点。','bad');
 else if(record.status==='ambiguous')notice('⚠ ERP 储位不明确',record.message+'。请人工核对，不计入有效盘点。','bad');
 else notice('⚠ ERP 无匹配记录',record.message+'。已记录实际位置，不计入有效盘点。','bad');
}
function statusInfo(k){let st={done:['完成','ok'],pending:['未盘点','wait'],short:['数量不足','short'],over:['超出','over'],accepted:['MATCH','ok'],duplicate:['重复','short'],unmatched:['ERP无记录','bad'],invalid:['QR错误','bad'],mismatch:['位置不符','bad'],ambiguous:['ERP多位置','bad'],legacy:['旧版待复盘','wait']}[k]||['异常','bad'];return [tr(st[0]),st[1]]}
function pill(k){let [label,cl]=statusInfo(k);return '<span class="pill '+cl+'">'+label+'</span>'}
function render(){const sums=scannedSum(),total=state.inventory.length,items=state.inventory.map(r=>{const s=sums.get(keyOf(r))||{sum:0,count:0};return {...r,scanned:s.sum,count:s.count,difference:round3(s.sum-r.quantity),status:classify(r,s.sum)}});
 let done=items.filter(x=>x.status==='done').length,over=items.filter(x=>x.status==='over').length,exceptions=state.history.filter(h=>h.status!=='accepted').length;
 $('countTotal').textContent=total;$('countDone').textContent=done;$('countPending').textContent=items.filter(x=>x.status==='pending'||x.status==='short').length;
 $('countIssues').textContent=over+exceptions;$('countScans').textContent=state.history.filter(h=>h.status==='accepted').length;
 $('progressFill').style.width=(total?done/total*100:0)+'%';$('progressLabel').textContent='完成率 '+(total?Math.round(done/total*100):0)+'%（'+done+' / '+total+' 项）';
 $('warehouseOptions').innerHTML=[...new Set(state.inventory.map(x=>x.warehouse))].sort().map(x=>'<option value="'+safe(x)+'"></option>').join('');
 $('reportInfo').innerHTML=state.reportName?'<span><strong>'+safe(state.reportName)+'</strong><br><span class="muted">'+safe(state.importedAt)+' · '+total+tr(' 个合并库存项目')+'</span></span><span class="pill ok">'+tr('报表已导入')+'</span>':'<span class="muted">尚未导入报表</span>';
 let q=cleanCode($('searchInventory').value||'');let filtered=items.filter(r=>(invFilter==='all'||(invFilter==='issues'?r.status!=='done':r.status===invFilter))&&(!q||[r.part,r.name,r.spec,r.warehouse,r.location,r.lot].some(v=>cleanCode(v).includes(q))));
 $('tableSummary').textContent=filtered.length+' / '+total+' 项记录';
 $('inventoryBody').innerHTML=filtered.length?filtered.slice(0,1500).map(r=>'<tr><td>'+pill(r.status)+'</td><td>'+safe(r.part)+'</td><td class="namecol">'+safe(r.name)+'</td><td>'+safe(r.spec)+'</td><td>'+safe(r.warehouse)+'</td><td>'+safe(r.location)+'</td><td>'+safe(r.lot)+'</td><td class="num">'+displayNumber(r.quantity)+'</td><td class="num">'+displayNumber(r.scanned)+'</td><td class="num '+(r.difference<0?'amber-text':r.difference>0?'red-text':'green-text')+'">'+displayNumber(r.difference)+'</td><td>'+r.count+'</td></tr>').join(''):'<tr><td colspan="11" class="blank">'+(total?'目前筛选没有项目':'请先导入 ERP 报表')+'</td></tr>';
 if(filtered.length>1500)$('tableSummary').textContent+='（画面只显示前 1500 项，导出包含全部）';
 let histFilter=$('historyFilter').value;let history=state.history.filter(h=>histFilter==='all'||(histFilter==='accepted'?h.status==='accepted':h.status!=='accepted')).slice().reverse();
 $('historySummary').textContent=history.length+' 笔记录';
 $('historyBody').innerHTML=history.length?history.slice(0,500).map(h=>'<tr><td>'+safe(h.at)+'</td><td>'+pill(h.status)+'</td><td>'+safe(h.label)+'</td><td>'+safe(h.part)+'</td><td>'+safe(h.warehouse)+'</td><td>'+safe(h.location)+'</td><td>'+safe(h.actualWarehouse||'—')+'</td><td>'+safe(h.actualLocation||'—')+'</td><td>'+safe(h.erpWarehouse||'—')+'</td><td>'+safe(h.erpLocation||'—')+'</td><td>'+safe(h.lot)+'</td><td class="num">'+(Number.isFinite(h.weight)?displayNumber(h.weight):'—')+'</td><td class="namecol">'+safe(tr(h.message))+'</td><td><button class="btn small-btn danger" data-delete-id="'+h.id+'">'+tr('删除')+'</button></td></tr>').join(''):'<tr><td colspan="14" class="blank">暂无扫描记录</td></tr>';
 if(history.length>500)$('historySummary').textContent+='（仅显示最新 500 笔，导出包含全部）';
}
function revokeUrl(blob,name){let url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
function exportRows(){const sums=scannedSum();return state.inventory.map(r=>{let s=sums.get(keyOf(r))||{sum:0,count:0},diff=round3(s.sum-r.quantity);return {...r,scanned:s.sum,difference:diff,count:s.count,status:classify(r,s.sum)}})}
function csvCell(v){let s=String(v??'');if(/^[=+@\t\r]/.test(s)||s.startsWith('-')&&!/^-\d+(?:\.\d+)?$/.test(s))s="'"+s;return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
function exportCsv(){if(!state.inventory.length){msg('请先导入 ERP 报表');return}
 let head=['状态 Status','料件編號 Part No.','品名 Description','規格 Spec','倉庫 Warehouse','儲位 Location','批號 Lot','ERP Qty (KG)','Scanned Qty (KG)','Variance (KG)','Scanned Labels','Location Exception Labels','Actual Warehouse / Location (Exceptions)'];
 let rows=exportRows().map(r=>{
  const anomalies=state.history.filter(h=>h.part===r.part&&h.lot===r.lot&&h.status==='mismatch'&&(h.erpWarehouse===r.warehouse&&h.erpLocation===r.location));
  return [statusInfo(r.status)[0],r.part,r.name,r.spec,r.warehouse,r.location,r.lot,displayNumber(r.quantity),displayNumber(r.scanned),displayNumber(r.difference),r.count,anomalies.length,[...new Set(anomalies.map(h=>(h.actualWarehouse||'')+'/'+(h.actualLocation||'')))].join('; ')];
 });
 let content='\uFEFF'+[head,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n');
 revokeUrl(new Blob([content],{type:'text/csv;charset=utf-8'}),'TMC_Stock_Take_'+stamp()+'.csv');msg('已导出 CSV，比对资料包含所有库存项目');
}
function xesc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')}
function excelCol(i){let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s}
function sheetXML(data,widths){let cols=widths.map((w,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>').join('');
 let rows=data.map((row,ri)=>'<row r="'+(ri+1)+'"'+(ri===0?' ht="28" customHeight="1"':'')+'>'+row.map((v,ci)=>{
  let ref=excelCol(ci)+(ri+1);if(v===null||v===undefined||v==='')return'';
  if(typeof v==='number'&&Number.isFinite(v))return '<c r="'+ref+'" s="2"><v>'+v+'</v></c>';
  return '<c r="'+ref+'" s="'+(ri===0?'1':'0')+'" t="inlineStr"><is><t xml:space="preserve">'+xesc(v)+'</t></is></c>'
 }).join('')+'</row>').join('');
 let filter=data.length>1?'<autoFilter ref="A1:'+excelCol(data[0].length-1)+data.length+'"/>':'';
 return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="16"/><cols>'+cols+'</cols><sheetData>'+rows+'</sheetData>'+filter+'</worksheet>';
}
async function exportExcel(){if(!state.inventory.length){msg('请先导入 ERP 报表');return}
 try{
 const rows=exportRows(),history=state.history;
 const counts={done:rows.filter(r=>r.status==='done').length,pending:rows.filter(r=>r.status==='pending').length,short:rows.filter(r=>r.status==='short').length,over:rows.filter(r=>r.status==='over').length};
 const summary=[['Stock Take Summary','Value'],['ERP file',state.reportName],['Import time',state.importedAt],['Export time',now()],['ERP inventory lines',rows.length],['Completed',counts.done],['Not yet counted',counts.pending],['Quantity short',counts.short],['Over quantity',counts.over],['Accepted scans',history.filter(h=>h.status==='accepted').length],['Exceptional scans',history.filter(h=>h.status!=='accepted').length],['Physical position mismatch',history.filter(h=>h.status==='mismatch').length],['Ambiguous ERP row',history.filter(h=>h.status==='ambiguous').length],['V1.0 legacy scans requiring recheck',history.filter(h=>h.status==='legacy').length],['Quantity tolerance (kg)',TOLERANCE],['Source','Local browser data']];
 const rec=[['Status','Part No.','Description','Specification','Warehouse','Location','Lot No.','ERP Qty (KG)','Scanned Qty (KG)','Difference (KG)','Label Count','Unit'],...rows.map(r=>[statusInfo(r.status)[0],r.part,r.name,r.spec,r.warehouse,r.location,r.lot,r.quantity,r.scanned,r.difference,r.count,r.unit])];
 const scan=[['Scanned At','Status','Label No.','Part No.','Lot No.','QR Warehouse','QR Location','Actual Warehouse','Actual Location','ERP Warehouse','ERP Location','Net Weight (KG)','Reason','Raw QR'],...history.map(h=>[h.at,statusInfo(h.status)[0],h.label||'',h.part||'',h.lot||'',h.warehouse||'',h.location||'',h.actualWarehouse||'',h.actualLocation||'',h.erpWarehouse||'',h.erpLocation||'',Number.isFinite(h.weight)?h.weight:'',tr(h.message||''),h.raw||''])];
 const exception=[['Type','Scan Time','Label No.','Part No.','Lot No.','QR Warehouse','QR Location','Actual Warehouse','Actual Location','ERP Warehouse','ERP Location','Net Weight (KG)','Note'],...history.filter(h=>h.status!=='accepted').map(h=>[statusInfo(h.status)[0],h.at,h.label||'',h.part||'',h.lot||'',h.warehouse||'',h.location||'',h.actualWarehouse||'',h.actualLocation||'',h.erpWarehouse||'',h.erpLocation||'',Number.isFinite(h.weight)?h.weight:'',tr(h.message||'')])];
 const actualSummary=[['Actual Warehouse','Actual Racking No.','Part No.','Lot No.','Labels Scanned','Physical Weight (KG)','Triple-Matched Weight (KG)','Exception Weight (KG)','Statuses'],...(()=>{
   const map=new Map();for(const h of history){if(!h.part||!h.actualWarehouse||!h.actualLocation||!Number.isFinite(h.weight)||h.status==='duplicate'||h.status==='legacy')continue;
     const key=[h.actualWarehouse,h.actualLocation,h.part,h.lot].join('\u001f');if(!map.has(key))map.set(key,{wh:h.actualWarehouse,loc:h.actualLocation,part:h.part,lot:h.lot,labels:new Set(),weight:0,accepted:0,exception:0,statuses:new Set()});
     const x=map.get(key);if(x.labels.has(h.label))continue;x.labels.add(h.label);x.weight=round3(x.weight+h.weight);if(h.status==='accepted')x.accepted=round3(x.accepted+h.weight);else x.exception=round3(x.exception+h.weight);x.statuses.add(statusInfo(h.status)[0]);
   }return [...map.values()].map(x=>[x.wh,x.loc,x.part,x.lot,x.labels.size,x.weight,x.accepted,x.exception,[...x.statuses].join(', ')]);
  })()];
  const sheets=[['Summary',summary,[29,53]],['Reconciliation',rec,[16,20,43,20,15,18,19,18,20,20,16,12]],['ScanHistory',scan,[23,17,17,21,19,16,18,18,18,18,18,19,60,65]],['Exceptions',exception,[18,24,17,21,19,18,18,18,18,18,18,20,72]],['ActualLocations',actualSummary,[21,23,21,19,19,21,26,25,30]]];
 const zip=new JSZip();
 zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+sheets.map((_,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'</Types>');
 zip.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
 zip.file('xl/workbook.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>'+sheets.map(([name],i)=>'<sheet name="'+xesc(name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets></workbook>');
 zip.file('xl/_rels/workbook.xml.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheets.map((_,i)=>'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+'<Relationship Id="rId'+(sheets.length+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
 zip.file('xl/styles.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF123454"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>');
 sheets.forEach(([,data,widths],i)=>zip.file('xl/worksheets/sheet'+(i+1)+'.xml',sheetXML(data,widths)));
 revokeUrl(await zip.generateAsync({type:'blob',compression:'DEFLATE'}),'TMC_Stock_Take_'+stamp()+'.xlsx');msg('已导出 Excel：总览、库存比对、扫描记录、异常清单及实际储位汇总');
 }catch(e){console.error(e);msg('Excel 导出失败：'+e.message)}
}
function exportJson(){revokeUrl(new Blob([JSON.stringify({version:2,exportedAt:now(),state},null,2)],{type:'application/json'}),'TMC_StockTake_Backup_'+stamp()+'.json');msg('JSON 备份已下载')}
async function importJson(file){try{let obj=JSON.parse(await file.text());let incoming=obj.state||obj;if(!Array.isArray(incoming.inventory)||!Array.isArray(incoming.history))throw Error('备份格式不正确');
 if(!withConfirm('恢复 JSON 备份会覆盖目前报表与盘点记录。确定继续？'))return;
 state={version:2,inventory:incoming.inventory,history:incoming.history.map(h=>(!incoming.version||incoming.version<2)&&h.status==='accepted'?{...h,status:'legacy',message:'旧版未验证实际位置；需重新盘点'}:h),reportName:incoming.reportName||'',importedAt:incoming.importedAt||'',nextId:incoming.nextId||1,activeLocation:incoming.version>=2?incoming.activeLocation||null:null};
  state.nextId=Math.max(0,...state.history.map(x=>Number(x.id)||0))+1;
  await saveStore();restorePositionInputs();render();msg('成功恢复 '+state.inventory.length+' 项库存和 '+state.history.length+' 笔扫描记录');
 }catch(e){msg('备份恢复失败：'+e.message)}finally{$('backupInput').value=''}}
async function deleteHistory(id){const found=state.history.find(h=>h.id===id);if(!found||!withConfirm('删除这笔 '+(found.label||'异常')+' 扫描记录？有效记录的重量会重新计算。'))return;
 state.history=state.history.filter(h=>h.id!==id);await saveStore();render();notice('记录已删除','盘点重量已经重新计算。','warn')}
async function undo(){if(!state.history.length){msg('暂无扫描记录可以撤销');return}let last=state.history[state.history.length-1];if(!withConfirm('撤销最后扫描记录 Label '+(last.label||'(无效QR)')+'？'))return;
 state.history.pop();await saveStore();render();notice('已撤销扫描','最近一笔扫描记录已经移除。','warn')}
async function clearScans(){if(!state.history.length){msg('没有需要清空的扫描记录');return}if(!withConfirm('清空 '+state.history.length+' 笔扫描记录？ERP 报表将保留，无法撤销。'))return;
 state.history=[];await saveStore();render();notice('已清空扫描','ERP 库存资料保留，可以重新盘点。','warn')}
async function clearAll(){if(!state.inventory.length&&!state.history.length){msg('目前没有盘点资料');return}if(!withConfirm('确定删除本机 ERP 报表以及所有扫描记录？建议先导出 Excel/JSON 备份。'))return;
 await stopCamera();state={version:2,inventory:[],history:[],reportName:'',importedAt:'',nextId:1,activeLocation:null};await saveStore();restorePositionInputs();render();notice('盘点资料已清空','请重新导入 ERP 库存报表。','warn')}
function photoError(){msg('本浏览器未提供照片 QR 识别功能。请改用 Chrome Android 相机或 2D 扫描枪。')}
async function detectPhoto(file){if(!file)return;
 try{if(!('BarcodeDetector'in window))return photoError();const bmp=await createImageBitmap(file);let dec=new BarcodeDetector({formats:['qr_code']});let found=await dec.detect(bmp);bmp.close?.();if(!found.length)throw Error('照片内未侦测到清晰的 QR Code');await performScan(found[0].rawValue)}catch(e){msg('照片读取失败：'+e.message)}finally{$('photoInput').value=''}
}
async function stopCamera(){if(videoFrame)cancelAnimationFrame(videoFrame);videoFrame=null;if(cameraStream){for(const t of cameraStream.getTracks())t.stop();cameraStream=null}
 $('scannerPanel').classList.remove('active');$('cameraBtn').textContent='开启相机扫描';$('cameraVideo').srcObject=null;}
async function scanFrames(){if(!cameraStream)return;
 try{let video=$('cameraVideo');if(video.readyState>=2&&!scanLock){let rs=await detector.detect(video);if(rs.length){let value=rs[0].rawValue,t=Date.now();if(value&&(value!==lastScanText||t-lastScanAt>12000)){
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
 for(const id of ['actualWarehouse','actualLocation'])$(id).addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('confirmPosition').click()}});
 $('cameraBtn').addEventListener('click',toggleCamera);$('scanBtn').addEventListener('click',async()=>{let s=$('scanInput').value.trim();if(s){$('scanInput').value='';await performScan(s)}else msg('请输入 QR 标签内容')});
 $('scanInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('scanBtn').click()}});
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
window.StockTakeRender=()=>{render();updatePositionUI();window.StockTakeI18n?.apply()};
hookEvents();loadPromise=initialize();
})();

/* Stock Take V1.3.6: bilingual UI. UI translations never modify inventory or scan data. */
(function(){
'use strict';
const KEY='tmc_stock_take_ui_lang_v1';
let lang='zh';
try{lang=localStorage.getItem(KEY)==='en'?'en':'zh';}catch(_){}
const raw = [

// V1.3.6 separated page navigation
['云端同步','Cloud Sync'],['ERP 导入','ERP Import'],['扫码盘点','Scan & Count'],['扫描记录','Scan History'],['声音设置','Sound Settings'],
['云端连接与账号','Cloud Connection & Account'],['电脑与手机共用盘点数据','Share stock take data across PC and phone'],
['ERP 导入与实际位置','ERP Import & Actual Locations'],['导入报表、设置实际储位并查看盘点进度','Import ERP, confirm actual locations and review progress'],
['扫码与 ERP 盘点比对','Scan & ERP Reconciliation'],['扫描 QR 并立即核对 ERP 数量','Scan QR labels and reconcile ERP quantities'],
['查看标签记录与异常，必要时删除错误扫描','Review scan history and exceptions; delete incorrect scans if needed'],
['扫码声音设置','Scan Beep Settings'],['调整扫描提示音、音效与音量','Adjust scan alert style and volume'],
['盘点资料管理 / Inventory Data','Inventory Data Management'],['导入 ERP、导出 Excel/CSV、备份与恢复盘点资料。','Import ERP, export Excel/CSV and manage JSON backups.'],
['已确认 ERP 和实际位置？下一步开始扫描标签。','ERP and actual location confirmed? Start scanning labels.'],
['开始扫码 / Start Scanning','Start Scanning'],
['声音设置只影响当前设备。手机静音或媒体音量过低时，可能听不到提示音。','Sound settings apply to this device only. Silent mode or low media volume may mute beeps.'],
['← 返回扫码 / Back to Scan','← Back to Scan'],

['⚠ 同一料号与批号对应多个 ERP 储位 / Select ERP Row','⚠ Multiple ERP racks for the same part/lot — select a row'],
['QR 标签上的旧仓库、旧储位不参与比对。请核对实物对应的 ERP 库存项目；选择后只计入一次，不用重新扫码。','Old warehouse/rack on QR are only references. Confirm which ERP row this item belongs to. It will count once; no rescan needed.'],
['选择并计入 / Count here','Select & Count'],['取消 / Cancel','Cancel'],

['ERP × 实际位置（QR 仅供识别）','ERP × Actual Locations (QR for ID only)'],

['扫码提示音 / Beep sound','Beep sound'],['♫ 试听 / Test','♫ Test Beep'],
['成功、位置差异、重复和错误分别提示','Different sounds for success, location variance, duplicate and error'],
['音效风格 / Beep style','Beep style'],['清脆 / Crisp','Crisp'],['扫描枪 / Scanner','Scanner'],['柔和 / Soft','Soft'],
['音量 / Volume','Volume'],['试听结果 / Test result','Test result'],['成功 / Success','Success'],['位置差异 / Variance','Location variance'],['重复 / Duplicate','Duplicate'],['错误 / Error','Error'],
['↓ 导出 Excel (.xlsx)','↓ Export Excel (.xlsx)'],
['已盘点标签','Counted Labels'],['QR 标签（仅参考）','QR Label (reference only)'],
['QR 仓库和储位仅供记录，不参与比对','QR warehouse and rack are recorded for reference only, not compared'],
['QR 标签旧仓库/储位仅作记录','Old QR warehouse/location recorded for reference'],
['料号、批号符合 ERP，实物位置与 ERP 一致；QR 标签旧仓库/储位仅作记录','Part and lot match ERP, physical location matches. QR location is only a reference'],
['已盘点·位置差异','Counted · Location Variance'],['已盘点·多储位','Counted · Multiple Racks'],
['旧版位置差异·待复盘','Legacy Location Issue · Rescan'],
['同料号及批号在 ERP 的多个储位均出现在实际位置清单中，无法确定该标签归属：','Part / Lot match several ERP rack rows in the actual group; cannot assign this label: '],
['ERP 同料号/批号存在多个库存项目，实际位置未能唯一确定：','Multiple ERP rows have the same part and lot and cannot be uniquely identified from the physical location: '],
['。请缩小实际储位范围后重扫。','. Confirm a specific actual location and rescan.'],
['。请先核对再重扫。','. Verify then rescan.'],
['ERP 仓库 ','ERP warehouse '],[' ≠ 实际仓库 ',' ≠ actual warehouse '],
[' 与实际位置 ',' differs from actual locations '],[' 不一致',''],
['；本张标签尚未指定唯一实际储位，重量只计一次','; exact physical rack is not assigned for this label; net weight counted once'],
['✓ COUNTED · ERP 位置差异 / LOCATION VARIANCE','✓ COUNTED · ERP LOCATION VARIANCE'],
['✓ COUNTED · 多储位待确认 / MULTIPLE LOCATIONS','✓ COUNTED · MULTIPLE LOCATIONS TO REVIEW'],
['✓ COUNTED · 数量完成','✓ COUNTED · Quantity completed'],['✓ COUNTED · 已计入盘点','✓ COUNTED · Scan saved'],
['⚠ COUNTED · 数量超出','⚠ COUNTED · Quantity exceeded'],
['⚠ ERP 项目无法唯一对应','⚠ Ambiguous ERP record'],
['；已计入盘点，储位调整请另行核查。','; counted, ERP location requires follow-up.'],
['；已计入盘点，具体储位需人工核对。','; counted, exact physical rack requires verification.'],
['实际记录多个储位：','Physical locations: '],
['按 QR 的「料号 + 批号」识别 ERP 项目，重量每标签计一次；只比对 ERP 与实际位置。QR 标签的旧仓库/储位不参与匹配。实物已找到但有位置差异，仍计入已盘点并单独列出待调整。','Identify ERP by QR part and lot; count one weight per label. Compare only ERP versus actual location. QR warehouse and rack are historical references, not match criteria. Counted location differences are listed for ERP adjustment.'],
['只比对 ','Only compare '],['ERP 仓库/储位','ERP warehouse / rack'],[' 与 ',' with '],['实际仓库/储位','actual warehouse / rack'],
['。QR 标签仓库/储位可能是旧位置，仅保存作参考，不影响盘点计重。实际有多个储位时整组保存、重量只计一次，但不能自动指定到其中某一个储位。','. The QR warehouse and rack may be outdated, so they are recorded for reference and do not block counting. Multi-rack groups preserve the whole list and count weight once, without assigning it to one precise rack.'],
['导入 ERP → 确认实际位置 → 扫描 QR（识别料号/批号/重量）→ ERP 与实际位置核查','Import ERP → Confirm actual location → Scan QR part/lot/weight → Compare ERP with actual'],

// V1.3.2 location verification + scan sound
['实际储位 / Actual Racking No. (multiple allowed) *','Actual Racking No. (multiple allowed) *'],
['可同时输入多个实际储位，以逗号、分号或换行分隔。每张标签的净重只记一次。','Enter several actual rack locations separated by commas, semicolons or line breaks. Weight counts once per label.'],
['确认实际仓库及一个或多个占用储位；连续扫描时会保留整组储位','Confirm the warehouse and all occupied rack positions; consecutive scans retain the group'],
['可同时记录多个实际储位。必须先确认整组位置再扫描；更换储位后重新确认。','Multiple actual locations are supported. Confirm the entire location group before scanning; reconfirm after changing it.'],
['只有 ERP、QR、实际仓库和单一储位完全一致才会计入有效重量。多实际储位会保留详细清单并标记异常，防止自动认定正确或多计重量。','Only one fully matching physical rack location counts as valid weight. Multiple actual racks are recorded as an exception; weights are never multiplied.'],
['只有三方一致且实际位置唯一的标签会累计重量；多实际储位会单独记录并提示核对，不会拆分或重复计算标签重量。','Only exact three-way matches with a single physical location count toward ERP weight. Multiple occupied racks are recorded for review, without splitting or repeating the label weight.'],
['ERP 储位在实际清单中','ERP location found in actual list'],['QR 储位在实际清单中','QR location found in actual list'],['额外实际储位','Other physical locations'],['是','Yes'],['否','No'],
['多位置需人工确认，不能自动视为单一位置 MATCH','Multiple physical locations need review; they cannot be treated as one MATCH'],
['请先填写实际仓库和至少一个实际储位，再点击确认位置','Enter Actual Warehouse and at least one rack location, then confirm'],
['实际位置尚未确认，请先确认当前实际储位清单','Confirm the current physical rack list before scanning'],
['请输入实际仓库和至少一个实际储位','Enter Actual Warehouse and at least one rack location'],
['实际储位最多 20 个；如需更多，请分开记录并核对','Maximum 20 actual locations per label; split and verify if there are more'],
['实际储位格式不正确，请使用编号并以逗号或换行分隔','Invalid rack location. Use location codes separated by commas or line breaks'],
['仓库编号格式不正确','Invalid warehouse code'],
['已记录多个实际储位','Multiple physical locations recorded'],
['已有盘点记录，重量不会重复计算','already scanned; weight will not be counted again'],
['仓库：ERP ','Warehouse: ERP '],['仓库：QR ','Warehouse: QR '],['储位：ERP ','Location: ERP '],[' ≠ QR ',' ≠ QR '],[' ≠ 实际 ',' ≠ Physical '],
['ERP 储位 ','ERP location '],['QR 储位 ','QR location '],[' 未在实际位置清单中找到（同仓库比对）',' not found in the physical location list (same-warehouse check)'],
['实际记录多个储位：','Multiple actual rack locations: '],['；多位置需人工确认，不能自动视为单一位置 MATCH','; multiple physical locations require manual review and cannot be treated as a single-location MATCH'],
['额外实际储位：','Additional actual locations: '],['；','; '],
['⚠ 实际位置清单已改变，请重新确认后扫描；历史记录不变。','⚠ Physical location list changed. Confirm it before scanning. Scan history is unchanged.'],
['当前盘点位置：','Current physical location: '],[' 个储位',' rack locations'],
['。每张标签只记录一次净重；换位置时请重新确认。','. Count net weight once per label. Reconfirm when changing locations.'],
['（',' ('],['个储位）。扫描时每张标签只计算一次重量。',' rack locations). Weight counted once per label.'],

['ERP 同料号/批號存在多个位置，标签与实际储位清单指向不同 ERP 项目：','ERP contains multiple locations; QR and physical list indicate different ERP entries: '],

// Top-level UI and actions
['⬇ 安装 App','⬇ Install App'],
['仓库库存盘点','Warehouse Stock Take'],
['导入 ERP 报表 → 设置实际盘点位置 → 扫描标签 QR → 三方自动比对','Import ERP report → Confirm physical location → Scan label QR → Three-way comparison'],
['↓ 导出 Excel','↓ Export Excel'],['↓ 导出 CSV','↓ Export CSV'],['↓ JSON 备份','↓ JSON Backup'],['↑ 恢复 JSON','↑ Restore JSON'],
['清空盘点','Clear Stock Take'],
['ERP 库存项目','ERP Inventory Items'],['已完成盘点','Completed Items'],['待盘点 / 数量不足','Pending / Short Quantity'],['异常 / 数量超出','Exceptions / Excess Quantity'],['三方匹配标签','Three-Way Matched Labels'],
['① 导入 ERP 库存报表','① Import ERP Inventory Report'],['载入图片示例','Load Sample Data'],
['选择 ERP Excel (.xlsx) 或 CSV 报表','Select ERP Excel (.xlsx) or CSV File'],
['支持料件編號、品名、規格、倉庫編號、儲位、批號、庫存數量、庫存單位','Supported columns: Part No., Description, Specification, Warehouse, Location, Lot No., Stock Quantity and Unit'],
['确认报表栏位对应 / Column Mapping','Confirm Column Mapping'],['自动辨识后可以自行调整','Automatically detected; you can adjust the mappings'],
['确认导入报表','Confirm Import'],['取消','Cancel'],['尚未导入报表','No ERP report imported'],
['先匹配「料号 + 批号」，再将 ERP、QR 标签和实际盘点仓库 / 储位三方核对。只有三方一致的标签会累计重量；无法唯一确认 ERP 项目时会显示异常，不会随意分配给某个储位。','First match Part No. + Lot No., then compare ERP location, QR label location and confirmed physical location. Only three-way matches count toward scanned weight. Ambiguous ERP records are flagged rather than allocated to the wrong location.'],
['② 设置实际盘点位置','② Confirm Physical Stock Location'],
['先确认目前站在哪个仓库和货架，再连续扫描该位置的物料标签','Confirm the current warehouse and rack before scanning labels at this location'],
['尚未设置','Not Set'],['实际仓库 / Actual Warehouse *','Actual Warehouse *'],['实际储位 / Actual Racking No. *','Actual Racking No. *'],
['✓ 确认当前盘点位置','✓ Confirm Current Location'],
['未确认实际位置之前，无法扫描标签。确认后会持续沿用，直到你更换储位。','You must confirm the physical location before scanning. The confirmed location stays active until you change it.'],
['比对三个来源：','Compare three sources: '],['ERP 报表位置','ERP location'],['标签 QR 位置','QR label location'],['仓库人员确认的实际位置','physical location confirmed by warehouse staff'],
['。三方全部相符才计算有效盘点重量。任何位置不一致都会存入异常记录，不会自动修改 ERP 库存。','. Only a complete three-way location match counts as valid weight. Location mismatches are recorded as exceptions; ERP stock is never changed automatically.'],
['③ 扫描实物 QR 标签','③ Scan Physical QR Label'],['开启相机扫描','Start Camera Scan'],['关闭相机','Stop Camera'],['等待扫描 QR Code','Ready to Scan QR Code'],
['手机相机、扫描枪、手动输入或上传标签照片','Phone camera, scanner, manual entry or QR label photo'],
['手动输入 / 2D Scanner Input','Manual / 2D Scanner Input'],['确认扫描','Confirm Scan'],['从照片读取 QR','Scan QR from Photo'],['试扫示例标签','Try Sample Label'],['撤销上一笔','Undo Last Scan'],
['准备就绪','Ready'],['请先导入 ERP 报表，并确认实际盘点位置。','Import an ERP report and confirm the physical stock location first.'],
['示例 QR：','Sample QR: '],['。相机需要 HTTPS（例如 GitHub Pages）或 localhost；若浏览器不支持 QR 相机识别，可以使用 2D 扫描枪或手动输入。','. Camera scanning requires HTTPS (such as GitHub Pages) or localhost. If your browser does not support QR recognition, use a 2D scanner or manual entry.'],
['④ ERP 盘点比对 / Inventory Reconciliation','④ ERP Inventory Reconciliation'],['按项目显示 ERP 数量、已扫描重量及差异','Compare ERP quantity, scanned weight and variance by stock item'],
['只看差异','Show Discrepancies'],['显示全部','Show All'],['全部状态','All Statuses'],['已完成','Completed'],['待盘点','Not Counted'],['数量不足','Short Quantity'],['数量超出','Excess Quantity'],['全部扫描','All Scans'],['有效扫描','Valid Scans'],['异常 / 重复','Exceptions / Duplicates'],
['状态','Status'],['料号 Part No.','Part No.'],['料号','Part No.'],['品名 Description','Description'],['规格','Specification'],['仓库','Warehouse'],['储位','Location'],['批号','Lot No.'],['ERP 数量','ERP Quantity'],['扫描重量','Scanned Weight'],['差异 (实-账)','Difference (Actual − ERP)'],['标签数','Label Count'],['请先导入报表','Please import the ERP report first'],
['⑤ 扫描记录 / Scan History','⑤ Scan History'],['保存每个标签编号、重量、时间与异常原因','Records label number, weight, scan time and any exceptions'],['清空扫描记录','Clear Scan History'],
['扫描时间','Scanned At'],['结果','Result'],['标签仓库','QR Warehouse'],['标签储位','QR Location'],['实际仓库','Actual Warehouse'],['实际储位','Actual Location'],['ERP 仓库','ERP Warehouse'],['ERP 储位','ERP Location'],['净重 KG','Net Weight KG'],['差异 / 备注','Difference / Notes'],['操作','Action'],['删除','Delete'],['暂无扫描记录','No scan history yet'],
['TMC Stock Take V1.2 · 本机浏览器储存（IndexedDB）· 不上传仓库数据到服务器 · 请定期导出 Excel 备份','TMC Stock Take V1.2 · Data stored locally in your browser (IndexedDB) · Warehouse data is not uploaded to a server · Export backups regularly'],
['若更换手机或清除浏览器网站数据，原盘点记录可能会丢失。','If you change phones or clear website data, your stock take records may be lost.'],
['搜索料号 / 批号 / 储位 / 品名','Search Part No. / Lot No. / Location / Description'],['例如 L002','e.g. L002'],['例如 3A1-113','e.g. 3A1-113'],
['— 不使用此栏 —','— Do not use this column —'],['(无标题)','(Untitled)'],
['料件編號 / Part No.','Part No.'],['品名 / Description','Description'],['規格 / Specification','Specification'],['倉庫編號 / Warehouse','Warehouse'],['儲位 / Location','Location'],['批號 / Lot No.','Lot No.'],['庫存數量 / Stock Quantity','Stock Quantity'],['庫存單位 / Unit','Unit'],
['工作表：','Sheet: '],['表头第 ','Header row '],[' 行 · 共 ',' · Total '],[' 行资料',' data rows'],['预览：','Preview: '],
['完成率 ','Completion '],[' 项',' items'],[' 项记录',' records'],[' 笔记录',' records'],[' 个合并库存项目',' merged inventory items'],['报表已导入','Report Imported'],['目前筛选没有项目','No items match the current filter'],['（画面只显示前 1500 项，导出包含全部）',' (first 1,500 shown; export includes all)'],['（仅显示最新 500 笔，导出包含全部）',' (latest 500 shown; export includes all)'],
// Status badges
['完成','Complete'],['未盘点','Not Counted'],['数量不足','Short'],['超出','Over'],['重复','Duplicate'],['ERP无记录','No ERP Match'],['QR错误','Invalid QR'],['位置不符','Location Mismatch'],['ERP多位置','Ambiguous ERP Location'],['旧版待复盘','Legacy: Recheck'],['异常','Exception'],
// Position and comparison / results
['（',' ('],['）',')'],['、',', '],['已确认 ','Confirmed '],['位置待重新确认','Reconfirm Location'],['✓ 当前盘点位置：','✓ Current location: '],['。连续扫描将保留该位置；换货架时请重新确认。','. This location remains active for consecutive scans; reconfirm when moving to another rack.'],
['⚠ 位置输入已改变。请确认新位置后再继续扫描；旧的盘点记录不会被更改。','⚠ Location changed. Confirm the new location before scanning. Existing scan history remains unchanged.'],
['请先输入仓库编号及实际储位，再点击「确认当前盘点位置」。','Enter Warehouse and Actual Racking No., then select Confirm Current Location.'],
['✓ 实际位置已确认','✓ Physical Location Confirmed'],['。现在可以连续扫描该货架的标签。','. You can now scan labels at this rack.'],
['ERP × QR 标签 × 实际位置','ERP × QR Label × Physical Location'],['比对字段','Field'],['ERP 系统','ERP System'],['QR 标签','QR Label'],['实际位置','Physical Location'],['未确认','Unverified'],['储位 / Racking No.','Location / Racking No.'],
['仓库不符','Warehouse Mismatch'],['储位不符','Location Mismatch'],['ERP≠标签','ERP ≠ QR'],['ERP≠实际','ERP ≠ Physical'],['标签≠实际','QR ≠ Physical'],
['不符：ERP ',' mismatch: ERP '],[' / 标签 ',' / QR '],[' / 实际 ',' / Actual '],
['ERP、QR 标签和实际存放位置三方一致','ERP, QR label and physical location all match'],
['请先导入 ERP 库存报表','Please import an ERP inventory report first'],['请先导入 ERP 报表','Please import an ERP report first'],['尚未读取库存清单，无法比对扫描标签。','No ERP inventory imported; cannot compare scanned labels.'],
['请先确认实际盘点位置','Confirm Physical Location First'],['请先填写实际仓库和实际储位，再点击确认位置','Enter Actual Warehouse and Actual Racking No., then confirm the location'],
['实际位置尚未确认，点击「确认当前盘点位置」后再扫描','Physical location is not confirmed. Select Confirm Current Location before scanning'],
['请输入实际仓库和实际储位','Enter Actual Warehouse and Actual Racking No.'],['位置格式不正确，请检查仓库及储位编号','Invalid location format. Check warehouse and location values'],
['成功导入 ERP 报表','ERP Report Imported Successfully'],['共读取 ','Imported '],[' 行，合并后 ',' row(s); merged into '],[' 项库存。可以开始扫描标签。',' inventory item(s). You can now scan labels.'],
['QR 资料格式错误','Invalid QR Data Format'],['扫描内容为空','Scan input is empty'],['无法识别 QR 格式：预期为 Label|Warehouse|Location|Lot|Part|Net 六段资料','Unrecognized QR format. Expected six fields: Label|Warehouse|Location|Lot|Part|Net'],
['QR 部分资料缺失，或净重不是有效正数','QR data is incomplete, or the net weight is not a valid positive number'],
['✓ MATCH · 三方一致 / 盘点完成','✓ MATCH · Three-Way Match / Completed'],['⚠ 三方一致，但数量超出','⚠ Three-Way Match but Excess Quantity'],['✓ MATCH · 三方一致 / 重量累计中','✓ MATCH · Three-Way Match / Accumulating Weight'],
['重复标签 / DUPLICATE','Duplicate Label'],['⚠ 三方位置不一致 / LOCATION MISMATCH','⚠ Three-Way Location Mismatch'],['⚠ ERP 储位不明确','⚠ Ambiguous ERP Location'],['⚠ ERP 无匹配记录','⚠ No Matching ERP Record'],
[' / 已扫描 ',' / Scanned '],['。请核查标签与重量。','. Verify the label and weight.'],[' | 本张 ',' | This label '],[' | 已累计 ',' | Accumulated '],['。此重量暂不计入有效盘点。','. This weight is not counted as valid stock take.'],['。请人工核对，不计入有效盘点。','. Please verify manually; weight not counted.'],['。已记录实际位置，不计入有效盘点。','. Physical location recorded; weight not counted.'],
['ERP 有此料号，但找不到相同批号 ','Part number exists in ERP but lot number was not found: '],['ERP 中找不到该料号及批号','Part number and lot number not found in ERP'],
['ERP 同料号/批号存在多个位置，标签位置和实际位置对应不同 ERP 项目：','Multiple ERP locations for this part and lot; QR and physical locations refer to different ERP rows: '],
['ERP 同料号/批号有 ','ERP has '],[' 个储位，无法确认对应哪一行：',' locations for this part and lot; cannot identify a unique ERP row: '],
['Label ','Label '],[' 已有三方 MATCH 记录，重量不会重复计算',' already has a three-way MATCH record; weight will not be counted twice'],['；本次位置异常：','; current location discrepancy: '],
// Workflow & backup messages
['本机储存失败，请尽快导出 Excel / JSON 备份','Local save failed; export an Excel or JSON backup as soon as possible'],['浏览器容量不足，请导出数据备份','Browser storage is full; please back up your data'],
['缺少 Excel 读取元件','Excel reading component is unavailable'],['Excel 缺少 ','Excel file is missing '],['找不到 Excel 工作表','No Excel worksheet found'],
['请使用 .xlsx 或 .csv 文件','Please select an .xlsx or .csv file'],['未辨识到 ERP 栏位。请检查报表标题是否包含料号、仓库、储位、批号及库存数量','Cannot detect ERP columns. Verify headers for Part No., Warehouse, Location, Lot No., and Stock Quantity'],
['报表已读取，请确认栏位后导入','Report loaded; confirm the column mappings to import'],['读取失败：','Read failed: '],['请指定必要栏位：','Please map this required column: '],['未找到有效资料，请检查栏位和数量','No valid rows found. Check column mapping and quantities'],
['导入新 ERP 报表会清除目前盘点记录（','Importing a new ERP report will clear existing scan history ('],[' 笔）。建议先导出备份。是否继续？',' records). Export a backup first. Continue?'],['示例报表已读取，请确认导入','Sample report loaded; confirm import'],
['已导出 CSV，比对资料包含所有库存项目','CSV exported, including all inventory items'],['已导出 Excel：总览、库存比对、扫描记录、异常清单及实际储位汇总','Excel exported: Summary, Reconciliation, Scan History, Exceptions and Actual Locations'],['Excel 导出失败：','Excel export failed: '],['JSON 备份已下载','JSON backup downloaded'],
['备份格式不正确','Invalid backup format'],['恢复 JSON 备份会覆盖目前报表与盘点记录。确定继续？','Restoring a JSON backup will replace the current report and scan history. Continue?'],
['旧版未验证实际位置；需重新盘点','Legacy scan has no verified physical location; rescan required'],['V1.0 旧记录（没有实际位置），请到对应实际储位重新扫描；旧重量不计入 V1.1 三方已盘点数','V1.0 legacy scan (physical location not verified). Rescan at the actual location; old weight is excluded from three-way matches.'],
['成功恢复 ','Restored '],[' 项库存和 ',' inventory items and '],[' 笔扫描记录',' scan records'],['备份恢复失败：','Backup restore failed: '],
['删除这笔 ','Delete this '],[' 扫描记录？有效记录的重量会重新计算。',' scan record? Valid scanned weights will be recalculated.'],['记录已删除','Record Deleted'],['盘点重量已经重新计算。','Scanned weight recalculated.'],
['暂无扫描记录可以撤销','No scans to undo'],['撤销最后扫描记录 Label ','Undo last scan, Label '],['(无效QR)','(invalid QR)'],['？','?'],['已撤销扫描','Scan Undone'],['最近一笔扫描记录已经移除。','The latest scan has been removed.'],
['没有需要清空的扫描记录','There is no scan history to clear'],['清空 ','Clear '],[' 笔扫描记录？ERP 报表将保留，无法撤销。',' scan records? The ERP report will be kept. This cannot be undone.'],['已清空扫描','Scan History Cleared'],['ERP 库存资料保留，可以重新盘点。','ERP inventory retained. You can start a new stock take.'],
['目前没有盘点资料','No stock take data to clear'],['确定删除本机 ERP 报表以及所有扫描记录？建议先导出 Excel/JSON 备份。','Delete the local ERP report and all scan history? Please export an Excel/JSON backup first.'],['盘点资料已清空','Stock Take Data Cleared'],['请重新导入 ERP 库存报表。','Import an ERP inventory report to start.'],
['本浏览器未提供照片 QR 识别功能。请改用 Chrome Android 相机或 2D 扫描枪。','Photo QR detection is not available in this browser. Use Android Chrome camera or a 2D scanner.'],['照片内未侦测到清晰的 QR Code','No clear QR code was detected in the image'],['照片读取失败：','Photo scan failed: '],
['相机需要 HTTPS；请部署至 GitHub Pages，再用手机打开','Camera requires HTTPS. Publish on GitHub Pages and open it on your phone'],['此浏览器不支持内建 QR 识别。请使用新版 Android Chrome 或扫描枪。','This browser does not support built-in QR detection. Use an up-to-date Android Chrome or a 2D scanner.'],
['无法使用相机，请检查浏览器权限','Camera unavailable. Check browser permissions'],['相机无法启动：','Unable to start camera: '],['请允许浏览器使用相机','Allow camera access in your browser'],['请输入 QR 标签内容','Enter QR label data'],
];
// Exact phrases first; partial replacements handle generated messages with numeric values and label IDs.
const dictionary = new Map(raw);
const patterns = [...dictionary].sort((a,b)=>b[0].length-a[0].length);
const original = new WeakMap();
function translate(value){
 const s=String(value??'');if(lang!=='en'||!/[\u3400-\u9fff]/.test(s))return s;
 const exact=dictionary.get(s);if(exact!==undefined)return exact;
 return patterns.reduce((acc,[from,to])=>acc.includes(from)?acc.split(from).join(to):acc,s);
}
function apply(){
 document.documentElement.lang=lang==='en'?'en':'zh-Hans';
 const select=document.getElementById('languageSelect');if(select&&select.value!==lang)select.value=lang;
 const root=document.body;if(!root)return;
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{
  acceptNode(node){if(!node.nodeValue||!node.nodeValue.trim())return NodeFilter.FILTER_REJECT;
   const el=node.parentElement;if(!el||el.closest('style,script,textarea,#inventoryBody,#historyBody,#mappingPreview,code'))return NodeFilter.FILTER_REJECT;
   return NodeFilter.FILTER_ACCEPT;}
 });
 let node;while((node=walker.nextNode())){
  let prev=original.get(node);let source=prev&&node.nodeValue===prev.last?prev.source:node.nodeValue;
  const display=lang==='en'?translate(source):source;
  if(node.nodeValue!==display)node.nodeValue=display;
  original.set(node,{source,last:display});
 }
 for(const el of root.querySelectorAll('[placeholder],[aria-label],[title]')){
  for(const attr of ['placeholder','aria-label','title']){
   if(!el.hasAttribute(attr))continue;let now=el.getAttribute(attr),id='a:'+attr,prev=el.__i18nCache?.[id],source=prev&&prev.last===now?prev.source:now,display=lang==='en'?translate(source):source;
   if(now!==display)el.setAttribute(attr,display);
   if(!el.__i18nCache)el.__i18nCache={};el.__i18nCache[id]={source,last:display};
  }
 }
}
let scheduled=false;
function schedule(){if(scheduled)return;scheduled=true;Promise.resolve().then(()=>{scheduled=false;apply()})}
function setLanguage(next){lang=next==='en'?'en':'zh';try{localStorage.setItem(KEY,lang)}catch(_){};
 apply();if(typeof window.StockTakeRender==='function')window.StockTakeRender();}
window.StockTakeI18n={translate,apply,setLanguage,get language(){return lang}};
const sel=document.getElementById('languageSelect');if(sel){sel.value=lang;sel.addEventListener('change',()=>setLanguage(sel.value))}
apply();
const observer=new MutationObserver(schedule);observer.observe(document.body,{subtree:true,childList:true,characterData:true});
})();

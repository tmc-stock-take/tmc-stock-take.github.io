# V1.3.18 — ERP Reconciliation: Complete First / 已完成优先排序

ERP Inventory Reconciliation 列表现在每次渲染时将 status=done (Complete) 排在最前面，其余未完成项目排在下方；相同状态分组保留 ERP 报表的原有顺序。扫描成功及云端同步更新后自动重新排序。搜索和状态过滤逻辑不变。仅影响网页显示顺序，不修改 ERP 数据、扫描记录、云端同步及 Excel 导出。

# V1.3.17 — 多个实际仓库 / Multiple Actual Warehouses

- Actual Warehouse 可输入多个仓库编号，以逗号、分号或换行分隔；最多 20 个，重复值自动去重。
- Actual Racking No. 继续支持多个储位。两组均视为同一张实物标签的实际位置集合，**不代表逐个仓库 / 储位已准确分配**。
- ERP 位置比对确认 ERP 仓库在实际仓库清单内、ERP 储位在实际储位清单内；多个仓库或储位时保留多位置提示与人工复核，重量只计一次。
- 位置确认时保留整组资料；切换后不改动既有扫描记录。
- 旧记录以及 Supabase 表结构仍兼容，毋须 SQL 升级。
- 更新前请备份 JSON/Excel。将 ZIP 全部文件上传到 GitHub Pages 原仓库根目录、覆盖同名文件，切勿删除浏览器储存。
- 注意：仓库清单与储位清单分别记录，不自动建立仓库-储位的精确对应关系。

# V1.3.17 — 2D 扫描枪即时自动确认 / Immediate scanner submit

基于原有 V1.3.14 完整 ZIP 开发。扫描页面的 2D Scanner 输入框现在支持：

- 扫描枪自动输入完标准六段 QR 标签后，最后一个字符输入后立即自动确认（不使用计时等待），无需触碰绿色「确认扫描」按钮。
- 若扫描枪自动发送 Enter，也会立即确认一次。
- 若扫码内容未完整或不符合六段 QR 格式，则不自动提交，可检查或使用绿色按钮手动提交。
- 自动确认时防止单次提交过程中重复触发；如 ERP 多库存项目需人工选择，仍保留 ERP 选择步骤。
- 扫完后输入框自动恢复焦点，方便下一张标签连续扫描。
- 保持 V1.3.14 的 8 处隐藏说明、ERP 单笔数量匹配、实际位置/Racking/Row、历史记录、Supabase、Excel 导出及中英文界面不变。

**GitHub Pages 更新：** 上传 ZIP 所有文件至原 Repository 根目录覆盖同名文件，包含 `vendor/` 子目录；无需运行 SQL。更新后应显示 V1.3.18。请先备份 JSON/Excel；不要清理浏览器网站数据。

**注意：** 若你的蓝牙/USB 2D 扫描枪连接后没有把文字输入到扫描框，请先点击扫描框使之获得焦点。第一次打开扫码页也会尝试自动聚焦。存在多笔 ERP 候选时仍需人工选择，防止误计。

---

# V1.3.14 — 隐藏截图红框中的说明文字 / Hide Informational Help Blocks

基于 V1.3.13 原有程序，仅隐藏截图红框的 8 个说明性区块（使用 CSS，不删除数据或业务代码）。

- ERP 导入：QR / ERP 核对说明。
- 实际位置：多储位输入说明、Racking / Row 备注说明、确认位置下方的绿色提示文字区块和 ERP 位置说明。
- 扫码页面：快速切换 Racking / Row 下方的说明、QR 盘点规则说明、底部示例 QR / HTTPS 说明。
- **保留**实际位置输入与确认按钮、扫码结果及错误警告、快速切换当前状态、扫描记录、ERP 严格单笔核对、Supabase 云端同步、Excel 导出、中英文切换及声音设置。
- `positionNotice` 元素仍存在，供旧程序更新文字，只是在界面隐藏；如要重新显示，移除 `.v1314-hide-help` 类即可。

## GitHub Pages 更新

1. 建议先导出 Excel/JSON 作为备份；不要清除浏览器网站数据或 Supabase 表。
2. 将本 ZIP 全部内容（包括 `vendor/`）上传至现有 Repository 根目录，覆盖同名文件。
3. 本次实际改动的文件：`index.html`、`app.js`（仅版本注释）、`i18n.js`（版本字符串）、`manifest.webmanifest`（版本名称）、`sw.js`（缓存版本）、本 README。其余文件原样保留。
4. 提交后网页版本应显示 V1.3.14；如手机仍显示旧版，重新加载页面，勿清除网站数据。

## 测试范围
静态源代码检查、JS 语法校验和元素核对可在本地完成；真实 Supabase 连接、手机相机权限及扫描操作需要在部署环境验证。

---

# V1.3.13 — Current Location 英文提示修正 / English Status Message Fix

本次以 **V1.3.12** 为基础，仅修正「Actual Stock Location」已确认位置的**动态提示语**在 English 模式下仍有中文的问题；不改变任何盘点算法或数据结构。

- 中文模式：`✓ 当前盘点位置：A001 / 2A1。Racking / Row 仅记录，不参与盘点核对或计重。`
- English mode: `✓ Current location: A001 / 2A1. Racking / Row are for record-keeping purposes only and are not included in stock take verification or weight calculations.`
- Warehouse / Location 和 Racking / Row 依据当前已确认位置动态显示；即使更换位置，句子也会正确切换中英文。
- 更新了网页显示版本、PWA 清单及 Service Worker 缓存键（V1.3.13），避免继续显示旧提示。
- **无需修改 Supabase SQL**；保留先前的 ERP 严格单张标签核对、Racking / Row 切换、Excel 导出、扫码音效、云端同步等功能。

**更新 GitHub Pages：** 先备份 JSON/Excel；解压 ZIP，将全部文件与 `vendor/` 文件夹上传到已有的 `tmc-stock-take.github.io` Repository 根目录并覆盖，提交后确认页面显示 V1.3.13；手机如有旧缓存，可重新载入或关闭再打开，不要清除网站数据。

---

# V1.3.12 提示文字修正 / Prompt Translation Update

本版本在 V1.3.11 基础上修正两段界面文案，盘点规则、ERP 比对、Racking / Row、Excel、云端同步不变。

### 中文模式
- **实际盘点位置：** 请先填写实际仓库（Actual Warehouse）及实际储位（Actual Location）；Racking / Row 为选填。完成后点击「确认当前盘点位置」。
- **Supabase 首次连接：** 首次连接：请先建立 Supabase 项目，在 SQL Editor 执行随附的 SQL，然后填写 Project URL 和 Publishable Key。请勿使用 secret 或 service_role key。

### English mode
- **Actual Stock Location:** Enter the Actual Warehouse and Actual Location. Racking and Row are optional. Click Confirm Current Location.
- **Supabase first-time setup:** First-time setup: Create a Supabase project, run the included SQL in the SQL Editor, then enter your Project URL and publishable key. Do not use a secret or service_role key.

这两段均使用完整句子的中英文映射，避免混合文本或「items目」等不正确显示。云端公开配置仅限可公开使用的 publishable/anon key，绝不填写 service_role/secret key。

部署：先做 JSON/Excel 备份，再把 ZIP 解压后的全部网站文件（含 `app.js`、`i18n.js`、`index.html`、`sw.js`）上传覆盖 GitHub Repository 根目录；等待 GitHub Pages 部署后检查页首 `V1.3.12`。不需要更改 Supabase 数据库。

---

# V1.3.12 中英文界面翻译修正 / English UI Localization Fix

本版从 V1.3.10 升级，盘点计算规则和 Racking / Row 快速切换功能不变。

- 修正英文模式下云端同步的设置说明、按钮、状态与页脚说明。
- 修正扫描页面的严格单笔 ERP 匹配说明、比对表提示、扫描历史空白提示以及手动备注标题。
- 修正程序动态生成的空白状态，英文模式下显示 `Please import an ERP report first` 或 `No scan records yet`。
- 保留中文模式；ERP 导入的品名、料号、批号及扫描记录数据不会被翻译改写。
- 中文 / English 语言切换会保留在当前浏览器，不清除盘点记录。

## GitHub Pages 更新

先备份数据，解压 ZIP，将网站文件（含 `app.js`、`i18n.js`、`index.html`、`sw.js` 及 `vendor` 文件夹）上传至当前 GitHub Pages 仓库根目录，覆盖旧文件。确保页面版本为 V1.3.12。手机如缓存旧版可刷新或关闭重新打开，**不要清除网站数据**。云端 SQL 无需修改，但如使用 Supabase，仍请依原流程验证同步。

---

# V1.3.10 更新：扫码页快速切换 Racking / Row

原有 ERP 导入及完整盘点规则保持 V1.3.9 不变；**新增扫码页快速切换手动 Racking 和 Row**，不用返回 ERP 导入页面操作。

## 操作

1. 首先到「ERP 导入」上传 ERP 报表，并在「Actual Stock Location」确认 Warehouse (如 A001)、Location (如 2A1-01)、Racking (如 R01)、Row (如 01)。
2. 进入「扫码盘点」，五项统计卡下面新增「快速切换 Racking / Row」卡片。扫描首批标签。
3. 同一 Warehouse / Location 换到 R02 / 02 时，在扫码页直接将 Racking 改为 `R02`、Row 改为 `02`，点击「确认切换 / Confirm Switch」后继续扫码。
4. 确认后「ERP 导入」页面的手动栏位同步更新，扫描记录和 Excel 每笔都保留扫描当时的 Racking / Row；**过去记录不改变**。

## 防错机制

- 快速切换**只能更改 Racking 和 Row**，不能改变已确认的 Warehouse / Location 或自动确认 ERP 位置。
- 修改快速切换输入框后、按下「确认切换」前，系统会阻止新的扫描（包含相机和云端扫描）；如相机正在扫描，则停止相机以避免误入旧 Racking。
- 如果 ERP 导入页面 Warehouse / Location 有尚未确认的修改，则必须先返回该页面确认，不能通过快速切换绕过。
- 若有待人工选择的 ERP 库存项目，请先确认或取消，然后切换 Racking / Row。
- 新 Racking / Row 仅是现场备注，**不参与 ERP 单笔数量、料号、批号及实际位置比对**，也不会改变重量或去重规则。
- 不需要更改 Supabase SQL（位置备注已包含在扫描 payload JSON）。本机模式旧数据会保留，云端模式仍需已有正确 Supabase 配置。

## 部署

解压 ZIP 并将所有网站文件（含 `app.js`, `index.html`, `i18n.js`, `sw.js`、`vendor` 文件夹）上传至 GitHub Pages Repository 根目录并覆盖旧文件。完成部署后检查页头 **V1.3.10**。更新前建议备份 Excel/JSON 和云端数据库。手机版如缓存旧版，请重新载入网站，不要清除网站数据。

---

# V1.3.9 更新：Racking / Row 手动备注（不计算）

在「ERP 导入 → ② Actual Stock Location」新增两个**可选**手动输入栏：`Manual Racking` 与 `Manual Row`。两者属于现场位置备注，而不是 ERP / QR 比对字段。

- 输入完成后按「确认当前盘点位置」，之后扫码时自动附在每笔扫描记录中。
- 更改任一手动备注后需重新确认当前盘点位置；更改不会重算旧扫描记录。
- 这两个栏位**不参与**仓库及储位对比、Part No.、Lot No.、净重判断；也不会影响扫描是否成功或数量计入。
- 在「扫描记录」显示两栏；Excel 的 `Reconciliation`、`ScanHistory`、`Exceptions`、`LocationDetails`、`LocationVariance` 和 CSV 增加参考字段；JSON 备份与 Supabase 的扫描 JSON 自动保留。
- Cloud 仍依靠原本的 Supabase `payload jsonb` 存储，无需新增数据库栏位，不需执行 SQL 升级。
- 如果旧记录没有这两个新栏位，显示空白，**不会清除旧资料**。

---

# TMC Warehouse Stock Take V1.3.9 — ERP 单张标签严格匹配

本版根据最新确认规则，**严格禁止累计多张 QR 标签净重来满足一笔 ERP 数量**。

## 本版唯一有效的盘点匹配规则

1. 必须先导入 ERP Excel (.xlsx) 或 CSV。必填 ERP 栏位：**料件编号、品名、仓库、储位、批号、库存数量**。
2. QR 码包含 `Label No. | 仓库 | 储位 | 批号 | 料号 | 净重`。由于 QR **没有品名**，系统通过料号寻找 ERP 品名，并显示在比对和待选择的 ERP 项目中。无法独立核实打印标签的文字品名。
3. 匹配必须同时满足 **ERP 料号对应的品名、批号和该行单笔数量（Net KG）**。数量允许 ±0.001 KG 的浮点表示误差。扫描不同重量的标签，**不计入完成，不能再扫其他标签补重量**。
4. 同料号、同批号和同重量出现在多个 ERP 行（不同储位）时，显示列表让操作员选择。没有确认前不保存有效盘点。
5. **每个 ERP 库存行最多一张有效标签；每个 Label No. 最多有效一次**，防止重复计数。
6. QR 上旧仓库和储位保留作为参考，不影响匹配结果。ERP 与实际仓库/储位不符，仍可在 **品名、批号、单笔数量完全匹配** 后计为完成，同时单独记录位置差异。
7. 历史记录即使过去显示成功，新版也会按照本规则重新认定；**历史标签重量不符合 ERP 单笔数量的记录不再计入有效完成数**。请预先备份，并审查旧扫描。

### 你提供的真实问题示例

- ERP 行：Part `5007803105001`，品名 `S-Silicon w/PM on Tape(Roll)`，Lot `S2618`，库存 `378.600 KG`。
- 扫描标签：Label `008856`，Part 相同，Lot 相同，但 Net `361.100 KG`。
- **正确结果：数量不符（-17.500 KG），未完成，已保存异常扫描记录；不允许追加 17.500 KG 凑成 378.600 KG。**
- 扫到一个不同的 Label，净重恰好 `378.600 KG`，该 ERP 行尚未完成且无其他匹配歧义时，才算完成。

## 页面结构（保留 V1.3.7）

- **同步**：连接 Supabase；电脑上传 ERP、手机扫描可共享数据（需自行完成 Supabase 配置）。
- **ERP 导入**：Excel/CSV 导入和栏位对应，实际仓库/储位、报表下载、JSON 备份。
- **扫码盘点**：五张统计卡、QR 扫描、ERP 盘点比对。
- **扫描记录**：有效盘点/数量异常/重复/旧记录待复核。
- **声音设置**：清脆、扫码枪、柔和提示音及音量。

Excel 直接导出为单一 `.xlsx`，仍含 7 张工作表；料号文本格式、状态颜色及实际储位匹配保留。Excel 的 ScanHistory 和 Exceptions 会说明数量比对是否匹配，供复盘。

## GitHub Pages 更新

1. 从旧版导出 JSON 和 Excel 备份。使用云端时也应备份 Supabase 数据。
2. 解压完整 ZIP，把**解压后的文件和 vendor 目录**上传到原先 `tmc-stock-take.github.io` Repository 根目录；覆盖同名文件，不要只上传 ZIP。
3. 提交后检查 GitHub Actions 的 Pages 部署为绿色成功，打开网站确认版本 **V1.3.9**。
4. 手机 PWA 旧版可能暂时被 Service Worker 缓存。关闭并重新打开或刷新页面，**不要直接清除网站数据**。
5. 此版沿用既有 Supabase 状态 `mismatch` 来记录数量不符；**已配置 V1.3.2 或以上数据库时无需新 SQL**。首次使用云端仍要按内附 `supabase_schema.sql` 建表。服务端尚未在用户自己的 Supabase 项目中做联机验收。

说明：扫码 QR 的 Net KG 为**标签登记重量**，不是现场实物重新过磅的独立证据。数量不符需要人工核查。


## V1.3.17 更新说明

- 对六段以 `|` 分隔，且最后净重符合 `190.300` 这样的三位小数格式的 QR 标签：收到完整第六段的最后一个字符时立即自动提交（0ms 计时等待）。
- 扫描枪发出 Enter 时立即确认，仍支持绿色按钮手动确认。
- 对非三位小数或其他非标准 QR 格式，不进行可能过早的自动判断，请设置扫描枪的 Enter 后缀；没有结束标记无法保证在任意内容末尾即刻判断完成。
- 没有修改 ERP 匹配规则、扫描数据结构、Supabase、Excel 导出或数据库。


## V1.3.23 — English language fixes
- English mode: localized footer, multiple warehouse placeholder, ERP verification failure detail, and dynamic scan notices.
- Chinese mode unchanged; imported ERP values are not translated.
- Stock take validation, QR recognition, sorting, Supabase and Excel data logic unchanged.
- No Supabase SQL changes required.

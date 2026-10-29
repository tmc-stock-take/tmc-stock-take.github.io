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

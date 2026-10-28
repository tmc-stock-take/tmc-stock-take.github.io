# TMC Warehouse Stock Take V1.1.1 — 已换成你选的蓝色扫码图标

这是 **V1.1 盘点系统的图标更新版**。保留 ERP 导入、QR 扫描、实际仓库/储位三方比对、盘点记录及导出功能；本次只更新 App/浏览器图标和静态资源版本。

## GitHub Pages 更新方式（无需新建 Repository）

1. 将本 ZIP **解压**，打开你现有的 `tmc-stock-take.github.io` Repository 的 **Code** 页面。
2. 选择 `Add file → Upload files`，上传解压后的所有文件及 `vendor` 文件夹，覆盖现有文件。
3. 点击 `Commit changes`。GitHub Pages 会从 `main / (root)` 重新部署。
4. 在网站按 `Ctrl+F5` 或重新打开网页。若 Android 主屏幕图标仍是旧图标，可先移除旧的主屏幕快捷方式，再从 Chrome 重新安装；**请不要清除网站数据或重置盘点资料**。
5. 网站的实际网址请以 GitHub `Settings → Pages` 显示的 **Your site is live at** 为准。

## 图标文件

- `icon-192.png`、`icon-512.png`：Android / PWA App 图标。
- `icon-maskable-512.png`：适配 Android 自适应图标。
- `apple-touch-icon.png`：iPhone 主屏幕图标。
- `favicon-64.png`：浏览器标签页图标。
- `icon.svg`：为兼容旧文件引用，同时更新为同款图标。

---

# TMC Warehouse Stock Take V1.1 — 三方盘点系统

本版本是独立的本地存储网页 App，可直接上传至 GitHub Pages（不影响原有 `tmc-qr-scanner` 项目）。

## V1.1 新增：ERP × QR 标签 × 实际仓库/储位

1. **① 导入 ERP 报表**：Excel `.xlsx` 或 `.csv`，确认自动检测的料号、品名、规格、仓库、储位、批号、库存数量、单位栏位。
2. **② 确认实际盘点位置**：输入 `Actual Warehouse`、`Actual Racking No.`（例如 `L002`、`3A1-113`），点击「确认当前盘点位置」。不确认或输入已改动时不能扫描。
3. **③ 扫描 QR 标签**：连续扫描同一个实物储位的多张标签，不必重复输入仓库/储位；换储位时重新输入并确认。支持 Android Chrome 相机（浏览器需 BarcodeDetector API）、二维扫码枪、手动输入和照片（浏览器支持时）。
4. 盘点系统会比较三个位置来源：ERP 报表、QR 标签和刚刚**人工确认的实际存放位置**。三者仓库和储位都一致，才判定 `MATCH` 并累计净重。相同 Label No. 不会重复计重。
5. 存在差异时，界面显示三栏对照、原因及对应 Label No.；异常扫描不计入三方匹配重量，不会自动修改 ERP。
6. **④ 盘点比对**显示 ERP 数量、匹配扫描净重、数量差异；**⑤ 扫描记录**同时显示标签、实际和 ERP 的仓库/储位，以及异常说明。
7. Excel 导出包括五个工作表：`Summary`、`Reconciliation`、`ScanHistory`、`Exceptions`、`ActualLocations`；后一个表汇总实物储位的扫描净重和异常重量。CSV 则导出库存比对与该 ERP 行关联的异常实际位置。
8. 使用 JSON 备份/恢复可在设备之间转移记录，但**没有自动云同步**。

## 你的示例

ERP：料号 `5899951013108`，批号 `20260617`，仓库 `L002`，储位 `3A1-113`，重量 `190.300 KG`。

标签二维码：`NO.009998|L002|3A1-113|20260617|5899951013108|190.300`

- 实际位置 **L002 / 3A1-113**：三方 MATCH，190.300 KG 可以计入盘点。
- 实际位置 **L002 / 3A1-115**：ERP/QR 均为 3A1-113，实际为 3A1-115；提示储位异常，190.300 KG 不计入 MATCH。
- 实际位置 **L003 / 3A1-115**：ERP/QR 均为 L002 / 3A1-113；同时提示仓库与储位异常。
- 如果同料号/批号在 ERP 具有多项不同仓库或储位，而标签及实物位置指向不同 ERP 行，系统显示「ERP 多位置」，不会随意归入其中一个 ERP 项目。

**注意**：输入的“实际位置”由盘点人员确认，程序不会通过 QR 读出货物真正所在位置；所以必须在货架现场核实后填写。扫码标签上没有储位变化的信息时，单靠标签也无法判断货物是否被移动。

## 旧版本升级（非常重要）

- 直接将 V1.1 的文件上传覆盖同一个 GitHub Pages 仓库中的旧程序文件；不用删除库存资料。
- 既有 ERP 导入数据可保留（相同浏览器、相同网站地址、未清理站点数据的前提下）。
- **V1.0 扫描历史没有实际位置字段**，因此旧版 MATCH 将自动转成「旧版待复盘」，保留历史但不计入 V1.1 的三方 MATCH 净重。请按实际储位重新扫描对应标签。这样不会把旧纪录误认为已经核对过真实位置。
- 新版缓存名已更换，网页更新后刷新或完全关闭重开 PWA。如果手机仍见旧版本，可清除网站缓存（不要清除网站储存资料，避免盘点记录丢失），并以网页版本文字 V1.1 确认。

## GitHub Pages 部署

1. 下载 ZIP 并解压。
2. 打开独立的 GitHub 仓库（建议 `tmc-stock-take`），上传根目录中的 `index.html`、`app.js`、`sw.js`、`manifest.webmanifest`、`icon.svg`、`vendor` 文件夹。
3. Settings → Pages → Deploy from a branch → main → /(root) → Save。
4. 等待 GitHub Pages 发布后以 HTTPS 网址打开；首次使用相机需授权。添加到 Android 主屏幕可作为 PWA 使用。

## 技术限制

- ERP / 实盘数量按 KG 处理，误差 ±0.001 KG。非 KG 单位不做单位换算。
- QR 预期包含六项：`Label | Warehouse | Location | Lot | Part | Net`，会自动去除 `NO.` 标记。
- 品名/规格不会自动与 QR 匹配，因为该 QR 码不包含这两项。
- Excel 如果把长料号**有损舍入**为科学计数法，可能不可逆；建议从 ERP 导出原始 XLSX，或保留料号为文本。
- 相机功能依赖手机浏览器 `BarcodeDetector`；不支持时建议使用 USB/蓝牙二维扫码枪或手动输入。
- 所有库存和盘点记录保存在当前设备本地浏览器，默认不发送至云端；每次盘点后请下载 Excel 与 JSON 备份。
- V1.1 不允许扫描异常位置的重量进入账面匹配数，但仍可通过 `ActualLocations` 工作表回顾扫描到的实物重量。

## 文件说明

- `index.html` 页面和样式
- `app.js` 报表导入、三方比对、扫码、防重复、导出与本地储存
- `vendor/jszip.min.js` 离线 Excel ZIP 读取/生成依赖
- `sw.js` 离线资源缓存
- `manifest.webmanifest` 与 `icon.svg` PWA 图标/元数据
- `示例ERP报表.csv` 演示 ERP 资料
- `THIRD_PARTY_LICENSES.md` 第三方组件许可

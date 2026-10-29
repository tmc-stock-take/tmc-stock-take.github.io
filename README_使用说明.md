# TMC Warehouse Stock Take V1.3.1 — 电脑 ↔ 手机实时同步 / PC ↔ Phone Realtime Sync

> **重要**：这是可部署的完整 V1.3.1 程序和 Supabase 数据库建库文件，但**在您自己创建并配置 Supabase 项目之前，手机/电脑不会自动同步**。没有配置时，仍可使用原有 V1.2 本机盘点功能。

## V1.3.1 新增

- **云端同步 / Cloud Sync**：电脑和 Android 手机使用相同邮箱账号登录，读取同一份 ERP 库存报表、扫描历史与差异汇总。
- **实时提示 / Live updates**：Supabase Realtime 接收变更，另外每 15 秒刷新以应对断线或后台休眠。
- **数据防重复 / No double counting**：数据库约束使同一盘点任务内相同 Label No. 只能有一笔有效 MATCH；重复会保存为异常记录，不重复加重。
- **严格三方比对 / Three-way reconciliation**：ERP 仓库/储位 × QR 标签仓库/储位 × 实际确认仓库/储位，三方一致才计重。
- **联网才提交 / Online writes**：网络断开、登录过期或保存失败，会显示「未保存」，必须重新扫描；不会冒充同步成功。
- **保留本机模式 / Local mode preserved**：旧 V1.2 IndexedDB 数据不会被偷偷上传云端；退出云端可继续访问原本本机记录。建议升级前先导出 JSON 备份。
- **中英文 / Chinese + English**，原先的蓝色扫码枪图标保持不变。


## V1.3.1 — 一个标签对应多个实际储位 / Multiple Actual Racking Locations

在 **Actual Racking No.** 中可以输入 `2A1, 2A1-01, 2A1-02`，以逗号、分号或换行分隔，点击 **确认当前盘点位置** 后再扫 QR。系统将这三个储位作为同一张标签的「实际占用位置清单」保存，并提供 ERP/QR 位置是否包含其中的独立检查结果。储位编号仅做**精确匹配**，例如 `2A1` 不会误判与 `2A1-01` 相同。

例子：ERP 是 `A001 / 2A1-01`；QR 是 `B000 / 51430`；实际仓库是 `A001`，实际储位是 `2A1, 2A1-01, 2A1-02`。系统显示：ERP 储位存在于实际清单、QR 储位不存在、两个额外储位、QR 仓库和 ERP/实际仓库不一致；**整笔记为位置异常，不计入有效 ERP 盘点重量**。仓库人员需人工调查实际占用/标签/ERP 的差异。即使其中一个储位匹配 ERP，其他实际储位也不会被自动忽略。

**重量安全规则**：一张 Label No. 净重只保留一次，不因输入多个实际储位而重复计算。Excel 的 `ScanHistory`、`Exceptions` 会展示全部实际位置和检查标志，`ActualLocations` 将多位置作为**一个位置组**汇总重量；新增 `LocationDetails` 为每个位置单独列明，但**不分配/重复写入同一标签的净重**。原有单储位记录仍可读取。

English: enter multiple occupied racks separated by commas, semicolons or line breaks, then confirm the location group. The comparison checks each rack code exactly and reports mismatches/extra positions without assuming a match or distributing the label's net weight across racks.

### 可复制测试资料 / Quick Test

- 先导入附带的 `示例_多储位ERP报表.csv`。
- 实际 Warehouse：`A001`，实际 Racking No.：`2A1, 2A1-01, 2A1-02`；点击确认整组位置。
- 手动扫描 QR 内容：`NO.009998|B000|51430|20260617|5899951013108|190.300`。
- 预期：`LOCATION MISMATCH`，ERP 实际存在 `YES`，QR 实际存在 `NO`，额外位置 `2A1` / `2A1-02`；有效盘点重量 `0 KG`，异常实物重量记录 `190.300 KG` 且只计一次。
- 重复扫描相同 Label No. 显示重复记录，净重不重复；切换到单储位 `2A1-01` 并扫描全新 Label No. 且 QR `A001 / 2A1-01`，则可正常 MATCH。

## A. 创建 Supabase 云端数据库（首次设置）

1. 到 https://supabase.com/dashboard 创建账号及 **New project**，选择您获授权使用的组织/项目及适当地区。Supabase 是第三方云端服务；使用前应遵守公司内部数据保护要求。
2. 项目准备好后，进入 **SQL Editor → New query**，打开压缩包中的 **`supabase_schema.sql`**，完整复制 SQL，点击 **Run**。仅需对新项目执行一次。该脚本创建 `stocktake_batches`、`stocktake_scans`、各项索引、唯一标签约束、Row Level Security（仅本人可访问）及 Realtime 数据表发布。
3. 进入 **Authentication → Providers → Email**，确认 Email/Password 已开启。若开启 Email confirmation，注册后需先点收件箱的验证链接。**Authentication → URL Configuration**：Site URL 设为 `https://tmc-stock-take.github.io/`，可把此地址加入 Redirect URLs。
4. 在 Supabase 项目 **Connect** 或 **Project Settings → API Keys** 取得 **Project URL**（`https://...supabase.co`）以及 **Publishable key**（一般以 `sb_publishable_` 开头；旧项目可用 anon public key）。
5. 在网页版 V1.3.1 的「云端同步」区输入上述 Project URL 与 Publishable Key，点 **连接云端 / Connect**。**不要输入 Secret Key / service_role**；这些密钥不应出现在 GitHub 公共文件或浏览器中。
6. 如果想让公司电脑及手机无需分别输入 URL/key，可将 ZIP 中 `cloud-config.js` 填上 **公开的** Project URL 和 Publishable Key 后上传；请绝对不要填写管理员/secret/service_role 密钥。

## B. 发布至原来的 GitHub Pages

1. 在旧版本中先 **↓ JSON 备份**，再下载并解压这个 ZIP。
2. 进入 GitHub Repository：`https://github.com/tmc-stock-take/tmc-stock-take.github.io`。
3. **Add file → Upload files**，把 ZIP 解压后的网站文件上传到 Repository 根目录（尤其 `index.html`、`app.js`、`i18n.js`、`cloud.js`、`cloud-config.js`、`sw.js`、`vendor/jszip.min.js` 和图标），覆盖旧版，再 **Commit changes**。
4. **Settings → Pages** 选择 `Deploy from a branch` → `main` → `/(root)`；**Actions** 中确认 Pages 部署成功。
5. 使用 `https://tmc-stock-take.github.io/` 打开网站，左上角应显示 **V1.3.1**。旧 PWA 不刷新时关闭旧 App，使用 Chrome 重新访问并刷新；**不要清除浏览器数据**。

> `supabase_schema.sql` 和本说明可以保留在 ZIP 及 Repository；里面没有 API 密钥。**不要将实际 ERP 报表、库存清单或 JSON 备份上传到 Public GitHub Repository。**

## C. 实际盘点流程

1. **电脑端**：在网站云端区注册/登录账户 → 上传 ERP Excel/CSV → 确认字段 → 点击「确认导入报表」。出现「云端 ERP 报表已导入」才算成功。
2. **Android 手机端**：打开同一个网站 → 云端区填写相同 Project URL / Publishable Key（若未预配置）→ 用**同一个邮箱账户**登录。应能看到电脑上传的 ERP 报表。
3. 手机先输入并确认 **Actual Warehouse** 与 **Actual Racking No.**，再扫描物料 QR。显示 **MATCH** 才能计入有效重量。
4. 电脑端无需重新上传 ERP；可观察扫描记录、异常和重量在 Realtime 通知后更新，后台睡眠或断线恢复时最长可等待下一次 15 秒检查，也可按云端区 **↻ Refresh**。
5. 电脑端可导出 Excel，包括 **Summary、Reconciliation、ScanHistory、Exceptions、ActualLocations**；也可以 JSON 备份。

## 重要限制及保安

- **同一账号**：V1.3 采用一个云端账号在电脑/手机登录的同步模式。**不包含**多员工独立账号的共用任务、审批及分级权限；若要让不同员工分别登录且共同盘点，需要后续新增公司团队/成员管理。不要把公司账号密码任意分享。
- **云端要联网**：本机模式仍可离线使用；云端模式**不支持离线排队后自动上传**，断网时须联网后重扫，避免误以为成功。
- **公司资料**：上传到 Supabase 的数据由第三方云服务托管，可能涉及公司库存、货品、储位和重量，使用前请确认公司许可。GitHub Pages 只放网站程序，不存放 ERP 原始 Excel 文件；实际盘点数据库的库存记录与扫描记录保存在 Supabase。
- **访问控制**：SQL 使用 Auth + RLS，只允许登录账户访问其自己的记录；所有设备务必使用经授权的账号，启用设备锁屏和强密码。公开的 Publishable/anon Key 本身不是密码，安全主要依赖用户身份验证与 RLS。
- **一次仅查看最新任务**：上传新的 ERP 报表创建新云端任务，旧任务会保留在数据库但 V1.3 界面只显示最新一份。清空全部云端盘点会删除该账号下全部任务与历史；该操作需要二次确认。
- **测试程度**：本地功能、语言切换及模拟 Supabase 保存/查重流程已测试。尚未使用您的实际 Supabase 凭据进行跨设备端到端测试；正式上线前请先用示例 ERP 报表和示例 Label 009998 做实际联机验收。

---

# English Quick Start

1. Create your own Supabase project and run **`supabase_schema.sql`** in SQL Editor.
2. Enable Email/Password in Authentication, set site/redirect URL to `https://tmc-stock-take.github.io/`.
3. In the app, enter your Supabase Project URL and **public publishable/anon key**. Never enter any secret/service_role key.
4. Create/sign in to an authorized email account. On the PC, import the ERP report. On Android, sign in using **the same account**, confirm the physical warehouse and racking number, then scan printed QR labels.
5. The PC should receive scan updates live and also refreshes periodically as a backup. Duplicate valid labels are blocked from double counting at the database level.
6. This release does **not** include multi-employee role sharing or offline cloud upload. Data already stored in V1.2 local mode is not automatically uploaded.

Supabase official guidance: https://supabase.com/docs/guides/database/postgres/row-level-security and https://supabase.com/docs/guides/realtime/postgres-changes

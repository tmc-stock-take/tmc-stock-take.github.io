# TMC Warehouse Stock Take V1.3.2 — 取消 QR 位置比对 + 扫码提示音

这是一份完整可部署到 GitHub Pages 的网页/PWA 程序，包含中文与英文、ERP Excel/CSV 导入、手机/扫码枪扫描、多个实际储位、ERP 与实际位置差异、Excel 报表，以及可选的 Supabase 电脑↔手机同步。

## V1.3.2 核心规则

1. 扫描 QR 标签，从中读取 **Label No.、Part No.、Lot No.、Net Weight (KG)** 进行物料识别和重量累计。原 QR 标签上的 **Warehouse 和 Location 完全不参与库存匹配及位置判断**，但保存在扫描历史作参考，不要求改标签。
2. 以 **Part No. + Lot No.** 在 ERP 查找物料；如 ERP 有多笔相同料号/批号，先用实际仓库和实际位置锁定唯一 ERP 行。**如果无法唯一确认，标记 Ambiguous（待核对），不会胡乱计重**。
3. 当料号/批号能唯一对应 ERP 行，并由操作员确认实物确实存在时：即使 ERP 仓库或储位和实物不符，仍计入**已盘点 COUNTED**，同时记录 **ERP LOCATION VARIANCE**，不修改 ERP 原始库存。
4. 实际位置允许输入 `2A1, 2A1-01, 2A1-02` 多个储位：保存整组位置，只计一次标签净重，并标记 **COUNTED · MULTIPLE LOCATIONS** 待确认精确位置；**这不是把重量拆成三份，也不意味着每一储位各有一份标签重量**。
5. 相同 Label No. 如果已有有效盘点（包括位置差异和多储位），重扫标记 **DUPLICATE**，不得重复累计。旧 V1.3.1 的 `mismatch` 扫描记录**不会自动转成已盘点**；为避免误转换历史记录，需要核查后重新扫描该标签（可在新规则下正常计重）。
6. QR 标签上的 Net Weight 是**标签声明重量**，并非实物过磅证明；实际称重不符仍须人工核查。盘点重量按标签记录累计，比对 ERP 行的库存数量，超量显示差异。

### 测试例子

- ERP：`A001 / 2A1-01`，Part `5899951013108`、Lot `20260617`、ERP Qty `190.300 KG`
- QR：`NO.009998|B000|51430|20260617|5899951013108|190.300`
- 实际 `A001 / 2A1-01`：**COUNTED**，190.300 KG 已计入；QR B000/51430 不影响。
- 实际 `A001 / 2A1-02`：**COUNTED · LOCATION VARIANCE**，190.300 KG 已计入，另列 ERP 储位差异。
- 实际 `A001 / 2A1, 2A1-01, 2A1-02`：**COUNTED · MULTIPLE LOCATIONS**，190.300 KG 只计一次，实际精确储位待确认。

## 扫描“哔”声 / Beep Sound

扫码栏上方新增“扫码提示音 / Beep sound”开关和“♫ 试听 / Test”按钮。首次使用可先点击“试听”；扫码成功播放一次较高音短“哔”，已盘点但位置差异/多储位播放双声提醒，重复标签播放双次低音，格式/资料异常播放更低的警示音。关掉后会记住该设备的选择。手机静音、媒体音量设定或浏览器自动播放限制可能使提示音无法听到；请确认设备媒体音量并先在网页上点击一次按钮。没有外部声音文件，音效通过浏览器 Web Audio 在设备本地生成。

## Excel 报表

- **Reconciliation**：每笔 ERP 库存数量、已盘点总重量与差异（包含位置差异计重）。
- **LocationVariance**：已盘点但 ERP 仓库/储位不同，或实际多个储位待确认的记录，供之后调整 ERP。
- **ScanHistory**：每张标签及其 QR 旧仓库/储位、实际仓库/储位、ERP 仓库/储位与重量；QR 栏明确注明不参与比对。
- **Exceptions**：需要调查的记录（包含已盘点但位置待查、重复标签、ERP 无匹配等）。
- **ActualLocations / LocationDetails**：以储位组汇总并展示完整多个实际储位；不按储位重复加标签重量。

## 上传 GitHub Pages

1. **升级前在旧版网页先下载 JSON 备份及 Excel**（本机模式）。不要清除 Chrome/Android 浏览器网站数据。
2. 下载 V1.3.2 ZIP，解压后把网站文件及 `vendor` 文件夹上传覆盖到公司 Repository 根目录（`index.html` 必须在根目录）：https://github.com/tmc-stock-take/tmc-stock-take.github.io
3. GitHub → **Add file → Upload files → Commit changes**。确认 `sound.js` 同步上传。GitHub Pages 设置维持 **Deploy from a branch → main → /(root)**。
4. 新版首次加载应出现 **V1.3.2**；手机如有旧版缓存，请关闭 App 后在 Chrome 刷新网页，或重新添加主屏幕快捷方式。勿清除网站数据。

## Supabase 云端同步（重要：需更新 SQL）

- **新建数据库**：在 Supabase 项目 SQL Editor 执行 `supabase_schema.sql`。
- **以前已配置 V1.3/V1.3.1 Supabase 数据库**：先备份数据，再在 SQL Editor 执行包内 **`supabase_upgrade_v132.sql`**，为 `counted_variance` 和 `counted_multi` 增加合法状态，并扩展 Label No. 的云端唯一限制。**单纯覆盖 GitHub 网站文件不足以完成云端升级**。
- 电脑和手机仍须配置 Supabase Project URL + **公开** publishable/anon key、登录同一已授权账号，才能看到同一份报表和扫码记录。不可在客户端填写 Supabase service_role / secret key。
- 无云端配置时仍是本机模式：不同设备**不会自动同步**。
- 云端需要网络，保存失败会提示重新扫描；断网不会把未保存记录标为成功。推荐先用示例数据在手机/电脑验证，然后再投入正式盘点。
- GitHub Public 仓库仅上传网站程序，**不要上传真实 ERP 报表、库存数据、JSON 备份、公司账号密码**。向 Supabase 上传库存资料前需确认公司允许使用第三方托管服务。
- 这版仍是同一云端账号跨设备使用，暂未实施各员工独立账号的共用盘点任务权限。

> 注意：旧版 `mismatch` 不自动回算重量。需要审核历史扫描并重新扫描，以免不经核实就把旧异常批量转为有效盘点。

## English quick guide

V1.3.2 uses QR **Part No. + Lot No. + Net KG** to identify/count an item. QR warehouse/rack codes are *historical references only* and never used for matching. Count uniquely identifiable items even when ERP location differs, but add a **Location Variance** follow-up report; multiple actual rack locations are grouped without allocating/repeating weight. The new sound toggle plays a short beep for a successful scan and distinctive warning tones for duplicates or exceptions.

For cloud mode, existing V1.3/V1.3.1 Supabase installations **must run `supabase_upgrade_v132.sql` in SQL Editor** before using new statuses. Real-device cloud synchronization requires your own Supabase credentials; only simulated cloud tests were run here.

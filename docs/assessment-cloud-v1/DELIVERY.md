# 职业六芒星云端存档 V1.0 第一期交付

状态：隔离存储是环境里的 PostgreSQL 表 `assessment_reports_dev`。操作者已用合成数据打通 CloudBase 闭环。本代理没有执行 `tcb deploy`，没有合并 `main`，没有创建飞书表，没有把飞书改成 `live`。上线前清单见 `ACCEPTANCE.md`。

## 1. 已完成功能

职业六芒星在原结果页下方增加一块可选同意。不勾选时不发请求，题目、划词、结果图、本机历史和导出图片保持原样。

勾选后可以：

- 把这一次的两组词、三句说明和昵称写成结构化报告
- 用同一个 `clientSubmissionId` 重试，不产生第二份
- 生成 `reportId` 与分享秘密分开的 H5 链接，秘密只放在 hash
- 换一份页面凭链接读回同一组词
- 在作答设备上撤销；撤销后只显示失效页
- 断网时结果页仍在，队列保留同一次提交，恢复后可再试
- 管理员接口在集成密钥和链接秘密都正确时读取全文；人工填写客户 ID 后，只把「客户归档状态」改为已归档，不按昵称合并，不改客户事实字段

飞书镜像按下面的字段写好了，默认关闭。`mock` 模式只写在进程内存里。真实写入器按「报告 ID」先查再更新，没有记录才新建。CloudBase 已写入、飞书写入失败时，报告标成「待重试」；受保护的补偿入口可以再试，成功后同一报告 ID 仍只有一行。这一轮线上保持 `off`。

六芒星没有分数。维度是 `kind: "category"`，`score` 为 `null`。

## 2. 修改文件、分支与 PR

分支：`cursor/star-cloud-archive-v1-46b1`

只动了职业六芒星的挂点和新增的共享文件。没有改 `star/js/data.js` 的词表，没有改计分文件，没有改首页卡片和其他 12 个测评入口。

| 路径 | 作用 |
|---|---|
| `star/js/app.js`、`star/index.html` | 结果页挂上云端块，不改划词和本机保存 |
| `star/js/cloud-payload.js` | 把当前六芒星收成协议对象 |
| `js/cloud-kit.js`、`js/cloud-client.mjs` | 同意、队列、提交、复制、撤销 |
| `js/report-render.js`、`js/report-page.js`、`r/index.html` | 独立阅读页 |
| `cloud/assessment-report/` | 隔离 HTTP 服务。本地默认内存库；云上写入 PostgreSQL 表。飞书默认关闭 |
| `tools/asva-import-preview.html` | 本地导入原型，不进首页 |
| `docs/assessment-cloud-v1/` | 本说明、协议 schema、飞书权限、真机验收、上线回滚、验收清单 |

## 3. PostgreSQL 表与隔离

环境 `root-journey-prod-d4d7pzd0a8f805` 是个人版 PostgreSQL。隔离数据放在 SQL 表 `assessment_reports_dev`。代码拒绝 `assessment_reports` 以及其他不以 `assessment_reports_dev` 开头的表名。

HTTP 函数名：`assessmentReportDev`，路径与现有 `/asva-api` 分开。

文档字段（服务端信封，不返回给普通阅读页）：

| 字段 | 含义 |
|---|---|
| `reportId` | 主键。客户端生成，服务端保证同一提交号不插第二份 |
| `sourceSubmissionId` | `clientSubmissionId`，幂等键 |
| `bodyHash`、`linkSecretHash`、`ownerSecretHash` | 只存哈希。分享秘密和作废口令的原文不入库 |
| `byteSize` | 协议 JSON 的 UTF-8 字节数 |
| `shareStatus` | `active` / `revoked`。对应飞书「报告状态」 |
| `archiveStatus` | `未归档` / `已归档`。撤销不会改它 |
| `customerId` | 人工确认后才写入，可空 |
| `feishuSync` | `off` / `已同步` / `待重试` / `失败`。以这份文档为准 |
| `payload` | AssessmentResult V1。含 `extensionData.consent` 与 `extensionData.share` |

`payload` 至少包含：`reportId`、`assessmentId`、`assessmentVersion`、`nickname`、`completedAt`、`result`、`dimensions`、`interpretation`、`recommendations`、`reportContent`、`source`、`schemaVersion`。同意在 `extensionData.consent`，分享状态在 `extensionData.share.status`。

表结构：`report_id` 主键，`source_submission_id` 唯一索引，`doc` 为 jsonb，里面是上面的整份服务端文档。云函数优先用 `@cloudbase/node-sdk` 的 `rdb()` 读写。PostgREST 不能建表，所以部署前要在控制台「SQL 数据库」执行：

```sql
CREATE TABLE IF NOT EXISTS assessment_reports_dev (
  report_id text PRIMARY KEY,
  source_submission_id text NOT NULL,
  doc jsonb NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS assessment_reports_dev_source_submission_id_uidx
  ON assessment_reports_dev (source_submission_id);
```

若函数环境变量里有 `ASSESSMENT_PG_URL`，启动时会执行同一段语句。

`createCloudBaseStore` 只在同时满足下面两项时连接：

- `ASSESSMENT_STORE_DRIVER=postgres`（`cloudbase` 仍接受，健康检查里的 `store` 都是 `postgres`）
- `ASSESSMENT_CLOUDBASE_WRITE_CONFIRM=dev-isolated`

本地 `node cloud/assessment-report/local-server.mjs` 默认仍是内存库。部署入口另外要求 `ASSESSMENT_DEPLOY_CONFIRM=dev-isolated`。确认之后如果不是 PostgreSQL 驱动，进程退出。`FEISHU_INDEX_MODE=live` 同样拒绝启动。

健康检查返回真实 `store`（`memory` 或 `postgres`）。`deployed` 只在部署确认开关为 `dev-isolated` 时为 true。`collection` 字段是表名。

云函数在平台注入了临时身份时，`rdb()` 不需要额外密钥。若启动日志是鉴权失败，在函数环境变量设置 `CLOUDBASE_APIKEY`（控制台生成的 API Key）。不要写进 Git，也不要写进 `cloudbaserc.json`。`rdb()` 仍不可用时，再设 `ASSESSMENT_PG_URL` 为 SQL 数据库连接串，同样只放环境变量。

2026-10-19 的只读探测仍然有效：`GET /asva-api/api/health` 是生产服务，本轮没有调用它的写接口，也没有改这个函数。

### 部署环境变量

| 变量 | 值 |
|---|---|
| `ASSESSMENT_COLLECTION` | `assessment_reports_dev` |
| `ASSESSMENT_STORE_DRIVER` | `postgres` |
| `ASSESSMENT_CLOUDBASE_WRITE_CONFIRM` | `dev-isolated` |
| `ASSESSMENT_DEPLOY_CONFIRM` | `dev-isolated` |
| `FEISHU_INDEX_MODE` | `off` |
| `PUBLIC_REPORT_BASE` | `https://xiangshu3721.github.io/mindtest-web/r/` |

函数名 `assessmentReportDev`，内存 256 MB，超时 60 秒，最小实例 0，HTTP 路径 `/assessment-report-dev`。同一份非密钥配置在 `cloud/assessment-report/cloudbaserc.json`。

公开地址：

```text
https://root-journey-prod-d4d7pzd0a8f805-1304965105.ap-shanghai.app.tcloudbase.com/assessment-report-dev
```

建议命令（在 Mac 上执行，先 `npm install`）：

```bash
git fetch origin cursor/star-cloud-archive-v1-46b1
git checkout cursor/star-cloud-archive-v1-46b1
cd cloud/assessment-report
npm install
tcb login
tcb fn deploy assessmentReportDev --httpFn --path /assessment-report-dev --dir . \
  --runtime Nodejs20.19 --timeout 60 --memory 256 --install-dependency false
```

### 合成 curl

`GET /assessment-report-dev/health` 应返回 `store: "postgres"`、`deployed: true`、`feishu: "off"`、`collection: "assessment_reports_dev"`。

然后对 `/assessment-report-dev/v1/results`、`/v1/results/read`、`/v1/results/revoke` 做一轮合成数据（提交、同一份再提交、另一份正文撞同一提交号得到 409、读取、撤销、再读得到 410 且正文没有词）。完整命令和生成合成 JSON 的脚本在 `cloud/assessment-report/DEPLOY.md`。

跨请求持久化：留下一份未撤销的报告，在 SQL 数据库里能查到它的 `report_id` 之后，等实例缩到 0 或重新部署，再读同一 `reportId`。仍返回 200 和同一组词，才说明行在 PostgreSQL 里。内存库在新进程上这次读取会是 404。

`js/assessment-cloud-config.mjs` 的 `endpoint` 已写成上述基址，没有末尾斜杠。`reportPageBase` 是 `https://xiangshu3721.github.io/mindtest-web/r/`。

## 4. 飞书「ASVA 测评记录」字段（待建表，本轮未创建）

表名：`ASVA 测评记录`。

位置：独立 Base「ASVA 测评数据」。现在还没有用户提供的 Base 链接，也没有 `table_id`。`table_id` 用环境变量 `FEISHU_ASSESSMENT_TABLE_ID`，当前为空。写入开关 `FEISHU_INDEX_MODE` 默认 `off`。

仓库里有可注入的飞书 HTTP writer：按「报告 ID」查询，已有记录就更新第一条，没有记录才新建。`live` 要同时有 `FEISHU_INDEX_LIVE_CONFIRM=YES`、表 ID、应用 ID、应用密钥和 `FEISHU_APP_TOKEN`。缺任何一项时进程拒绝以 live 启动，也不会发请求。凭证不进 Git。这一轮 `cloudbaserc.json` 仍是 `off`，不要在线上改成 `live`。

不使用生活小调查的妙搭 webhook。ASVA 现用飞书应用是 `cli_aaff6cb53db89bd3`（与解忧小屋同一应用）。小调查应用 `cli_aa3e5840a3f89d2b` 不用于测评。

报告 ID 的唯一性由 PostgreSQL 主键 `report_id` 保证，不靠飞书文本字段的唯一属性。

| # | 字段 | 类型 | 空 | 写入来源 |
|---|---|---|---|---|
| 1 | 报告 ID | 文本 | 否 | `reportId` |
| 2 | 客户昵称 | 文本 | 否 | `nickname`，1–12 字 |
| 3 | 测评 ID | 文本 | 否 | `assessmentId` |
| 4 | 测评名称 | 文本 | 否 | `assessmentName` |
| 5 | 完成时间 | 日期时间 | 否 | `completedAt`。真写入时把 ISO 转成飞书毫秒时间戳 |
| 6 | 核心结果摘要 | 文本 | 否 | 结论加摘要，截断到 120 字 |
| 7 | 来源 | 单选或文本 | 否 | 站内合集 / 站外仓。建表时做成单选 |
| 8 | 关联客户 ID | 文本 | 可空 | 人工确认后的 `customer_id` |
| 9 | 报告状态 | 单选 | 否 | 有效 / 已撤销 |
| 10 | 客户归档状态 | 单选 | 否 | 未归档 / 已归档 |
| 11 | 同步状态 | 单选 | 否 | 已同步 / 待重试 / 失败 |
| 12 | 来源导师 ID | 文本 | 可空 | `extensionData.attribution.mentorId` |
| 13 | 来源活动 | 文本 | 可空 | `extensionData.attribution.activity` |
| 14 | 记录版本 | 文本 | 否 | `schemaVersion`，现为 `1.0.0` |
| 15 | 报告字节数 | 数字 | 否 | `byteSize` |
| 16 | 创建时间 | 日期时间 | 否 | 服务端写入时间 |

明确不进这张表：逐题过程、分享秘密、作废口令、完整 JSON、手机号、SCL-90 真实姓名、开放自述。

同步状态以 CloudBase 文档的 `feishuSync` 为准。镜像写失败时，文档仍在，状态变为「待重试」；飞书里可能没有这一行，或还留着旧状态。不能因为飞书没有行，就判断报告没有保存。

报告状态和客户归档状态分开。撤销只把报告状态改为已撤销，归档状态保持原值。归档只在人工指定客户 ID 之后改为已归档，不自动撤销链接。

### 建表前的访问权限

表不放进已有客户资料的 ASVA Base。用户已定为独立 Base「ASVA 测评数据」。隐藏视图只是默认不展示，不算访问控制。谁可管、可编、可阅读，应用如何独占读写，普通协作者为什么不能读和导出，以及用人点一次的验证步骤，写在 `FEISHU_ACL.md`。

在那份清单打勾、并且用户给出 Base 链接之前，不创建「ASVA 测评记录」，不把线上开关改成 `live`。字段形状可以先在本机看，它不会请求飞书：

```bash
node cloud/assessment-report/feishu-synthetic.mjs
```

### 补偿重试

PostgreSQL 写入成功、飞书失败时，文档的 `feishuSync` 是「待重试」。同一提交号再提交会再试一次。另外有 `POST /v1/integrations/feishu/retry`，正文 `{}`。它要健康检查里的 `deployed: true`，还要 `Authorization: Bearer <ASVA_REPORT_IMPORT_KEY>`。缺一项返回 404，响应里没有分享秘密。它只扫「待重试」，成功后按报告 ID 覆盖，不新建第二行。满 8 次标成「失败」的记录不会被这个入口自动再扫。页面不链到这个地址。

真机和微信步骤见 `E2E_BROWSER_WECHAT.md`。上线和回滚见 `GO_LIVE_ROLLBACK.md`。三栏验收见 `ACCEPTANCE.md`。

## 5. H5 测试地址

隔离函数已由操作者部署，合成闭环已通过。公开基址是上面的 `/assessment-report-dev`。GitHub Pages 还没有这份前端：分支未合并，线上作答页还不会调用这个 endpoint。阅读页地址要等发布后才是 `https://xiangshu3721.github.io/mindtest-web/r/#rpt_<id>.<secret>`。未经用户同意不合并、不发布。

本地隔离服务：

```bash
node cloud/assessment-report/local-server.mjs
```

然后打开 `http://127.0.0.1:4173/star/index.html`。同意并生成链接后，地址形如：

```text
http://127.0.0.1:4173/r/#rpt_<id>.<secret>
```

线上页面是 `https://xiangshu3721.github.io/mindtest-web/r/#rpt_<id>.<secret>`。`js/assessment-cloud-config.mjs` 的 `endpoint` 已指向隔离函数 `/assessment-report-dev`，`reportPageBase` 指向上面的 `r/`。微信分享标题使用页面里写死的「ASVA 测评报告」。

## 6. ASVA 导入现状

正确仓库是公开仓 `xiangshu3721/asva-workbench`，默认分支 `master`。线上 API 是：

```text
https://root-journey-prod-d4d7pzd0a8f805-1304965105.ap-shanghai.app.tcloudbase.com/asva-api
```

本轮没有改这个仓库，没有改生产 ASVA。工作台 README 写明导师账号不能登录，导入操作者仍是管理员。

客户原始资料仍应走现有 `SourceRecord`。在该仓确认新的 `source_type` 之前，草稿使用 `IMPORTED_TEXT`，标题以「测评报告」开头。`content_hash` 按 reportId 加协议正文计算，同一客户重复导入返回已有 `source_id`。`linkSecret` 不进入 `raw_text` 或 `notes`。客户事实字段列表保持为空。

本地原型：`tools/asva-import-preview.html`。它调用本仓的管理员读取和归档接口。归档接口只更新隔离库里的「客户归档状态」和关联客户 ID。

以后要在 `asva-workbench` 做的事，不在本轮：

- 客户页增加「从测评报告导入」，粘贴完整链接
- 服务端拿 `ASVA_REPORT_IMPORT_KEY` 调用 `POST /v1/integrations/asva/read`
- 管理员选定客户并确认后写一条 SourceRecord，不覆盖客户字段
- 环境变量只放在 CloudBase，不进前端包
- 按该仓已有纪律，先 Staging，再考虑生产

## 7. 测试结果与遗留

已通过：

```bash
npm test
```

覆盖：ECR、SCL-90、PDQ-4 原有计分测试；六芒星协议不含分数；未同意不提交；同一提交号幂等与冲突；换词序产生新报告且旧链接不变；错误秘密与不存在都是 404；撤销后 410 且正文没有词；飞书默认关闭；mock 镜像失败、重试、同一报告 ID 不新增行；CloudBase 已写入而飞书连续失败时保持「待重试」，补偿入口在未部署或无密钥时 404，补写成功后同一报告 ID 只有一行；writer 用假接口按报告 ID 更新，查询到多条时只更新第一条、不再新建；撤销不改变归档状态；多次失败后标记失败但报告仍可读取；live 未确认时不调用 writer；管理员缺密钥为 404；归档必须手填客户 ID，重复归档不新增，不按昵称合并；超限 429、过大 413、错误来源 403；其他测评页面没有引用云端块。PostgreSQL 驱动用 mock 覆盖插入幂等、唯一键冲突、更新，以及表不存在时返回建表 SQL。没有云函数身份时不会去连真实环境。部署入口在确认开关打开后拒绝内存库；飞书 live 缺凭证时拒绝启动，凭证齐全才允许监听。这一轮配置仍是 off。词表快照与 `star/js/data.js` 一致。这些测试都不请求 `open.feishu.cn`。

浏览器里用合成的六芒星结果走通过本地服务：不勾选不请求、断网后再试仍是同一份、H5 读到同一组词、撤销后只剩失效页。ECR 页面没有这块同意。这不是真机，也不是微信内。

遗留，本轮不做：

- 真机浏览器和微信内打开、转发。步骤在 `E2E_BROWSER_WECHAT.md`，还没走
- 真飞书建表与写入。还没有「ASVA 测评数据」的链接。飞书保持 off
- 合并 `main`、发布 GitHub Pages。未经用户同意不做
- 生产 ASVA 工作台改动
- 其他 12 个测评接入

## 8. 实测存储大小

合成的一份职业六芒星（昵称、3+3 个词、三轮过程、三句说明，不含图片、PDF、HTML）写入后为 **3072 字节**。服务端把这个数记在文档的 `byteSize`，飞书镜像字段「报告字节数」使用同一个数。

单份上限 400KB，超过直接 413，不截断入库。

## 9. 预计资源消耗

这个环境的用量里已经有 PostgreSQL。本轮不购买资源包，不改套餐。函数仍按短时、最小实例 0 来部署。一份报告大约 3KB，三次函数调用的量级相对个人版额度很小。之前按文档接口估算的 0.2 点/份不适用于现在这条 PostgreSQL 路径。

这还不包含一个常驻函数的空转。所以隔离函数若要部署，必须能缩到 0 实例，并且不能改动已经在跑的 `asva-api`。

## 10. 后续其他测评接入要点

- 继续只在交卷成功后调用 `cloud-kit`，不改计分文件和词表
- 每套新增自己的 `assessmentVersion` 常量和协议组装，服务端允许清单再加 id
- 有分数的测评把原计分返回值放进 `extensionData.score`，不要在云端重算
- 开放题、姓名、手机号默认不进协议，除非同意范围里有对应项
- 飞书仍然只写上面 16 列，不把全文镜像过去
- 爱的 5 种语言的 `?r=` 分数链不能当作 `reportId`
- 寻根之旅默认不传电话和父母原文
- 每套单独发布，合集站卡片地址不变

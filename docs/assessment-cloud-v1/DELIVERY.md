# 职业六芒星云端存档 V1.0 第一期交付

状态：代码和本地合成测试已完成。没有合并 `main`，没有创建飞书表，没有部署云函数，没有写入生产 CloudBase 集合。

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

飞书镜像代码按下面的字段写好了，默认关闭。`mock` 模式只写在进程内存里，用来验证同一报告 ID 不新增第二行，以及镜像失败后重试。

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
| `cloud/assessment-report/` | 隔离 HTTP 服务。默认内存库，飞书默认关闭 |
| `tools/asva-import-preview.html` | 本地导入原型，不进首页 |
| `docs/assessment-cloud-v1/` | 本说明和协议 schema |

## 3. CloudBase 数据模型与隔离

计划中的集合名：`assessment_reports_dev`。代码拒绝 `assessment_reports` 以及其他不以 `assessment_reports_dev` 开头的集合名。

计划中的 HTTP 函数名：`assessmentReportDev`，路径与现有 `/asva-api` 分开。

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

### 阻断：这轮没有连接 CloudBase

2026-10-19 只读探测了已有 HTTP 路径：

- `GET /asva-api/api/health` 返回 200。这是 ASVA 生产服务，发布号 R045。本轮没有调用它的写接口。
- `GET /assessmentReportDev` 与 `/mindtest-report` 返回 `INVALID_PATH`，说明这两个函数名还没有部署。
- 本环境没有 CloudBase 登录态，不能列出文档库里已经存在的集合，也不能安全地新建集合。

因此 CloudBase 驱动直接拒绝连接，本地测试使用内存库，集合名仍固定为 `assessment_reports_dev`。确认集合清单并明确授权之后，才能部署 `assessmentReportDev`。部署时最小实例应为 0，避免在个人版上再挂一个常驻服务。

## 4. 飞书「ASVA 测评记录」字段（待建表，本轮未创建）

表名：`ASVA 测评记录`。

意向位置：现有 ASVA Base。`table_id` 用环境变量 `FEISHU_ASSESSMENT_TABLE_ID`，当前为空。写入开关 `FEISHU_INDEX_MODE` 默认 `off`。`live` 还要 `FEISHU_INDEX_LIVE_CONFIRM=YES`，并且本仓库没有打包飞书 HTTP 客户端，没有注入 writer 时不会发请求。

不使用生活小调查的妙搭 webhook。ASVA 现用飞书应用是 `cli_aaff6cb53db89bd3`（与解忧小屋同一应用，见 `asva-workbench` 的 `.env.example`）。小调查应用 `cli_aa3e5840a3f89d2b` 不用于测评。

报告 ID 的唯一性由 CloudBase 服务端保证，不靠飞书文本字段的唯一属性。

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

### 建表前的访问权限：现在还不能证明能限制住

这张表如果放进现有 ASVA Base，同一 Base 里已经有客户、预约、服务记录等数据。飞书的隐藏视图只是默认不展示，有 Base 权限的人仍然可以打开表、改视图或导出。这不等于访问控制。

正式建表前必须在飞书里核对，并写进建表记录：

1. 谁拥有这个 Base 的可管理、可编辑、可阅读权限。导师、群成员、外部协作者是否在内。
2. 高级权限是否能把「ASVA 测评记录」限制到只有管理员应用 `cli_aaff6cb53db89bd3` 可读写，其他人不可读、不可导出。
3. 应用的 `tenant_access_token` 是否会让服务端读到全表。服务端日志仍只记 reportId、测评 ID、状态码和耗时。
4. 导出、自动化和群机器人是否会被这张表触发。不要把索引转发到群。

本轮没有飞书管理员令牌，没有读取 Base 的成员和高级权限，所以不能证明「放进现有 Base 是安全的」。若上面第 2 点做不到，就改用一个单独的、只授权给该应用的 Base。不要用隐藏视图代替权限。

在这次核对完成之前，不创建「ASVA 测评记录」。

## 5. H5 测试地址

没有部署到 GitHub Pages，也没有部署到 CloudBase，所以没有线上测试地址。

本地隔离服务：

```bash
node cloud/assessment-report/local-server.mjs
```

然后打开 `http://127.0.0.1:4173/star/index.html`。同意并生成链接后，地址形如：

```text
http://127.0.0.1:4173/r/#rpt_<id>.<secret>
```

线上页面将来是 `https://xiangshu3721.github.io/mindtest-web/r/#rpt_<id>.<secret>`。`js/assessment-cloud-config.mjs` 里的 `endpoint` 现在是空的。Pages 上打开链接会显示「报告服务还没有接到这个页面」，直到隔离函数部署并把地址写进这个配置。微信分享标题使用页面里写死的「ASVA 测评报告」。

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

覆盖：ECR、SCL-90、PDQ-4 原有计分测试；六芒星协议不含分数；未同意不提交；同一提交号幂等与冲突；换词序产生新报告且旧链接不变；错误秘密与不存在都是 404；撤销后 410 且正文没有词；飞书默认关闭；mock 镜像失败、重试、同一报告 ID 不新增行；撤销不改变归档状态；多次失败后标记失败但报告仍可读取；live 未确认时不调用 writer；管理员缺密钥为 404；归档必须手填客户 ID，重复归档不新增，不按昵称合并；超限 429、过大 413、错误来源 403；其他测评页面没有引用云端块。

浏览器里用合成的六芒星结果走通了：不勾选不请求、断网后再试仍是同一份、H5 读到同一组词、撤销后只剩失效页。ECR 页面没有这块同意。

遗留，本轮不做：

- 真微信里打开和转发
- 真飞书建表与写入
- 生产 CloudBase 集合与函数部署
- 生产 ASVA 工作台改动
- 其他 12 个测评接入

## 8. 实测存储大小

合成的一份职业六芒星（昵称、3+3 个词、三轮过程、三句说明，不含图片、PDF、HTML）写入后为 **3072 字节**。服务端把这个数记在文档的 `byteSize`，飞书镜像字段「报告字节数」使用同一个数。

单份上限 400KB，超过直接 413，不截断入库。

## 9. 预计资源消耗

价格按腾讯云 CloudBase 上海地域公开标价估算（文档型数据库 200 点/万次调用、40 点/GB/天；云函数 13.3 点/万次、0.11108 点/GBs；外网出流量 800 点/GB）。个人版套餐是 40000 点/月。控制台此前约 927/40000，本轮没有重新登录核对余额。

一份报告走完「保存 + 打开一次 + 撤销」，大约 8 次数据库调用、3 次函数调用，正文约 3KB：

- 数据库调用约 0.16 点
- 函数调用与 256MB 短时运行约 0.02 点
- 出流量约 0.01 点

合计大约 **0.2 点/份**。一千份大约 200 点。一千份存 30 天，容量大约 0.1 点/天。这个量级不需要购买资源包，也不需要升级套餐。

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

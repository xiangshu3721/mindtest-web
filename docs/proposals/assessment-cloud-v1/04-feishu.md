# 04 · 飞书多维表格字段设计

本文是**建议表结构**。本次不建表、不改已有 ASVA 客户表、不调用飞书接口。

## 1. 为什么拆成「索引表 + 云端全文」

飞书多维表格适合筛选昵称、测评名、时间、类型码。它不适合当唯一全文库：

- 长文本有上限。SCL-90 加上 90 题与因子叙述、Beattie 书中原话、心力地图完整 Report，容易顶满。
- 寻根之旅若误写入全文，会把手机号放进可筛选的表格。
- 撤销、权限、按 reportId 读取，用 CloudBase 函数更直接。浏览器直连飞书会被 CORS 拦住，小调查的 `submit.js` 已经遇到这件事。

因此：

- **权威全文**：CloudBase 环境 `root-journey-prod-d4d7pzd0a8f805`（问己 `cloudbaserc.json` 与 ASVA 工作台 `cloudbaserc.json` 都是这个 envId）里的新文档集合，建议名 `assessment_reports`。一条文档 = 一份通过 schema 的 JSON。
- **飞书新表**（尚不存在）：「测评结果索引」。只放检索列、状态、以及不超过约 2 万字的预览。全文用 `payloadRef` 指向 CloudBase 文档 id（与 reportId 相同即可）。
- 不把测评结果写入已有表 `ASVA 客户`、`ASVA 客户原始资料`。那些表的写入发生在导师审核导入时，见 07。

小调查的妙搭 webhook 继续只服务小调查。测评不复用那个公开 URL。

## 2. 建议新表「测评结果索引」

一行 = 一份 reportId。不要用昵称当主键。

| 字段显示名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| reportId | 文本 | 是 | 唯一。与 CloudBase 文档 id 相同 |
| 测评ID | 文本 | 是 | assessmentId |
| 测评名称 | 单选或文本 | 是 | 便于筛选。单选的选项在确认测评清单后一次性建好，避免自由填写 |
| 规则版本 | 文本 | 是 | assessmentVersion |
| 昵称 | 文本 | 是 | 1–12 字。不是手机号 |
| 完成时间 | 日期 | 是 | completedAt |
| 协议版本 | 文本 | 是 | 固定 1.0.0 |
| 状态 | 单选 | 是 | 有效 / 已撤销 / 已导入 |
| 结论摘要 | 文本 | 是 | `result.headline`，截断到 200 字 |
| 类型码 | 文本 | 否 | `result.code`，如霍兰德码、ECR 类型、PDQ 阳性 id 列表 |
| 维度摘要 | 文本 | 否 | 人可读短句，例如「回避 3.20；焦虑 5.10」。供搜索，不供重算 |
| 兼容级别 | 单选 | 是 | full / snapshot / partial |
| 来源 | 单选 | 是 | 站内合集 / 站外仓 |
| 页面路径 | 文本 | 否 | source.path |
| 同意版本 | 文本 | 是 | consent.version |
| 同意范围 | 多选 | 是 | store、share_link、mentor_read、profile_demographics、open_text、journey_archive |
| 客户端提交号 | 文本 | 是 | clientSubmissionId，唯一，防重复 |
| 预览 | 文本 | 否 | textFallback 的前几千字。不是全文 |
| payloadRef | 文本 | 是 | CloudBase 文档 id |
| 撤销时间 | 日期 | 否 | |
| 导入客户ID | 文本 | 否 | ASVA `customer_id`。空表示尚未导入 |
| 导入时间 | 日期 | 否 | |
| 导入操作者 | 文本 | 否 | ASVA 员工 id，不是飞书用户随意填写 |
| 创建时间 | 日期 | 是 | 服务端写入 |

明确**不要**的列：手机号、微信号、SCL-90 真实姓名、逐题答案、开放自述全文、危机叙述全文、父母档案。这些只在 CloudBase 全文里，并受同意范围约束。姓名若需被管理员搜到，应在导入客户档案之后用 ASVA 已有客户字段，而不是在测评索引里再存一份。

统计需求与列的对应：

- 某测评做了多少份：按「测评名称」或「测评ID」计数，状态=有效。
- 某昵称最近的报告：筛昵称 + 完成时间。昵称会重名，只能当筛选，不能当身份。
- 霍兰德码分布：类型码列，仅 `holland` 行有意义。
- 已发给导师但未进档案：状态=有效 且 导入客户ID 为空。
- 撤销：状态=已撤销，H5 不再返回正文。

## 3. 与已有飞书数据的边界

ASVA 工作台 README（`master`）写明现用数据包括 Customers、Appointments、ServiceRecords、Staff、Products、Enrollments、画像变更，以及 SourceRecords、Evidence、提案、冲突。Customer Schema V1 规定：一次服务、理论结果、AI 摘要不得直接变成客户字段；原始资料表保存不可悄悄覆盖的依据。

所以测评索引是**新表**。它不是客户主表的扩展列。确认 Base 时二选一：

1. 放进 ASVA 现有 Base，便于管理员在飞书里一起看。应用权限沿用 ASVA 已有飞书应用。推荐。
2. 单独 Base 给测评。则 ASVA 服务端要第二个 app_token，导入时多一次配置。

无论哪一种，应用密钥只放在 CloudBase 环境变量，与 ASVA 今天的做法相同（`.env.example` 里 `FEISHU_APP_ID` / `FEISHU_APP_SECRET` 不进前端）。

任务背景里的应用 `cli_aa3e5840a3f89d2b` 与 ASVA 正在用的应用是否同一个，公开仓库不能证明。建表前核对。若是两个应用，不要让测评函数使用小调查那个已经公开的 webhook。

## 4. 写入规则

- 只有 CloudBase 函数用 `tenant_access_token` 写索引表。
- 先写 CloudBase 全文成功，再写飞书索引。飞书失败则全文标记 `index_pending`，函数可重试。不对作答者显示「已上云」，直到两边都成功；若产品希望「全文成功即可看链接」，链接可以先发，索引补写，但界面要写「目录同步中」。
- 同一 `reportId` 或同一 `clientSubmissionId` 再次提交：若正文哈希相同，返回原链接，不新增行。若正文不同，返回 409，客户端保留本地结果并提示「这一份编号已用过」，不覆盖导师可能已经打开的旧报告。
- 撤销：全文 `share.status=revoked`，索引状态改为已撤销。不物理删除，以便审计「曾经发出去过」。
- 飞书自动化不要再转发到群机器人。索引表含昵称与结论，群消息会扩大知情范围。

## 5. 预览列的裁剪

`预览` 只用 `reportContent.textFallback` 的前 1500 字，并去掉连续的题干引用以外的开放自述（若该次同意不含 `open_text`）。SCL-90 危机句若存在，预览保留「有需要立刻回应的条目，请打开完整报告」，不把题干选择贴进表格。完整危机原文在 H5 与 CloudBase 全文里，给打开链接的人看。

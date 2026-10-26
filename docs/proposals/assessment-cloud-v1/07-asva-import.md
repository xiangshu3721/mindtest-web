# 07 · ASVA 客户关怀系统导入

对接对象是公开仓库 `xiangshu3721/asva-workbench`（默认分支 `master`）里已经在跑的工作台，不是新建一个「客户关怀系统」。线上 API 形态见该仓 README：页面走 CloudBase 上的 `/asva-api`，飞书是服务端仓库，客户字段有 Schema V1，原始资料是 `SourceRecord`（飞书表「ASVA 客户原始资料」）。

本次不改该仓库，不写客户数据。

## 1. 导师侧流程

1. 作答者把 H5 链接发给导师（微信）。
2. 导师用浏览器打开链接，阅读完整报告。这一步只读测评函数，不进客户档案。
3. 需要归档时，在 ASVA 工作台的客户页粘贴**同一条完整链接**。
4. 工作台服务端解析 hash 中的 reportId 与 linkSecret，调用 `POST /v1/integrations/asva/read`。
5. 界面展示结构化预览：测评名、昵称、时间、结论、维度、解释、建议、compat 级别与 gaps。partial 的寻根报告必须先看到「不含家庭档案全文」。
6. 管理员选择已有客户，或按现有建档流程新建客户。**不按昵称自动合并。**
7. 确认后写入一条 SourceRecord，不直接改客户事实字段。
8. 若需要把「当前困扰」等写入档案，走工作台已有的证据与 ProfileUpdateProposal：管理员确认后才落客户字段。测评导入本身停在「原始资料已挂上」。

当前 README 写明导师账号不能登录，录入者是管理员。在导师端开放之前，粘贴链接的人是管理员。这是现状，不是本方案新加的限制。若产品希望导师自己粘贴，要先做 ASVA 的导师登录，那是另一项工作，不要塞进测评第一期。

## 2. 为什么禁止爬页面和 OCR

报告页是脚本渲染的，爬虫拿到的静态 HTML 没有分数。OCR 导出图会错字，且绕过撤销：链接失效后图还在。导入只接受集成接口的 JSON。粘贴普通网址、图片、聊天记录，接口不解析。

工作台若已有「粘贴文字生成画像草稿」，那条链路继续用于会谈记录。测评链接走单独按钮「从测评报告导入」，避免把链接当成长文去抽实体。

## 3. 写入已有 SourceRecord 的字段映射

不新建客户表。在确认 ASVA 能接受新的 `source_type` 之前，先用现有类型里的 `IMPORTED_TEXT`（SourceRecord V1 已列出），并在 `title` 与 `notes` 标明是测评报告。若要新增枚举 `ASSESSMENT_REPORT`，按该仓 Schema Change Rules 单独改，本方案只提出需要，不假设枚举已经存在。

| SourceRecord 字段 | 取值 |
|---|---|
| source_id | 新生成，不占用 reportId |
| customer_id | 管理员选中的客户 |
| source_type | 确认前暂定 `IMPORTED_TEXT`；标题前缀「测评报告」 |
| title | `{assessmentName} · {completedAt 日期} · {nickname}` |
| raw_text | 协议的 textFallback + 维度列表 + 解释与建议的纯文本。便于现有证据抽取阅读 |
| file_ref | 不传图片。元数据 JSON：`{ "kind": "assessment-result-v1", "reportId", "schemaVersion", "assessmentId", "assessmentVersion", "compat" }` |
| content_hash | 对 reportId + 协议正文哈希。同一链接重复导入不新增第二份资料 |
| occurred_at | completedAt |
| sensitivity_level | 保持该表默认 HIGH |
| notes | 链接状态在导入当时为有效；不保存 linkSecret |

linkSecret 只在当次请求内存里使用，不写入飞书 `raw_text` 或 `notes`。否则原始资料表会变成新的报告密码。

导入成功后，测评函数把飞书索引的「导入客户ID / 导入时间 / 导入操作者」补上，状态改为「已导入」。已导入仍可阅读，直到作答者或管理员撤销。撤销不删除已经确认进客户档案的事实，只停止继续从链接读取；档案里已确认的句子按 ASVA 自己的变更历史处理。界面在导入前写明这句。

## 4. 预览字段与客户字段的关系

这些**可以**出现在导入预览，供人判断，但默认不写客户列：

- 昵称 → 不覆盖 `Customer.nickname`。若客户还没有昵称，由管理员点选「采用这个昵称」才写入，并走现有 ProfileChanges。
- 霍兰德码、依恋类型、PDQ 阳性列表、SCL-90 因子 → 不新增客户字段。放在 SourceRecord。理论模型不得按 Customer Schema 直接加列。
- SCL-90 姓名、性别、年龄段 → 仅当协议里确有 `profile_demographics`，且管理员对照客户电话等已有身份后手工确认。年龄段是区间，不能写成精确生日。
- 危机文案 → 预览置顶，提示联系现有危机资源（量表原文已含 12356）。不自动改预约状态。

## 5. 失败

| 情况 | 界面 |
|---|---|
| 链接缺 hash | 「请粘贴作答者发出的完整报告链接」 |
| 404 | 「链接无效」 |
| 410 | 「链接已失效，不能导入」 |
| 测评函数超时 | 「暂时读不到报告，请稍后再试」。不改客户 |
| 重复导入 | 「这份报告已经在该客户的原始资料里」，给出已有 source_id |
| 客户未选择 | 不允许确认 |

ASVA 生产发布纪律（该仓 README：Staging 验证后才能上 Production）同样适用于将来的导入按钮。测评方案的第一期可以先在 Staging 用假报告试导入。

## 6. 与小调查入库的差别

小调查是「提交即进表」，没有导师审核，也没有按链接回读。测评多了回读与审核，所以不能把 survey-ingest 当成完成态。可以对齐的只有：浏览器不持有飞书密钥、失败可再试、字段先有一份稳定 JSON 再映射到表格列。

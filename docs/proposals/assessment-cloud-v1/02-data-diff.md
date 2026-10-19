# 02 · 结果数据结构差异

对照基准是 [schema.json](./schema.json) 的 AssessmentResult V1.0。差异来自第 01 篇实勘，不是风格偏好。

## 1. 五类结果，不要收成一种分数表

| 类型 | 测评 | 统一字段怎么放 |
|---|---|---|
| 多维分数 | SCL-90、PDQ-4、ECR、SEFS、珍爱金字塔、霍兰德、巨婴、个人充电、心力地图、Beattie 六套 | `dimensions[]` 一条一个维；总分放 `result` 或某一条 dimension |
| 类型 / 代码 | ECR 四型、霍兰德三码、SEFS 主导维、PDQ 多个划界、5 种语言主爱语 | `result.code` + `result.label`。PDQ 与双主爱语允许 code 里多个 id |
| 分类词，无分数 | 职业六芒星 | `dimensions[].kind = category`，`score = null`，词在 `labels` |
| 开放文本 | 霍兰德三问、个人充电自述、心力地图自述、愤怒填空、寻根材料 | `extensionData.openText`，并在 `reportContent` 里按原页面出现 |
| 档案旅程 | 寻根之旅 | 默认不映射整包。只映射地图页快照，`compat.level = partial` |

## 2. 本地「结果」实际有三层，不能混用

| 层 | 谁有 | 云端能不能只靠它无损还原 |
|---|---|---|
| A. 计分原对象 | 交卷那一刹那的内存：`scoreScl90`、`scorePdq4`、`scoreEcr`、`scoreJuying`、`computeResult`、`HollandEngine.compute`、SEFS `calc`、心力地图 `Report`、Beattie 的 sectionScores+逐题草稿 | 能。这是上云应抓的层 |
| B. result-kit 摘要 | SCL-90、PDQ-4、ECR、六芒星、巨婴、个人充电、5 种语言、珍爱（另带 data）、心力地图（精简 data）、寻根地图 | 不能单独作为临床报告。`clean()` 会截断 |
| C. 页面分节 `sec` 或 PNG | 配置了 capture 的测评；SEFS / 霍兰德用自绘图片 | 能阅读，难筛选。作 `reportContent.sections` 兜底，不作飞书统计源 |

Beattie 更特殊：档案是第四层，只有分项分和书中原话，逐题在草稿。草稿清除后 A 层消失。

## 3. 逐项差异

### 3.1 标识与时间

- reportId：全部没有。result-kit 的 `r` + 时间 + 随机是本机 id，换浏览器就无效，且碰撞空间小，不能当云端主键。
- 霍兰德历史 id、SEFS 历史 id、心力地图 `report.id` / `session.id` 都是本机 id，可放进 `extensionData` 作对照，不替换 `reportId`。
- 时间：result-kit 用毫秒 `t`；Beattie、心力地图用 ISO 字符串；个人充电同时有 `date`（日历日）和 `ts`。协议统一 `completedAt` ISO，日历日放 `extensionData`。
- 版本：只有心力地图和霍兰德（`RIASEC_V2`）有明确规则版本。其余接入时补常量，例如 `scl90-rules-2026-10`，值表示「当前仓库这套题」，不表示常模出版年。

### 3.2 昵称与身份

| 测评 | 称呼从哪来 | 多出来的身份 |
|---|---|---|
| 合集站 ResultKit 系、SEFS、巨婴、珍爱、5 种语言、个人充电、寻根地图、Beattie | `rk.v1.nickname` | SCL-90 另有姓名、性别、年龄段 |
| 霍兰德 | `holland_explore.nick`，默认可为「我」 | 无 |
| 寻根档案 | 档案 `profile.name` 与 ResultKit 昵称并存 | 手机号、微信二维码、籍贯等 |

协议里的 `nickname` 只放 1–12 字昵称。SCL-90 资料进 `extensionData.profile`，且同意范围含 `profile_demographics` 才上传。寻根手机号不进协议默认集。

### 3.3 答案形态

| 测评 | 答案 | 是否已持久化到可重算的本机历史 |
|---|---|---|
| SCL-90 | 90×1–5 | 否，只在 session |
| PDQ-4 | 126×0/1 | 否 |
| ECR | 36×1–7 原始分 | 否 |
| 六芒星 | 词 id 的多轮集合 | 会话有；历史只有最后 3+3 |
| Beattie | Likert / 选项字母 / 是非 | 草稿有，档案无 |
| SEFS | 24×0–4 | 是，历史含 answers |
| 个人充电 | 状态 id 或自述 + 来源 id | 日记有输入，分数现算 |
| 心力地图 | 题 id → 0–4 或 na，加情境、选择、自述 | 会话有；历史精简版无 |
| 珍爱 | 36×1–5 | 是，`data.a` |
| 寻根 | 发展/家庭多套答案 + 大量文本 | 在 IndexedDB 整档 |
| 5 种语言 | 30 个语言码 | 进度里有；交卷后进度可能被清，历史只有五种分数 |
| 巨婴 | 20×0–5 | 会话有；历史去重键是分数拼接，摘要不是全表 |
| 霍兰德 | 60 题 1–5 + 计时 + 三问 | 历史含 `result` 与 `explore`；进度里的逐题在提交后是否保留以 `progress` 清理逻辑为准，上云应在写入历史的同一刻抓 `result` 与 `explore` |

### 3.4 分数语义不可相加

这些数字不能放进同一张「总分排行」：

- SCL-90 总分约 90–450，因子均分 1–5，另有 GSI。
- PDQ 分量表各有划界，总分是各量表分之和，划界不是同一个数。
- ECR 均分 1–7，判别分 `m` 可正可负。
- SEFS 维 0–24，总分 0–96。
- 珍爱维 0–100 的百分制，另有加权总分。
- 霍兰德是测评内部 0–100，不是官方常模百分位。
- 巨婴 0–100，由 0–5 相加。
- 个人充电电量 0–100，四维是「漏电」不是「能力高好」。
- 心力地图分数高表示困扰多，方向与珍爱「分高更稳」相反。
- Beattie 0–230，分项 100/50/80，灯色不是临床分度。
- 六芒星没有分数。

飞书可以筛选「某一测评内部的代码」，不要做跨测评总分。

### 3.5 解释与建议的来源

| 测评 | 解释存在哪 | 上云时 |
|---|---|---|
| SCL-90 | 因子 `narrative`、`gsiText`、`verdictText`、`guidance`、`crisis` | 原样放 interpretation，不另写一篇 |
| PDQ-4 | 量表 `portrait`、`verdict.text` | 同上 |
| ECR | 维度 `narrative`、类型 `text` | 同上 |
| Beattie | `insightFor` 的 means/actions + `bandText` 书中原话 | 两段都留。原话可能很长 |
| 六芒星 | 三条固定说明 | recommendations 用这三句 |
| SEFS | 维度 `suggest` 与类型名 | 用 data.js 已有句子 |
| 个人充电 | `band.tagline`、链路 `now/cut`、动作列表 | 动作放 recommendations |
| 心力地图 | `summary`、`topic`、`patterns`、`boundary` | viewModel 用完整 Report |
| 珍爱 | `buildReport` 开场、资源、需要、7 天句 | 交卷时调用现有 `buildReport`，不重写文案 |
| 5 种语言 | `meaning` 与 `how` | 主爱语的 how 放 recommendations |
| 巨婴 | `band` 文案与 `side` | 原样 |
| 霍兰德 | `js/report.js` 按 code 与 structure 选句 | 保存当时 `result`，H5 用同一 report.js 规则重绘；规则版本写进 `assessmentVersion` |
| 寻根 | AI 洞察每次可能不同 | 默认不上传。地图页静态展示才进 reportContent |

### 3.6 特殊结构对照

| 结构 | 测评 | 重绘需要 |
|---|---|---|
| 雷达 / 多边形 | SEFS 四维、个人充电四维、霍兰德六边形、珍爱雷达、寻根地图、Beattie 分项条 | 分数数组即可重绘。SVG 字符串可做兜底 |
| 点图 | ECR 回避×焦虑 | 两个 exactMean |
| 伪 3D 金字塔 | 珍爱 | 六维分数 + 现有几何代码。若 H5 第一期不搬 3D，文字报告仍算完整阅读，3D 写入 gaps「交互旋转未搬」 |
| 星图 hex | 六芒星 | 3+3 个词。result-kit 已有 `hex` 分节 |
| 多类型同时阳性 | PDQ-4 | 不要压成一个 code |
| 并列类型 | ECR `tied`、5 种语言双主爱语、SEFS 多个 leaders | `result.flags` 含 tied 或 complex |
| 效度 | PDQ suspect/tooGood；霍兰德 quality；SCL-90 rush | `extensionData.quality`，并在 interpretation 保留原提示 |
| 危机 | SCL-90 `crisis` | 必须出现在导师报告正文 |
| 练习进度 | 珍爱 `practice` | 冻结在交卷快照 |
| 当日覆盖 | 个人充电 | 本地覆盖不等于云端覆盖 |

## 4. 不能完整适配时的机制

按协议 `extensionData.compat.level`：

1. **full**  
   结构化 `dimensions` + `result` + `interpretation` + `recommendations` + `extensionData.score/answers` 足以在不看旧页面的情况下重绘原报告。六芒星、量表类、霍兰德、珍爱、SEFS、巨婴、5 种语言、个人充电、心力地图（上传完整 Report 时）、Beattie（上传逐题时）走这条。

2. **snapshot**  
   结构化字段只够列表预览。阅读以 `reportContent.sections` 或 `textFallback` 为准。使用条件：交卷时拿不到原对象，只能抓到 result-kit 分节。导师仍能读到当时页面文字，统计只能用 headline。Beattie 若产品决定不存逐题，就降为 snapshot，gaps 写「无逐题答案，不能在规则升级后重算」。

3. **partial**  
   寻根之旅。`reportContent` 只含生命成长地图页。gaps 固定写：「不含手机号、微信二维码、父母档案、材料原文、AI 洞察全文」。ASVA 导入界面要显示这句，避免导师以为已经同步了整段旅程。

禁止用爬取线上 HTML 或 OCR 导出图来补 gaps。缺的部分就保持缺，并在报告上写「这一次没有保存逐题」。

## 5. 同一人多次测评

协议一条记录是一次测评，不是一个人。同昵称不合并。ASVA 导入时再由人工把 reportId 挂到已有客户，见 07。不要在提交接口里按昵称查重客户。

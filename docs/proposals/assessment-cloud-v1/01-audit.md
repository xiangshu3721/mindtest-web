# 01 · 全系列测评审计清单

审计日期：2026-10-19。  
审计对象：`xiangshu3721/mindtest-web` 的 `main`（本地 `d4c3ce6`），以及首页外链指向的公开仓库默认分支。  
线上目录：https://xiangshu3721.github.io/mindtest-web/

## 1. 范围怎么定的

列入清单的规则：

- `index.html` 与 `PRODUCT.md` 写明的 13 张卡片，全部列入。
- 情绪健康测试卡片内的 6 套题，分别列入。
- 卡片指向的独立仓，用公开 Git 读到存储与分享实现的，标「站外仓」。
- 仓库里有、但首页没有入口的内容，单独标「未挂到目录」，不算漏测，也不当成待上云测评。

没有按「以前听说有 11 张卡」去补不存在的入口。当前目录就是 13 张。

## 2. 总表

「云端」列只表示本测评自己是否已经把结果送到飞书或 CloudBase。问己、小调查、ASVA 工作台的云在第 6 节，不属于某一张测评卡。

| # | 测评 | 位置 | 路径 | 昵称 | 结果存在哪 | 可再看 | 独立分享链接 | 云端/飞书 | 适配 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | SEFS 主观体验功能状态量表 | 站外仓 `my-react-app` | https://xiangshu3721.github.io/my-react-app/sefs/?v=4 | ResultKit，`rk.v1.nickname` | 会话 `sefs-v1-session`；历史 `sefs-v1-history`（含 24 题答案） | 本机历史，最多 30 条 | 无。仅图片保存 | 无 | 可完整适配 |
| 2 | 个人充电 | 站外仓 `geren-chongdian` | https://xiangshu3721.github.io/geren-chongdian/ | ResultKit，确认点在提交 | `gcd.v1` 日记；摘要另存 `rk.v1.gcd` | 本机历史 + 当日记录 | 无 | 无 | 可适配；开放自述放 extensionData |
| 3 | 高敏感心力地图 | 站外仓 `sensitive-map` | https://xiangshu3721.github.io/sensitive-map/ | ResultKit；会话里另有 `nick` | 会话 `sensitive-map-session-v1`（7 天）；历史 `rk.v1.sensmap` 为去自述精简版 | 本机历史；会话过期后明细在精简版里不完整 | 无。导出长图，预约二维码不是报告链接 | 无。已有知情同意结构，未上传 | 可完整适配，但必须在生成报告当时取完整 `report`，不能只读历史精简版 |
| 4 | 珍爱金字塔 | 站外仓 `zhenai-pyramid` | https://xiangshu3721.github.io/zhenai-pyramid/ | ResultKit | 进度 `zhenai-pyramid:v1`；历史 `rk.v1.zhenai`，`data.a` 为 36 题答案 | 本机可续答、可回看 | 无。导出 PNG | 无 | 可完整适配，且已有「摘要 + 原始答案」 |
| 5 | SCL-90 | 站内 `scl90/` | `scl90/index.html` | ResultKit；另有量表内姓名 | 会话 `scl90-session`（答案+姓名性别年龄）；历史 `rk.v1.scl90` 为截断摘要 | 会话未关时可回报告；历史可看摘要与分节快照 | 无。打印 / 导出图 | 无 | 可完整适配。姓名需单独同意范围 |
| 6 | PDQ-4 | 站内 `pdq/` | `pdq/index.html` | ResultKit | 会话 `pdq4-session`；历史 `rk.v1.pdq4` 截断摘要 | 同 SCL-90 | 无 | 无 | 可完整适配 |
| 7 | 成人依恋 ECR | 站内 `ecr/` | `ecr/index.html` | ResultKit | 会话 `ecr-session`；历史 `rk.v1.ecr` 截断摘要 | 同 SCL-90 | 无 | 无 | 可完整适配 |
| 8 | 寻根之旅 | 站外仓 `root-journey-web` | https://xiangshu3721.github.io/root-journey-web/ | ResultKit；档案里另有姓名、手机号 | IndexedDB `root-journey-mvp` / `journey` / `current-device`；旧键 `root-journey-demo-v1`；地图摘要 `rk.v1.root` | 本机档案可继续编辑 | 无。AI 洞察走云函数，但不保存测评报告链接 | 洞察代理是腾讯云 SCF，不是结果库 | **不能整包适配**。默认只允许生命成长地图快照 |
| 9a | 情绪健康测试 | 站内 `beattie/` | `beattie/index.html#` 对应 `emotional-health` | ResultKit；写入档案 `nick` | 档案 `boundary-emotion-archive-v1`；草稿 `boundary-emotion-draft-v1:emotional-health` | 情绪档案，每套最多 30 条 | 无。导出图 | 无 | 分项分数可适配；逐题答案档案里没有，要在交卷瞬间另存 |
| 9b | 愤怒测试 | 同上 | 测试 id `anger` | 同上 | 草稿键后缀 `anger`；可选填空只在草稿 | 同上 | 无 | 无 | 同上；填空在 `angerFill`，档案对象不含它 |
| 9c | 恐惧测试 | 同上 | `fear` | 同上 | 草稿后缀 `fear` | 同上 | 无 | 无 | 同 9a |
| 9d | 戏剧化与不幸成瘾测试 | 同上 | `drama` | 同上 | 草稿后缀 `drama` | 同上 | 无 | 无 | 同 9a。结果页另有「先看悲痛」提示 |
| 9e | 内疚测试 | 同上 | `guilt` | 同上 | 草稿后缀 `guilt` | 同上 | 无 | 无 | 同 9a |
| 9f | 悲痛与失落测试 | 同上 | `grief` | 同上 | 草稿后缀 `grief` | 同上 | 无 | 无 | 同 9a |
| 10 | 爱的 5 种语言 | 站外仓 `5loves` | https://xiangshu3721.github.io/5loves/ | ResultKit | 进度 `five-loves-progress-v1`；历史 `rk.v1.5loves` | 本机历史；可用 `?r=` 打开分数结果 | **有分数链接，无报告编号** | 无 | 可完整适配。不要复用 `?r=` 当 reportId |
| 11 | 巨婴测评 | 站外仓 `juying` | https://xiangshu3721.github.io/juying/ | ResultKit | 会话 `juying-session`；历史 `rk.v1.juying`，去重键为 20 个分数拼接 | 会话 + 历史摘要 | 无 | 无 | 可完整适配 |
| 12 | 职业六芒星 | 站内 `star/` | `star/index.html` | ResultKit | 会话 `career-star-v2`（含三轮划词）；历史 `rk.v1.star` 只有留下的 3+3 个词 | 本机历史可导出；旧键 `career-star-archive-v1` 会迁入后删除 | 无 | 无 | 可适配。无数值分；三轮过程要在交卷时放进 extensionData，历史摘要里没有 |
| 13 | 霍兰德兴趣探索 | 站外仓 `holland-explore` | https://xiangshu3721.github.io/holland-explore/ | 自有键，不走 ResultKit 共用昵称 | `holland_explore.nick` / `.progress` / `.history` | 本机历史含计分对象与三道探索题 | 无 | 无 | 可完整适配。开放题与质量标记必须进 extensionData |

未挂到目录、不进入上云范围：

| 内容 | 原因 |
|---|---|
| `eap/` 东方领导力 EAP 深度学习报告 V4 | 静态长页，无作答、无计分、无 localStorage。首页无链接 |
| 仓库根目录 `js/app.js` + `js/data.js` + `js/score.js` | 与 `ecr/` 同源的旧副本，首页不加载。`package.json` 的测试只跑 `ecr/js/score.test.mjs` |
| 旧仓 `mindtest`（SCL-90 单页） | 公开仓存在，**当前合集站不引用**。不列入本方案改造 |
| 问己 `wenji`、生活与心情小调查 `shenghuo-xinqing` | 不是合集站卡片。只作为可复用入库模式对照，见第 6 节 |

## 3. 站内测评

共用层先写一次，下面每套不再重复。

### 3.0 共用 result-kit（`js/result-kit.js`）

- 技术：无依赖 IIFE，挂在 `window.ResultKit`。SCL-90、PDQ-4、ECR、六芒星、情绪测试入口页用 `<script src="../js/result-kit.js?v=nick3">`。
- 昵称：`localStorage["rk.v1.nickname"]`，清洗后 1–12 字。是否已确认：`sessionStorage["rk.v1.nickok." + 测评id]`。重新测试会 `nickReset()`，要求再确认。
- 历史：`localStorage["rk.v1." + id] = { v:1, items:[...] }`，每套最多 30 条。条目 `{ id, t, title, nick?, k?, d?, s }`。`s` 经 `clean()`：`headline`≤120、`sub`≤260、`who`≤60、`metrics`≤16、`notes`≤6 且每条≤160。页面分节 `s.sec` 另有约 70000 字符上限，超限会丢 SVG 再截断。
- 空间满：先留 10 条，仍失败则只留内存，结果页仍可看。
- 导出：canvas 长图，文件名含昵称。不是链接。
- 同源事实：`https://xiangshu3721.github.io` 下所有项目仓库共享这一份 localStorage。昵称会在合集站与外链站之间带着走；key 撞名会串数据。当前已用 id：`scl90`、`pdq4`、`ecr`、`star`、`beattie-*`、`sefs`（只 configure，未见 save）、`juying`、`zhenai`、`5loves`、`sensmap`、`root`、`gcd`。
- 云端：文件头写明「不上传任何数据」。全文件无飞书、无 CloudBase。

### 3.1 SCL-90 症状自评量表

- 目录：`scl90/`。访问：`scl90/index.html`。
- 技术：原生 HTML + `css/app.css` + ES Module（`js/app.js`、`js/data.js`、`js/score.js`）。无构建。
- 昵称：封面「开始 / 继续」前由 ResultKit 插入。另有量表资料页：姓名（最长 20）、性别（男/女）、年龄段（`AGES`）。资料存在会话，不写入 `rk.v1.nickname`。历史摘要的 `who` 是「姓名 性别 年龄」。
- 会话键 `scl90-session`：`{ step, profile:{name,gender,age}, index, answers[90], times[90], rushed }`。答案 1–5。刷新可恢复。关页后会话消失，报告靠重新计分才能出现，所以关页后只剩 result-kit 历史。
- 计分：`scl90/js/score.js` 的 `scoreScl90`。因子均分等级、GSI 分段、三条筛查界值、危机提示都在此文件。`scl90/js/score.test.mjs` 有测试。
- 计分结果字段：`total`、`gsi`、`gsiLabel`、`gsiText`、`positiveCount`、`negativeCount`、`positiveMean`、四项常模比较布尔、`factors[]`（id/name/about/count/raw/mean/level/levelLabel/narrative/norm/normCut/aboveNorm/screened）、`ranked`、`rules`、`positive`、`notable`（≥4 分条目）、`norms`、`crisis`、`guidance`、`verdictTitle`、`verdictText`。
- 十个因子：躯体化 som、强迫症状 oc、人际关系敏感 is、抑郁 dep、焦虑 anx、敌对 hos、恐怖 phob、偏执 par、精神病性 psy、其他 add。
- 特殊结构：因子条形图、筛查阳性/阴性、第 15 题与第 59 题危机文案、常模对照。不是类型学。
- 再看：本机会话内可以；历史靠摘要 + 延迟抓取的分节，**不是**完整 `scoreScl90` 对象。`metrics` 含总分、阳性项目和 10 个因子，16 条上限刚好能放下，更长的因子叙述依赖 `sec`。
- 分享链接：无。
- 云端：无。
- 适配：`compat.level = full`。`dimensions` 用 10 因子；`result.headline` 用现有 verdict；`extensionData.score` 存原对象；`extensionData.profile` 存姓名性别年龄；`extensionData.answers` 存 90 题。危机文案放进 `interpretation`，不要省略。
- 接入时要动的文件（现在不动）：`scl90/js/app.js` 的 `recordResult()`；可选在 `scl90/js/data.js` 增加版本常量（不改题目与界值）；`scl90/index.html` 若要换 result-kit 版本号。
- 风险：临床筛查与自杀意念条目；姓名比昵称更能识别人；历史摘要不足以无损还原；`?debug` 预填只在本地调试，上云时必须排除 debug 入口。

### 3.2 人格障碍筛查 PDQ-4

- 目录：`pdq/`。访问：`pdq/index.html`。
- 技术：与 SCL-90 相同的原生模块结构。
- 昵称：仅 ResultKit。无姓名栏。
- 会话 `pdq4-session`：`{ step, index, answers[126]（0/1）, times, rushed }`。结果不落会话，进报告页时 `scorePdq4` 重算。
- 计分：`pdq/js/score.js`。12 个分量表、冲动/品行附加分、掩饰 `tooGood`、可疑 `suspect`、`verdict`。
- 分量表：偏执型 par、分裂样 szd、分裂型 szt、反社会型 ant、边缘型 bor、表演型 his、自恋型 nar、回避型 avo、依赖型 dep、强迫型 ocp、被动攻击型 pag、抑郁型 dps。群组 A/B/C/附录在 `data.js` 的 `CLUSTERS`。
- 结果字段：`scales[]`（id/name/alias/cluster/about/portrait/score/max/cutoff/positive/items）、`positiveScales`、`positiveCount`、`total`、`impulse`、`conduct`、`tooGood`、`suspect`、`verdict{id,title,text}`。
- 特殊结构：划界线、效度两条、多类型并列，不是单一类型。
- 再看：同 SCL-90。`summarize()` 的 metrics 是 1 条总览 + 12 个量表 = 13，在 16 条以内；画像长文依赖页面分节。
- 分享链接：无。云端：无。
- 适配：`full`。`dimensions` 用 12 个量表，`extra.positive` 表示是否过划界。效度放 `result.flags`（`suspect` / `too-good`）并在 `interpretation` 保留原 verdict 文案。
- 接入文件：`pdq/js/app.js` 的 `recordResult()`；版本常量可放 `pdq/js/data.js`。
- 风险：筛查易被当成诊断；可疑卷与掩饰分必须原样可见，不能只上传「几个阳性」。

### 3.3 成人依恋关系测评 ECR

- 目录：`ecr/`。访问：`ecr/index.html`。量表名在数据里是「亲密关系经历量表」。
- 技术：同上。反向题集合 `REVERSE_ITEMS`。
- 昵称：仅 ResultKit。
- 会话 `ecr-session`：`{ step, index, answers[36]（1–7 原始分，未反向）, times }`。
- 计分：`ecr/js/score.js` 的 `scoreEcr`。两维均分，Fisher 判别取最大类型；中点为 4。
- 维度：依恋回避 avoidance、依恋焦虑 anxiety。类型：安全型 secure、专注型 preoccupied、冷漠型 dismissing、恐惧型 fearful。
- 结果字段：`dimensions[]`、`avoidance`、`anxiety`、`types[]`（含 `m` / `exactM` / `win`）、`type`、`tied`、`margin`、`closeCall`、`nearMidpoint`、`quadrant`、`quadrantName`、`differsFromQuadrant`、`scored`（反向后的 36 个数）。
- 特殊结构：二维平面点、四类型判别分、并列与接近中点的说明。结果页有点图。
- 再看：同前。摘要 metrics 为 2 维 + 4 个判别分。
- 分享链接：无。云端：无。
- 适配：`full`。`result.code` 用类型 id；并列时 `code` 用逗号连接并设 flag `tied`。点图坐标可由两维均分重绘，不必存位图。
- 接入文件：`ecr/js/app.js` 的 `recordResult()`。不要改根目录那份未挂载副本。
- 风险：低。注意根目录副本若将来被误挂，会没有昵称门槛。

### 3.4 情绪健康测试（Beattie 六套）

- 目录：运行产物 `beattie/`（Vite 打包的 `assets/index-DbKef-pC.js`）；源码 `beattie-src/`。访问：`beattie/index.html`。首页只链到这个入口，六套在应用内选择。
- 技术：TypeScript + Vite。计分 `beattie-src/src/lib/scoring.ts`，题目 `src/data/*.ts`，解读 `src/data/insights.ts`，档案 `src/lib/storage.ts`，结果 UI `src/ui/result.ts`，流程 `src/main.ts`。
- 六套：

| assessmentId 建议 | 源码 id | 标题 | 章节字段 |
|---|---|---|---|
| beattie-emotional-health | emotional-health | 情绪健康测试 | chapter 28 |
| beattie-anger | anger | 愤怒测试 | 见 anger.ts |
| beattie-fear | fear | 恐惧测试 | 见 fear.ts |
| beattie-drama | drama | 戏剧化与不幸成瘾测试 | 见 drama.ts |
| beattie-guilt | guilt | 内疚测试 | 见 guilt.ts |
| beattie-grief | grief | 悲痛与失落测试 | 见 grief.ts |

- 每套结构相同：10 道 0–10 评估、5 道选择、8 道判断，满分 230（100+50+80）。判断题有「不适用」记 10 分；内疚等题的 NA 规则在 `scoreTf`。戏剧化开始前有悲痛提醒。
- 昵称：ResultKit。`configure` 的 id 是 `beattie-` + 测试 id，开始按钮是警告页或首页上的「读过了，开始」。档案条目另存 `nick`。
- 档案键 `boundary-emotion-archive-v1`：数组，元素为 `{ testId, title, completedAt, sectionScores:{assessment,mcq,tf}, total, bandText, nick? }`。**没有逐题答案。** 每套最多 30 条。
- 草稿键 `boundary-emotion-draft-v1:` + testId：`{ step, warningAccepted, likert, mcq, tf, angerFill?, finishedAt? }`。愤怒测试有可选填空 `angerFill`，只在草稿里。回首页或重做会 `clearDraft`。
- 计分位置：`scoring.ts` 只加总；分数段原文在各测试 `bands`；说人话的灯色、headline、行动建议在 `insights.ts` 的 `insightFor`。结果页同时展示学习解读与「书中原话」。
- 再看：情绪档案可以。档案卡片重算灯色与建议（依赖当前前端代码），书中原话用当时存下的 `bandText`。
- 分享链接：无。导出走 ResultKit 长图，不是 `RK.save` 历史。本测评的「历史」是自有档案，不是 `rk.v1.beattie-*`。
- 云端：无。
- 适配：分项与总分、灯色、建议、书中原话可以 `full` 重绘**当前版本**的结果页。逐题答案与愤怒填空若不在交卷时写入 `extensionData`，关草稿后永久丢失，此时只能 `snapshot`。建议交卷时 `compat.level=full`，并写明 gaps 为空的前提是带上 `answers` 与 `openText.angerFill`。
- 接入文件：`beattie-src/src/main.ts` 交卷处（约 `saveArchiveEntry` 前后）；然后重新构建 `beattie/assets`。不要只改打包后的 js。
- 风险：书中原话较长，飞书长文本可能不够，应放 CloudBase；六套要六个 `assessmentId`，不要收成一条「情绪测试总分」；打包哈希文件名会变，Pages 缓存要一起换。

### 3.5 职业六芒星

- 目录：`star/`。访问：`star/index.html`。
- 技术：原生 ES Module。词表 `star/js/data.js`（31 词，四组）。无数值计分文件，流程在 `star/js/app.js`。
- 玩法：划掉 15、再划 10、再划 3，留下 3 个底层动力；从划掉的词里复活 3 个现实追求。可在结果页调整顺序。
- 昵称：ResultKit，id `star`。
- 会话 `career-star-v2`：`{ step, cull1, cull2, cull3, revived, driveOrder, pursueOrder, recId }`。
- 历史 `rk.v1.star`：`summarize()` 只有 headline「底层动力：A、B、C」、sub「现实追求：…」和 3 条固定说明。调整顺序会删掉上一条再存。旧档案 `career-star-archive-v1` 在首次加载时迁入。
- 再看：可以，看到的是 3+3 个词和星图（capture 支持 `hex` 分节）。三轮划掉过程不在历史里。
- 分享链接：无。页脚写明选择留在本机、不会上传。
- 云端：无。
- 适配：`full`，但 `dimensions` 不是分数。建议两条：`drive`（kind=category，labels 为 3 词）、`pursue`（同样）。`extensionData.rounds = { cull1, cull2, cull3, revived }` 才能还原过程。没有这个字段时，星图仍可画，过程不可还原，`compat.gaps` 要写上。
- 接入文件：`star/js/app.js` 的 `rememberResult()`。
- 风险：低，适合第一期试点。无诊断、无开放长文。结果页改顺序会换 report，若已上云，应生成新 reportId 还是更新旧链接，需要产品定：建议改顺序视为新的一次提交。

## 4. 站外仓

以下仓库公开可读。均标「站外仓」。改造不在 `mindtest-web` 一个 PR 里完成，每个仓要自己的改动与发布。

### 4.1 SEFS · 主观体验功能状态量表

- 仓：`xiangshu3721/my-react-app`，路径 `sefs/`（默认分支上 `main` 没有该目录，文件在 `master`）。线上 `?v=4`。
- 技术：单页原生 JS（`sefs/app.js`、`data.js`、`base.css`、`results.css`、`history.css`），自带一份 `result-kit.js`。外层 React 工程不是这套题的运行时。
- 题：4 维 × 6 题，0–4 分。维度：体验广度、体验容纳、体验归属、体验自主。每维 0–24，总分 0–96。主导维是最高分；≥15 分的维度达到 2 个则 `complex=true`。计分函数 `calc()` 在 `sefs/app.js`，没有独立 score 模块。
- 昵称：`RK.configure({ id:"sefs" })`，开始按钮 `#startBtn`。历史记录自带 `nick`。未见 `RK.save`，历史不进 `rk.v1.sefs`。
- 存储：会话 `sefs-v1-session` = `{ answers, index, agreed, view, curId }`。历史 `sefs-v1-history` = `{ v:1, max:30, items:[{ id, t, nick, answers[24], scores, total, leaders, complex }] }`。损坏时会尝试备份到 `sefs-v1-history-corrupt-backup`。
- 同意：封面勾选后才能开始；隐私弹层说明不上传、不含第三方统计。这是使用说明，不是「同意写入飞书」。
- 再看：有「我的历史结果」，可打开单条重绘雷达图。
- 分享：弹层生成 PNG，长按保存。无 URL。
- 云端：无。
- 适配：`full`。`dimensions` 四条；`result.flags` 含 `complex` 与主导维 id。
- 接入文件：`sefs/app.js` 写入历史处 `addHistory`；`sefs/index.html` 的脚本版本号。合集站 `index.html` 不用改逻辑，除非改卡片链接上的 `?v=`。
- 风险：草稿规则写明「尚未提供可核验的信效度」。报告须保留页面上的非诊断声明。

### 4.2 个人充电

- 仓：`geren-chongdian`。线上根路径。
- 技术：原生 JS。`js/engine.js` 纯计算，`js/rules.js` 文案与权重，`js/app.js` 三个 hash 页 `#/aware` `#/map` `#/repair`。自带 `result-kit.js`。
- 输入：状态单选或一句自述（有字数上限 `customMaxLen`），耗电来源最多 3 个。同一天再交卷会覆盖当天记录。
- 输出：电量 0–100、分档、四维耗电（身体与节律 body、情绪稳定 emotion、关系边界 relation、世界宽度 world）、链路落点（匮乏 scarcity、纠缠 entangle、关系抢电 grab、情绪失控 emotion、世界变窄 narrow）、修复动作、场域、关系训练。同一天同输入结果固定，动作在并列时按「第几天」轮换。
- 昵称：ResultKit id `gcd`，点「看看我的电量」时才确认。
- 存储：`gcd.v1 = { v:1, records:[{ date, ts, stateId, customText, sourceIds, done }] }`，最多保留 30 条。分数是打开地图时 `Engine.compute` 算出来的，不单独存。摘要另 `RK.save(summaryOf)` 到 `rk.v1.gcd`，**不带** `data`，因此历史摘要没有自述原文以外的 `who` 截断风险（`who`≤60）。
- 再看：可以。分享链接：无。云端：README 写明无后端。
- 适配：`full`，若 `extensionData` 保存输入 `{ stateId, customText, sourceIds, date }` 与当次 `compute` 返回值。只存摘要则会丢掉轮换动作的可重复性。自述走同意范围 `open_text`。
- 接入文件：`js/app.js` 提交成功、`RK.save` 旁边。
- 风险：自述可能出现人名；「覆盖今天」与云端「一份 report 永不覆盖」要说清楚：覆盖本地当天记录时，云端应新开 reportId，不改旧链接。

### 4.3 高敏感心力地图

- 仓：`sensitive-map`。Vite + React + TypeScript。
- 版本常量（`src/content/versions.ts`）：题库 `QB-1.1.0`，规则 `RR-1.1.0`，内容 `CT-1.1.0`，同意 `CONSENT-1.1.0`。产品名「高敏感心力地图」。
- 内容：32 道 Likert（可含不适用）、四域生活影响、情境题、一个选择、一段自述。四域：原生家庭 F、情感关系 R、情绪困扰 E、财富关系 M，每域 4 个子板块。同分规则有固定顺序，写在 `TIE_BREAK_RULE`。
- 会话 `sensitive-map-session-v1`：完整 `Session`，含同意记录、答案、影响、情境、选择、自述、生成好的 `report`。超过 7 天删除。
- 同意结构已存在：`participate` / `saveResult` / `contact`，各带时间和是否同意。这里的 `saveResult` 是本机保存语义，**不是**飞书同意。接入时要新增云端同意，不要偷用这个布尔值。
- 历史：`rk.v1.sensmap`。`saveReport` 把精简报告放进 `data.r`。注释写明不放自述、不放答题明细。精简字段：产品名、题库版本、规则版本、时间、summary、dimensions、topic、patterns、clue、helpNotice、anomalies、boundary。
- 计分与报告：`src/logic/score.ts`、`select.ts`、`report.ts`。`Report` 类型在 `src/model.ts`，字段很多（分数、模式链、线索、首要课题、异常、边界声明、答案副本等）。
- 再看：历史可重画导出长图（`ExportSheet`），前提是精简字段还在。自述与原始答案在会话清除后不在历史里。
- 分享：导出 PNG。`public/qr-ryu.png` 与 `ops-config.json` 是预约/接待配置，不是个人报告链接。
- 云端：无。
- 适配：交卷当时上传完整 `Report` + `narrative` 则 `full`。若只同步现有历史精简版，自述缺失，标 `snapshot`，gaps 写「不含自述与答题明细」。
- 接入文件：`src/lib/records.tsx` 的 `saveReport`；同意页 `src/pages/FlowPages.tsx`（只加云端同意，不改题目）。
- 风险：自述与关系细节敏感；报告对象大，不适合只塞进飞书长文本；已有同意文案与云端同意必须分成两步，避免「同意本机保存」被当成「同意给导师」。

### 4.4 珍爱金字塔

- 仓：`zhenai-pyramid`。原生 ES Module，无构建。
- 模型：6 维 × 6 题，1–5 分，反向题 6/12/18/24/30/36。维度分 = 总分/30×100。加权总分仅供参考（允许接纳 25%、自聚性 20%、理解与边界 20%、平和性 15%、有序性 10%、积极性 10%）。分级：80–100 稳定资源、60–79 可用成长、40–59 提醒修复、0–39 优先照顾。最低分并列取权重更高者。关联规则最多 2 条。
- 计分：`js/scoring.js` 的 `computeResult`。文案 `js/content.js`、`js/report.js`。图：`js/charts.js`、`js/pyramid3d.js`。
- 昵称：ResultKit id `zhenai`。
- 存储：`zhenai-pyramid:v1` 进度 `{ v, stage, idx, answers[36], done, practice, updated }`。历史 `RK.save(summary, { data:{ a:答案, p:练习 } })`。
- 结果字段：`sums`、`scores`、`total`、`totalLevel`、`levels`、`lowest`、`highest`、`allEqual`、`relations`、`weak`。页面还有 7 天练习与三维金字塔。
- 再看：可以，并能用 `data.a` 重绘长图。
- 分享链接：无。云端：README 写明不上传。
- 适配：`full`。这是外链仓里最适合当第二期样板的一套。
- 接入文件：`js/app.js` 在 `RK.save` 旁。
- 风险：三维图依赖前端几何，H5 报告要复用同一套绘制或接受「雷达 + 文字」等价阅读。练习勾选 `practice` 会变，链接若要反映练习进度，需另定「练习不进报告」或「练习更新产生新版本」。建议报告冻结交卷时的练习状态。

### 4.5 寻根之旅 · 原生家庭考古

- 仓：`root-journey-web`。Vite + React。
- 它不是一张 30 题的卷。本机档案 `JourneyData` 含：基本资料（**姓名、手机号、微信二维码**、出生年、籍贯、兄弟姐妹、人生阶段）、父亲/母亲长篇档案、材料、AI 洞察、内在角色、家庭模式测评、发展主题。
- 存储：IndexedDB 库 `root-journey-mvp`，对象库 `journey`，键 `current-device`。失败时退回 `localStorage["root-journey-demo-v1"]`。
- 家庭模式测评 `familyAssessment` 有版本、答案、维度分、开放题、反馈。这是档案中最接近「一份测评」的部分。
- 生命成长地图摘要走 ResultKit id `root`（`src/lib/records.ts`），capture 地图页。摘要不是全档案。
- 云：`src/lib/api.ts` 把材料发到腾讯云函数 URL（仓库 README 与 `tencent-scf/insight-proxy` 说明 Key 在函数环境变量）。默认回退地址写在源码里：`https://1304965105-dxgfj5bl4i.ap-shanghai.tencentscf.com`。这是洞察生成，不是结果表，也没有 reportId。函数允许 GitHub Pages 跨域。
- 再看：本机可继续编辑，没有「提交后冻结」的报告。
- 分享链接：无。
- 适配：**partial**。默认协议只收生命成长地图的 `reportContent` 快照（与现在导出图同一页），`extensionData` 不包含手机号、微信二维码、父母原文、材料全文。若将来要归档整份旅程，单独同意范围 `journey_archive`，并且不要进飞书索引列。
- 接入文件：`src/lib/records.ts` 与地图页保存点；**不要**在 `api.ts` 的洞察请求里夹带上云。
- 风险：高。误把 `JourneyData` 整包 POST 会把手机号和家庭故事写入新系统。本方案明确禁止默认整包。

### 4.6 爱的 5 种语言

- 仓：`5loves`。Vite + React。
- 30 道二选一。五种：肯定的言词 A、精心的时刻 B、接受礼物 C、服务的行动 D、身体的接触 E。每种在题面中出现 12 次。计分 `src/lib/score.ts` 的 `tally` / `primaries` / `ranked`。
- 昵称：ResultKit id `5loves`。
- 进度 `five-loves-progress-v1 = { picks, index }`。历史只存 ResultKit 摘要（主爱语、五种分数、表达建议），不存 30 个选项。
- 分享：`resultUrl()` 生成 `?r=n-n-n-n-n`，五种分数之和必须为 30，单个不超过 12。知道分数就能打开结果页。没有昵称、没有作废、没有同意。
- 云端：无。
- 适配：`full`，若提交时带上 `picks` 或五种分数。只靠现有 `?r=` 不能防转发后的扩散，也不能撤销。
- 接入文件：`src/lib/records.ts` 的 `saveResult`；`src/components/Result.tsx` 若保留旧分享，须加一句「这是分数短链，不是导师报告」。
- 风险：短链可被遍历（组合数有限）。新报告禁止使用这种编码。

### 4.7 巨婴测评

- 仓：`juying`。原生 JS，结构接近合集站内的 SCL-90。
- 20 项，0–5 分。前 10 心理特征，后 10 行为特征，总分 0–100。分档在 `js/data.js` 的 `BANDS`。计分 `js/score.js` 的 `scoreJuying`，返回 `{ total, mind, act, band, rows, marked, average, side }`。
- 昵称：ResultKit id `juying`。
- 会话 `juying-session`。历史 `RK.save(summarize(), { key: 20 个分数用逗号拼接 })`，6 小时内同答案不重复记。摘要 notes 最多 5 条高分项（分数≥4），**不是** 20 行全文。页面分节 capture 能补一截展示文字。
- 再看：可以。分享链接：无。云端：无。
- 适配：`full`，交卷时保存 `scoreJuying` 原对象即可。只同步摘要会丢掉未达 4 分的条目叙述。
- 接入文件：`js/app.js` 的 `recordResult()`。
- 风险：低到中。讲座对照，页面已声明不是诊断，协议里要保留这句。

### 4.8 霍兰德兴趣探索

- 仓：`holland-explore`。原生 JS，无 ResultKit。
- README：纯静态，结果只在 localStorage，无 AI、无 Key。
- 60 题，RIASEC 六维，计分在 `js/engine.js` 的 `HollandEngine.compute`，版本字符串 `RIASEC_V2`。分数为内部 0–100。输出：`scores`、`top_dimensions`、`holland_code`、`structure`（dominance、near_tie、differentiation、consistency、breadth）、`bands`、`ranking`、`quality`（FAST_RESPONSE / LOW_VARIANCE / MANY_UNSURE）、`median_ms`。
- 题后三问存在进度 `explore`：`q1` 开放文本最多 200 字，`q2` 多选，`q2other` 最多 60 字，`q3` 多选。
- 存储键：`holland_explore.nick`、`holland_explore.progress`、`holland_explore.history`。历史条目 `{ id, t, nick, result, explore }`。昵称不在 `rk.v1.nickname`，与合集站昵称**不自动同步**。
- 再看：本机历史可打开完整报告（`js/report.js`）。分享链接：无。云端：无。
- 适配：`full`。`result.code` = `holland_code`。六维进 `dimensions`。三问与 quality 进 `extensionData.openText` / `quality`。开放题同意范围 `open_text`。
- 接入文件：`js/app.js` 写入历史处（约生成 `rec` 的位置）；报告页 `js/report.js` 只读，不必改算法。
- 风险：开放题可能有学校、职业等识别信息；作答过快等质量标记应让导师看见，但不要写成「作答无效」除非原页面就是这么说的。

## 5. 跨测评技术事实

- 全部测评都是静态前端。GitHub Pages 不能保管密钥，也不能在服务端按 reportId 查库。
- 没有任何测评把结果写入 git。
- 导出图都是作答者主动保存的 PNG，微信里靠长按，不是链接。
- 「重新查看」全部依赖同一浏览器。换手机、清站点数据、无痕模式，历史就没了。这正是独立 H5 要补的缺口。
- 临床与高敏感内容：SCL-90（含危机题）、PDQ-4、心力地图自述、寻根之旅档案。上云顺序应晚于六芒星、巨婴、爱的语言、珍爱金字塔、霍兰德、个人充电、SEFS、ECR。
- 站外仓的 result-kit 是各仓 `public/` 或 `js/` 里的副本，不一定与合集站 `js/result-kit.js` 字节相同。改共用行为要逐仓对齐，不能只改 mindtest-web 一份就认为外链生效。

## 6. 可复用云端痕迹（不是测评本身）

核对过的公开文件：

| 仓库 | 实际存在的东西 | 和本方案的关系 |
|---|---|---|
| `mindtest-web` | 无 CloudBase、无飞书、无 webhook | 测评前端继续放这里 |
| `shenghuo-xinqing` `js/config.js` | 妙搭应用 `app_17g16djq8cb` 的 webhook：`https://hvtg4neiebi.feishuapp.com/app/app_17g16djq8cb/__runtime__/api/v1/automation/survey-ingest/runtime/webhook/3bf3b4a96b5d4ae0a27a9bebd9fbf172`。模式 `bitable`，请求体 `{ fields }`。`FEISHU_BITABLE.appId/appSecret` 为空 | 证明「浏览器不能直连开放平台、需要一个接收端」。该 URL 已公开，**不要**把测评结果打到这条 webhook。失败时数据留在 `shenghuo-xinqing:pending`，结果页可再试，这个重试体验可以对齐 |
| `shenghuo-xinqing` `js/submit.js` | 另有一条浏览器直连 `tenant_access_token` 的实现，注释写明会被 CORS 拦住且密钥会公开 | 新方案明确不走这条 |
| 任务背景中的应用 `cli_aa3e5840a3f89d2b` | 本次读到的前端与 `.env.example` **没有**这个字面量 | 实施前向管理员核对。不能在文档里把它写成「代码里已经配好」 |
| `wenji` | CloudBase 环境 `root-journey-prod-d4d7pzd0a8f805`，云托管 `wenji-api`。对话 Key 在服务端。用户会话仍在 `localStorage` `wenji_sessions` | 环境可以复用。问己没有测评结果表 |
| `asva-workbench`（分支 `master`） | 同一 CloudBase 环境。HTTP 服务路径 `/asva-api`。飞书表已有客户、预约、服务记录、员工、产品、报名、画像变更、原始资料、证据、更新提案、冲突。密钥在 CloudBase 环境变量，Pages 不含密钥 | 导入对接走这里，见 07。不要把测评 JSON 写进客户主表字段 |
| `root-journey-web` | 腾讯云 SCF 洞察代理，DeepSeek Key 在函数环境 | 只服务寻根洞察。测评报告不放进这个函数 |

未读到、因此不写入方案细节的内容：飞书 Base 的 app_token、任何 table_id 的真实值、`cli_aa3e5840a3f89d2b` 的权限范围、妙搭自动化里已经建了哪些列。这些在公开仓库的示例文件中是空的或只存在于云端环境。

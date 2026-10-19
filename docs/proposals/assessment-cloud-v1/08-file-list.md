# 08 · 最小改造文件清单

本 PR 只新增 `docs/proposals/assessment-cloud-v1/`。下表是**以后**开发时的文件，现在不改。原则：不动计分文件；能在 `save` 旁边加一次调用就不改题目与渲染。

## 1. 共享层（先做）

| 文件 | 仓 | 做什么 |
|---|---|---|
| `js/cloud-kit.js`（新） | mindtest-web | 同意框、生成 reportId、队列、提交、复制链接、撤销。不包含计分 |
| `r/index.html`（新） | mindtest-web | 只读报告壳 |
| `js/report-render.js`（新，可按阶段加） | mindtest-web | 按 assessmentId 画已保存的协议 |
| CloudBase 函数源码（新目录，位置待确认） | 建议不放进公开测评仓，或放不含环境变量的目录 | 校验、存储、飞书索引、ASVA 读 |
| 飞书「测评结果索引」（新表） | 飞书，确认后由管理员建 | 见 04 |

`js/result-kit.js` 第一期可以不改。各测评在自己的 `RK.save` 之后调用 cloud-kit。若希望少改测评文件，可以给 result-kit 加一个可选 `onSaved` 回调；那是共享层的小改动，仍然不改 `clean()` 的截断规则，避免历史导出行为变化。

## 2. 站内测评

| 测评 | 文件 | 挂点 |
|---|---|---|
| 六芒星 | `star/js/app.js` | `rememberResult()` |
| SCL-90 | `scl90/js/app.js` | `recordResult()` |
| SCL-90 版本号 | `scl90/js/data.js` | 只加常量，不改 `FACTORS` 与界值 |
| PDQ-4 | `pdq/js/app.js` | `recordResult()` |
| PDQ-4 版本号 | `pdq/js/data.js` | 只加常量 |
| ECR | `ecr/js/app.js` | `recordResult()` |
| Beattie | `beattie-src/src/main.ts` | `saveArchiveEntry` 之前，把草稿答案一并交给 cloud-kit |
| Beattie 产物 | `beattie/assets/*`、`beattie/index.html` | 仅在源码改完后重新构建 |

不要改：`scl90/js/score.js`、`pdq/js/score.js`、`ecr/js/score.js`、`beattie-src/src/lib/scoring.ts`、`star/js/data.js` 的词表、各 `*.test.mjs` 的期望分数。

不要改：根目录 `js/app.js`（未挂载副本）、`eap/`、`index.html` 的卡片顺序与文案。报告页不是新卡片。

## 3. 站外仓

每个仓单独发布。合集站卡片 URL 不用改，除非该仓的脚本缓存参数要升。

| 测评 | 仓内文件 |
|---|---|
| 巨婴 | `js/app.js` 的 `recordResult()` |
| 5 种语言 | `src/lib/records.ts` 的 `saveResult`；结果页保留旧 `?r=` 时加说明 |
| SEFS | `sefs/app.js` 的 `addHistory` |
| 珍爱金字塔 | `js/app.js` 里 `RK.save` 那一行附近 |
| 个人充电 | `js/app.js` 提交成功处 |
| 霍兰德 | `js/app.js` 写入 `holland_explore.history` 处 |
| 心力地图 | `src/lib/records.tsx` 的 `saveReport`；同意页只增加云端勾选 |
| 寻根之旅 | `src/lib/records.ts` 只上传地图快照。不改 `src/lib/api.ts` |

站外仓若自带一份 `result-kit.js`，不要求与合集站字节相同。cloud-kit 以脚本方式引入，或在 Vite 项目里放 `src/lib/cloud-kit.ts` 的薄封装，内部协议必须与 schema 1.0.0 一致。

## 4. ASVA（更后）

| 位置 | 改动 |
|---|---|
| `asva-workbench` 客户页 | 「从测评报告导入」粘贴框与预览 |
| `server` 路由 | 服务端调用测评读接口，写 SourceRecord |
| 环境变量 | `ASVA_REPORT_IMPORT_KEY`、测评函数基址。不进前端包 |
| 文档 | 若新增 source_type，走该仓已有的 schema 变更规则 |

客户主表字段清单不增加 SCL 因子列。

## 5. 明确排除

- 不改 `main` 上的运行时代码来「先试一下」。
- 不把 webhook、appSecret、ownerToken 写入任何测评仓库。
- 不删除导出图、历史、昵称门槛、外链卡片。
- 不把 `?debug` / `?preview` 的预填结果自动上云。调试查询存在时，cloud-kit 直接不展示上传块。

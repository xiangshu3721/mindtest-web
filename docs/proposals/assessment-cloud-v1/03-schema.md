# 03 · 统一测评结果 JSON Schema V1.0

机器可读文件：[schema.json](./schema.json)。`schemaVersion` 固定为 `1.0.0`。

## 1. 必填字段

| 字段 | 作用 |
|---|---|
| reportId | 云端主键，形如 `rpt_` + 16–64 位 URL 安全随机串。客户端生成 |
| assessmentId | 稳定短名，见 01 总表 |
| assessmentName | 给人看的名字，与当时页面标题一致 |
| assessmentVersion | 题库与规则版本。没有常量的测评，接入时新增字符串，不改算法 |
| nickname | 1–12 字 |
| completedAt | ISO 时间 |
| dimensions | 维分数或分类词，可为空数组（不推荐；六芒星至少两条 category） |
| result | 一句话结论、短码、标记 |
| interpretation | 页面上的解释段 |
| recommendations | 页面上的建议段 |
| reportContent | 原报告快照：视图模型、分节、纯文本兜底 |
| extensionData | 答案、计分原对象、开放题、同意、兼容级别 |
| source | 来自哪一页、站内或站外、客户端提交号 |
| schemaVersion | `1.0.0` |

同意书不单独占顶层，放在 `extensionData.consent`。未同意的结果不得调用提交接口。

## 2. 无损还原约定

还原顺序：

1. 用 `extensionData.score`（计分函数原返回值）和 `assessmentVersion` 对应的**现有**渲染函数重画。
2. 渲染函数读不到的装饰，用 `reportContent.viewModel`。
3. 仍缺的段落，用 `reportContent.sections`（与 result-kit capture 同形）。
4. 再不行，显示 `reportContent.textFallback`，并标明「结构化重绘不完整」。

云端不重新计分。若将来规则常量升级，旧报告仍用它保存的 `score` 与 `assessmentVersion`，不按新规则重算。

`reportContent.sections` 单份建议不超过 70000 字符，与 `js/result-kit.js` 的 `SEC_CAP` 一致，避免本机历史与云端快照一个被截一个没截时对不上。超出时优先保留文字、丢掉内嵌 SVG，图由分数重绘。

## 3. 示例（职业六芒星，试点形态）

```json
{
  "reportId": "rpt_7f3c1a9e2b84d016aa01",
  "assessmentId": "star",
  "assessmentName": "职业六芒星",
  "assessmentVersion": "star-words-31-v1",
  "nickname": "小林",
  "completedAt": "2026-10-19T15:04:00+08:00",
  "dimensions": [
    { "id": "drive", "name": "底层动力", "kind": "category", "score": null, "labels": ["自由", "创造性", "成就感"] },
    { "id": "pursue", "name": "现实追求", "kind": "category", "score": null, "labels": ["稳定", "健康", "家庭"] }
  ],
  "result": {
    "headline": "底层动力：自由、创造性、成就感",
    "code": null,
    "label": "自我整理，不是职业诊断",
    "summary": "现实追求：稳定、健康、家庭",
    "flags": []
  },
  "interpretation": [
    { "id": "note-1", "title": null, "text": "倒三角（底层动力）是划了三轮之后留下的 3 个词，是对你最要紧的。" }
  ],
  "recommendations": [
    { "id": "note-3", "title": null, "text": "这是一次自我整理，不是打分，也不是职业诊断。" }
  ],
  "reportContent": {
    "format": "view-model+sections",
    "viewModel": { "driveOrder": ["自由", "创造性", "成就感"], "pursueOrder": ["稳定", "健康", "家庭"] },
    "sections": [],
    "textFallback": "底层动力：自由、创造性、成就感。现实追求：稳定、健康、家庭。"
  },
  "extensionData": {
    "rounds": { "cull1": [], "cull2": [], "cull3": [], "revived": ["稳定", "健康", "家庭"] },
    "consent": {
      "agreed": true,
      "version": "consent-assessment-1",
      "at": "2026-10-19T15:04:02+08:00",
      "scopes": ["store", "share_link", "mentor_read"]
    },
    "compat": { "level": "full", "gaps": [] }
  },
  "source": {
    "site": "ASVA 常用心理测试",
    "path": "star/index.html",
    "repo": "mindtest-web",
    "origin": "in-repo",
    "clientSubmissionId": "sub_01HZXSTAR0001",
    "resultKitId": "star",
    "localKey": "career-star-v2"
  },
  "schemaVersion": "1.0.0"
}
```

示例里的词是虚构的，只说明形状。

## 4. SCL-90 怎么放（说明映射，不是新算法）

- `dimensions`：10 个因子，`score` = mean，`raw` = 因子总分，`level` / `narrative` 用 `scoreScl90` 已返回的字段。
- `result.headline` = 现有 `verdictTitle` + GSI。`result.flags` 含 `positive` 或 `negative`，若有危机再加 `crisis-urgent` / `crisis-alert` / `crisis-note`。
- `interpretation`：`verdictText`、`gsiText`、各因子 narrative、`crisis.text`。
- `recommendations`：`guidance` 各行。
- `extensionData.score`：整个返回值。`extensionData.answers`：90 个 1–5。`extensionData.profile`：姓名、性别、年龄段。`extensionData.quality.rushed`：现有 rush 标记。
- 无 `profile_demographics` 同意时：不上传 `profile`，`reportContent` 里的姓名行改成「未同意保存资料页」，并在 `compat.gaps` 注明。页面本地报告仍显示姓名。这一条是隐私裁剪，不是改计分。

## 5. 各测评 compat 预置

| assessmentId | 预置 level | gaps（若按建议抓数） |
|---|---|---|
| star | full | 空。若不抓三轮过程，则 gaps 加「无划词过程」 |
| juying、5loves、sefs、zhenai、ecr、pdq4、holland、gcd | full | 空 |
| scl90 | full | 未同意资料页时注明姓名未上传 |
| sensmap | full | 若只同步历史精简版，改为 snapshot，gaps「无自述与答题明细」 |
| beattie-* | full | 若不存逐题，改为 snapshot |
| root | partial | 固定不含电话、二维码、父母原文、材料与洞察全文 |

EAP 与未挂载的根目录 ECR 副本不产生记录。

## 6. 校验

服务端用本 schema 做结构校验。失败返回 422，正文不入库。未知测评 id 在试点期拒绝，避免把调试页写进表。

不要把 schema 文件当成运行时接口从 GitHub 拉取后再信任：Pages 上的 json 谁都能改。云函数内嵌同一份 schema，或内嵌其哈希。仓库里的文件只供审阅。

# 05 · API、权限、去重与重试

密钥、飞书 token、ASVA 集成密钥只出现在 CloudBase 环境变量。浏览器与 GitHub 仓库只知道函数的 HTTPS 地址。

## 1. 放在哪

建议在已有环境 `root-journey-prod-d4d7pzd0a8f805` 新建 HTTP 云函数，路径与 ASVA 的 `/asva-api` 分开，例如：

```text
https://<env>.ap-shanghai.app.tcloudbase.com/mindtest-report
```

分开的原因：测评提交是匿名的，ASVA 接口是管理员登录后的。放在同一个函数里，匿名路由一旦配错就会碰到客户档案。

不新建一套腾讯云账号。不把函数码放进测评仓库的提交历史里夹带密钥。函数代码以后可以放在 `asva-workbench` 或单独的私有部署目录；本方案不决定仓库，只决定运行位置。

问己的云托管 `wenji-api` 不承载测评。寻根的 SCF 洞察函数不承载测评。

## 2. 浏览器调用的三个接口

允许的 Origin：`https://xiangshu3721.github.io` 与本地开发源。其他 Origin 拒绝。预检可缓存。这与问己 README 里「只允许 GitHub Pages 跨域」的做法一致。

### 2.1 提交 `POST /v1/results`

请求体就是 AssessmentResult V1，且 `extensionData.consent.agreed === true`，范围至少包含 `store` 与 `share_link`。

服务端：

1. 校验 schema、测评 id 在允许清单、昵称长度、同意版本是当前公布的版本。
2. 生成或接受客户端的 `reportId`。格式不对则 422。
3. 以 `clientSubmissionId` 做唯一约束。相同 id 且正文哈希相同：200，返回已有链接。相同 id 哈希不同：409。
4. 写入 CloudBase 文档。文档内另存 `ownerSecret` 的哈希（原文只在响应里出现一次）和 `linkSecret` 的哈希。
5. 写飞书索引。失败则文档记 `index_pending`，响应仍可带 `index: "pending"`。
6. 不把 `ownerSecret` 写入飞书。

响应：

```json
{
  "reportId": "rpt_...",
  "reportUrl": "https://xiangshu3721.github.io/mindtest-web/r/#rpt_....<linkSecret>",
  "ownerToken": "<ownerSecret>",
  "status": "active",
  "index": "ok"
}
```

`ownerToken` 只返回这一次。客户端放进 `localStorage` 键 `rk.cloud.owner.v1.<reportId>`。清站点数据后不能再自助撤销，只能由管理员在飞书或 ASVA 后台撤销。同意文案要写明这一点。

无登录。不收集手机号。不设账号。

限流建议：单 IP 每分钟 10 次提交、每小时 40 次。超限 429。正文上限 400KB。寻根 partial 快照应远小于此；超过上限直接 413，提示缩短，而不是截断入库。

### 2.2 读报告 `POST /v1/results/read`

用 POST 是为了让链接秘密放在 JSON 正文，而不是查询串，减少它出现在访问日志和微信 Referer 里。

```json
{ "reportId": "rpt_...", "linkSecret": "..." }
```

- 哈希匹配且状态有效：200，返回去掉 `ownerSecret`、内部哈希之后的协议 JSON。
- 状态已撤销：410，正文只有 `{ "error": "revoked" }`，无报告内容。
- 秘密错误：404，与「不存在」相同，避免探测 reportId。
- 不提供「列出某昵称全部报告」的公开接口。

H5 页面任何人拿到完整链接都能读。这就是分享权限模型：权限 = 持有链接。同意文案写明「打开链接的人能看完整报告，包括分数和你同意保存的文字」。

### 2.3 撤销 `POST /v1/results/revoke`

```json
{ "reportId": "rpt_...", "ownerToken": "..." }
```

成功：200，状态改为 revoked，飞书索引同步。再次撤销：200，幂等。token 错误：404。

管理员撤销走下一节的集成接口，不把管理员密钥放进测评网页。

## 3. ASVA 只读拉取 `POST /v1/integrations/asva/read`

调用方只能是 ASVA 云函数。请求：

```json
{ "reportId": "rpt_...", "linkSecret": "..." }
```

请求头：`Authorization: Bearer <ASVA_REPORT_IMPORT_KEY>`。该密钥只存在于两个 CloudBase 函数的环境变量：测评函数校验它，ASVA 函数发送它。

两者都要：集成密钥证明是 ASVA 服务端，链接秘密证明管理员是从导师发来的链接进入，而不是凭空遍历全部测评。缺少任一个都是 404。

返回与 H5 相同的协议 JSON。不返回 ownerToken。已撤销返回 410。

没有批量导出接口。

## 4. 防重复

| 情况 | 行为 |
|---|---|
| 网络超时后的自动重试 | 同一 reportId、同一 clientSubmissionId、同一哈希，返回原链接 |
| 作答者返回修改答案后再交卷 | 新的 clientSubmissionId 与新的 reportId。旧链接仍指向旧答案 |
| 六芒星在结果页只调整词序 | 视为新提交。旧链接保持原顺序 |
| 个人充电覆盖「今天」 | 新提交。不更新昨天或今天早些时候的链接 |
| 巨婴本机 6 小时同答案去重 | 只影响 localStorage 历史条数，不代替云端幂等 |
| 5 种语言 `?r=` | 与 reportId 无关 |

本机在点击「保存并生成链接」时生成两个 id，写入 `localStorage["rk.cloud.pending.v1"]` 队列，成功后再标完成。

## 5. 失败与离线

提交失败（断网、429、500、飞书索引 pending 以外的写入失败）时：

- 测评结果页照常显示，与今天一样。
- 页面说明「链接还没生成，结果仍在这台设备上」。
- 队列保留协议 JSON、reportId、重试次数、下次时间。
- 退避：约 5 秒、30 秒、2 分钟，之后每次打开该测评结果页或合集站时再试，最多 8 次。仍失败则留下按钮「再试一次」，对齐小调查结果页的补发，但队列键用统一的 `rk.cloud.pending.v1`，不要各写一套。
- 不在后台无限重试，避免无痕模式或禁用存储时卡住。
- 队列里是敏感内容。同意文案写明「生成链接前，一份副本会暂存在这台设备」。撤销成功或用户点「放弃上云」时删除队列项。

飞书索引失败但全文已写入：响应 `index: "pending"`，链接可用。函数内部重试索引，不要求用户再交卷。

## 6. 日志

函数日志只记 reportId、assessmentId、状态码、耗时。不记昵称、答案、开放题、linkSecret、ownerToken、Authorization。与 ASVA SourceRecord 文档「普通日志不输出 raw_text」同一原则。

## 7. 同意文案（需产品定稿后才能开发）

最低内容：

- 保存内容：这一次的分数、结论、以及你在页面上看到的解释；若勾选开放题或资料页，还包括那些文字。
- 保存位置：腾讯云上的报告库，以及飞书里的一条索引（昵称、测评名、时间、一句结论）。
- 谁能看：持有链接的人；你把链接发给导师，导师就能看。
- 撤销：在这台设备上可以让链接失效；清掉浏览器数据后需要联系管理员。
- 不做：不注册、不收手机号、不把结果放进公开网页仓库。
- 不勾选：结果只留在这台设备，和现在一样。

SCL-90、PDQ-4、心力地图、寻根之旅使用追加段落，不能只用六芒星那一版短文案。追加段落在开发前单独确认。

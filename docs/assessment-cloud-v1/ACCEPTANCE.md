# 上线前验收

PR #16 保持草稿。未经用户明确同意，不合并 `main`，不发布 GitHub Pages，不把飞书改成 live。

当前阶段只做测评基础设施。ASVA 客户档案、导师工作台、导入、客户 ID 关联、审核、画像和 AI 分析全部暂缓。`tools/asva-import-preview.html` 留在仓库里，不再开发、不再联调、不再部署。本阶段对外使用的是报告保存、阅读和撤销。标准化读取接口还在，但不接到 ASVA。

判定以仓库测试和操作者已经做过的 CloudBase 合成闭环为准。真机、微信和飞书真实读写还没有做。

## 已验证

- `npm test` 覆盖原有 ECR、SCL-90、PDQ-4 计分，以及六芒星协议：不勾选不提交、同一提交号幂等、内容变了返回 409、错误秘密和不存在都是 404、撤销后 410 且正文没有词。
- 分享链接的秘密放在 hash。`?r=` 这种短链不会被当成 `reportId`。
- 服务端日志只记服务名、reportId、测评 ID、状态码和耗时。
- 来源不在允许列表里时返回 403。允许的来源是写明的站点，不是任意网站。代码里的允许来源包括 `https://xiangshu3721.github.io` 和手机预览所在的 `https://root-journey-prod-d4d7pzd0a8f805-1304965105.ap-shanghai.app.tcloudbase.com`。
- 飞书默认 `off`。mock 下写入失败会把报告标成「待重试」，报告仍能读。满 8 次标成「失败」，报告仍能读。
- 补偿入口 `POST /v1/integrations/feishu/retry` 在没有部署确认或没有管理密钥时返回 404。密钥正确且已确认部署时，待重试的报告可以补写成「已同步」，同一报告 ID 只有一行。
- 飞书 HTTP writer 用假的接口演练过：先按「报告 ID」查询，没有记录才新建，已有记录只更新。时间字段会转成毫秒数字。演练没有请求 `open.feishu.cn`。
- 隔离表名拒绝 `assessment_reports`。云上存储是 PostgreSQL 表 `assessment_reports_dev`。
- 操作者已在真实环境做完 CloudBase 合成闭环。接口是 `https://root-journey-prod-d4d7pzd0a8f805-1304965105.ap-shanghai.app.tcloudbase.com/assessment-report-dev`。
- 预览包只含职业六芒星和阅读页。它的阅读页基址是 `.../assessment-report-dev/preview/r/`。正式配置 `js/assessment-cloud-config.mjs` 仍指向 GitHub Pages 的 `r/`。部署确认打开时，函数只提供 `/preview/`，不把仓库里的其他页面挂出去。
- 其他测评页面没有引用云端块。`asva-api` 没有改。

## 未验证

- 飞书真实建表和真实读写。还没有「ASVA 测评数据」的 Base 链接，也没有 `table_id`。线上开关仍是 `off`。
- 普通协作者账号是否看不到或不能导出「ASVA 测评记录」。核对步骤在 `FEISHU_ACL.md`。
- 手机预览地址还要操作者按 `cloud/assessment-report/DEPLOY.md` 重新部署 `assessmentReportDev` 之后才打得开。本代理没有部署。部署前打开 `/preview/` 会是 404。
- iPhone Safari、安卓 Chrome、微信内的点击。步骤在 `E2E_BROWSER_WECHAT.md`，文末表格仍是「未做」。
- GitHub Pages 上的作答页和阅读页还没有这份前端。分支未合并，`xiangshu3721.github.io/mindtest-web` 不会变成这次的测试地址。
- 线上函数还没有调用过补偿入口。

## 上线阻断项

- 用户还没有同意合并或发布。在同意之前停止。手机预览只为验收，不是发布。
- 飞书 Base 链接还没给。权限清单还没用人点过。在这之前禁止 `FEISHU_INDEX_MODE=live`。
- 真机浏览器和微信内步骤还没走完。发布给真实访客之前要先走完 `E2E_BROWSER_WECHAT.md`。预览地址 404 时，先完成 DEPLOY.md 里的那一次函数部署，再开始点。
- 上线和回滚顺序见 `GO_LIVE_ROLLBACK.md`。已发出的 `#rpt_<id>.<secret>` 在函数和 PostgreSQL 行还在时继续有效。预览链接和以后的 Pages 链接是两套地址，已发出的预览链接只在预览页还在时打得开。
- 本阶段不把 ASVA 导入、客户 ID、审核、画像或 AI 分析当作上线条件。这些先不做。
- 增量消耗见下一节。这个量不需要购买资源包，也不要为验收改套餐。若实际调用量比下一节高出一个数量级，先停下来看，不要先买。

## 增量消耗

按一份合成职业六芒星估算。昵称「小林」，3 个底层动力加 3 个现实追求。数字来自当前协议对象：`byteSize(payload)` 为 3056 字节，整份入库文档 JSON 为 3628 字节。加上 `report_id`、`source_submission_id` 和索引，PostgreSQL 里大约一行 4KB。单份上限仍是 400KB，超过直接拒绝，不截断入库。不存图片、PDF、HTML。

走完「保存 → 刷新仍是同一条 → 新开页读回 → 撤销 → 再打开看到失效」：

| 项目 | 次数 | 说明 |
|---|---|---|
| 数据库新增行 | 1 | 同一提交号再提交不新增。换一组词才是新的一行 |
| 接口调用 | 4 | 保存 1 次，读回 1 次，撤销 1 次，失效后再读 1 次 |
| 飞书写入 | 0 | `FEISHU_INDEX_MODE=off`，不请求飞书 |
| 页面请求 | 约 30 | 预览页由这个函数顺带提供。打开作答页约 8 个文件，阅读页约 6 个。刷新会再要一次。验收点一遍大约几十次函数调用 |

离线时请求到不了服务器，不计调用。网络恢复后「再试一次」成功，只增加 1 次保存。若第一次其实已经写入、手机没收到响应，再试仍是同一行。

飞书以后改成 live 并且写入成功时：第一次保存 1 次，撤销再 1 次，按报告 ID 覆盖，不另起一行。已经同步过的重复提交不再写飞书。读报告不写飞书。在 Base 链接和权限核对完成之前，这一列保持 0。

最小实例仍是 0。不新建静态网站，不新增函数，不改 `asva-api`。

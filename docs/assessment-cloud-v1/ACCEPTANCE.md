# 上线前验收

PR #16 保持草稿。未经用户明确同意，不合并 `main`，不发布 GitHub Pages，不把飞书改成 live。

判定日期以仓库里的测试和操作者已经做过的 CloudBase 合成闭环为准。真机、微信和飞书真实读写还没有做。

## 已验证

- `npm test` 覆盖原有 ECR、SCL-90、PDQ-4 计分，以及六芒星协议：不勾选不提交、同一提交号幂等、内容变了返回 409、错误秘密和不存在都是 404、撤销后 410 且正文没有词。
- 分享链接的秘密放在 hash。`?r=` 这种短链不会被当成 `reportId`。
- 服务端日志只记服务名、reportId、测评 ID、状态码和耗时。
- 来源不在允许列表里时返回 403。允许的来源是写明的站点，不是任意网站。
- 飞书默认 `off`。mock 下写入失败会把报告标成「待重试」，报告仍能读。满 8 次标成「失败」，报告仍能读。
- 补偿入口 `POST /v1/integrations/feishu/retry` 在没有部署确认或没有管理密钥时返回 404。密钥正确且已确认部署时，待重试的报告可以补写成「已同步」，同一报告 ID 只有一行。
- 飞书 HTTP writer 用假的接口演练过：先按「报告 ID」查询，没有记录才新建，已有记录只更新。时间字段会转成毫秒数字。演练没有请求 `open.feishu.cn`。
- 隔离表名拒绝 `assessment_reports`。云上存储是 PostgreSQL 表 `assessment_reports_dev`。
- 操作者已在真实环境做完 CloudBase 合成闭环。配置里的 endpoint 是 `https://root-journey-prod-d4d7pzd0a8f805-1304965105.ap-shanghai.app.tcloudbase.com/assessment-report-dev`，阅读页基址是 `https://xiangshu3721.github.io/mindtest-web/r/`。
- 其他测评页面没有引用云端块。`asva-api` 没有改。

## 未验证

- 飞书真实建表和真实读写。还没有「ASVA 测评数据」的 Base 链接，也没有 `table_id`。
- 普通协作者账号是否看不到或不能导出「ASVA 测评记录」。核对步骤在 `FEISHU_ACL.md`。
- Chrome、Safari 真机上的完整点击。步骤在 `E2E_BROWSER_WECHAT.md`。
- 微信里打开、转发、撤销后再次打开。
- GitHub Pages 上的作答页和阅读页还没有这份前端。分支未合并，线上页面还不会调用新的 endpoint。
- 线上函数还没有调用过补偿入口。线上飞书开关仍是 `off`，这一轮不去打开它。

## 上线阻断项

- 用户还没有同意合并或发布。在同意之前停止。
- 飞书 Base 链接还没给。权限清单还没用人点过。在这之前禁止 `FEISHU_INDEX_MODE=live`。
- 真机浏览器和微信内步骤还没走完。发布给真实访客之前要先走完 `E2E_BROWSER_WECHAT.md`。
- 上线和回滚顺序见 `GO_LIVE_ROLLBACK.md`。已发出的 `#rpt_<id>.<secret>` 在函数和 PostgreSQL 行还在时继续有效。

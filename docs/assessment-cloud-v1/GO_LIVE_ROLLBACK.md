# 上线顺序和回滚

未经用户明确同意，不合并 `main`，不发布 GitHub Pages，不把飞书改成 `live`。这份 PR 保持草稿。

## 上线顺序

1. 隔离函数已经在 `assessment-report-dev`。健康检查是 `store=postgres`、`feishu=off`。这一步不要再部署别的函数，不要动 `asva-api`。
2. 前端配置已经指向该函数和 `https://xiangshu3721.github.io/mindtest-web/r/`。GitHub Pages 要等用户同意合并并发布后，线上作答页才会带上这个地址。合并本身不是本文件的授权。
3. 飞书继续 `FEISHU_INDEX_MODE=off`。等用户给出「ASVA 测评数据」的链接，并按 `FEISHU_ACL.md` 用普通协作者账号核对通过，再建「ASVA 测评记录」。
4. 表和权限都就绪之后，才在函数环境变量里填 `FEISHU_APP_TOKEN`、`FEISHU_ASSESSMENT_TABLE_ID`、`FEISHU_APP_ID`、`FEISHU_APP_SECRET`、`FEISHU_INDEX_LIVE_CONFIRM=YES`，然后把 `FEISHU_INDEX_MODE` 改为 `live` 并重启函数。凭证不进 Git。缺任何一项时，进程拒绝以 live 启动。
5. 用合成昵称走一遍保存。PostgreSQL 里有行，飞书里同一报告 ID 只有一行。再调用一次补偿入口，行数仍然是一。
6. 按 `E2E_BROWSER_WECHAT.md` 在 Chrome 或 Safari，以及微信里走完同意、复制、新开页、撤销。

补偿入口是 `POST /v1/integrations/feishu/retry`，正文用 `{}`。要同时满足：函数以 `ASSESSMENT_DEPLOY_CONFIRM=dev-isolated` 启动，并且请求头带 `Authorization: Bearer <ASVA_REPORT_IMPORT_KEY>`。缺一项时返回 404。这个地址不放进页面。

## 回滚

1. 飞书出问题：把 `FEISHU_INDEX_MODE` 改回 `off` 并重启。已保存的报告仍在 PostgreSQL，阅读和撤销照旧。飞书里可能缺一行或停在旧状态，这不表示报告丢了。
2. 前端出问题：把 `js/assessment-cloud-config.mjs` 的 `endpoint` 改回空字符串再发布。Pages 会停止发起新的保存。已经发出去的 `#rpt_<id>.<secret>` 只要函数还在、行还在，就还能打开。
3. 函数出问题：不要删表 `assessment_reports_dev`。把函数环境变量改回上一个可用组合，或重新部署这一分支里已知可用的修订。最小实例保持 0。不要升级套餐，不要购买资源包。
4. 不要为了回滚去改 `asva-api`，也不要改其他测评的题目、计分和入口。

## 已生成报告怎么兼容

- `reportId` 仍是 `rpt_` 加一段随机串。分享秘密仍在链接的 `#` 后面，不进查询串，不进飞书。
- 协议版本保持 `1.0.0`。阅读接口只认 `reportId` 和链接秘密，不看飞书有没有行。
- `feishuSync` 可以是 `off`、`待重试`、`失败` 或 `已同步`。这四种状态下，未撤销的报告都还能读。
- 撤销后的链接继续返回 410，正文不带词。回滚飞书不会把已撤销的链接重新打开。
- 同一 `clientSubmissionId` 再提交，正文没变就还是原来的报告；正文变了返回 409。旧链接继续指向旧报告。
- 补偿只处理状态为「待重试」的行。已经「失败」的要另行处理，不会在飞书里自动再插一行。同一报告 ID 找到旧记录就更新，找不到才新建。

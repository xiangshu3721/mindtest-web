# 真机浏览器和微信内验收

这一页是给人走的步骤。仓库里的 `npm test` 已经覆盖协议、幂等、撤销和来源限制。真机和微信还没有人走完，所以验收清单里这两项标为未验证。

用合成昵称，例如「小林」。不要填真实客户的姓名、电话或原话。

正式地址：

- 作答页要等这份分支发布到 GitHub Pages 之后，才是 `https://xiangshu3721.github.io/mindtest-web/star/index.html`
- 阅读页基址：`https://xiangshu3721.github.io/mindtest-web/r/`
- 接口：`https://root-journey-prod-d4d7pzd0a8f805-1304965105.ap-shanghai.app.tcloudbase.com/assessment-report-dev`
- 健康检查应看到 `store` 为 `postgres`，`feishu` 为 `off`

发布之前，可以在本机走同一套点击：`node cloud/assessment-report/local-server.mjs`，打开 `http://127.0.0.1:4173/star/index.html`。本机接口是内存库，不能代替线上 PostgreSQL 的那一次。

## Chrome 或 Safari

1. 打开六芒星，做完，停在原结果页。不勾选同意时，网络面板里没有 `/v1/results`。
2. 勾选同意，保存。请求发到上面的 endpoint，路径是 `POST /v1/results`。响应 200，记下 `reportId`。
3. 复制链接。链接形状是 `https://xiangshu3721.github.io/mindtest-web/r/#rpt_<id>.<secret>`。秘密在 `#` 后面。地址栏的 `?` 查询里没有 `r`，也没有秘密。
4. 再交一次同一结果。还是同一个 `reportId`。换一组词会得到新的 `reportId`，旧链接仍能打开旧结果。
5. 新开一个无痕窗口，粘贴链接。页面读回同一组词。请求是 `POST /v1/results/read`，正文带 `reportId` 和 `linkSecret`。响应头没有把秘密写进日志能看到的查询串。
6. 回到作答设备，撤销。阅读页刷新后只剩「这条链接已经失效」，状态 410，正文没有词。
7. 打开开发者工具的网络和文档请求。失败请求的页面来源如果不是 `https://xiangshu3721.github.io`，接口应返回 403。允许的来源写在服务端，不是 `*`。

服务端日志只保留服务名、reportId、测评 ID、状态码和耗时。日志里不应出现分享秘密或作废口令。

## 微信内

1. 用手机微信打开作答页，完成并同意保存。若 Pages 还没发布这份前端，这一步先标未验证。
2. 复制链接，发给文件传输助手。点开链接。微信标题是页面里写死的「ASVA 测评报告」。
3. 确认打开的是同一组词。再从作答页撤销，文件传输助手里重新点开，只看到失效页。
4. 看分享卡片的链接，秘密仍在 `#` 后面。微信不要把秘密放到 `?` 查询里。

做完把浏览器、微信版本和结果写进 `ACCEPTANCE.md` 的已验证或未验证。

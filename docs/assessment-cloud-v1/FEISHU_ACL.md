# 飞书独立 Base 权限核对

表要建在单独的 Base「ASVA 测评数据」里。表名仍是「ASVA 测评记录」。现在还没有这个 Base 的链接，也没有 `table_id`。链接由用户稍后提供。在链接到齐、下面每一项都打勾之前，不建表，不把 `FEISHU_INDEX_MODE` 改成 `live`。

应用用 `cli_aaff6cb53db89bd3`（ASVA 和解忧小屋共用的那个）。不要用生活小调查的应用 `cli_aa3e5840a3f89d2b`。不要接妙搭 webhook。

隐藏视图只是默认不展示。有 Base 权限的人仍然可以打开表、改视图或导出。隐藏视图不算访问控制。

## 要核对的人

在飞书里打开这个 Base 的成员和高级权限，逐项写下结果：

1. 谁有可管理、可编辑、可阅读。把导师、群成员、外部协作者的名字记下来。
2. 高级权限能不能把「ASVA 测评记录」收成：只有应用 `cli_aaff6cb53db89bd3` 可以读和写。其他人不可读、不可导出。
3. 普通协作者用自己的账号打开这个 Base 时，应看不到这张表，或者打开后没有记录、不能导出。用一个真实的普通协作者账号点一次，把截图或一句结论记在建表记录里。
4. 应用的 `tenant_access_token` 能读到整张表。这是服务端写索引需要的。服务端日志仍然只记 reportId、测评 ID、状态码和耗时，不记分享秘密、作废口令和全文。
5. 导出、自动化、群机器人没有订阅这张表。索引不要转发到群。

做不到第 2 点，就不要把表放进任何已经有客户资料的 Base。继续用这个单独 Base，把成员收干净，再重新核对。

## 建表

权限核对通过、用户给出 Base 链接之后，才在「ASVA 测评数据」里建「ASVA 测评记录」。16 个字段和类型见 `DELIVERY.md` 第 4 节。来源、报告状态、客户归档状态、同步状态做成单选。完成时间和创建时间做成日期时间。报告字节数做成数字。

从 Base 链接取出 app token，表建好后取出 `table_id`。这两个值连同应用密钥只放在云函数环境变量里：

- `FEISHU_APP_TOKEN`
- `FEISHU_ASSESSMENT_TABLE_ID`
- `FEISHU_APP_ID` = `cli_aaff6cb53db89bd3`
- `FEISHU_APP_SECRET`
- `FEISHU_INDEX_LIVE_CONFIRM` = `YES`
- `FEISHU_INDEX_MODE` = `live`

这一轮线上函数保持 `FEISHU_INDEX_MODE=off`。不要把上述值写进 Git。

进程内可以先看字段形状，它不会请求飞书：

```bash
node cloud/assessment-report/feishu-synthetic.mjs
```

脚本如果带 `--live` 会直接退出。等权限核对完成后再考虑真实写入。

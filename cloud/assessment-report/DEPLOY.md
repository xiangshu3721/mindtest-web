# assessmentReportDev 隔离部署

只部署这个函数。不要部署、不要更新 `asva-api`。不要把飞书改成 `live`，不要创建飞书表，不要购买资源包，不要改套餐。

环境：`root-journey-prod-d4d7pzd0a8f805`（个人版 `baas_personal`）。

函数名：`assessmentReportDev`  
HTTP 路径：`/assessment-report-dev`  
运行时：Nodejs20.19  
内存：256 MB  
超时：60 秒  
最小实例：0（部署后在控制台确认，不要改成常驻）

公开基址：

```text
https://root-journey-prod-d4d7pzd0a8f805-1304965105.ap-shanghai.app.tcloudbase.com/assessment-report-dev
```

这个环境的侧栏是 SQL 数据库（PostgreSQL）。隔离数据是表 `assessment_reports_dev`。云函数用 `@cloudbase/node-sdk` 的 `rdb()` 访问，不使用 SecretId / SecretKey。下面的开关不是密钥。不要把 `ASVA_REPORT_IMPORT_KEY`、飞书应用密钥、`CLOUDBASE_APIKEY`、数据库连接串写进 Git。

## 先在 SQL 数据库建表

控制台：环境 `root-journey-prod-d4d7pzd0a8f805` → SQL 数据库 → 执行下面的 SQL。不要建 `assessment_reports`。

```sql
CREATE TABLE IF NOT EXISTS assessment_reports_dev (
  report_id text PRIMARY KEY,
  source_submission_id text NOT NULL,
  doc jsonb NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS assessment_reports_dev_source_submission_id_uidx
  ON assessment_reports_dev (source_submission_id);
```

`report_id` 对应 `reportId`。`source_submission_id` 对应 `clientSubmissionId`，唯一。`doc` 是整份服务端文档（jsonb），字段与内存文档一致：`reportId`、`sourceSubmissionId`、`bodyHash`、`byteSize`、`linkSecretHash`、`ownerSecretHash`、`shareStatus`、`revokedAt`、`archiveStatus`、`customerId`、`feishuSync`、`feishuAttempts`、`indexStatus`、`createdAt`、`payload`、`collection`。

`rdb()` 不能执行建表。表还不存在时，函数启动失败，日志里会带上同一段 SQL。设了 `ASSESSMENT_PG_URL` 时，函数会自己执行这两句。

## 环境变量

| 变量 | 值 |
|---|---|
| `ASSESSMENT_COLLECTION` | `assessment_reports_dev` |
| `ASSESSMENT_STORE_DRIVER` | `postgres` |
| `ASSESSMENT_CLOUDBASE_WRITE_CONFIRM` | `dev-isolated` |
| `ASSESSMENT_DEPLOY_CONFIRM` | `dev-isolated` |
| `FEISHU_INDEX_MODE` | `off` |
| `PUBLIC_REPORT_BASE` | `https://xiangshu3721.github.io/mindtest-web/r/` |

`PUBLIC_REPORT_BASE` 在临时阅读域名出来之前，先指向 GitHub Pages 的 `r/`。分享链接由服务端拼接，秘密仍在 hash 里。

同一份声明在本目录 `cloudbaserc.json` 的 `envVariables`。其中没有密钥。

这一轮 `FEISHU_INDEX_MODE` 保持 `off`。不要在函数上改成 `live`，也不要创建飞书表。

`live` 只有在同时具备 `FEISHU_INDEX_LIVE_CONFIRM=YES`、`FEISHU_ASSESSMENT_TABLE_ID`、`FEISHU_APP_ID`、`FEISHU_APP_SECRET`、`FEISHU_APP_TOKEN` 时才会监听。缺任何一项，进程退出，避免半套配置去连飞书。这些值只放函数环境变量，不进 Git。表要建在独立 Base「ASVA 测评数据」，权限核对见 `docs/assessment-cloud-v1/FEISHU_ACL.md`。

补偿入口是 `POST /v1/integrations/feishu/retry`，正文用 `{}`。它要求 `ASSESSMENT_DEPLOY_CONFIRM=dev-isolated`（健康检查里 `deployed: true`）并且 `Authorization: Bearer <ASVA_REPORT_IMPORT_KEY>`。缺一项就是 404，页面上没有这个入口。返回只有 `retried`、`synced`、`pending`、`failed` 四个数字。它只重试「待重试」，按报告 ID 覆盖同一行，不给已标「失败」的记录自动再试。上线顺序、回滚和验收清单在 `docs/assessment-cloud-v1/GO_LIVE_ROLLBACK.md` 与 `ACCEPTANCE.md`。

### 鉴权

平台给 HTTP 云函数注入了临时身份时，`rdb()` 直接可用，不必再配密钥。

若日志是「PostgreSQL 鉴权失败」：

1. 控制台打开该环境的 API Key，复制值。
2. 只在函数 `assessmentReportDev` 的环境变量里新增 `CLOUDBASE_APIKEY`。
3. 不要把这个值写进仓库、`cloudbaserc.json` 或前端。

`rdb()` 仍然不可用时，再在函数环境变量设置 `ASSESSMENT_PG_URL`，值为控制台 SQL 数据库给出的连接串。它同样不能进 Git。有这个变量时，启动会尝试幂等建表。

健康检查里的 `store` 是 `postgres`。`collection` 是表名 `assessment_reports_dev`。

## 命令

在 Mac 上，从本仓库执行。本代理没有登录 CloudBase，也不会代替执行部署。

```bash
git fetch origin cursor/star-cloud-archive-v1-46b1
git checkout cursor/star-cloud-archive-v1-46b1
cd cloud/assessment-report
npm install
tcb login
tcb fn deploy assessmentReportDev --httpFn --path /assessment-report-dev --dir . \
  --runtime Nodejs20.19 --timeout 60 --memory 256 --install-dependency false
```

`--install-dependency false` 表示使用刚才 `npm install` 得到的 `node_modules`，云端不再装依赖。`node_modules` 不要提交。

部署后到控制台把最小实例确认为 0。不要勾选或更新 `asva-api`。

## 用 curl 做合成闭环

先看健康检查。`store` 必须是 `postgres`，`deployed` 为 true，`feishu` 为 `off`，`collection` 为 `assessment_reports_dev`。

```bash
BASE=https://root-journey-prod-d4d7pzd0a8f805-1304965105.ap-shanghai.app.tcloudbase.com/assessment-report-dev
curl -sS "$BASE/health"
```

网关会去掉函数路径前缀，函数内部看到的是 `/health` 和 `/v1/results`。公开地址仍带 `/assessment-report-dev`。

在仓库根目录生成两份合成提交（昵称「小林」，不含真实客户数据）：

```bash
cd ../..
node --input-type=module <<'EOF'
import { writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { WORDS } from "./star/js/data.js";
import { buildStarResult } from "./star/js/cloud-payload.js";

const token = (bytes) => randomBytes(bytes).toString("base64url");
function pack(file) {
  const reportId = `rpt_${token(18)}`;
  const clientSubmissionId = `sub_${token(12)}`;
  const linkSecret = token(32);
  const ownerToken = token(32);
  const result = buildStarResult({
    nickname: "小林",
    reportId,
    clientSubmissionId,
    completedAt: "2026-10-20T12:00:00+08:00",
    driveOrder: WORDS.slice(28),
    pursueOrder: WORDS.slice(0, 3),
    cull1: WORDS.slice(0, 15),
    cull2: WORDS.slice(15, 25),
    cull3: WORDS.slice(25, 28),
    revived: WORDS.slice(0, 3),
  });
  writeFileSync(file, JSON.stringify({ result, linkSecret, ownerToken }));
  writeFileSync(`${file}.meta`, JSON.stringify({ reportId, clientSubmissionId, linkSecret, ownerToken }));
}
pack("/tmp/star-a.json");
pack("/tmp/star-b.json");
EOF
```

提交、重复提交、冲突、读取、撤销：

```bash
BASE=https://root-journey-prod-d4d7pzd0a8f805-1304965105.ap-shanghai.app.tcloudbase.com/assessment-report-dev
META=$(cat /tmp/star-a.json.meta)
RID=$(node -e 'console.log(JSON.parse(process.argv[1]).reportId)' "$META")
SECRET=$(node -e 'console.log(JSON.parse(process.argv[1]).linkSecret)' "$META")
OWNER=$(node -e 'console.log(JSON.parse(process.argv[1]).ownerToken)' "$META")

curl -sS -X POST "$BASE/v1/results" -H 'content-type: application/json' --data @/tmp/star-a.json
echo
curl -sS -X POST "$BASE/v1/results" -H 'content-type: application/json' --data @/tmp/star-a.json
echo
node --input-type=module -e '
import { readFileSync, writeFileSync } from "node:fs";
const body = JSON.parse(readFileSync("/tmp/star-a.json", "utf8"));
body.result.nickname = "小陈";
body.result.extensionData.consent.at = body.result.completedAt;
writeFileSync("/tmp/star-a-changed.json", JSON.stringify(body));
'
curl -sS -o /tmp/conflict.json -w '%{http_code}\n' -X POST "$BASE/v1/results" \
  -H 'content-type: application/json' --data @/tmp/star-a-changed.json
curl -sS -X POST "$BASE/v1/results/read" -H 'content-type: application/json' \
  -d "{\"reportId\":\"$RID\",\"linkSecret\":\"$SECRET\"}"
echo
curl -sS -X POST "$BASE/v1/results/revoke" -H 'content-type: application/json' \
  -d "{\"reportId\":\"$RID\",\"ownerToken\":\"$OWNER\"}"
echo
curl -sS -X POST "$BASE/v1/results/read" -H 'content-type: application/json' \
  -d "{\"reportId\":\"$RID\",\"linkSecret\":\"$SECRET\"}"
echo
curl -sS -X POST "$BASE/v1/results" -H 'content-type: application/json' --data @/tmp/star-b.json
echo
```

期望：

- 第一次提交 200，返回的 `reportId` 与 meta 相同，`index` 为 `off`
- 同一份再提交 200，还是这个 `reportId`。控制台里这个 `clientSubmissionId` 只有一条文档
- 只改昵称、提交号不变：协议仍然合法，正文哈希变了，返回 409，`error` 为 `conflict`
- 读取 200，正文里有「小林」和那两组词
- 撤销 200
- 再读 410，正文只有 `{"error":"revoked"}`，没有词
- B 是另一份提交，200，控制台里应有自己的一条文档

同一提交号配上一份完全不同、但仍然合法的正文，同样是 409：

```bash
node --input-type=module -e '
import { readFileSync, writeFileSync } from "node:fs";
const a = JSON.parse(readFileSync("/tmp/star-a.json", "utf8"));
const b = JSON.parse(readFileSync("/tmp/star-b.json", "utf8"));
b.result.source.clientSubmissionId = a.result.source.clientSubmissionId;
writeFileSync("/tmp/star-conflict.json", JSON.stringify(b));
'
curl -sS -o /tmp/conflict.json -w '%{http_code}\n' -X POST "$BASE/v1/results" \
  -H 'content-type: application/json' --data @/tmp/star-conflict.json
```

这次正文哈希不同、提交号相同，期望 HTTP 409，`error` 为 `conflict`。

## 怎样确认不是内存库

B 这份不要撤销。健康检查里的 `store` 已是 `postgres` 之后：

1. 在 SQL 数据库执行 `SELECT report_id, doc->>'shareStatus' FROM assessment_reports_dev;`，能看到 B 的 `report_id`。
2. 最小实例是 0。等实例缩到 0，或重新部署一次让进程换新。
3. 再对 B 做一次 `POST /v1/results/read`。

冷启动之后仍返回 200 和同一组词，说明行在 PostgreSQL 里。若当时误用内存库，新进程上这次读取会是 404。

前端 `js/assessment-cloud-config.mjs` 的 `endpoint` 已写成上面的 `BASE`，没有末尾斜杠。`reportPageBase` 是 `https://xiangshu3721.github.io/mindtest-web/r/`。

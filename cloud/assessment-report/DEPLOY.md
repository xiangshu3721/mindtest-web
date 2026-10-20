# assessmentReportDev 隔离部署

只部署这个函数。不要部署、不要更新 `asva-api`。不要把飞书改成 `live`，不要创建飞书表，不要购买资源包，不要改套餐。

环境：`root-journey-prod-d4d7pzd0a8f805`（个人版 `baas_personal`）。

函数名：`assessmentReportDev`  
HTTP 路径：`/assessmentReportDev`  
运行时：Nodejs20.19  
内存：256 MB  
超时：60 秒  
最小实例：0（部署后在控制台确认，不要改成常驻）

公开基址：

```text
https://root-journey-prod-d4d7pzd0a8f805-1304965105.ap-shanghai.app.tcloudbase.com/assessmentReportDev
```

云函数内用 `@cloudbase/node-sdk` 的当前环境身份访问文档库，不使用 SecretId / SecretKey。下面的开关不是密钥，可以放在函数环境变量里。不要把 `ASVA_REPORT_IMPORT_KEY`、飞书应用密钥写进 Git。

## 部署前：文档型数据库必须已开通

2026-10-20 在 Mac 上用 manager-node 查过这个环境：

- `EnvInfo.Databases` 为 null / []
- `checkCollectionExists` 返回「当前环境未开通文档型数据库」
- `DescribeDbDistribution` 有时返回「The Env Is Initializing, Please Try It Later」
- 个人版套餐明细里已经包含文档库，`CollectionLimits=100`。这不是缺套餐。

若控制台里文档型数据库仍是未开通或初始化中，创建集合 `assessment_reports_dev` 会失败。函数发现这个错误会退出，不会退回内存库。先开通文档型数据库，等状态变为可用，再继续。不要为此升级套餐或购买资源包。

控制台路径：环境 `root-journey-prod-d4d7pzd0a8f805` → 数据库 → 文档型。开通完成后再建集合。

## 环境变量

| 变量 | 值 |
|---|---|
| `ASSESSMENT_COLLECTION` | `assessment_reports_dev` |
| `ASSESSMENT_STORE_DRIVER` | `cloudbase` |
| `ASSESSMENT_CLOUDBASE_WRITE_CONFIRM` | `dev-isolated` |
| `ASSESSMENT_DEPLOY_CONFIRM` | `dev-isolated` |
| `FEISHU_INDEX_MODE` | `off` |
| `PUBLIC_REPORT_BASE` | `https://xiangshu3721.github.io/mindtest-web/r/` |

`PUBLIC_REPORT_BASE` 在临时阅读域名出来之前，先指向 GitHub Pages 的 `r/`。分享链接由服务端拼接，秘密仍在 hash 里。

同一份声明在本目录 `cloudbaserc.json` 的 `envVariables`。其中没有密钥。

`FEISHU_INDEX_MODE=live` 时进程直接退出。这一期不要设 `mock` 以外的值；部署就用 `off`。

## 集合与索引

只创建 `assessment_reports_dev`。不要创建或写入 `assessment_reports`。

启动时会尝试 `createCollection`，并尝试两个唯一索引：

- `reportId_1`：字段 `reportId`，唯一
- `sourceSubmissionId_1`：字段 `sourceSubmissionId`，唯一

文档 `_id` 使用 `reportId`。若运行日志里 `indexFallback` 为 true，或控制台看不到这两个索引，就在控制台手工建。索引建不成时函数仍会启动，但并发下的重复插入要靠这两个唯一索引挡住。

字段与内存文档一致：`reportId`、`sourceSubmissionId`、`bodyHash`、`byteSize`、`linkSecretHash`、`ownerSecretHash`、`shareStatus`、`revokedAt`、`archiveStatus`、`customerId`、`feishuSync`、`feishuAttempts`、`indexStatus`、`createdAt`、`payload`、`collection`。

## 命令

在 Mac 上，从本仓库执行。本代理没有登录 CloudBase，也不会代替执行部署。

```bash
git fetch origin cursor/star-cloud-archive-v1-46b1
git checkout cursor/star-cloud-archive-v1-46b1
cd cloud/assessment-report
npm install
tcb login
tcb fn deploy assessmentReportDev --httpFn --path /assessmentReportDev --dir . \
  --runtime Nodejs20.19 --timeout 60 --memory 256 --install-dependency false
```

`--install-dependency false` 表示使用刚才 `npm install` 得到的 `node_modules`，云端不再装依赖。`node_modules` 不要提交。

部署后到控制台把最小实例确认为 0。不要勾选或更新 `asva-api`。

## 用 curl 做合成闭环

先看健康检查。`store` 必须是 `cloudbase`，`deployed` 为 true，`feishu` 为 `off`，`collection` 为 `assessment_reports_dev`。

```bash
BASE=https://root-journey-prod-d4d7pzd0a8f805-1304965105.ap-shanghai.app.tcloudbase.com/assessmentReportDev
curl -sS "$BASE/health"
```

网关会去掉函数路径前缀，函数内部看到的是 `/health` 和 `/v1/results`。公开地址仍带 `/assessmentReportDev`。

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
BASE=https://root-journey-prod-d4d7pzd0a8f805-1304965105.ap-shanghai.app.tcloudbase.com/assessmentReportDev
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

B 这份不要撤销。健康检查里的 `store` 已是 `cloudbase` 之后：

1. 在控制台打开集合 `assessment_reports_dev`，能看到 B 的 `reportId`。
2. 最小实例是 0。等实例缩到 0，或重新部署一次让进程换新。
3. 再对 B 做一次 `POST /v1/results/read`。

冷启动之后仍返回 200 和同一组词，说明文档在文档库里，不是进程内存。若当时误用内存库，新进程上这次读取会是 404。

前端 `js/assessment-cloud-config.mjs` 的 `endpoint` 仍保持空。curl 通过之前不要把函数地址写进页面。通过之后再把 endpoint 设为上面的 `BASE`（不要加末尾斜杠）。

# Stage 1B · Provider 版本溯源、隐私与隔离验证

状态：**仅 Draft PR；未运行云端合成测试；未部署；线上接入仍 BLOCKED**。

## 已确认事实

- `mindtest-web/main` 目前不含 `cloud/assessment-report/`；候选实现位于未合并的 PR #22，且依赖 PR #20 / #16。请勿把此依赖链一次性合并进 `main`。
- 已获授权的只读远端 `$LATEST` 比对显示 61 个可部署源文件与候选树字节级一致，但无法证明历史构建包 SHA、依赖闭包与发布记录。
- 现网 health 显示 `postgres` / `deployed: true`，且 Feishu `live`，与候选配置 `off` 存在运行时漂移。**禁止自动修复现网环境变量**，须独立核对业务影响和授权。
- 25/25 候选合成测试仅证明候选源码行为，不证明线上长期持久化或撤销正常。
- PR #22 原部署说明有 `tcb fn deploy` 等可能覆盖环境变量的命令，**不能把这些旧命令当成本次实施指令**。

## 本 PR 做了什么

1. `lib/handler.mjs`：请求指标仅保留服务名、HTTP 状态和耗时，不再携带明文 `reportId`、`assessmentId`、密钥或客户资料；原响应与数据库行为不改。
2. `build-release-manifest.mjs`：本地从干净的 Git 工作树生成确定性的文件清单，每个源文件 SHA256、聚合 `sourceFilesSha256`、`sourceCommit`、`package-lock` SHA256。产物写入 `release-manifest.json`，只用于**以后由批准的发布流程打包进候选服务**。
3. 在**最终发布包已构建以后**，再用 `--attest /path/to/final-package.zip` 计算包 SHA256，生成位于包外的 `.attestation.json`。由于自引用问题，**不能把最终包 SHA 写进包内并声称哈希仍不变**。
4. `lib/release-provenance.mjs` 和 `local-server.mjs` 将已嵌入的公开清单摘要放入健康接口的 `release` 字段。未嵌入时 `status=UNVERIFIED`；嵌入成功时为 `EMBEDDED_UNATTESTED`。**即使健康接口返回 SHA，也不等于远端已被独立核对**。
5. `release-provenance.test.mjs`：合成验证日志最小化、字段白名单、未知版本保守处理、源码清单稳定性；不用真实用户数据、网络或云端凭据。

## 准入与验证顺序（严禁跳步）

1. **本地独立验收**：在此 Draft 分支运行 `node --test cloud/assessment-report/handler.test.mjs cloud/assessment-report/release-provenance.test.mjs`，并执行合成持久化/撤销相关测试；确保没有公开日志中的报告身份/密钥回归。不得为了 PASS 放宽安全要求。
2. **可审计发布管道设计**：确认实际的 CloudBase 函数只更新代码能力、环境变量保护、审批、回滚、已有版本备份；生成清单必须与最终提交和拟打包文件一致；真实构建包的 sha256 应独立保存于受控 Actions artifact/审计单，不写入应用响应。
3. **只有独立隔离环境已证实，且得到明确授权时**，才创建一个新名字的测试函数和单独的 PostgreSQL 表/库，`FEISHU_INDEX_MODE=off` 且不配置飞书密钥。不得复用现网 `assessmentReportDev`、`assessment_reports_dev` 表、正式报告 endpoint；不得将 `root-journey-prod-...` 仅因函数名中含 Dev 而当成沙盒。
4. 在隔离服务里用虚构的职业六芒星报告验证：创建 200 → 持续读取 200 → 同一提交幂等 → 不同内容冲突 409 → 仅 ownerToken 能撤销 → 撤销后读取 410 → 重启进程后未撤销结果仍可读取。
5. **只读下载并核验测试函数的远端代码**：与批准提交的源文件清单、候选打包 hash 对照，并核查 health 内嵌摘要；配置需再次核对 PostgreSQL / Feishu off / 最小权限 / 访问控制。带密钥的明文不得出现在日志、PR、Actions、飞书或模型上下文。
6. 通过后才能进一步讨论现有线上 `assessmentReportDev` 的升级、受控迁移或单独正式 Provider 建设，及 ASVA 的 preview/confirm/私有快照。**这份 Draft 不执行任何部署**。

## 命令（只能在干净的源码 checkout 本地执行；下面的命令不会访问生产）

```sh
node --test cloud/assessment-report/handler.test.mjs cloud/assessment-report/release-provenance.test.mjs
node cloud/assessment-report/build-release-manifest.mjs
# 人工、独立、受控构建最终包后，才调用：
node cloud/assessment-report/build-release-manifest.mjs --attest /path/to/approved-final-package.zip
```

`release-manifest.json` 应作为 **gitignored 本地产物**，绝不把包含秘密的本地环境文件打包。运行脚本有意拒绝未提交的部署相关源码，以减少版本错认。

## 明确阻断仍在

- 当前生产服务无不可变 CloudBase 发布版本或审核过的历史包；
- Feishu live 漂移未复核用途与潜在数据同步影响；
- 尚未在隔离云资源中进行持久化、撤销和远端指纹测试；
- 尚未证明所用归档、AI 使用授权与真实客户身份已经核对。

**最终门禁：本地测试 PASS ≠ Stage 1B provider PASS。** 没有生产接口历史包证明和隔离功能验证时保持 `BLOCKED_PROVIDER_PROVENANCE`。 

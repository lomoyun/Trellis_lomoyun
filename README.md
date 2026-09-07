# Trellis Lite

保留 Task / PRD / Plan / Trace 的轻量协作层。适用于跨 coding agent、
跨设备、跨人员接续工作；Git 是共享载体，不是后台同步服务。

原版基线与版权见 [UPSTREAM.md](UPSTREAM.md)、[LICENSE](LICENSE)、
[COPYRIGHT](COPYRIGHT)。这是独立且不兼容旧命令的 fork，不覆盖原版 trellis。

## 使用

需要 Node.js 20+、Git。开发安装需要 pnpm 10。

```powershell
pnpm install
pnpm build
pnpm tll --help
node packages/cli/bin/tll.js --help
node packages/cli/bin/tll.js --root E:/your/project init --platforms codex
```

安装命令别名后可使用 tll 或 trellis-lite。init 默认不安装 hooks；
加 --hooks 才为 Codex / Claude / Cursor 注册 session-start 入口，宿主还需批准。
其他平台使用共享 AGENTS.md 和手动 context；平台列表不代表全部宿主实测通过。

```text
tll init
tll task new "实现登录" --id login
tll task show login
tll --actor alice --platform codex session new
tll --session <uuid> task start login --expect <revision>
tll --session <uuid> context --json
tll task update login --expect <revision> --plan confirmed-plan.md
tll checkpoint login --session <uuid> --input checkpoint.json
tll handoff login --session <uuid> --input handoff.json
tll task finish login --session <uuid> --input finish.json
```

每次 show/update/start 返回最新 revision。update、expand 和 checkpoint
使用这个 revision 检查并发修改；冲突时先重读、合并，不强制覆盖。
JSON 输入文件路径相对命令当前目录；--root 指定项目，不改变输入文件解析目录。

## 任务和追溯

```text
.trellis/
  config.yaml
  project.md
  tasks/<id>/
    task.md                  # quick: 元数据 + PRD + Plan
    trace/<session>.jsonl     # 每会话一个文件
  spec/                      # 可选项目知识
  workspace/<actor>/<session>/  # handoff
  .local/                    # Git 忽略：会话、授权、恢复日志
```

quick 保留 YAML frontmatter 和 <!-- tll:plan --> 分隔标记。
PRD 至少说明目标、边界、验收；Plan 使用稳定步骤编号，例如 S1、S2。
不强制分阶段思考、子代理、每轮检查或独立设计文档。

显式执行 tll task expand <id> --expect <revision> 后，标准任务分为
task.json、prd.md、plan.md；ID、目录、附件和 Trace 不变，不按文件大小自动升级。

checkpoint.json 示例：

```json
{
  "schemaVersion": 1,
  "key": "login-milestone-1",
  "type": "checkpoint",
  "summary": "已实现接口；集成验证待执行",
  "expectedRevision": "<show 返回的 revision>",
  "evidence": {
    "source": "reported",
    "command": "pnpm test",
    "result": "not-run"
  }
}
```

事件类型：checkpoint、decision、milestone、block、verify、handoff、done、
native-goal。同一 key 的相同请求返回原事件，不重复写入；不同请求复用 key 被拒绝。
finish 标记 done，但不会伪造测试通过。记录不等于已 commit，commit 不等于已 push。
手动编辑在下个 checkpoint 生成完整快照，不承诺逐次编辑历史。
跨会话时间戳仅用于显示，不能推断因果；同一会话按 seq 排序。

## 原生 plan / goal

原生 plan 是当前执行界面，Trellis Plan 是可携带的持久记录，不重复规划。
只读阶段不创建任务、会话或检查点；恢复写模式后导入确认过的 Plan 原文。
可用 --read-only 或 TLL_READ_ONLY=1 显式防止 CLI 写入；宿主模式仍由主代理遵守。

只在用户明确要求时由主代理调用宿主 goal 工具。Trellis 不模拟 slash 命令，
不扫描宿主对话库、不自动创建目标，也不覆盖已有目标。
原生目标完成只记 native-goal 事件，不自动关闭 Task。tll native --input
可返回机器可读适配建议，不执行宿主工具。

## 自动提交（默认关闭）

共享 config 不构成许可。只有用户主动授权本机 Git 身份后才允许提交：

```text
tll --session <uuid> policy grant --scope records --duration session --ack allow-local-commits
tll policy show
tll policy revoke
```

scope 为 records 或 task；duration 为 session、task（加 --task <id>）或 repo-user。
只在 checkpoint / handoff / finish 时尝试，不在读取或对话回调时提交。
records 仅提交当前任务文档、当前会话 Trace 和本次 handoff。
task 还可提交 start --files 预先归属、且 checkpoint --files 再次显式指定的代码。
起始已脏文件、无法确认归属、已有暂存修改或冲突会跳过提交，记录仍保留。
同一文件开始后被其他工具修改无法可靠识别作者；不要给共享编辑文件授权自动提交。
Git hooks 正常运行；失败保留记录及本次暂存内容，可用同一 checkpoint key 重试。
产品没有自动 push 功能。

## 升级、迁移与恢复

```text
tll update --dry-run
tll migrate --dry-run
tll migrate --apply
tll recover <transaction-id>
tll recover <transaction-id> --rollback
```

迁移保留 PRD、implement.md、附件、研究、spec、workspace 和 archive。
活动旧任务转 standard，未知字段及原记录保留；不同 plan.md 与 implement.md
会报冲突。旧自动提交配置不会成为新授权。
仅删除归属哈希匹配的旧运行时文件；自定义或不确定的文件保留并报告。
迁移后先审查剩余旧 hooks/skills，运行 init 安装轻入口，再提交。
恢复使用 .local/transactions 的 before/after 日志；后续编辑冲突时拒绝覆盖。
崩溃遗留锁不会按超时强行抢占，先核实对应进程结束，再处理指定锁文件。

## 验证和边界

```text
pnpm lint
pnpm typecheck
pnpm test
```

两个包均为 private，未配置公开发布。模板与 core 使用同一实现源。
本地开发直接使用 pnpm tll。若安装打包产物，需将 CLI 的 core 依赖映射到
配套 core tar 包或自己的私有 registry；pnpm smoke:pack 验证了这条安装路径。
默认初始化最多 5 个共享文件，每平台额外不超过 4 个，通用模板不超过 30 KiB。
context 默认预算 16 KiB；超限时提供完整文件引用与版本，不静默截断验收条件。
跨设备传递靠显式 Git commit/push/pull；本机授权和会话不传递。
实时宿主验收与模拟 hooks 测试分开报告，详见 docs/verification.md。

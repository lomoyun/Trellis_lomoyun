# TLL

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

初始化时可以登记使用者，沿用熟悉的 `-u` 写法：

```powershell
tll init -u lomoyun --platforms codex
# 等价：tll init --user lomoyun --platforms codex
```

首次不传 `-u` 时读取目标项目的 `git config user.name`；未配置则提示指定用户。
姓名保存在 `.tll/.local/user.json`，由 Git 忽略，不修改 Git 配置。重复 `init`
保留已登记姓名，显式 `-u` 才更换；`update` 不改变用户，`--dry-run` 不写入。
初始化不自动创建会话、不授权自动提交。

后续 `task new` / `session new` 的身份优先级为：`--actor` → 显式选择的会话身份
→ 本项目本机登记用户 → Git 用户名。`--actor` 是临时覆盖，不改已登记姓名；
已有会话和历史 Trace 的身份也不会随重新登记而改变。不同设备需各自登记并创建会话。

全局链接安装后使用 `tll`，不再提供 `trellis-lite` 命令别名。init 默认不安装 hooks；
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

复用 show/update/start 等成功命令返回的 revision；只有所需版本不可用时才补读 show。
update、expand 和 checkpoint 保留并发检查；冲突或已知并发修改时刷新、协调，不盲目重试。
JSON 输入文件路径相对命令当前目录；--root 指定项目，不改变输入文件解析目录。

## 任务和追溯

一个 Task 对应一个可独立验收、交付和结束的目标，不是项目的长期总账。
所有请求的仓库修改都归属 Task，包括小改动；只读工作不需要 Task 生命周期。
只有新工作属于原范围和验收标准，才复用任务；同项目、同模块或同会话不等于同任务。
实现、测试和达到原验收所需的修复是 Plan 步骤；独立新功能用新的 Task ID。
例如扁管选型、翅片选型、冷媒选择可分别建任务，通过 References 关联，不复制历史。
任务完成后新增需求另建任务，已有记录不自动拆分或搬动。

```text
.tll/
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
默认使用 quick；小任务可以只有 S1 implement and verify。复用足够的已有 brief/Plan，
不为走流程重写。登记、创建 Task、创建会话和绑定仅在对应状态缺失或切换时执行。
不强制分阶段思考、每轮检查或独立设计文档；主 Agent 和原生委派规则见下文。
task.md 只保留当前目标、范围、验收、步骤和简短状态；必要的详细设计/日志作为附件
按需读，历史结果留在 Trace。体积提醒不能替代 Agent 对独立交付边界的判断。

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
checkpoint 只记录结果，不执行检查或独立核验 evidence；finish 标记 done，尚无强制验收门禁，
由主 Agent 在完成验收后调用。记录不等于已 commit，commit 不等于已 push。
手动编辑在下个 checkpoint 生成完整快照，不承诺逐次编辑历史。
跨会话时间戳仅用于显示，不能推断因果；同一会话按 seq 排序。
小型连续任务通常只需一次最终证据 checkpoint，然后 finish，不重复记录启动或逐工具/文件日志。
重要决策、范围变化、阻塞和影响恢复的里程碑增加中间记录；相关结果合并记录，但不延误关键恢复信息。

## 主 Agent 与委派规则

AGENTS.md 模板以核心责任规则和必要的 TLL 操作指引为主。主 Agent 负责最终交付；
Task 的范围与验收决定能否复用，同一交付目标的委派属于 Plan 步骤。只读工作不需要
创建/绑定/结束 Task 或记录 checkpoint；原生只读模式不产生持久化和 Git 副作用。

默认直接执行；仅独立工作在扣除派发、上下文传递和审查成本后仍有明确净收益时委派。
子 Agent 使用 **`gpt-5.6-sol`，推理强度 `xhigh`**；不可用或无法确认该组合时只说明一次，
由主 Agent 继续完成，不替换模型或推理强度。
默认最多同时运行两个子 Agent，禁止递归委派，遵守更严格的宿主限制及用户要求。
使用宿主原生工具，不通过额外 CLI 进程模拟委派；目标、范围、依赖、影响和可执行验收
用于判断局部工作是否适合委派，文件数、代码行数和预计耗时仅作参考。

主 Agent 派发时说明 Task/步骤、目标、修改范围、必要依据、验收方式和代码基线。并行写入范围
不重叠，主 Agent 不同时修改子 Agent 负责的文件；范围或依赖冲突时暂停受影响部分并重新分配。
子 Agent 可自行阅读代码、选择局部方案、实现和自测，返回改动说明、文件或产物、实际验证及
对应代码/环境版本、未完成事项；业务规则、公共接口或范围需要变化时回报主 Agent。
子 Agent 不修改任何 TLL 状态，不提交、推送或再次委派。

主 Agent 通过宿主通知或等待能力接收结果，检查实际 diff、需求符合度、验证证据和集成影响，
给出通过、返工或接管结论。相关代码、输入、配置和环境均未变时，可复用可核实的证据；变化后或证据
不足时补跑相关检查。必须记录真实验证结果及未执行项，不能假装跑过或通过测试。
子 Agent 结束不代表验收通过，单个步骤通过也不代表 Task 完成。
同一交付目标内的委派属于既有 Task 的 Plan 步骤，不自动创建子 Task；主 Agent 使用现有
checkpoint/evidence 记录委派及验收结果，不新增事件类型或持久化 schema。
Task finished、tests passed、committed、pushed 是四个不同状态。Never auto-push。
TLL 不记录 hidden reasoning、raw chat 或 secrets。

这些是由 `tll init/update` 写入 AGENTS.md、由只读 hook 复用的指令，不是运行时强制门禁。
TLL 不增加调度器、后台监听、命令或配置；派发、通知、等待和取消由宿主承担。其他项目需各自
运行 `tll update --dry-run` 检查后更新；用户修改冲突不会被强制覆盖。软件回归和真实宿主
委派验收分别记录，平台列表不表示全部宿主已实测。

## 原生 plan / goal

原生 plan 是当前执行界面，TLL Plan 是可携带的持久记录，不重复规划。
只读阶段不创建任务、会话或检查点；恢复写模式后导入确认过的 Plan 原文。
可用 --read-only 或 TLL_READ_ONLY=1 显式防止 CLI 写入；宿主模式仍由主代理遵守。

只在用户明确要求时由主代理调用宿主 goal 工具。TLL 不模拟 slash 命令，
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

新项目只使用 `.tll/`。已有 `.trellis/` 的项目需要显式迁移，不能在旁边再初始化
一套 `.tll/`。先停止该项目的所有旧 agent/CLI，再逐步执行并检查输出：

```text
tll migrate --rename-directory --dry-run
tll migrate --rename-directory --apply
tll migrate --dry-run
tll migrate --apply
tll init
```

目录切换是单独的一次重命名，不复制或改写附件、历史 Trace 和本地状态；两个目录
并存、链接、旧写入锁或未完成事务会阻止切换。它不会自动修改外部脚本中的旧路径，
也不能阻止不遵守停机要求的外部写入者。切换后必须完成后续迁移和入口更新再恢复 agent。
若后续步骤冲突，数据仍留在 `.tll/`，按提示处理后重试，不要再次执行目录切换。

旧 Trace 的快照路径与版本表示当时的历史，不做字符串替换；当前任务版本会因路径
变化而改变，继续工作前先 `task show`，并使用新的 checkpoint key。
旧本地事务只保留审计用途，不能在新目录下重放 `.trellis/` 写入。
旧自动提交授权不生效，需用户重新授权；已有 Lite 本地会话保留，但换设备/窗口仍需新建。

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
context 默认只列 draft/doing/blocked 候选；task list 和显式 ID 仍可读取已结束任务。
context 默认预算 16 KiB（紧凑 JSON 的 UTF-8 字节，不是 token 数）；超限时优先装入
项目说明、任务正文、显式 specs、事件摘要。大文档放不下时保留完整引用与版本，
继续尝试装入其他小项，不静默截断验收条件。
PRD + Plan 超过 8 KiB 时提醒检查交付边界和外置细节，不拒绝保存或自动拆任务。
Trace 默认只带每会话最新检查点/交接的标识、人员、时间、类型、版本和摘要，
完整 evidence/快照仍在所引用的 JSONL 事件中，按需读取。附件不自动注入。
选定任务的完整目标、范围、验收与 Plan 仍需在实施前读完；不能把省略视为不存在。
跨设备传递靠显式 Git commit/push/pull；本机授权和会话不传递。
实时宿主验收与模拟 hooks 测试分开报告，详见 docs/verification.md。

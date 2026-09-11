---
schemaVersion: 1
id: agent-entry-core-rules
title: 精简共享 Agent 入口并指定子 Agent 模型
creator: lomoyun
owner: lomoyun
status: done
createdAt: 2026-09-11T07:25:02.176Z
updatedAt: 2026-09-11T07:33:57.036Z
---
# 精简共享 Agent 入口并指定子 Agent 模型

## 目标与范围
按用户给出的责任、Task 边界、并行写入、真实验证、状态区分、保密及只读原则整理 AGENTS.md 模板，明确子 Agent 使用 gpt-5.6-sol / xhigh。同步相关说明和输出回归，通过现有 update 更新本仓库受管入口与清单。
模板以核心责任规则和必要 TLL 操作指引为主，减少重复的流程描述。模型组合不可用时由主 Agent 完成并说明，不静默换模型。保留已有原生委派的并发上限和禁止递归约束。
不改运行时调度、持久化契约、CLI、全局配置或其他项目；不提交/推送。已有 Task simple-subagent-delegation 已完成，本次是独立模板修订，保留其历史与验收事实。

## 验收
- 生成模板表达用户列出的十一项核心原则及明确模型/推理强度；保留完成工作所需的 TLL 命令和安全边界。
- 新初始化、旧入口升级、用户模型规则冲突、重复更新幂等、现有只读 hook 共用入口和打包输出均通过回归。
- 顺序运行 pnpm lint、pnpm typecheck、pnpm test、pnpm smoke:pack，记录实际结果及未执行项。
- 本仓库 update 先预览后执行，保留块外文字及无关改动，完成后 dry-run 无变化；记录 checkpoint 并 finish。
- 本次不需要调用子 Agent；模板输出验证不宣称完成指定模型的真实宿主验收。

## References
- simple-subagent-delegation
- README.md、docs/platforms.md

## 完成情况
- S1：模板按十一项核心原则整理，入口由 125 行精简为 89 行，明确 gpt-5.6-sol / xhigh 及不可用时的主 Agent 回退。说明已同步。
- S2：最终顺序 lint、typecheck、90 项测试和 smoke:pack 通过；初次回归发现旧冲突样例文本锚点未更新，修正后重跑通过。
- S3：本仓库受管入口和清单已更新，块外内容及无关改动保持，重复更新幂等。无未完成项；本次未调用子 Agent，指定模型的真实宿主使用未验收。

<!-- tll:plan -->
# Plan

- S1：将共享 ENTRY 整理为核心责任规则、原生子 Agent 模型要求和必要操作指引；同步使用说明。
- S2：更新入口/模板冲突/打包输出断言，顺序完成 lint、typecheck、test 和 smoke:pack。
- S3：预览并更新本仓库入口和清单，验证块外内容、幂等及无关文件保留；记录实际验收并结束任务。

---
schemaVersion: 1
id: agent-entry-minimal-lifecycle
title: 应用用户提供的最小写入生命周期模板
creator: lomoyun
owner: lomoyun
status: done
createdAt: 2026-09-11T08:05:38.624Z
updatedAt: 2026-09-11T08:13:24.818Z
---
# 应用用户提供的最小写入生命周期模板

目标：按用户本轮提供的 TLL 文档替换共享 ENTRY，子 Agent 指定 gpt-5.6-sol / xhigh；保留文档的按需启动、版本复用、单一 Plan、默认直接执行和最少必要记录规则。

范围：共享模板、相关输出/冲突/打包断言、使用说明及本仓库受管入口/清单。保持原文语义，不改运行时、schema、命令或全局配置；保留无关改动，不提交或推送。相关已完成 Task：agent-entry-core-rules。

验收：生成内容与用户文档一致；新初始化、旧块升级、用户修改保护、幂等和现有只读 hooks 回归通过；顺序通过 lint/typecheck/test/smoke:pack；本仓库 update 预览后安全应用，块外内容保持，最终 checkpoint 后 finish。本次直接执行，不调用子 Agent，不宣称指定模型的真实宿主验收。

<!-- tll:plan -->
# Plan

- S1：应用用户原文，同步必要测试/说明，验证并安全更新本仓库入口，记录最终证据后结束 Task。

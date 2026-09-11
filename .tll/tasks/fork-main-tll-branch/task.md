---
schemaVersion: 1
id: fork-main-tll-branch
title: 分离上游 main 与 TLL 开发分支
creator: lomoyun
owner: lomoyun
status: done
createdAt: 2026-09-11T08:43:55.201Z
updatedAt: 2026-09-11T08:45:46.586Z
---
# 分离上游 main 与 TLL 开发分支

目标：main 保持 mindfold-ai/trellis:main 的镜像；用户的 TLL 改动保留在 tll-lite，当前工作区切换到该开发分支。

范围：本地/远端分支引用、UPSTREAM.md 分支说明及本 Task 记录。保留原有 4 个自定义提交；不修改产品代码、不合并上游产品实现、不修改其他 checkout 或全局配置。

验收：原提交 a6329227291a01997fd1295e409f558cb66cb819 在本地/远端 tll-lite 可达；本地 main 与 origin/main 对齐本次核实的 upstream/main；当前分支跟踪 origin/tll-lite；产品文件保持原样；远端引用核验通过，工作区干净。使用精确 force-with-lease 保护 main 更新，先确认开发分支已保存到远端。

验证：比较 Git 提交引用、祖先关系和产品路径差异；复用代码与环境不变时的已有软件验证，不宣称新跑测试。

<!-- tll:plan -->
# Plan

- S1：创建并推送 tll-lite，安全对齐 main 与上游，核实引用和代码保留，补充简短分支说明，记录结果并完成 Task。

# Blog Style Unification Refactor Plan

## Context
当前生成器在「样式体系」和「结构抽象」上有几类不一致：

1. About 社交栏与文章 ToC 使用了不同的 HTML/CSS 语义，导致字号、行高、字重和间距出现漂移。
2. 列表页与文章页的背景容器挂载在不同节点（`#root::before` vs `.article-page::before`），About 页又有独立最小高度策略，页面底色延展行为不一致。
3. 列表卡片和文章索引对象在构建期与运行时有重复实现，维护成本高且容易引入回归。
4. 导航区模板重复、样式常量分散（如内容宽度、侧栏宽度、外边距），后续改动难以保持全局一致。

本次重构目标：先保证视觉一致性，再消除结构重复，最后收敛为可复用的组件和 token。

## Scope & Principles
- 仅在 `gen-blog` 仓库内重构，不修改用户内容仓库。
- 每个任务独立提交（一个任务一个 commit）。
- 每个任务完成后都执行生成与基础回归验证，再提交。
- 优先最小差异改造，不引入新配置项。

## Task Checklist
- [x] T1 统一 Sidebar 组件：ToC 与 About 社交栏共享容器/标题/列表/链接样式基类。
- [x] T2 统一正文框架：About、列表、文章三类页面采用统一内容壳层（content shell）。
- [x] T3 统一背景长度策略：将 About 的“背景跟随正文长度”模式推广到列表页与文章页。
- [x] T4 提取布局 token：统一内容宽度、侧栏宽度、关键间距和 sticky 偏移。
- [x] T5 去重侧栏定位规则：合并 ToC/Profile 的大屏 sticky 规则。
- [x] T6 统一列表渲染逻辑：复用构建期与运行时的卡片结构/日期格式/按年分组算法。
- [x] T7 统一帖子摘要映射：列表页面数据与 `filter-index` 使用同一映射函数。
- [x] T8 抽象公共导航模板片段：移除 `theme/index.html` 与 `theme/post.html` 的重复导航结构。
- [x] T9 清理无效旧样式：移除当前路径未使用的遗留 `article-view/about-view/article-controls` 样式块。

## Validation Baseline
每个任务提交前执行：

1. `npm run lint`
2. `npm run generate -- "/Users/yujiachen/Library/Mobile Documents/iCloud~md~obsidian/Documents/jiachen yu" dist`
3. 关键页面 smoke check（about/list/post）：确认页面可打开、导航与主题切换正常、无明显布局错位。

## New Findings
- 2026-02-06: 仓库当前 `npm run lint` 存在既有历史问题（`scripts/images.js` 与 `scripts/obsidian.js` 触发复杂度/行数规则），本轮以“全量 lint 记录 + 变更文件定向 lint 通过”作为门禁，避免阻塞增量重构。
- 2026-02-06: 文章源目录是活跃仓库，重构期间多次生成的帖子数发生了自然波动（34→38），属于内容侧变化，不是生成器逻辑回归。
- 2026-02-06: `agent-browser` 初始阶段有 daemon 会话冲突，重启后恢复；后续 smoke check 已基于本地 `dist` 临时服务完成。
- 2026-02-06: 已修复历史 lint 债务：`scripts/images.js` 与 `scripts/obsidian.js` 按职责拆分后，`npm run lint` 全量通过。

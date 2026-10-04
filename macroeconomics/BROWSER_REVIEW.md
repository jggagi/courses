# 浏览器兼容与无障碍验证

2026-10-04 对完整课程 PR #4 做独立浏览器审阅。首轮基线是 `6178489d8bcd29ea2788d13877289eb4f01cd388`。修改仅在本课程目录；审计用的是隔离浏览器中的教学测试文字。

## 新增验证

`app/tests/e2e/compatibility.spec.ts` 有七条可在 Chromium、Firefox、WebKit 执行的代表学习路径：24课目录和客观反馈，增长与政策滞后/A基准，银行事件与债务边界/开放核算，刷新及显式JSON往返，同源双标签保存冲突与草稿导出，WCAG语义/对比度扫描，以及390px键盘导航、长表滚动、图的文字替代、减少动画与终课报告。无外部资源请求及未捕获异常也会导致失败。

axe-core 4.13.0 作为本地开发测试依赖，由测试在页面中执行，不进入产品运行依赖，也不访问审计服务。扫描覆盖首页、两节代表课程、终课作品、个人记录、来源和LA03/04/06/07/08/09；新增复习页亦纳入后续整合验证。扫描包括WCAG2 A/AA、2.1 A/AA和2.2 AA标签。

## 实际运行与发现

环境：Node24.19.0、npm11.9.0、Playwright1.63.0、Debian13上的系统Chromium151.0.7922.173。

已运行 `npm ci --cache /tmp/macroeconomics-npm`（原51包）和随后官方npm源安装 `@axe-core/playwright@4.13.0`（新增2包）。`npm run typecheck`通过。原基线运行新增六条Chromium测试，五条学习/记录/键盘路径通过；WCAG扫描失败并发现实际配色问题，未将失败记为通过。

首轮12页扫描仅报告 `color-contrast`。共同侧栏说明、眉题、课程编号、状态、隐私说明，以及顶栏、首页模块编号、页脚和辅助文字，部分小字对比度低于4.5:1。当前课链接背景下的状态最低3.01:1，首页模块编号为2.91:1。问题已送交负责样式的实施者修正；修正后的完整整合结果以 `DELIVERY.md` 中实际复测为准。

## 跨引擎阻塞与准确界限

真实尝试了以下安装命令：

```bash
PLAYWRIGHT_BROWSERS_PATH=/tmp/macroeconomics-browsers npx playwright install firefox webkit
PLAYWRIGHT_BROWSERS_PATH=/tmp/macroeconomics-browsers npx playwright install webkit
```

Firefox155.0（Playwright构建1543）及WebKit26.6（构建2359）的官方 `cdn.playwright.dev`、`playwright.download.prss.microsoft.com` 下载均被当前受限制的代理策略拒绝：HTTP403、`Domain forbidden`。没有替换镜像或绕过网络策略。系统也没有这两个浏览器或可用WebDriver。

进一步实际尝试Firefox/WebKit的记录往返测试，两条在启动时因上述可执行文件缺失而失败（Firefox4ms、WebKit5ms），学习页面未被这两个引擎执行。因此本环境 **Firefox和WebKit兼容性未验证**，不能声称三浏览器全通过。

即使未来LinuxWebKit测试通过，也只能说明该WebKit构建的兼容性，不能代替真实macOS/iOS Safari验证。axe、可访问名称/ARIA树和键盘验证也不能代替真实读屏软件或有读屏需求者的学习试用；本次未运行VoiceOver、NVDA或用户研究。

## 可复现命令

已有系统Chromium时，完整浏览器套件保持：

```bash
npm run test:e2e
npm run test:e2e -- compatibility.spec.ts
```

在允许官方Playwright下载且满足宿主系统依赖的环境，可运行：

```bash
npx playwright install --with-deps firefox webkit
npm run test:compat
```

`test:compat`明确选择三个引擎；`test:e2e`保持只用Chromium完整套件，Firefox/WebKit仅配置新增代表测试。若设置 `PLAYWRIGHT_BROWSERS_PATH`，安装与测试必须使用同一路径。失败时完整本地axe结果写入忽略目录 `app/test-results/**/local-axe-audit.json`，不包含真实学习记录。

## 最终集成复测

本次源码与测试集成提交`abb467517c01dd22cb24b4a8f0f72a86cea7fc62`实跑完整Chromium41/41，其中本报告七条全部通过。13个代表页面（含复习）axe WCAG扫描无发现，原浅色小字已修正；两标签保存冲突、手机键盘目录及损坏hash均通过。随后仅补强输入反馈关联的最终源码`f02ae396d2634bde8f0547d76c1a03e8ddb7e2c0`，重跑受影响六场景、376单元、类型与生产加载验证均通过。具体命令、产物和范围见DELIVERY.md。Firefox/WebKit、真实Safari与真实读屏验证仍受上述限制，未计入通过数量。

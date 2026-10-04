# 宏观经济学完整课程与复习交付

2026-10-04。用户在全部设计课程交付后要求“全部完成”后续改进。本轮完成24课逐节审校、本地复习、手机阅读与实验参数引导、按模块加载、独立PR审阅及可运行的无障碍验证。课程为A01–A12共24节、LA01–LA09共9实验、96道原课反馈练习、115词条、7来源和终课作品；没有未实现课页。

仅修改`macroeconomics/`。沿用独立分支`codex/macroeconomics-complete`及[草稿PR #4](https://github.com/jggagi/courses/pull/4)，没有合并。原完整课程交付保留在[DELIVERY_COMPLETE_INITIAL.md](DELIVERY_COMPLETE_INITIAL.md)，首期历史见[DELIVERY_PHASE1.md](DELIVERY_PHASE1.md)。

## 验收提交与实际执行

完整集成源与测试提交：`abb467517c01dd22cb24b4a8f0f72a86cea7fc62`。实跑类型检查、376单元、独立内容52、生产构建/加载测试，以及完整Chromium **41/41（2.8分钟）**。

最终源码提交：`f02ae396d2634bde8f0547d76c1a03e8ddb7e2c0`。末次只补强输入错误提示与当前答案/尝试的关联；其后实际重跑类型、376单元、生产构建/加载与受影响的6个原课/复习场景，**6/6（19秒）**通过。后续仓库提交只补交付文档和发布记录。

环境Node24.19.0、npm11.9.0、Playwright1.63.0、系统Chromium151.0.7922.173。锁定依赖的`npm ci --cache /tmp/macroeconomics-npm`成功安装53包；仅新增本地axe开发测试依赖，没有新增运行时依赖。

```bash
cd macroeconomics/app
npm ci
npm run typecheck
npm test
npm run test:content
npm run build
npm run test:production
npm run test:e2e
# 最后反馈补强后的相关重测
npm run test:e2e -- objective-format.spec.ts refinements.spec.ts
```

| 检查 | 实际结果 |
| --- | --- |
| 单元/合同 | 9文件376项：模型189、原状态81、内容52、PR保护6、复习43、导航/状态/全课答案/异步内容/公式5 |
| 独立内容 | 52项通过；24课七步路径、四题/课、来源/概念/实验一致；另核对全部24个数值答案的独立固定oracle |
| Chromium | 全套41项通过：原25、兼容/无障碍7、参数与长表3、复习与自评4、统一答案格式与草稿2 |
| 无障碍 | 13个代表页面本地axe WCAG A/AA扫描无发现；390px键盘、具名图/数字替代、局部表滚动、减少动画通过 |
| 生产 | 74模块；入口353.94kB/gzip117.04kB、主要CSS11.56kB/gzip3.56kB，无500kB单包警告 |
| 加载行为 | 真实生产浏览器首页JS合计354811字节；首页不加载正文，先后只进入A01/A12时仅加载这两个正文模块；LA06与复习正常，无外部请求/未捕获错误 |
| Git | `git diff --check`通过；所有仓库改动仅在macroeconomics/ |

入口相比先前650.98kB降低约45.6%；gzip从219.33kB到117.04kB。此为产物及请求证据，不声称测量了低端手机的加载时间。正文十二模块、实验、复习和终课工作台分别按需加载，没有后台教材预取。

## 教学与功能

逐课发现与修订见[基础与增长12课审校](TEACHING_REVIEW_FOUNDATIONS.md)和[政策与开放12课审校](TEACHING_REVIEW_POLICY.md)。修正过时规划提示、赤字重复计息、公共投资/G/储蓄口径、利率单位、客户净值、终课默认数值与组合敏感性说明，补充可复算推导和反例；原96题ID、答案与容差未变。正文现位于`app/src/content/modules/A01.ts`至`A12.ts`，轻量目录与正文一致性有异步测试约束。

`/#/review`按每题最新追加的原始答案重新核对，不相信导入的correct标记；正确重做移出待复习，保留尝试与误解笔记。陈旧/错课/无法核实历史明确展示。六道原创迁移练习连接十二模块，参考数字复用现有纯内核；解释由学习者自评。十二张模型卡复用原七字段，改写取消旧自评。回原课可直接聚焦题目/展开模型卡。细节见[REVIEW_FEATURES.md](REVIEW_FEATURES.md)。

手机目录默认收起，键盘展开/选课后关闭并进入正文；公式分行、上下标、保留可访问原式。九实验提供单位、允许域与教学建议的区别，特别说明小数/百分数/百分点；长表具名且可聚焦，局部双向滚动，保留表头/首列。终课明确分别比较模型及六项组合强度，合法输入即时复算。

## 本地记录与审阅修复

[独立代码审阅](PR_REVIEW.md)记录原PR问题和修复。安全解析损坏hash；原课/复习共用严格十进制及选项核对；预测/笔记草稿形成“学习中”证据，客观重做不降低已自评状态，编辑自由回答取消该题旧自评，重置不显示旧反馈；旧信心4/5仍有匹配显示。

沿用`courses:macroeconomics:v1`/schema1，复习使用notes/selfChecks命名键，无顶层迁移破坏。旧六课/三实验结构严格迁移，全部九实验A/B重新核对，坏记录保护。接近1MiB上限的合法JSON改用紧凑编码，导入/保存/导出统一容量。另一标签已保存不同原文时拒绝覆盖，当前草稿仍可导出；真实两标签场景通过，不自动合并私人笔记。

500+500个合成事件的独立Node保存样本从约210ms降为68.5ms，仅说明减少重复复算。大量事件仍同步重放，原文比较不是数据库事务。没有延迟保存、跨设备同步、后台、遥测、LLM判卷或实时国家数据。全部经济例子仍为教学合成；详细模型边界见[IMPLEMENTATION_NOTES.md](IMPLEMENTATION_NOTES.md)。

## 截图

隔离测试只使用教学测试文字；本轮生成并实际查看：

- [桌面复习](app/tests/screenshots/refinements-desktop-review.png)
- [手机正文与折叠菜单](app/tests/screenshots/refinements-mobile-lesson.png)
- [公式上下标](app/tests/screenshots/refinements-formula.png)

完整套件同时更新原实验、手机、终课及错误态截图。没有提交实际学习者的私人笔记或导出。

## 未完成的环境验证

**Firefox和WebKit未验证**：真实尝试官方安装，当前网络策略在`cdn.playwright.dev`及`playwright.download.prss.microsoft.com`返回HTTP403/Domain forbidden，宿主无这些浏览器；实际启动也因可执行文件缺失失败。没有换镜像或绕过策略。三引擎配置和七条代表路径已保留，可在允许官方安装且满足依赖的环境运行`npm run test:compat`；证据见[BROWSER_REVIEW.md](BROWSER_REVIEW.md)。

LinuxWebKit不能替代真实Safari。axe、ARIA和键盘不等于VoiceOver/NVDA或真实学习者试用；本轮没有这些条件，没有把专家式审校说成人类用户研究。

## 原私人Site更新

复用`app/.openai/hosting.json`的原项目，原地址与私人访问范围保留，记录仍在同一浏览器origin。原生发布已于2026-10-04T02:32:29.626208+00:00返回`succeeded`，地址为[宏观经济学 · 完整课程](https://macroeconomics-phase1-jggagi.jggagi.chatgpt.site)。

- 项目：`appgprj_6ac116886a9081919efc64bfd0f76696`；访问保持owner-only。
- Site源码：`6dd3b5d6b8e1f1c8a0425f906b8f410259bdee49`，来自验收源码`f02ae396d2634bde8f0547d76c1a03e8ddb7e2c0`。
- 版本：第3版，`appgprj_6ac116886a9081919efc64bfd0f76696~appgver_76b7bbcffe388191a84594f0a54b9ebd`。
- 发布：`appgdep_6ac1baaf5c148191af989db17ac7ef54`，原生成功，无新增数据服务。
- Site独立源码检查、构建和生产加载测试通过；打包的28个文件SHA-256与本地验收dist逐一相同，入口JS SHA-256为`a9347a3c60f9ebd98cefa50ecc85083d67c1d1995a9b8822894512fbaa07f29c`。

当前环境仍没有Sites配套本地脚本，复用已记录的等价本地Git同步/检查/静态打包流程，并用原生Sites工具发布。没有以请求生产页面代替原生发布验证，没有上传学习记录。

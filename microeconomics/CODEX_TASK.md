# Codex task｜实现微观经济学 Phase 1

这是直接可执行的实现任务，不是再次设计整个仓库的请求。**目标：在 `microeconomics/` 内交付一套可以实际学习的中文交互课程首期。** 不要只回复计划，不要扩展成全仓平台。

## 0. 开始与范围

读取根目录 `AGENTS.md`、`LEARNING_DESIGN.md`，本目录全部6份设计文档。检查已有代码与Git状态；若已经有实现则审查和增量完成，不覆盖或重建。所有修改限定在 `microeconomics/`，工作分支建议 `codex/microeconomics-phase1`。

**必须实现：** M01–M03共6节课、ML01–ML03共3个实验、24节课程的诚实目录、概念词条、逐课练习反馈、模型卡、本地进度/笔记、可恢复实验状态、参考资料入口和测试。

**不实现：** M04–M12正文/实验、AI导师、LLM判卷、账号系统、云同步、实时数据、共享课程引擎、另一门课、根站点、线上部署。后续模块只显示“规划中”，不能用相同占位正文冒充完成。

## 1. 本地应用边界

在本目录 `app/` 建独立Web应用。建议Vite + React + TypeScript；用SVG实现这些二维图，公式可用KaTeX。选择实现时可用且兼容的稳定依赖，核验官方文档并固定锁文件，不臆造版本。单元测试用Vitest或等价轻量工具；浏览器E2E用Playwright或仓库已有工具。已有栈合适时复用它，不为统一而重写。

建议结构：

```text
microeconomics/
  app/
    package.json / package-lock.json
    src/
      content/          # typed lessons, glossary, questions, references
      models/           # pure economics functions, no UI/state imports
      components/       # charts, tables, inputs, feedback, model cards
      pages/
      persistence/
    tests/unit/
    tests/e2e/
    public/             # only local, licensed or original assets
  IMPLEMENTATION_NOTES.md
  DELIVERY.md
```

不在根目录建package.json或workspaces。应用通过本目录命令独立启动/测试/构建；默认开发端口5173，端口忙时明确报告。提供适合子路径的资源base和hash路由，课程深链接刷新不依赖未配置的服务器rewrite。图、字体、公式和课程本体不能依赖运行时第三方CDN。

## 2. 内容合同与页面

使用本地轻量类型而非通用DSL。Lesson至少有稳定id、moduleId、title、centralQuestion、prerequisites、sections、definitions、assumptions、workedExample、labId、checks、counterexample、recap、references、status。Question区分choice/numeric/self-explanation；每项有答案依据和反馈；自由文字题采用自评rubric，不用关键词评分。

保持课程ID `microeconomics` 和课ID `M01-A` 至 `M12-B`。首期6节按 `LESSONS_PHASE1.md` 组织成完整文章：开场问题 → 对象/直觉 → 推导 → 实验 → 反例 → 检查。不能只把Markdown塞入左右栏就结束；交互要进入对应论证位置。必要引用直接链接到本地参考词条。

首页从“继续学习/开始第一课”进入；提供模块目录和局部概念地图。不需要大型hero或宣传页。后续章节目录可阅读简介，课程正文链接不跳空页。

首期词汇至少覆盖：稀缺、机会成本、沉没成本、可行集、预算线、相对价格、偏好、序数效用、无差异曲线、边际替代率、内点/角点/拐角、需求、比较静态、收入效应与替代效应。词条明确对象、例子、常见混淆和出现位置。

## 3. 实验必须真实工作

遵守 `LABS.md` ML01–ML03，先实现纯函数与oracle测试，再绑定图。预算、偏好、求解器与需求图共享计算逻辑；允许ML01/02/03复用本课程组件，但不要抽取跨课程包。

每个实验先保存用户预测，再允许揭示或运行（也允许显式跳过预测）；提供基准A与实验B、数值表和重置。参数变化影响真实计算而不只是曲线位置。更改偏好与更改表示必须是不同控件，说明差异。

重点处理预算为零、完全替代的并列最优集合、互补拐角、MRS未定义、非法价格。对多最优输出明确集合，不替学习者隐藏假设。

## 4. 状态与隐私

使用localStorage的本课程命名空间，如 `courses:microeconomics:v1`。保存schemaVersion、courseId、lastLessonId、lessonStates、objectiveAttempts、selfChecks、notes、labStates、updatedAt。`labStates`分别保存baseline/scenario/prediction/revealed，不把切换课页后的状态丢掉。

加载时验证结构和版本；损坏数据不能白屏，显示可恢复/清空提示。schema升级有显式迁移或不破坏旧数据的提示。关闭/刷新后恢复；无跨课key或共享完成度。对localStorage不可用提供内存回退并明确提示未保存。

支持用户显式JSON导出/导入，校验courseId、版本、大小和字段，拒绝另一门课的文件与无效内容。文本按纯文本渲染，禁止dangerouslySetInnerHTML展示用户输入。导出含个人笔记，提示勿提交公开GitHub。重置实验不重置进度；重置本课记录需确认，只删本课keys。

首期无遥测/分析SDK、自动外传、模型调用或外链预取。资源全部本地；外部参考由用户点击打开。

## 5. 必须实际执行的测试

**数学单元测试：** LABS中全部ML01–ML03 oracle；价格预算同比例变换不变性；预算可行性；序数表示不变性；CD解析解与独立网格比较；所有退化和多值情况。网格近似容差独立说明，不用显示精度掩盖数学错误。

**内容检查：** 首期恰有6个可学习课ID；每节有定义、例子、推导/模型、反例、3道检查及解释和来源；后续18节状态planned；没有悬空glossary/reference/lab ID。不要为了机械计数写无意义占位句。

**状态测试：** 刷新恢复、导出导入往返、错误JSON、未知版本、macroeconomics文件拒绝、仅重置本课、用户文本不执行HTML脚本。

**浏览器E2E：**
1. 开始M01-A，回答/自评后进入M01-B；ML01改变px，截距和表同步；重置回默认。
2. M02-A比较组合并切换u/u²，数值变化而排序不变；互补拐角无NaN。
3. M03默认求解(20,30)，px6得到(10,30)，选择线性并列时显示最优集合；切互补为正确拐角。
4. 保存预测与笔记，刷新和深链接恢复；导出、清空、导入后恢复。
5. 全程键盘完成关键操作；390px移动视口无正文横向溢出，图有替代表格；桌面约1440px检查公式、布局、空状态和错误态。

运行类型检查、单元测试、生产构建与真实浏览器E2E。至少保存桌面、手机及一张多解/拐角状态截图，并实际查看。截图不是测试通过的替代；未运行项如实记录。

## 6. 交付与停止条件

更新本目录README的实际启动命令和状态，不修改根README。写 `DELIVERY.md`：实现范围、安装/启动/测试/构建命令、结果、截图路径、已知限制、个人记录隐私、未实现章节和commit信息。源码、课程内容与测试均提交本任务分支；不要自动合并或部署。

验收依据是：学习者能从第1节进入第6节，在三个实验中得到正确可解释结果，看到反例、完成练习、保存并恢复进度。满足后停止，不自行扩展Phase2。

经济学有误或环境阻塞时，先记录具体问题和已验证范围，能完成的继续完成；不伪造测试结果，不把失败隐藏在漂亮UI后面。

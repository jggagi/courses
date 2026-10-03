# 宏观经济学｜从总量核算到增长、波动与政策

**courseId:** `macroeconomics`  
**状态：** Phase 1 Web 应用已实现：A01–A03 六节可学习课程、LA01–LA03 三个实验。完整目录含 24 节，A04–A12 的 18 节标注“已规划，未实现”。

## 一条主线

经济活动与交易 → 存量、流量和核算 → 名义与实际测量 → 长期生产能力 → 短期支出、就业与价格 → 货币、金融和政策 → 开放经济、危机与证据。

宏观不是把一个家庭扩大成一个国家，也不是背诵若干“降息利好什么”的固定结论。它研究相互连接的主体及其总量结果：一个人的支出是另一个人的收入，金融资产往往对应别人的负债，个体计划在整体上可能不能同时实现。

第一步建立账本，但账本不是全部理论。相同核算恒等式可以容纳不同的行为机制、预期、制度和政策响应。课程逐步区分定义/恒等式、行为假设、均衡或动态条件、经验关系以及规范判断。

## 文件入口

- [CURRICULUM.md](CURRICULUM.md)：12模块、24节课、概念依赖、终课作品。
- [LABS.md](LABS.md)：9个实验模型；LA01–LA03为首期必做。
- [LESSONS_PHASE1.md](LESSONS_PHASE1.md)：首期6节课的教学种子、例题和答案。
- [REFERENCES.md](REFERENCES.md)：教材与统计/中央银行官方资料、数据规则。
- [CODEX_TASK.md](CODEX_TASK.md)：独立应用实现、测试与交付任务。

共同教学规则见 [LEARNING_DESIGN.md](../LEARNING_DESIGN.md) 与 [AGENTS.md](../AGENTS.md)。

## 学完应能做什么

读懂GDP、通胀、就业、利率和债务数据的对象与口径；解释资本积累、技术与长期增长；用明确条件分析需求和供给冲击；区分政策工具、传导机制和最终结果；把不同解释作为模型比较，而不是选择一个永远正确的口号。

建议先接触微观M01–M03的约束和边际语言，但不强制先完成微观。所有必要前置在本课程内解释，另一门课不运行也能独立学习。

## 首期成品

先把概念地基做扎实：6节课、3个实验（交易与资产负债、GDP三种核算、名义/实际与价格指数），配有练习、错误反馈、本地笔记和恢复状态。通胀—政策模拟、增长模型和真实数据分析在后续阶段，不用虚假的政策仪表盘填充第一版。

默认全用教学合成数据，时期写“第0期/第1期/第2期”而非伪装历史。无需金融账户、个人资产或云端 API。源码、依赖、锁文件与测试全部在本目录 `app/` 内，另一门课无需启动。

## 私人 ChatGPT Site

后续按用户请求发布：[宏观经济学 · Phase 1](https://macroeconomics-phase1-jggagi.jggagi.chatgpt.site)。访问权限保持私人，学习记录仍仅保存于当前浏览器。

原地址的学习记录不会自动跨站点恢复；请先在原应用“学习记录”页导出 JSON，再到本站导入。Site 标识保存在 `app/.openai/hosting.json`，发布版本与验证记录见 [DELIVERY.md](DELIVERY.md)。

## 本地运行

需要 Node.js 24（依赖 engines 允许的其他兼容版本亦可）与 npm：

```bash
cd macroeconomics/app
npm ci
npm run dev
```

打开 `http://localhost:5174/`。端口严格固定，冲突时退出并报告，不静默切换。hash 深链接例如 `/#/lesson/A01-A`；生产资源使用相对 base，可放在子路径。

```bash
npm run typecheck
npm test
npm run test:content
npm run build
npm run test:e2e
```

浏览器测试默认使用 `/usr/bin/chromium`。若 Chromium 在别处，运行 `CHROMIUM_PATH=/absolute/path/to/chromium npm run test:e2e`；也可用 Playwright 安装的 Chromium 可执行文件。生产本地预览使用 `npm run preview`。

## 学习记录与边界

预测、笔记、客观题尝试、自由题自评、模型卡与实验原始输入仅存于浏览器键 `courses:macroeconomics:v1`。导入文件会校验课程、版本、大小、结构和模型可行性。损坏记录不自动覆盖；存储不可用时提示内存模式。JSON 导出由用户明确操作，包含私人笔记，不应提交公开仓库。

LA01 只展开 H/F/B，准备金发行方在边界之外；LA02 是核算实验，不模拟政策行为；LA03 是固定价格/篮子模型，不复现官方链式与质量调整。没有后台、遥测、登录、自动外链请求、实时数据或 LLM 判卷。

实际验证结果与截图见 [DELIVERY.md](DELIVERY.md)，精度和模型边界见 [IMPLEMENTATION_NOTES.md](IMPLEMENTATION_NOTES.md)。没有自动合并，未扩展 Phase 2；私人站点仅在用户后续明确请求后发布。

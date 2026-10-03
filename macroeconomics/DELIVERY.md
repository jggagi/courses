# 宏观经济学 Phase 1 交付

日期：2026-10-03。分支：`codex/macroeconomics-phase1`。

实际验收针对的实现与测试 commit：`5f8b428ac161f6607c34f0366896f214757a25f6`。该提交之后只追加本交付记录与截图。基线为 `50cd2aa56b0885c2e6bf87eb6e1b52af30784a45`；Git 差异全部位于 `macroeconomics/`，根目录和微观课程未修改。没有自动合并、部署或启用遥测。

## 实际范围

- A01-A 至 A03-B：六节可独立阅读课程，每课七步主线、进阶插页、对象/单位/假设、推导、例题、反例、知识标签及来源。
- 每课四道检查，共24道：解释、数值、迁移与选择题；数值答案有单位与容差，干扰项有针对性反馈，自由回答用参考解释和 rubric 自评。
- LA01：事件驱动 H/F/B 账本、工资/消费/本金不同科目、逐步平衡与双边核验、事件重放撤销、冻结 A/B。
- LA02：生产链、中间投入、存货/出口/进口/机器/转移/旧股票/二手/前期库存，先分类后揭示、三侧核对、活动追溯与流向图。
- LA03：可编辑原始 p/q、三个独立冲击预设与通胀放缓预设、N/R/D/L 分图与数字表、单品贡献、独立权重与显示刻度、A/B、零分母和非法数值反馈。
- 完整24节目录中18节为“已规划，未实现”；40个局部词条、7个来源、本地笔记/预测/模型卡/信心、自评与客观尝试分开保存。
- 仅本机存储，命名空间 `courses:macroeconomics:v1`。JSON 显式往返、严格导入复算、损坏/未知版本保护、内存回退及本课重置隔离。

## 运行和实际验证

环境：Node.js `24.19.0`，npm `11.9.0`，Chromium `151.0.7922.173`。所有命令在 `macroeconomics/app/` 执行；本次安装使用 `/tmp/macroeconomics-npm` 作为缓存以适配环境写权限。

```bash
cd macroeconomics/app
npm ci
npm run dev
```

默认 `http://localhost:5174/`，端口冲突明确退出。生产本地预览 `npm run preview`。hash 深链接为 `/#/lesson/A01-A` 或 `/#/lab/LA01`；`base: './'` 支持子路径。

| 实际执行 | 结果摘要 |
| --- | --- |
| `npm install --cache /tmp/macroeconomics-npm --fetch-retries=0` | 成功，初次安装49个包，生成并提交锁文件；随后将 `@types/node` 核验并锁定为26.6.4，安装成功。 |
| `npm ls --depth=0` | 独立应用的全部直接依赖解析成功。 |
| `npm run typecheck` | 最终源代码与全部测试类型检查通过。 |
| `npm test` | 3个文件、110项通过：模型61、状态33、内容16。 |
| `npm run test:content` | 单独运行内容合同16项通过；6个可学/18个规划ID，词条/实验/来源无悬空。 |
| `npm run build` | Vite8.3.2生产构建通过，30模块；JS376.61kB（gzip121.91kB）、CSS9.31kB（gzip3.01kB）。 |
| `npm run test:e2e` | 最终真实 Chromium 12/12通过，36.7秒；包括下列学习闭环与边界。 |
| 本地产物子路径复验 | 临时静态服务器 `/course/#/lesson/A01-A` 实际加载并刷新成功，资源正常，无浏览器未捕获错误；服务器已关闭。 |
| `git diff --check` 与范围核验 | 通过；所有仓库差异仅在 `macroeconomics/`。 |

浏览器测试默认用 `/usr/bin/chromium`；其他位置可执行 `CHROMIUM_PATH=/absolute/path/to/chromium npm run test:e2e`。测试文件分别为 `app/tests/e2e/phase1.spec.ts` 与 `boundaries.spec.ts`，可重复运行，截图会更新。

浏览器实际验证六课预测、自评与客观反馈；LA01 20/10/5 oracle、A冻结和撤销；LA02三法100/140与所有指定活动；LA03 40→61→62.22、40→44→44、第2期2%通胀、刻度与权重分离、零分母和非法值；预测/笔记/原始事件刷新、真实下载JSON再清空导入、微观文件拒绝、脚本文字不执行、损坏保护与存储不可用；键盘路径、390px手机/1440px桌面、账表局部滚动、减少动画偏好。

另外验证非法组合活动不能覆盖有效记录或基准，导出有明确错误；导入A只有1期而B有3期时显示比较边界，缺失A值不伪造，图形不越界。每个浏览器测试都监听后台请求和页面错误：未发现外发请求或未捕获异常。

## 已保存并实际查看的截图

截图来自独立测试浏览器，只含教学合成参数与测试说明，不含个人学习笔记。宽账表在自身容器滚动，页面正文没有整体横向溢出。

- [1440px 桌面：LA03 与四个计算指标](app/tests/screenshots/desktop-la03.png)
- [390px 手机：LA01 三步账本](app/tests/screenshots/mobile-la01.png)
- [LA03 非法价格错误态](app/tests/screenshots/error-la03.png)

## 数据、来源与模型边界

全部默认数据为 `synthetic`，固定合成第0/1/2期，没有真实国家或当前经济的校准含义。模型、单位、时期和生成规则在 `app/src/data/synthetic.ts`；不使用随机数或API密钥。文案、练习及SVG原创，来源ID和主动打开的官方链接保留在内容与 `REFERENCES.md`。

LA01准备金发行方在模型边界之外；无利息、税、重估或新增信贷。LA02固定30→50→100教学生产链及明确收入科目，不模拟行为反应或完整官方编制。金额最多两位小数，内部整数最小单位汇总。LA03是固定价格与固定篮子的简化指数，不模拟链式、质量调整或真实数据修订；指数上溢明确报错，真正零分母为未定义。实现边界与审查反例见 `IMPLEMENTATION_NOTES.md`。

## 已知限制与停止范围

只实际验证 Chromium，未声称验证其他浏览器或所有辅助技术。客观题反馈来自明确答案；自由回答、模型卡与信心由学习者自评，不能解释为科学掌握率。本地记录依赖当前浏览器，存储不可用会提示内存模式，关闭前需用户主动导出；没有账号、后端或云同步。

Phase 1 必做范围已完成。A04–A12、LA04–LA09、真实数据、政策/投资预测、AI导师等均未实现；没有扩展 Phase 2。后续等待学习反馈。

## 后续请求：ChatGPT Sites

2026-10-03，用户在首期交付后明确请求使用 ChatGPT Site，随后发布为私人站点：

- 地址：https://macroeconomics-phase1-jggagi.jggagi.chatgpt.site
- Site project ID：`appgprj_6ac116886a9081919efc64bfd0f76696`。
- 发布源代码 commit：`43b0feb3cb7d9b162792e5b3a5b0205263f95802`，已推送到独立 Sites 源仓库；发布包包含该提交的 `.openai/hosting.json` 和 `dist/`。
- 保存版本：`appgprj_6ac116886a9081919efc64bfd0f76696~appgver_7f1844947f048191af0d2023b7dad613`；部署：`appgdep_6ac1174aa42c8191ad2ee2c1c3989294`。原生 Sites 返回 `succeeded`，无失败信息。
- 源课程仍在 `codex/macroeconomics-phase1` 分支；未合并 PR。原首期“未部署”记录指此次后续请求之前的交付状态。

只为托管新增 Site 标识、独立图标和 HTML 描述；教学运行时 JS 与原验收产物的 SHA-256 一致。发布副本实际再次通过 `npm run typecheck` 和 `npm run build`，其余110项单元测试、16项内容检查及12项 Chromium E2E使用上文同一实现的验证结果。未重复声称进行线上浏览器验证。当前环境未提供 Sites 配套本地脚本，使用等价的本地 Git/静态产物打包流程，验证远端源 commit 与发布源一致后通过原生 Sites 工具上传。

私人站点的访问控制由 Sites 提供，课程本身未增加账号后台、数据服务或云同步。学习记录仍仅在当前浏览器 origin 的 `courses:macroeconomics:v1` 中保存；从原地址迁移时，请先在原应用“学习记录”页显式导出 JSON，再在本站导入。导出包含私人笔记，不应提交到仓库。A04–A12仍仅为规划目录，没有扩展 Phase 2。

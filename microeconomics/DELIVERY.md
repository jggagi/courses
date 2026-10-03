# 微观经济学 Phase 1 交付记录

验证日期：2026-10-03。工作分支：`codex/microeconomics-phase1`。本次所有仓库修改均位于 `microeconomics/`；根目录与 `macroeconomics/` 无变更。没有自动合并或部署。

## 实际实现

- M01-A、M01-B、M02-A、M02-B、M03-A、M03-B 六节完整中文课程，连续七步教学结构，实验嵌入论证位置；每课明确对象、单位、外生条件、假设、推导、数值例子、反例和知识层次。
- ML01 可行域、ML02 偏好与序数表示、ML03 最优选择与需求。先保存或显式跳过预测；ML02/03 可在揭示前选组合；A/B 基准、参数、SVG、数值表和解释共享计算内核。实验后提供回到本节笔记记录解释的入口。
- 24 节诚实目录：6 节 available，M04–M12 共 18 节 planned，只有简介，不提供空白正文链接或伪造完成度。
- 18 个概念词条、三张首期模块模型卡、逐课参考资料入口。每课四题，共 24 题：解释自评、误解选择、数值、迁移自评。干扰项反馈解释对应误解，数值题说明单位与 1e-8 绝对容差，自由回答有参考与 rubric。
- 独立课程的本地状态：客观尝试、自评、概念信心、笔记、最后课程、实验 baseline/scenario/prediction/revealed；刷新、关闭后及深链接恢复。JSON 显式导出/导入，严格校验课程、版本、大小和字段，损坏记录保护恢复，localStorage 不可用时明确内存回退。
- 重置实验、确认重置本节和确认清空本课程分别处理；另一门课的 key 保留。用户文字仅作为纯文本，不执行 HTML。无后端、账号、LLM、遥测、自动外传或云同步。

## 运行命令

本次环境：Node 24.19.0、npm 11.9.0、系统 Chromium。稳定依赖经 registry 与官方文档核验，精确版本和完整锁文件保存在 `app/`。

```sh
cd microeconomics/app
npm ci
npm run dev
```

默认开发端口 5173，`strictPort: true`；占用时报错。生产构建使用相对资源 `base: './'`，课程使用 `#/lesson/M01-A` 等 hash 路由，刷新无需服务器 rewrite。`npm run preview` 在同一端口预览本地生产构建。

```sh
npm run typecheck
npm test
npm run test:content
npm run build
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
```

没有系统 Chromium 时，先 `npx playwright install chromium`，再 `npm run test:e2e`。E2E 会启动独立开发服务器；请先停止占用 5173 的进程。

在本次受限云环境，网络命令使用保留代理的网络权限；npm 缓存显式放在可写的 `/tmp/courses-npm-cache`，实际安装命令为 `npm install --cache /tmp/courses-npm-cache --no-fund --no-audit`，随后 `npm ci --cache /tmp/courses-npm-cache --no-fund --no-audit` 成功验证锁文件安装。

## 实际验证结果

| 检查 | 实际结果 |
| --- | --- |
| 依赖安装 / 锁文件重装 | 成功；最终 `npm ci` 安装 51 个包 |
| `npm run typecheck` | TypeScript strict 检查通过，无错误 |
| `npm test` | 3 文件、74 项通过：数学 18、状态 38、内容 18 |
| `npm run test:content` | 专项 18 项通过，6 available / 18 planned 与全部 ID 引用检查通过 |
| `npm run build` | Vite 生产构建通过；最终 JS 343.42 kB（gzip 114.17 kB）、CSS 8.16 kB；173 ms |
| 真实 Chromium E2E | 最终 13 项全部通过，26.8 秒；含六节顺序导航、实验、反馈、自评、恢复、导出清空导入、错误文件、纯文本、课程隔离、键盘、390px / 1440px 与仅本地资源请求 |
| 修改范围 / 空白检查 | 所有差异限定 `microeconomics/`；`git diff --check` 通过 |

数学测试覆盖 LABS.md 全部 ML01–03 oracle、同比例价格/预算不变性、预算可行性、非负网格上的序数平方保序、CD 解析解与独立 400×400 网格、零预算、非法价格、多值最优边界、互补拐角、未定义 MRS 和连续价格扫描。独立网格的数量与目标值容差见 [IMPLEMENTATION_NOTES.md](IMPLEMENTATION_NOTES.md)，不会用于界面求解。

早期 E2E 曾有一项失败：非法输入时，内嵌错误文字改变了输入的可访问名称。已修复为稳定 `aria-label` 与关联错误说明，重新运行全部 E2E 通过。测试期间一次服务器占用使启动检查按预期报错，停止本任务自己的开发进程后成功运行；未忽略端口冲突。

## 截图

下列三张截图由真实浏览器测试生成，已实际查看，均无个人笔记：

- [桌面 1440×1000](artifacts/desktop.png)：CD 参数、默认结果和预算/无差异曲线。
- [手机视口 390×844](artifacts/mobile.png)：纵向控件、默认结果、图形与图例，无正文横向溢出。
- [线性多解](artifacts/multiple-optima.png)：完整预算边界最优集合，保留 CD 基准与 ○/●、虚线/实线图层。

这是浏览器视口截图；Firefox、WebKit 与真实手机设备未运行。截图补充视觉核验，不替代测试通过证据。临时 trace、测试下载、报告、依赖和构建目录均在本课程 `.gitignore` 中排除。

## 模型边界与数据

全部数字为显著标记的 `synthetic` 教学情景，不是实际市场观测或现实预测。没有当前经济指标、实时 API、未经来源核验的历史事实或第三方图片。正文和图形为原创，MIT/CORE 为主动点击的阅读参考，不复制题库、原图或整本教材。

预算模型只涵盖非负、可分割商品与固定正价格；不含配给、最低采购量、时间或其他约束。CD 内点解要求正预算、正价格、0<α<1；零预算特判原点，线性并列返回集合，互补为不可微拐角。`u²` 的保序性仅用于非负域的确定性序数选择，不能扩展到任意风险期望效用。此偏好族的向下需求不构成所有商品的经验定律。

自由解释没有自动判分。`not_started / in_progress / practiced / self_checked` 是学习活动记录；客观尝试、主观自评和信心分别保留，不合成科学掌握率。导出含个人记录，勿提交公开仓库；浏览器清理存储可能丢失数据，请按需自行导出备份。

## 未实现与 commit

Phase 1 必须范围已实现并验证。M04–M12 正文、ML04–ML11、数值补偿分解、AI 导师、账户与云同步未实现；这是明确的后续范围。没有扩展到 Phase 2。

原始设计基线为 `50cd2aa56b0885c2e6bf87eb6e1b52af30784a45`。通过验证的最终源码、课程、测试、截图与运行说明 commit 为 **`83e8be9a521f4aa2a72490f077edf5761bda27c6`**；其后仅提交本交付记录。交付记录自身 commit 由 `git log -1 -- microeconomics/DELIVERY.md` 查询，避免自引用一个尚不存在的 SHA。

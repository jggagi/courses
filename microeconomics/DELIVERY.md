# 微观经济学完整课程与学习工具交付

验证日期：2026-10-04 UTC。分支：`codex/microeconomics-learning-tools`，基线 `8c5ba8a337fcf4a4faa101ce5c3d9b35dc47548d`（完整课程已交付版本）。仓库差异仅限 `microeconomics/`；本次用户继续授权完成五项学习工具，并沿用既有 ChatGPT Site。独立分支与草稿 PR，不自动合并；Site 仍仅所有者可见，无共享范围变化。

## 实际完成范围

原有 M01–M12 / 24 节中文正文、96 道检查、78 个概念词条、12 张模型卡、ML01–ML11 / 11 个基础实验、四项跨模块复习与六部分终课报告全部保留。新增五项已实际接入：

1. **错题与间隔复习**：答错客观题、有内容且仍疑惑的自评自动入本地队列；显示到期、后续、全部和提前复习。24 道数值题各有23种轮换的新参数情境，答案与反馈重新调用相同内核；选择题明确只重排，自由文字使用参考/rubric。再练1天、吃力3天、能解释7→14→30→60天，以UTC保存。原客观尝试不被复习改写，不算掌握率、不发外部提醒。
2. **多次实验历史**：14 个实验均可在运行后显式命名保存精确 A/B、预测、解释、时间和 modelVersion1；最多40份，不自动丢旧记录。确认恢复/删除，当前参数改变不覆盖历史。终课作品引用多份指定快照，并以保存参数重算结果导出；少于两份仍显示草稿，不硬性拦路。
3. **三个进阶实验**：MX01 有限 Slutsky/Hicks 补偿；MX02 初始企业数下短期与连续/整数长期进入条件；MX03 完整2×2纯/混合Nash支持集合（含连续区域）与独立的无限重复囚徒困境grim合作条件。每个有原创推导、具体例子、A/B、预测门槛、同尺度图/表、解释与独立重置。非法中间草稿保持本地，隐藏旧结果，修正后再应用。
4. **两个现实案例**：2020年美国卡支出/ZIP收入组、常规失业保险初请/续请。六个核验日期，图、精确表和日期比较共用原始数据；CSV、完整来源说明、UTC获取时间、固定版本修订、单位/季调、转换、SHA-256及许可署名可导出。可把所选日期及来源追加到终课证据，不覆盖、不重复。完整核验证据见 [REAL_CASES.md](REAL_CASES.md)。
5. **搜索、加载与阅读输出**：目录/词条轻量搜索；明确选择全文后才载入24节正文。四组正文、词条和工具真实动态import，生产首页不请求正文块。打印会展开推导与模型卡并复制完整控件文字，afterprint恢复；支持PDF、本节笔记/模型卡纯文本及终课作品导出。

## 实际运行与验收

Node24.19.0、npm11.9.0、系统 `/usr/bin/chromium`。依赖锁文件未改变，主树实际 `npm ci --cache /tmp/courses-npm-cache --no-fund --no-audit` 成功安装51个包。

```sh
cd microeconomics/app
npm ci
npm run dev
npm run typecheck
npm test
npm run test:content
npm run build
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
E2E_PRODUCTION=1 CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e -- tests/e2e/learning-navigation.spec.ts tests/e2e/learning-extensions.spec.ts tests/e2e/learning-cases.spec.ts
```

开发/预览固定5173，忙时明确报错。无系统Chromium时用 `npx playwright install chromium`。生产E2E使用已生成dist和Vite preview，开发E2E使用Vite dev，均由Playwright管理服务器。

| 检查 | 实际结果 |
| --- | --- |
| 锁文件依赖安装 | 51个包，成功 |
| TypeScript strict | 通过，无错误 |
| 全部Vitest单元 | 10文件、294项通过，2.92秒 |
| 内容专项 | 55项通过；另25项全量核对JSON目录/词条/12卡与typed正文一致、异步ID与搜索边界 |
| Chromium完整集成 | 46项通过，1.6分钟；保留原课程全流程并覆盖全部新增工具 |
| Chromium生产构建 | 15项通过，22.8秒；冷首页不请求正文、全文检索/深链接、完整笔记打印/PDF、满额可导入备份、3进阶实验与案例来源 |
| 生产构建 | 通过，274ms；入口328.98kB / gzip111.38kB；主CSS9.92kB / gzip3.13kB；正文块每组51.05–64.76kB，词条与工具独立块 |
| 修改范围/空白检查 | 差异全部位于microeconomics/；git diff --check通过 |

前次完整课程单块为642.83kB/gzip225.05kB；当前入口减少约49%，动态块在实际页面使用时加载，不调整警告阈值掩盖大小。首屏包含本地状态校验与数学模型，全文检索会按需加载全部正文。

新增数学测试使用独立支出/利润网格、预算与补偿分解恒等式、严格零利润边界、256个二元收益博弈与6561个三元收益博弈的支持/最佳回应检查、独立折现路径与合作阈值。真实浏览器核验案例SVG每个点与独立CSV读值一致，不只看图合理。

测试发现并修复两项真实问题：长连续快照名称在390px撑宽正文，现允许安全换行；compact JSON可小于1MiB而实际格式化导出超限，现按迁移后实际UTF-8导出计限。新增边界测试与浏览器验证：恰好1MiB能保存/导出/导入，超限保留原数据、显示错误，不白屏。

## 截图

真实浏览器生成并实际查看，无个人真实笔记：

- [进阶桌面补偿曲线](artifacts/learning-extensions-desktop.png)，1440×1000，B新价格改变而A保留。
- [进阶手机实验结果](artifacts/learning-extensions-mobile.png)，390×844，预测、运行与混合均衡结果。
- [历史案例桌面图与数字表](artifacts/learning-cases-desktop.png)，时期、来源、测量对象与不同收入ZIP组。
- [手机搜索](artifacts/learning-search-mobile.png)，390×844，键盘搜索与结果。
- 原有 [桌面选择](artifacts/desktop.png)、[手机选择](artifacts/mobile.png)、[并列最优集合](artifacts/multiple-optima.png)、[基础桌面](artifacts/complete-desktop.png)、[基础手机](artifacts/complete-mobile.png) 已由本轮完整E2E刷新。

截图补充测试，不能替代测试。只验证Chromium与指定视口；Firefox、WebKit及真实手机设备未运行。

## 状态、模型与证据边界

历史key `courses:microeconomics:v1`，schema3。严格验证后迁移有效v1/v2，读取不覆写旧原文；损坏、未知版本、别课、无效模型域、未知快照模型版本及超过1MiB拒绝，原记录保留。新字段为复习队列、三进阶实验、多次历史、终课引用。重置本节移除对应复习，保留共享实验/历史；清空全课须确认，不动别课。localStorage失败明确内存回退。导出含个人笔记，请勿公开提交。无账号、后端、云同步、LLM、遥测或自动外传。

MX01仅适用指定CD、正价格和非负预算；有限Slutsky/Hicks补偿通常不同。MX02是同质价格接受企业的均衡条件，非Cournot或动态模拟；弱整数条件可多解，F0活跃市场无有限自由进入企业数，无交易不伪造唯一成交价格。MX03只枚举2×2一次博弈与独立的无限/完美监测grim情境，不声称所有重复博弈或现实合作已识别。严重机器精度下真内点概率舍入到端点会明确拒绝，避免伪纯均衡。

实验均为synthetic。案例是固定后续修订的2020历史观测，不代表当时可获得信息或当前经济。卡支出不是实物消费量，ZIP组不是个人收入；UI申领不是全部失业人口，初请和续请不能相加。所选常规UI计数的季调口径在核验文件未明确，页面记录未知而不猜测；缺失不补造。日期差值只作描述，不估计弹性或政策因果。无实时API。

全部本次授权的五项工具已完成。云同步、AI导师、在线教师判卷、一般均衡完整求解与实时数据不在已授权范围。模型公式、域与教学oracle见 [LABS.md](LABS.md)、[IMPLEMENTATION_NOTES.md](IMPLEMENTATION_NOTES.md)；来源见 [REFERENCES.md](REFERENCES.md)、[REAL_CASES.md](REAL_CASES.md)。

## 提交与Site

课程基线8c5ba8a；本次通过上述检查的应用、内容、测试和截图提交为 **`fa22f045d4a7821c7c596478027ba662f3be79a9`**；本记录随后仅补齐该SHA。交付记录自身的SHA可由 `git log -1 -- microeconomics/DELIVERY.md` 查询。沿用项目 `appgprj_6ac11332890881919b9b578c3e887b41`，现有Site已核验为active、owner、custom仅1名所有者、0群组/外部访客，0自动任务。仅更新同一私人Site，保持浏览器origin与历史key，学习记录经schema3迁移继续使用。推送源码、静态archive与部署版本须相同SHA，不对外扩展共享。

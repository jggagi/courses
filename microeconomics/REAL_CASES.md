# 现实案例：固定历史快照与解释边界

本页实现两个可以探索、核验和引用的现实案例。正文、问题、自评和 SVG 为原创；观测不是 synthetic，连接的课程模型仍使用 synthetic 合成参数。案例不会请求运行时 API、外链预取或实时数据，也不将历史数据称作当前经济。

数据取自 Opportunity Insights 官方 [EconomicTracker](https://github.com/OpportunityInsights/EconomicTracker) 发布库，固定 commit `338754b4794d4b8d1bac4b647a5daa870ba7016c`（2026-10-02T15:04:19Z）。获取时间 UTC `2026-10-04T01:53:40Z`。方法文档和修订文档注明版本日期 2026-09-17。这是后续修订后的历史快照，不代表 2020 年当时能获得的信息。

World Bank API 在本执行环境经代理返回 CONNECT 403，未取得其数据；没有填造指标或绕过策略。继续核验以下发布文件、字典、处理方法、修订记录和 README 许可说明后，才保存快照。

## 卡支出与地区收入分组

提供者：Affinity Solutions（匿名卡交易）／Opportunity Insights（处理与发布）。引用 ID `MIC-OI-AFFINITY`。

序列：`spend_all`、`spend_all_q1`、`spend_all_q4`。来源：[固定版本的全国日频 CSV](https://github.com/OpportunityInsights/EconomicTracker/blob/338754b4794d4b8d1bac4b647a5daa870ba7016c/data/Affinity%20-%20National%20-%20Daily.csv)。原始提供者查证入口：[Affinity Data for Good](https://www.affinity.solutions/dataforgood)。数值来自已取得的 OI 文件，不声称另行取得提供者微观交易数据。

观测时期：2020-02-29、03-14、03-28、04-11、05-09、06-06 六个日期。该时段原数据是日频七日回看移动平均。基期 2020-01-06 至 02-02，来源已按 2019 年相应季节变化季调并做假日校正。q1/q4 按居住 ZIP code 的收入中位数分组，不能当作持卡人个体收入或同一家庭收入的变化。字典明确 `spend_s_` 和 `spend_19_` 为未季调列，本页只用 `spend_`。

原单位是相对基期的比例变化；显示值乘 100 为百分数。日期之差为百分点。金额变化指标没有在本页做统一价格平减，不能作为实物消费量。不会平均 q1/q4 得到全国合计，也不由支出推算需求弹性、收入效应或政策因果。

完整上游文件 SHA-256：`7c50f0abb2503fd2bd0468be5fed9433abc4f9a97f1e1d6549ef88a3af412f99`。原始六行摘录 SHA-256：`d7f27615e73f6c569396f899cc56e6e42fa3edd5162ea1d45159538aafeca96f`。

## 常规失业保险初请与续请

提供者：美国劳工部（全国原始统计）／Opportunity Insights（发布）。引用 ID `MIC-OI-UI`。

序列：`initclaims_count_regular`、`contclaims_count_regular`。来源：[固定版本的全国周频 CSV](https://github.com/OpportunityInsights/EconomicTracker/blob/338754b4794d4b8d1bac4b647a5daa870ba7016c/data/UI%20Claims%20-%20National%20-%20Weekly.csv)。原始提供者查证入口：[美国劳工部 UI 数据](https://oui.doleta.gov/unemploy/DataDashboard.asp)。数值来自 OI 发布文件；DOL 是 OI 字典与处理文档明确记录的原提供者。

观测周末日期同上，以周六为周结束日期。原单位为常规 UI 申请件数，显示为除以 1,000,000 的百万件；原值表保留件数。计数没有名义/实际平减之分。核验的 OI 字典及说明没有明确所选常规计数的季调口径，页面如实记录未知，不另加季调或声称季节性已排除。

初请和续请的对象不同，不能相加成为失业人数；常规项目也不是全部 PUA/PEUC 等项目。领取期限、资格、处理积压和项目迁移可能使申领数变化而就业没有恢复。六个日期无法识别失业保险对劳动供给的因果效果。

完整上游文件 SHA-256：`358e8ad03cb3a1c50e7899dadc210a34ac951af0d02d8220e06719a53a9c24fc`。原始六行摘录 SHA-256：`753edffb121c7eba4ed75b6adde59359d3983c0ca9481c3e117a2d8bd8b73889`。

## 证据、计算与学习记录

`app/src/content/data/` 保存两个来源 CSV 的原始表头和六行原文，按上游顺序，保留原始精度及 `.` 缺失标记。不是完整上游序列。`oi-source-receipt.json` 保存上游 commit、Git blob SHA、完整文件与摘录 SHA-256、获取日期、提取方法和少量原文证据。未选择日期不插补，其他项目缺失不补造，图中连线只是辅助阅读。

`cases.ts` 解析原文、严格检查日期与列、转换单位，生成图表共同使用的表和日期比较；差值是描述性计算，没有回归、弹性估计或政策识别。绘图横轴使用实际间隔天数，零参考线含义明确；缺失值不连接成一条曲线。页面允许比较任意已保存日期及导出 CSV 原始摘录和完整来源说明。

每案三题分别检验对象/模型条件、因果识别及替代机制/反例，附解释和三个独立自评标准。M12-B 共用案例笔记保存本机。将案例加入终课作品只追加已有 `capstone.evidence` 字段，保留原文；含所选日期、单位、转换、来源与识别边界，重复操作不重复追加，超出既有限额不覆盖。

## 许可与署名

[固定版本 README](https://github.com/OpportunityInsights/EconomicTracker/blob/338754b4794d4b8d1bac4b647a5daa870ba7016c/README.md) 明确欢迎使用发布数据，要求列出具体数据提供者，并引用配套研究与 [Economic Tracker](https://tracktherecovery.org)。页面、源码元数据和这里均保留署名。配套研究：Raj Chetty、John Friedman、Nathaniel Hendren、Michael Stepner 与 Opportunity Insights 团队，*The Economic Impacts of COVID-19: Evidence from a New Public Database Built Using Private Sector Data*，2020，[研究链接](https://opportunityinsights.org/wp-content/uploads/2020/05/tracker_paper.pdf)。核验的是 README 的使用说明和发布元数据，不是对论文全部因果结论的独立复现。

[数据字典](https://github.com/OpportunityInsights/EconomicTracker/blob/338754b4794d4b8d1bac4b647a5daa870ba7016c/docs/oi_tracker_data_dictionary.md)、[处理方法](https://github.com/OpportunityInsights/EconomicTracker/blob/338754b4794d4b8d1bac4b647a5daa870ba7016c/docs/oi_tracker_data_documentation.md)、[修订记录](https://github.com/OpportunityInsights/EconomicTracker/blob/338754b4794d4b8d1bac4b647a5daa870ba7016c/docs/oi_tracker_data_revisions.md) 均为同一固定上游版本。没有复制原图或调用远程渲染。

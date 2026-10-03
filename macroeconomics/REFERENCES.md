# 宏观参考资料、来源与数据规范

核验日期：**2026-10-03**。下列官方HTML入口已核验，未声称逐页审校其所有教材、视频、讲义或方法手册。历史课程中的“今天”按授课年份理解，不沿用为2026年的事实。本课程的组织、文案、练习和合成例子为原创设计。

## 核心教材

**MAC-MIT — MIT OCW, 14.02 Principles of Macroeconomics, Spring 2023**  
课程：https://ocw.mit.edu/courses/14-02-principles-of-macroeconomics-spring-2023/  
主题与阅读：https://ocw.mit.edu/courses/14-02-principles-of-macroeconomics-spring-2023/pages/topics-and-readings/

用于对照短期波动、长期增长、政府政策及消费/投资/金融等部门机制。对应A04–A12；入门定义与主题也用于A02。优先读取遇到的具体问题，不要求先看完整视频系列。

**MAC-CORE — CORE Econ, The Economy 2.0: Macroeconomics**  
目录：https://books.core-econ.org/the-economy/macroeconomics/0-3-contents.html

用于比较制度、劳动、通胀、金融与全球经济的组织方式。映射：A01/A08/A11→U6；A04/A05→U9；A06→U3；A07→U1/U2/U4；A08/A09→U5/U6/U10；A10→U7；A11→U8。具体实证命题需继续追踪各section原始资料，不以目录页代替研究证据。

## 测量与货币机制的官方说明

**MAC-BEA — U.S. Bureau of Economic Analysis, GDP学习入口**  
https://www.bea.gov/resources/learning-center/what-to-know-gdp

用途A02/A03：GDP、名义/实际、发布与修订、季调和年率等阅读入口。美国数据口径不能不加检查地套到其他国家。

**MAC-BEA-GLOSS — BEA, Gross domestic product词条**  
https://www.bea.gov/help/glossary/gross-domestic-product-gdp

用途A02：最终产出、增加值和核算边界。更详细的国民核算处理在实现具体真实数据案例时查该机构方法文件；教学模型不是完整官方编制系统。

**MAC-BLS-CPI — U.S. Bureau of Labor Statistics, CPI FAQ**  
https://www.bls.gov/cpi/questions-and-answers.htm

用途A03：消费价格指数的对象、权重、个人体验与总体指数、指数方法的局限。LA03为固定篮子的简化演示，不声称复现BLS的实际分层指数、抽样或质量调整。

**MAC-BLS-LABOR — BLS, CPS Concepts and Definitions**  
https://www.bls.gov/cps/definitions.htm

用途A07：就业、失业与劳动力参与的统计边界。仅作为明确口径的例子；比较国家、年龄范围和时期前需核验各自定义。

**MAC-BOE — Bank of England, Money creation in the modern economy**  
https://www.bankofengland.co.uk/quarterly-bulletin/2014/q1/money-creation-in-the-modern-economy

发表于2014-03-14。用途A01/A08/A11：贷款、存款与中央银行政策的机制说明，纠正常见的机械存款转贷/固定乘数叙述。该来源不意味着所有国家的操作框架和监管规定相同；放贷约束与跨行结算的具体实现需额外查相应机构资料。这里只核验了HTML说明，不宣称已审读其全部PDF附录。

## 最小阅读路径

先完成本课程的对象图与模型卡，再读一个对应教材section。核算/统计概念有争议时先查官方定义；对因果或政策效果有争议时再看原始研究和替代解释。无需并行通读全部来源。

后续具体真实数据案例必须新增来源记录，不能仅在页脚挂一个机构首页。允许选美国、中国或其他地区，但必须围绕问题选数据，不预设当前经济结论。本阶段不抓取实时数据，也未内置任何声称真实的时间序列。

## 数据manifest要求（后续真实案例）

每个数据集保存：`dataKind`、provider、dataset/seriesId、sourceUrl、license/terms note、observationStart/End、frequency、unit、currency、priceBasis、base/reference period、seasonalAdjustment、retrievedAt、releaseDate、vintage、revisionStatus、transformations、missingValuePolicy。

区分观察时期、发布日期和下载日期。明确同比/环比/年化，原始缺失与零值分开；不得把季度同比和季度环比折年率直接混画。真实数据只以注明版本的本地快照进入课程；用户主动更新才替换，旧版本须可追溯。

合成数据标明 `synthetic`、modelId、参数、单位、生成规则及随机种子（如果用随机数），不得套用真实国家/日期标签。首期全部使用确定性合成样例，不需要随机数或API密钥。

## 引用、许可与运行时网络

文案和题目原创。外部课本免费可读不自动代表可再发布；复制原图、原题或原文前核验许可、署名和修改说明。参考链接供用户主动打开，应用不得在后台下载教材、预取页面或将学习记录发送给这些站点。

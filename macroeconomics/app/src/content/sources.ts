import type { Source } from './types';

/** 本地来源ID只用于查证与继续阅读；应用不主动请求这些网页。 */
export const sources: Source[] = [
  {
    id: 'MAC-MIT',
    title: 'MIT OCW：14.02 Principles of Macroeconomics（Spring 2023）',
    url: 'https://ocw.mit.edu/courses/14-02-principles-of-macroeconomics-spring-2023/',
    note: '大学入门宏观主题与继续阅读入口。本课原创讲解不代表MIT背书；历史课程中的时间语境按授课年份理解。',
  },
  {
    id: 'MAC-CORE',
    title: 'CORE Econ：The Economy 2.0 — Macroeconomics',
    url: 'https://books.core-econ.org/the-economy/macroeconomics/0-3-contents.html',
    note: '用于对照制度、金融与总量机制；A01可继续阅读U6。目录是阅读入口，不能替代具体经验命题的原始证据。',
  },
  {
    id: 'MAC-BEA',
    title: 'BEA：GDP学习入口',
    url: 'https://www.bea.gov/resources/learning-center/what-to-know-gdp',
    note: '用于核验GDP、名义/实际与发布修订口径。美国统计说明不可未经检查直接套用到其他国家；本应用没有真实GDP序列。',
  },
  {
    id: 'MAC-BEA-GLOSS',
    title: 'BEA：Gross domestic product词条',
    url: 'https://www.bea.gov/help/glossary/gross-domestic-product-gdp',
    note: '用于核验最终产出与增加值的核算对象。本课生产链是简化教学模型，不是完整官方编制系统。',
  },
  {
    id: 'MAC-BLS-CPI',
    title: 'BLS：Consumer Price Index常见问题',
    url: 'https://www.bls.gov/cpi/questions-and-answers.htm',
    note: '用于查证消费价格指数、篮子与个人体验的区别。LA03的固定篮子没有复现官方抽样、分层、替代或质量调整。',
  },
  {
    id: 'MAC-BLS-LABOR',
    title: 'BLS：CPS Concepts and Definitions',
    url: 'https://www.bls.gov/cps/definitions.htm',
    note: 'A07规划阶段的就业统计阅读入口；首期不实现就业模型，也不展示未经核验的当前就业数据。',
  },
  {
    id: 'MAC-BOE',
    title: 'Bank of England：Money creation in the modern economy（2014）',
    url: 'https://www.bankofengland.co.uk/quarterly-bulletin/2014/q1/money-creation-in-the-modern-economy',
    note: '2014-03-14的货币机制说明，用于核验贷款与存款的双边关系。制度与监管细节需另查相应时期和辖区；不据此声称放贷无约束。',
  },
];

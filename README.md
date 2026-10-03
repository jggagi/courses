# Courses｜从概念到模型的学习工作台

这里存放可以持续学习、实验和改进的课程，而不是资料链接收藏夹。每门课程独立放在一个顶层目录，先形成清晰的知识结构和教学设计，再由 Codex 实现可交互的学习体验。

## 课程索引

| 课程 | 核心问题 | 入口 | Codex 实现任务 |
| --- | --- | --- | --- |
| 微观经济学 | 有限资源下，个人选择如何通过交易、竞争和制度形成社会结果？ | [microeconomics/README.md](microeconomics/README.md) | [microeconomics/CODEX_TASK.md](microeconomics/CODEX_TASK.md) |
| 宏观经济学 | 相互连接的生产、收入、支出和资产负债，如何形成增长、就业、通胀与波动？ | [macroeconomics/README.md](macroeconomics/README.md) | [macroeconomics/CODEX_TASK.md](macroeconomics/CODEX_TASK.md) |

每门课规划 **12 个模块、24 节核心课**。入门只要求代数与图表阅读；导数、优化、概率和动态系统在需要时补充，不先铺一大套数学。

## 当前交付状态

**2026-10-03：课程设计与 Codex handoff。不是已实现的 Web 应用。**

本轮提供：两门课的完整模块设计、概念依赖、实验规格、首期各 6 节课的教学种子、练习及答案、参考资料，以及分阶段实现与验收要求。后续模块目前是教学设计，不冒充已经写完的逐字教材；应用代码、可运行实验、浏览器测试和部署均待 Codex 实现与验证。

```text
courses/
├── README.md
├── AGENTS.md
├── LEARNING_DESIGN.md
├── microeconomics/
│   ├── README.md
│   ├── CURRICULUM.md
│   ├── LABS.md
│   ├── LESSONS_PHASE1.md
│   ├── REFERENCES.md
│   └── CODEX_TASK.md
└── macroeconomics/
    ├── README.md
    ├── CURRICULUM.md
    ├── LABS.md
    ├── LESSONS_PHASE1.md
    ├── REFERENCES.md
    └── CODEX_TASK.md
```

## 如何学习

先看 [共同学习设计](LEARNING_DESIGN.md)。每节课遵循：真实问题 → 对象和关系 → 图像与直觉 → 最小模型 → 预测与实验 → 反例和边界 → 用自己的话重建。

推荐路径：先学微观 M01–M03，建立约束、选择和边际的语言；之后微观与宏观可以并行。宏观 A01 从零解释存量、流量与核算，不要求先学完整门微观。交叉引用只帮助理解，不形成运行时依赖或强制解锁。

特别重视这些区分：对象与表示、模型与现实、恒等式与因果机制、均衡与最优、效率与公平、名义与实际、水平与增长率、存量与流量。理解这些边界比记忆大量结论更重要。

## 如何交给 Codex

每次只启动一门课的任务，读取根目录 `AGENTS.md`、`LEARNING_DESIGN.md` 和该目录下的 `CODEX_TASK.md`。两门课可以在不同分支或 worktree 并行实现；不得互相修改。首期各实现前 3 个模块、6 节完整课程和 3 个真实可用实验，而不是一次性生成 24 个空壳页面。

每门课以后在自己的 `app/` 内拥有独立依赖、锁文件、测试、构建配置和本地学习状态命名空间。此阶段不建立共享课程引擎、账户后台、AI 聊天服务或生产部署。

## 内容与数据边界

课程用原创中文讲解，关键术语附英文；外部教材与官方资料的链接、用途和核验日期见各课 `REFERENCES.md`。示例默认是明确标注的教学合成数据，不代表任何现实企业、家庭或经济体的校准、预测或投资建议。真实数据必须有来源、口径、时期与版本记录。

仓库公开；不提交学习者的真实收入、资产、健康资料、私密笔记、账号凭据或本地导出的学习记录。

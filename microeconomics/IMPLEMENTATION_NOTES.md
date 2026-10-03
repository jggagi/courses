# 微观 Phase 1 实现说明

## 数学内核与教学参数

`app/src/models/economics.ts` 为无 UI、状态、网络依赖的纯函数。货币预算 m 与价格使用同一个计价单位；x、y 是相应商品数量。数学有效域是 m≥0、px>0、py>0，所有输入须有限；CD 要求 0<α<1，线性权重 a,b>0，互补固定 1:1。实验控件仍应按 LABS.md 限制各自的教学范围：ML01 的 m≤300，ML03 的 m≤200，价格 1–20，CD α=.1–.9；数学内核的宽域允许不改变实际可行集的计价单位变换。非法输入抛出可解释的 RangeError，不作静默裁剪。

预算线为 y=m/py−(px/py)x；预算集合包含边界与内部。零预算特判为只有原点，极小正数量也不能因显示容差变为可行。支出与理论相等关系只使用浮点舍入容差 `16·Number.EPSILON·max(|a|,|b|)`，不使用界面显示精度。

CD 解由预算等式和适用的内点条件推导为 x*=αm/px、y*=(1−α)m/py。线性比较 a/px 与 b/py：严格较大者对应角点，相等时输出包含两个端点的 `optimal_set`，表示整段预算边界，不能将一个中点称为唯一最优。零预算把该集合退化为唯一原点。互补解 x=y=m/(px+py)，是不可微拐角。

平方表示仅用于 u≥0 的确定性序数选择。表示变换不进入优化公式，也不改变同一偏好下的排序；效用表示与偏好模式/权重是不同输入。CD 效用用加权对数的指数计算以避免中间乘积溢出；不在零数量上求对数。MRS 在轴、互补拐角和 MUy=0 的分支报告未定义，不将 Infinity/NaN 输出给页面。在互补的 x>y>0 分支，MUx=0、MUy=1，因此局部 MRS=0；这是直角曲线水平部分，不能误认为拐角有唯一斜率。

## 图形与集合值需求

无差异集合输出 `Point[][]`，每个数组是一条折线。CD 的 u=0 用两条轴表示；互补用三点的真实直角折线表示，不平滑。曲线只在指定图形矩形内作显式几何裁切，不更改经济参数。正 CD 水平集用对数间距采样以保留靠轴的陡峭部分。

需求数据对每个 px 调用同一个 `solveChoice`，横轴数量、纵轴 px。线性偏好若在扫描区间内有并列价格，即使扫描数组未恰好包含该价格，也插入该价格及完整最优数量区间；图形应断开两侧分支并单独展示区间，不能将多值关系伪造成连续单值插值。

## 独立网格与验证容差

理论 oracle 使用绝对/相对 1e−8 容差。独立 CD 网格测试不调用内核效用或解析解：用 400 个 x 分段，并在每个 x 的剩余预算中独立扫描 400 个 y 分段，直接计算 x^α·y^(1−α)。该网格是有限近似，数量容差按各轴最大购买数量/400 明确给出，目标值差容差为解析效用的 1e−4；不能把这些网格容差用于解析答案或 UI 求解。另检验所有预算、偏好表示变换、零预算、线性并列集合、互补拐角、轴上 MRS、连续价格扫描与非法域。

原设计中的首期数学 oracle 无需修正。实验均为 synthetic 教学参数；这些偏好族的比较静态不能解释为所有现实商品的经验定律。

## 本地实现与已核验的依赖 API

2026-10-03 通过 npm registry 查询可用稳定版本，并核验官方文档。锁文件固定 React/React DOM 19.3.0、Vite 8.3.2、React 插件 6.1.1、TypeScript 7.0.2、Vitest 5.0.3、Playwright Test 1.63.0。实际执行环境为 Node 24.19.0、npm 11.9.0；没有引入运行时 CDN 或第三方素材。

- React `react-dom/client` 的 `createRoot` / `render`：[官方文档](https://raw.githubusercontent.com/reactjs/react.dev/main/src/content/reference/react-dom/client/createRoot.md)。
- Vite 独立应用与相对 `base: './'`：[入门](https://raw.githubusercontent.com/vitejs/vite/main/docs/guide/index.md)、[共享配置](https://raw.githubusercontent.com/vitejs/vite/main/docs/config/shared-options.md)。
- React 插件 `plugins: [react()]`：[官方 README](https://raw.githubusercontent.com/vitejs/vite-plugin-react/main/packages/plugin-react/README.md)。
- Vitest 单次 `vitest run` 与独立配置：[入门](https://raw.githubusercontent.com/vitest-dev/vitest/main/docs/guide/index.md)、[配置](https://raw.githubusercontent.com/vitest-dev/vitest/main/docs/config/index.md)。
- Playwright `defineConfig`、`webServer`、真实浏览器与视口：[官方测试配置](https://raw.githubusercontent.com/microsoft/playwright/main/docs/src/test-configuration-js.md)。
- TypeScript `jsx: react-jsx`：[官方配置说明](https://raw.githubusercontent.com/microsoft/TypeScript-Website/v2/packages/tsconfig-reference/copy/en/options/jsx.md)。

课程通过 typed 本地内容组织连续文章，实验放在正文 `experiment` 段落处。ML02/ML03 在揭示前可选择组合；三实验先保存或显式跳过预测。运行后给出机制反馈、反例与实验解释入口，学习者在本节笔记记录自己的解释。自由解释使用参考答案和自评 rubric，不做关键词评分。客观数值题通过 `getNumericAnswer` 调用同一经济学内核。

实验 A/B 共享图轴；基准的预算、偏好与最优点各自保留。预算图使用同一几何内核，线性多值需求在并列处断开单值分支并显示完整区间；需求表取 A/B 并列价格的并集。○/● 与虚线/实线区分图层，颜色之外仍可辨认。非法数值保持未应用状态，错误说明使用稳定可访问名称及描述关联。

状态 schema 1 校验字段、课程 ID、域、ISO 时间与 1 MiB 导入大小；损坏或未知版本不被普通学习操作覆盖。浏览器写入配额失败时保留删除能力，只有显式确认的 reset 清理本课 key。所有用户文字经 React 纯文本/textarea 渲染，导出仅由用户点击触发。

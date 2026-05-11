# ADR-0001：技术栈选型——零构建的原生 ES Modules

- 状态：accepted
- 日期：2026-05-11
- 决策人：Property Valuation Builder
- 关联代码：`src/valuation.mjs`、`tests/valuation.test.mjs`、`package.json`

## 一、背景（Context）

本仓库要交付一个中国商品住宅内在价值估值应用，最终通过 GitHub Pages 以纯静态资源的形式部署到 `git@github.com:Tom-0727/property-valuation-app.git`。

核心范围非常窄：

- 估值核心是 5 个纯函数（Gordon 永续、有限年期 DCF、直接资本化、市场比较法、成本法），见 `docs/valuation-models.md` 第二至第五章。
- 后续会补充一个轻量计算器 UI，让用户在浏览器里填入参数、得到上述 5 个模型的并列估值结果。
- 不存在服务端、不存在登录、不存在数据库；GitHub Pages 只会托管原样的静态文件。

由于业务规则极其明确（即"不为折旧率、增长率、贴现率、资本化率、空置率、续期成本、风险溢价、流动性溢价、终值等参数预置任何数值"），估值核心库的代码量很小、外部依赖几乎为零，因此构建链复杂度本身就是一个值得规避的风险。

## 二、决策（Decision）

- 估值核心库使用**原生 ES Modules（`.mjs`）**，文件名后缀显式 `.mjs`，模块内部统一使用 `export function ...` 命名导出。
- **不引入任何 npm 运行时依赖与构建工具**：不使用 Vite、webpack、parcel、esbuild、Rollup 等。
- **不引入任何 npm 测试框架**：单元测试使用 Node 22 自带的 `node:test` + `node:assert/strict`，通过 `node --test tests/*.test.mjs` 执行。已在执行机上验证 Node 版本为 `v22.22.1`，原生支持上述 API。
- 加入一份**最小化** `package.json`，只声明 `"type": "module"` 与一个 `test` 脚本，**不包含 `dependencies` 与 `devDependencies` 任何字段**。这一来可让协作者直接 `npm test`，二来明确标记本仓库为 ES Module 项目；不引入 `package-lock.json`，也不会向仓库提交 `node_modules`。

后续 UI 将以 `index.html` + `<script type="module">` 的方式直接 `import` 同一份 `src/valuation.mjs`，浏览器与 Node 共用同一份源码，**零编译、零打包**。

## 三、理由（Rationale）

1. **零依赖即最小攻击面与最小审计面**：评估者（人或自动评估 agent）只需要读 5 个函数 + 一份测试文件即可判断估值逻辑是否正确，不必先理解一套打包配置。
2. **同一份 `.mjs` 文件在浏览器与 Node 同构**：Node 22 与现代浏览器都原生支持 ESM，省掉 transpile + bundle 一层抽象，也避免"开发环境与生产环境不一致"的常见 bug。
3. **GitHub Pages 部署成本几乎为零**：仓库内的 `index.html` 与 `src/*.mjs` 直接就是站点资产，无需任何 CI 构建步骤，部署即上传，回滚即 `git revert`。
4. **冷启动速度快**：相比 Vite + React 模板的依赖安装与首次启动开销，本方案的开发循环就是"改文件 → 在浏览器或 Node 里跑"。
5. **契合"不预置数值"的硬约束**：将估值核心约束在一个无依赖、无默认值的小模块里，可让"参数必须显式传入"在 code review 与单元测试中都易于核验。

## 四、被否决的备选（Alternatives Rejected）

- **Vite + React**：为 5 个纯函数 + 一份计算器表单引入一整套构建体系，构建复杂度严重高于业务复杂度。后续若 UI 极度膨胀可重新评估，但当前阶段拒绝。
- **webpack / parcel**：同上，且配置面更大，不适合"评估者要快速判断估值逻辑"的目标。
- **vitest / jest 等 npm 测试框架**：会引入数十到上百个 `devDependencies`，但仅用于跑几十个断言；`node:test` 已能覆盖全部需求。
- **TypeScript**：可在未来某个版本再评估。本阶段刻意避免引入编译步骤——`.mjs` + JSDoc 已能在 IDE 内获得足够的类型提示，而评估者读纯 ES Module 比读编译产物更直接。

## 五、约束与影响（Consequences）

- 浏览器目标限定为支持原生 `<script type="module">` 与 ES2020+ 语法的现代浏览器（Chrome / Edge / Safari / Firefox 当前主流版本）。不支持 IE。
- 调试运行环境必须为 Node 18+（实际验证版本为 22.22.1）才能跑 `node --test`。
- 任何引入 npm 运行时依赖的提案都需要新立一条 ADR 推翻本决策；新增 devDependency 也须显式记入新 ADR。

## 六、特别澄清：测试夹具中的数字

`tests/valuation.test.mjs` 中出现的具体数字（例如 `r = 0.08`、`g = 0.03`、`d = 0.30`、`k = 0.04` 等）**仅用于让公式可被手工核对**，并不代表本应用对中国商品住宅折旧率、增长率、贴现率、资本化率等参数的"推荐值"或"典型值"。`docs/valuation-models.md` 第六章 6.1 节中"严格不预置"的承诺**不因任何测试夹具数字而失效**：库本身严格不提供默认值，调用方必须为每一个必填参数显式传入数值。

# ADR-0002：前端路由方案——多文件直连，不使用 hash 路由

- 状态：accepted
- 日期：2026-05-11
- 决策人：Property Valuation Builder
- 关联代码：`index.html`、`about.html`、`calc.html`、`app.js`、`styles.css`
- 关联 ADR：[ADR-0001 技术栈选型](./0001-tech-stack.md)

## 一、背景（Context）

ADR-0001 已确定本仓库以零构建、原生 ES Modules 的方式交付，并通过 GitHub Pages 托管静态文件。现在需要为前端加入两条主要导航——「模型详情」与「估值计算」——以及一个落地页。

可选的实现路径主要有两类：

1. 单页应用（SPA） + 客户端 hash 路由（如 `index.html#/about`、`index.html#/calc`）。
2. 多文件直连（multi-file）：`index.html`（落地页）、`about.html`（模型详情）、`calc.html`（估值计算），三者互为兄弟，互相通过 `<a href="./about.html">` 跳转。

## 二、决策（Decision）

采用**多文件直连**方案：仓库根目录下放置三个独立 HTML 文件 `index.html`、`about.html`、`calc.html`，所有跳转使用相对路径 `./xxx.html`。

## 三、理由（Rationale）

1. **更简单**：无需手写或引入任何 JS 路由器，HTML 文件即页面。
2. **每个页面都是真实 URL**：可被独立书签、可被搜索引擎独立索引、可在分享时直接定位（例如 `…/calc.html`），而 hash 路由的 `#/calc` 在某些复制粘贴场景中容易被截断。
3. **与 GitHub Pages 子路径自然兼容**：相对路径写法 `./about.html`、`./src/valuation.mjs` 在本地 `python3 -m http.server`、在 `https://tom-0727.github.io/property-valuation-app/` 子路径下都能正确解析。
4. **诊断更直接**：评估者或维护者直接 `view-source:` 任意一页即可看到对应内容，无需先在 DevTools 里追路由表。
5. **契合 ADR-0001 的零构建原则**：不引入路由依赖与 JS 编排复杂度。

## 四、被否决的备选（Alternatives Rejected）

- **hash 路由 SPA**：需要在 `index.html` 内监听 `hashchange`、切换 DOM 区块；引入了与业务无关的 JS 状态管理负担，且不利于评估者直接审阅"模型详情"页面的源码。
- **History API (pushState) 路由**：在 GitHub Pages 上需要为每个虚拟路由都准备 fallback，否则深链接 404；维护成本更高，收益与多文件相同。

## 五、约束与影响（Consequences）

- 三个 HTML 之间的公用片段（如页头、页脚）目前以手写复制方式维持一致，文件改动时需注意同步——但页面只有三个，复制成本可控。
- 任何后续新增页面都需要新增一个 HTML 文件并在导航中显式登记，不能通过路由配置"凭空"出现。
- 若未来页面数量大幅膨胀（例如超过 10 页）或需要复杂的页内子路由，需要新立一条 ADR 重新评估本决策。

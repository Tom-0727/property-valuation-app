# 中国商品住宅内在价值估值

本项目是一个浏览器端的中国商品住宅内在价值估值工具，围绕住宅建设用地使用权 70 年的产权事实组织多种估值模型，参数由使用者依据自身房产与所在城市市场实际自行填入。

## 在线访问

线上地址：https://tom-0727.github.io/property-valuation-app/

首次访问时浏览器可能经过 GitHub Pages 账号级 CNAME 的 301 跳转，属正常行为。

## 设计原则

- 本项目不预置任何数值默认；使用者自行填入所有参数。
- 折旧率、增长率、贴现率、资本化率、空置率、续期对价、风险溢价、波动率、终值等关键参数均由使用者输入，工具不提供"推荐值""典型值""行业均值"。
- 中国商品住宅占用住宅建设用地使用权通常为 70 年（依《城镇国有土地使用权出让和转让暂行条例》设定），与英美永续产权住宅在制度上存在根本差异，估值逻辑围绕这一法定事实展开。
- 估值结果由使用者输入决定；工具同时给出多种主流模型的输出，便于交叉参考。

## 项目结构

- `index.html` — 站点入口与一句话定位页。
- `about.html` — 模型背景、产权制度、参数语义说明。
- `calc.html` — 参数输入与多模型并行结果页。
- `app.js` — 前端表单读取、调用估值函数、渲染结果的胶水代码。
- `styles.css` — 站点样式。
- `src/valuation.mjs` — 估值函数实现（8 个 export），项目核心。
- `tests/valuation.test.mjs` — `node --test` 单元测试，覆盖各函数的数值正确性与异常分支。
- `docs/valuation-models.md` — 各模型的数学公式、适用边界、参数语义与来源依据。
- `docs/decisions/` — 架构决策记录（ADR）。
- `package.json` — npm 元数据；声明 `test` 脚本，无任何依赖。

## 估值函数清单

`src/valuation.mjs` 导出 8 个纯函数，全部以函数参数承接所有数值输入，函数内部不持有任何隐含默认。

- `gordonPerpetuity(NOI_1, r, g)` — Gordon 永续增长模型，将稳定永续净运营收入按 `r - g` 资本化。
- `finiteHorizonDCF(cashFlows, r, TV)` — 有限年期 DCF，按使用者给出的逐年现金流序列与终值 TV 在贴现率 r 下求现值。
- `finiteHorizonDCFConstantGrowth(NOI_1, g, N, r, TV)` — 有限年期 DCF 的恒定增长简化形式，由首期 NOI、年增长率 g、年限 N、贴现率 r 与终值 TV 计算现值。
- `directCapitalisation(NOI, k)` — 直接资本化法，将稳定 NOI 直接除以资本化率 k 得到价值。
- `marketComparison(comparables)` — 市场比较法，对一组可比交易做特征调整后取加权或算术平均。
- `costMethod(L, C_replace, d)` — 折旧重置成本法，由土地价值 L、建筑重置成本 C_replace 与累计折旧率 d 合成价值。
- `realOptionBSM(S, K, sigma, r_f, T)` — 续期作为看涨期权的 Black–Scholes–Merton 闭式解，由标的价值 S、续期对价 K、波动率 sigma、无风险利率 r_f、到期时间 T 计算期权价值。
- `residualIncome(Book0, NOIs, depreciations, capEx, r, CV_N)` — 剩余收益法（Ohlson 风格），由初始账面价值、逐年 NOI/折旧/资本性支出序列、权益资本成本 r 与终值 CV_N 合成内在价值。

每个函数对必填参数缺失抛出 `TypeError`，对越界输入抛出 `RangeError`，详见 `docs/valuation-models.md` 与对应单元测试。

## 本地运行

需要 Node 22（仓库在 Node v22 上验证，`node --test` 行为依赖该版本的稳定 API）。本仓库无任何 npm 依赖，直接克隆即可运行测试。

```
git clone git@github.com:Tom-0727/property-valuation-app.git
cd property-valuation-app
node --test tests/*.test.mjs
```

或使用 npm 脚本：

```
npm test
```

测试套件共 63 个单元测试，覆盖 8 个估值函数。

站点本身是纯静态页面，本地预览可在仓库根目录起一个静态服务器：

```
python3 -m http.server 8080
```

然后访问 http://localhost:8080/。

## 文档与决策

- 数学公式、适用边界、参数语义与来源依据：`docs/valuation-models.md`。
- 技术栈选型记录：`docs/decisions/0001-tech-stack.md`。
- 路由与多页结构记录：`docs/decisions/0002-routing.md`。

## 反馈

如发现公式偏差、参数语义不清或交互问题，欢迎在仓库 GitHub Issues 中提出。本项目尚未声明开源协议。

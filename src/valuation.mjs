// Property Valuation core library — pure functions.
//
// Design contract (enforced by tests under tests/valuation.test.mjs):
//   - No numeric default in signatures for forbidden categories:
//     depreciation rate d, growth rate g, discount rate r, cap rate k,
//     vacancy rate, terminal value TV, renewal cost, risk premium,
//     liquidity premium, hedonic adjustment.
//   - Every required parameter must be an explicit caller input.
//   - Passing `undefined` (or NaN / non-number) for a required numeric
//     parameter throws TypeError.
//   - Domain violations (e.g. r <= g in Gordon, k <= 0 in cap, d outside
//     [0,1] in cost, empty comparables) throw RangeError.
//
// All formulas are taken verbatim from docs/valuation-models.md sections
// II, III, IV, V.1, V.2. Do not "improve" them.

const isFiniteNumber = (x) => typeof x === "number" && Number.isFinite(x);

function requireNumber(name, value) {
  if (value === undefined) {
    throw new TypeError(`Missing required parameter: ${name}`);
  }
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    throw new TypeError(`Parameter ${name} must be a finite number, got ${String(value)}`);
  }
}

// ---------------------------------------------------------------------------
// Model 1 — Gordon perpetuity (docs §II)
//
//   V = NOI_1 / (r - g),  requires g < r and r > -1.
//
//   NOI_1 : future-year-1 net operating income (元/年)
//   r     : required capitalisation / discount rate (1/年)
//   g     : long-run sustainable growth rate of NOI (1/年)
// ---------------------------------------------------------------------------
export function gordonPerpetuity(NOI_1, r, g) {
  requireNumber("NOI_1", NOI_1);
  requireNumber("r", r);
  requireNumber("g", g);
  if (r <= -1) {
    throw new RangeError(`Gordon: r must be > -1, got ${r}`);
  }
  if (r <= g) {
    throw new RangeError(`Gordon: must satisfy g < r, got r=${r}, g=${g}`);
  }
  return NOI_1 / (r - g);
}

// ---------------------------------------------------------------------------
// Model 2 — Finite-horizon DCF (docs §III)
//
//   V = Σ_{t=1..N} CF_t / (1+r)^t  +  TV / (1+r)^N
//
//   cashFlows : array of CF_t values, length defines N (so N is derived,
//               not a separate argument — this prevents the N ≠ CF.length
//               mismatch class of bugs).
//   r         : discount rate (1/年), required, must be > -1
//   TV        : terminal value at year N (元), required (set to 0 explicitly
//               if user assumes zero residual claim — no default here).
// ---------------------------------------------------------------------------
export function finiteHorizonDCF(cashFlows, r, TV) {
  if (cashFlows === undefined) {
    throw new TypeError("Missing required parameter: cashFlows");
  }
  if (!Array.isArray(cashFlows)) {
    throw new TypeError(`cashFlows must be an array, got ${typeof cashFlows}`);
  }
  if (cashFlows.length === 0) {
    throw new RangeError("DCF: cashFlows must be non-empty");
  }
  for (let t = 0; t < cashFlows.length; t++) {
    if (!isFiniteNumber(cashFlows[t])) {
      throw new TypeError(`cashFlows[${t}] must be a finite number, got ${String(cashFlows[t])}`);
    }
  }
  requireNumber("r", r);
  requireNumber("TV", TV);
  if (r <= -1) {
    throw new RangeError(`DCF: r must be > -1, got ${r}`);
  }

  const N = cashFlows.length;
  let pv = 0;
  for (let t = 1; t <= N; t++) {
    pv += cashFlows[t - 1] / Math.pow(1 + r, t);
  }
  pv += TV / Math.pow(1 + r, N);
  return pv;
}

// ---------------------------------------------------------------------------
// Model 2b — Finite-horizon DCF with constant-growth NOI (thin wrapper)
//
// A convenience wrapper around finiteHorizonDCF for the common "simple-mode"
// case where the caller does not have an explicit year-by-year CF series but
// is willing to assume a single constant annual growth rate g applied to a
// year-1 NOI base. The series is built as:
//
//   cashFlows[t-1] = NOI_1 · (1 + g)^(t-1)   for t = 1..N
//
// and then routed through finiteHorizonDCF(cashFlows, r, TV). g is a REQUIRED
// user input — no default is supplied. The math layer's no-defaults contract
// is preserved for every parameter.
//
//   NOI_1 : year-1 net operating income (元/年), finite
//   g     : annual growth rate of NOI (1/年), finite (may be negative)
//   N     : number of years in the horizon, integer >= 1
//   r     : discount rate (1/年), finite, must be > -1
//   TV    : terminal value at year N (元), finite (set to 0 explicitly for
//           a zero-residual scenario — never defaulted)
// ---------------------------------------------------------------------------
export function finiteHorizonDCFConstantGrowth(NOI_1, g, N, r, TV) {
  requireNumber("NOI_1", NOI_1);
  requireNumber("g", g);
  if (N === undefined) {
    throw new TypeError("Missing required parameter: N");
  }
  if (typeof N !== "number" || Number.isNaN(N) || !Number.isFinite(N)) {
    throw new TypeError(`Parameter N must be a finite number, got ${String(N)}`);
  }
  if (!Number.isInteger(N) || N < 1) {
    throw new RangeError(`DCF constant-growth: N must be an integer >= 1, got ${N}`);
  }
  requireNumber("r", r);
  requireNumber("TV", TV);
  if (r <= -1) {
    throw new RangeError(`DCF constant-growth: r must be > -1, got ${r}`);
  }

  const cashFlows = new Array(N);
  for (let t = 1; t <= N; t++) {
    cashFlows[t - 1] = NOI_1 * Math.pow(1 + g, t - 1);
  }
  return finiteHorizonDCF(cashFlows, r, TV);
}

// ---------------------------------------------------------------------------
// Model 3 — Direct capitalisation (docs §IV)
//
//   V = NOI / k
//
//   NOI : steady-state net operating income (元/年)
//   k   : cap rate (1/年), must be > 0
// ---------------------------------------------------------------------------
export function directCapitalisation(NOI, k) {
  requireNumber("NOI", NOI);
  requireNumber("k", k);
  if (k <= 0) {
    throw new RangeError(`Direct capitalisation: k must be > 0, got ${k}`);
  }
  return NOI / k;
}

// ---------------------------------------------------------------------------
// Model 4.1 — Market-comparison with hedonic adjustments (docs §V.1)
//
//   V = (1/m) · Σ_{i=1..m} P_i · Π_j (1 + c_{ij})
//
//   comparables : non-empty array of { price, adjustments } where price is
//                 a finite number > 0 and adjustments is an array of
//                 hedonic adjustment coefficients c_{ij}. The number of
//                 adjustments must match across all comparables (the
//                 caller is asserting "I used the same attribute set j for
//                 every comparable"). Each c_{ij} must be a finite number
//                 and is taken at face value (no default).
// ---------------------------------------------------------------------------
export function marketComparison(comparables) {
  if (comparables === undefined) {
    throw new TypeError("Missing required parameter: comparables");
  }
  if (!Array.isArray(comparables)) {
    throw new TypeError(`comparables must be an array, got ${typeof comparables}`);
  }
  if (comparables.length === 0) {
    throw new RangeError("marketComparison: comparables must be non-empty");
  }

  let expectedAdjLen = null;
  let sum = 0;
  for (let i = 0; i < comparables.length; i++) {
    const c = comparables[i];
    if (c === null || typeof c !== "object") {
      throw new TypeError(`comparables[${i}] must be an object with {price, adjustments}`);
    }
    const { price, adjustments } = c;
    if (price === undefined) {
      throw new TypeError(`comparables[${i}].price is required`);
    }
    if (!isFiniteNumber(price)) {
      throw new TypeError(`comparables[${i}].price must be a finite number, got ${String(price)}`);
    }
    if (price <= 0) {
      throw new RangeError(`comparables[${i}].price must be > 0, got ${price}`);
    }
    if (adjustments === undefined) {
      throw new TypeError(`comparables[${i}].adjustments is required (use [] for no adjustments)`);
    }
    if (!Array.isArray(adjustments)) {
      throw new TypeError(`comparables[${i}].adjustments must be an array`);
    }
    if (expectedAdjLen === null) {
      expectedAdjLen = adjustments.length;
    } else if (adjustments.length !== expectedAdjLen) {
      throw new RangeError(
        `comparables[${i}].adjustments length ${adjustments.length} != expected ${expectedAdjLen}`,
      );
    }
    let factor = 1;
    for (let j = 0; j < adjustments.length; j++) {
      const cij = adjustments[j];
      if (!isFiniteNumber(cij)) {
        throw new TypeError(
          `comparables[${i}].adjustments[${j}] must be a finite number, got ${String(cij)}`,
        );
      }
      factor *= 1 + cij;
    }
    sum += price * factor;
  }
  return sum / comparables.length;
}

// ---------------------------------------------------------------------------
// Model 4.2 — Cost method / depreciated replacement cost (docs §V.2)
//
//   V = L + C_replace · (1 - d)
//
//   L         : land-use right value (元), must be >= 0
//   C_replace : replacement-new construction cost (元), must be >= 0
//   d         : composite depreciation rate, must be in [0, 1]
// ---------------------------------------------------------------------------
export function costMethod(L, C_replace, d) {
  requireNumber("L", L);
  requireNumber("C_replace", C_replace);
  requireNumber("d", d);
  if (L < 0) {
    throw new RangeError(`Cost method: L must be >= 0, got ${L}`);
  }
  if (C_replace < 0) {
    throw new RangeError(`Cost method: C_replace must be >= 0, got ${C_replace}`);
  }
  if (d < 0 || d > 1) {
    throw new RangeError(`Cost method: d must be in [0, 1], got ${d}`);
  }
  return L + C_replace * (1 - d);
}

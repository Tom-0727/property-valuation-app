// Unit tests for src/valuation.mjs — node:test + node:assert/strict.
// Run from repo root:  node --test tests/*.test.mjs
//
// IMPORTANT: The numeric inputs used here (e.g. r=0.08, g=0.03, d=0.30) are
// purely illustrative fixtures chosen so the formulas can be hand-checked.
// They are NOT recommended parameter values and the library itself enforces
// "no defaults" — callers must always pass every required parameter
// explicitly.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  gordonPerpetuity,
  finiteHorizonDCF,
  finiteHorizonDCFConstantGrowth,
  directCapitalisation,
  marketComparison,
  costMethod,
} from "../src/valuation.mjs";

const approx = (actual, expected, eps = 1e-9) => {
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `expected ${expected} ± ${eps}, got ${actual}`,
  );
};

// ---------------------------------------------------------------------------
// Gordon perpetuity
// ---------------------------------------------------------------------------

test("gordonPerpetuity: reference value NOI=100, r=0.08, g=0.03 -> 2000", () => {
  // V = 100 / (0.08 - 0.03) = 100 / 0.05 = 2000
  approx(gordonPerpetuity(100, 0.08, 0.03), 2000, 1e-9);
});

test("gordonPerpetuity: g = 0 degenerates to NOI / r", () => {
  approx(gordonPerpetuity(50, 0.05, 0), 1000, 1e-9);
});

test("gordonPerpetuity: throws RangeError when g == r", () => {
  assert.throws(() => gordonPerpetuity(100, 0.05, 0.05), RangeError);
});

test("gordonPerpetuity: throws RangeError when g > r", () => {
  assert.throws(() => gordonPerpetuity(100, 0.04, 0.05), RangeError);
});

test("gordonPerpetuity: throws RangeError when r <= -1", () => {
  assert.throws(() => gordonPerpetuity(100, -1, -2), RangeError);
});

test("gordonPerpetuity: throws TypeError when r is undefined (no-default guardrail)", () => {
  assert.throws(() => gordonPerpetuity(100, undefined, 0.03), TypeError);
});

test("gordonPerpetuity: throws TypeError when g is undefined (no-default guardrail)", () => {
  assert.throws(() => gordonPerpetuity(100, 0.08, undefined), TypeError);
});

test("gordonPerpetuity: throws TypeError on NaN inputs", () => {
  assert.throws(() => gordonPerpetuity(NaN, 0.08, 0.03), TypeError);
  assert.throws(() => gordonPerpetuity(100, NaN, 0.03), TypeError);
});

// ---------------------------------------------------------------------------
// Finite-horizon DCF
// ---------------------------------------------------------------------------

test("finiteHorizonDCF: CF=[100,100], r=0.10, TV=0 -> ≈ 173.553719008", () => {
  // V = 100/1.1 + 100/1.21 = 90.9090909... + 82.6446281... = 173.5537190...
  const expected = 100 / 1.1 + 100 / 1.21;
  approx(finiteHorizonDCF([100, 100], 0.10, 0), expected, 1e-9);
});

test("finiteHorizonDCF: TV propagates correctly", () => {
  // CF=[100], r=0.10, TV=1100 -> 100/1.1 + 1100/1.1 = 1200/1.1 ≈ 1090.9090909
  const expected = 100 / 1.1 + 1100 / 1.1;
  approx(finiteHorizonDCF([100], 0.10, 1100), expected, 1e-9);
});

test("finiteHorizonDCF: r=0 means no discounting (PV = sum of CFs + TV)", () => {
  approx(finiteHorizonDCF([100, 200, 300], 0, 50), 650, 1e-9);
});

test("finiteHorizonDCF: throws TypeError when cashFlows is undefined", () => {
  assert.throws(() => finiteHorizonDCF(undefined, 0.1, 0), TypeError);
});

test("finiteHorizonDCF: throws TypeError when cashFlows is not an array", () => {
  assert.throws(() => finiteHorizonDCF("100,100", 0.1, 0), TypeError);
});

test("finiteHorizonDCF: throws RangeError on empty cashFlows", () => {
  assert.throws(() => finiteHorizonDCF([], 0.1, 0), RangeError);
});

test("finiteHorizonDCF: throws RangeError when r <= -1", () => {
  assert.throws(() => finiteHorizonDCF([100], -1, 0), RangeError);
  assert.throws(() => finiteHorizonDCF([100], -1.5, 0), RangeError);
});

test("finiteHorizonDCF: throws TypeError when r is undefined (no-default guardrail)", () => {
  assert.throws(() => finiteHorizonDCF([100, 100], undefined, 0), TypeError);
});

test("finiteHorizonDCF: throws TypeError when TV is undefined (no-default guardrail)", () => {
  assert.throws(() => finiteHorizonDCF([100, 100], 0.1, undefined), TypeError);
});

test("finiteHorizonDCF: throws TypeError when a CF entry is non-numeric", () => {
  assert.throws(() => finiteHorizonDCF([100, "200"], 0.1, 0), TypeError);
  assert.throws(() => finiteHorizonDCF([100, NaN], 0.1, 0), TypeError);
});

// ---------------------------------------------------------------------------
// Finite-horizon DCF with constant-growth NOI (simple-mode wrapper)
// ---------------------------------------------------------------------------

test("finiteHorizonDCFConstantGrowth: NOI_1=100, g=0, N=3, r=0.10, TV=0 -> ≈ 248.685199", () => {
  // V = 100/1.1 + 100/1.21 + 100/1.331
  const expected = 100 / 1.1 + 100 / 1.21 + 100 / 1.331;
  approx(finiteHorizonDCFConstantGrowth(100, 0, 3, 0.10, 0), expected, 1e-9);
});

test("finiteHorizonDCFConstantGrowth: g=0 matches finiteHorizonDCF with flat CF series", () => {
  const viaWrapper = finiteHorizonDCFConstantGrowth(100, 0, 3, 0.10, 0);
  const viaCore = finiteHorizonDCF([100, 100, 100], 0.10, 0);
  approx(viaWrapper, viaCore, 1e-12);
});

test("finiteHorizonDCFConstantGrowth: NOI_1=100, g=0.05, N=2, r=0.10, TV=0 -> 100/1.1 + 105/1.21", () => {
  const expected = 100 / 1.1 + 105 / 1.21;
  approx(finiteHorizonDCFConstantGrowth(100, 0.05, 2, 0.10, 0), expected, 1e-9);
});

test("finiteHorizonDCFConstantGrowth: TV propagates correctly through wrapper", () => {
  // N=1, NOI_1=100, g anything (only t=1 used), r=0.10, TV=1100
  const expected = 100 / 1.1 + 1100 / 1.1;
  approx(finiteHorizonDCFConstantGrowth(100, 0.05, 1, 0.10, 1100), expected, 1e-9);
});

test("finiteHorizonDCFConstantGrowth: throws TypeError on undefined NOI_1 / g / r / TV", () => {
  assert.throws(() => finiteHorizonDCFConstantGrowth(undefined, 0, 3, 0.10, 0), TypeError);
  assert.throws(() => finiteHorizonDCFConstantGrowth(100, undefined, 3, 0.10, 0), TypeError);
  assert.throws(() => finiteHorizonDCFConstantGrowth(100, 0, 3, undefined, 0), TypeError);
  assert.throws(() => finiteHorizonDCFConstantGrowth(100, 0, 3, 0.10, undefined), TypeError);
});

test("finiteHorizonDCFConstantGrowth: throws TypeError when N is undefined", () => {
  assert.throws(() => finiteHorizonDCFConstantGrowth(100, 0, undefined, 0.10, 0), TypeError);
});

test("finiteHorizonDCFConstantGrowth: throws TypeError on NaN r", () => {
  assert.throws(() => finiteHorizonDCFConstantGrowth(100, 0, 3, NaN, 0), TypeError);
});

test("finiteHorizonDCFConstantGrowth: throws RangeError when N is 0, negative or non-integer", () => {
  assert.throws(() => finiteHorizonDCFConstantGrowth(100, 0, 0, 0.10, 0), RangeError);
  assert.throws(() => finiteHorizonDCFConstantGrowth(100, 0, -1, 0.10, 0), RangeError);
  assert.throws(() => finiteHorizonDCFConstantGrowth(100, 0, 2.5, 0.10, 0), RangeError);
});

test("finiteHorizonDCFConstantGrowth: throws RangeError when r <= -1", () => {
  assert.throws(() => finiteHorizonDCFConstantGrowth(100, 0, 3, -1, 0), RangeError);
  assert.throws(() => finiteHorizonDCFConstantGrowth(100, 0, 3, -1.2, 0), RangeError);
});

// ---------------------------------------------------------------------------
// Direct capitalisation
// ---------------------------------------------------------------------------

test("directCapitalisation: NOI=120000, k=0.04 -> 3,000,000", () => {
  approx(directCapitalisation(120000, 0.04), 3_000_000, 1e-6);
});

test("directCapitalisation: throws RangeError when k == 0", () => {
  assert.throws(() => directCapitalisation(100, 0), RangeError);
});

test("directCapitalisation: throws RangeError when k < 0", () => {
  assert.throws(() => directCapitalisation(100, -0.01), RangeError);
});

test("directCapitalisation: throws TypeError when k is undefined (no-default guardrail)", () => {
  assert.throws(() => directCapitalisation(100, undefined), TypeError);
});

test("directCapitalisation: throws TypeError when NOI is undefined", () => {
  assert.throws(() => directCapitalisation(undefined, 0.04), TypeError);
});

// ---------------------------------------------------------------------------
// Market comparison (hedonic)
// ---------------------------------------------------------------------------

test("marketComparison: two comparables, single adjustment each, exact average", () => {
  // P1=1_000_000 with c=+0.05 -> 1_050_000
  // P2=1_200_000 with c=-0.10 -> 1_080_000
  // V = (1_050_000 + 1_080_000) / 2 = 1_065_000
  const v = marketComparison([
    { price: 1_000_000, adjustments: [0.05] },
    { price: 1_200_000, adjustments: [-0.10] },
  ]);
  approx(v, 1_065_000, 1e-6);
});

test("marketComparison: single comparable with empty adjustments == price", () => {
  approx(
    marketComparison([{ price: 2_500_000, adjustments: [] }]),
    2_500_000,
    1e-6,
  );
});

test("marketComparison: multiple adjustments compound multiplicatively", () => {
  // (1+0.1)(1+0.2) = 1.32, so P*1.32 = 132 for P=100, m=1 -> V=132
  approx(
    marketComparison([{ price: 100, adjustments: [0.1, 0.2] }]),
    132,
    1e-9,
  );
});

test("marketComparison: throws RangeError on empty comparables list", () => {
  assert.throws(() => marketComparison([]), RangeError);
});

test("marketComparison: throws RangeError on mismatched adjustment lengths", () => {
  assert.throws(
    () =>
      marketComparison([
        { price: 100, adjustments: [0.05] },
        { price: 200, adjustments: [0.05, 0.03] },
      ]),
    RangeError,
  );
});

test("marketComparison: throws TypeError when comparables is undefined (no-default guardrail)", () => {
  assert.throws(() => marketComparison(undefined), TypeError);
});

test("marketComparison: throws TypeError when an adjustment entry is non-numeric", () => {
  assert.throws(
    () => marketComparison([{ price: 100, adjustments: [undefined] }]),
    TypeError,
  );
});

// ---------------------------------------------------------------------------
// Cost method
// ---------------------------------------------------------------------------

test("costMethod: L=500000, C_replace=800000, d=0.30 -> 1,060,000", () => {
  // V = 500000 + 800000 * (1 - 0.3) = 500000 + 560000 = 1_060_000
  approx(costMethod(500_000, 800_000, 0.30), 1_060_000, 1e-6);
});

test("costMethod: d == 0 means no depreciation", () => {
  approx(costMethod(0, 100, 0), 100, 1e-9);
});

test("costMethod: d == 1 means total depreciation (only land remains)", () => {
  approx(costMethod(500, 100, 1), 500, 1e-9);
});

test("costMethod: throws RangeError when d < 0", () => {
  assert.throws(() => costMethod(100, 100, -0.01), RangeError);
});

test("costMethod: throws RangeError when d > 1", () => {
  assert.throws(() => costMethod(100, 100, 1.01), RangeError);
});

test("costMethod: throws RangeError when L < 0", () => {
  assert.throws(() => costMethod(-1, 100, 0.3), RangeError);
});

test("costMethod: throws RangeError when C_replace < 0", () => {
  assert.throws(() => costMethod(100, -1, 0.3), RangeError);
});

test("costMethod: throws TypeError when d is undefined (no-default guardrail)", () => {
  assert.throws(() => costMethod(100, 100, undefined), TypeError);
});

test("costMethod: throws TypeError when L is undefined", () => {
  assert.throws(() => costMethod(undefined, 100, 0.3), TypeError);
});

test("costMethod: throws TypeError when C_replace is undefined", () => {
  assert.throws(() => costMethod(100, undefined, 0.3), TypeError);
});

// app.js — browser glue that wires DOM forms to the pure valuation functions.
// Reads user input from forms, calls into src/valuation.mjs, and renders
// either a formatted result or the thrown error message into each result region.
//
// NO numeric defaults for any domain parameter — every value originates from the
// user's typed input. The only numeric literals appearing in this file are loop
// indices (0, 1) and option-value identifiers for Intl.NumberFormat.

import {
  gordonPerpetuity,
  finiteHorizonDCF,
  directCapitalisation,
  marketComparison,
  costMethod,
} from "./src/valuation.mjs";

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const moneyFormatter = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  maximumFractionDigits: 2,
});

function renderSuccess(el, value, modelLabel) {
  el.classList.remove("error");
  el.classList.add("success");
  el.innerHTML =
    '<div>模型：' + escapeHtml(modelLabel) + '</div>' +
    '<div>估值：<span class="value">' + escapeHtml(moneyFormatter.format(value)) + '</span></div>' +
    '<div>原始数值：<span class="value">' + escapeHtml(String(value)) + '</span></div>';
}

function renderError(el, err) {
  el.classList.remove("success");
  el.classList.add("error");
  const message = err && err.message ? err.message : String(err);
  el.textContent = "错误：" + message;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// Input parsing helpers — strict: empty / NaN inputs raise a clear 中文 error.
// ---------------------------------------------------------------------------

function parseRequiredNumber(rawValue, fieldLabel) {
  if (rawValue === undefined || rawValue === null) {
    throw new Error("参数「" + fieldLabel + "」未填写。");
  }
  const trimmed = String(rawValue).trim();
  if (trimmed === "") {
    throw new Error("参数「" + fieldLabel + "」未填写。");
  }
  const parsed = Number.parseFloat(trimmed);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
    throw new Error("参数「" + fieldLabel + "」无法解析为数字：" + trimmed);
  }
  return parsed;
}

function parseNumberList(rawValue, fieldLabel) {
  if (rawValue === undefined || rawValue === null) {
    throw new Error("参数「" + fieldLabel + "」未填写。");
  }
  const trimmed = String(rawValue).trim();
  if (trimmed === "") {
    throw new Error("参数「" + fieldLabel + "」未填写。");
  }
  // Split by comma / whitespace / Chinese comma to be permissive.
  const tokens = trimmed
    .split(/[,，\s]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  if (tokens.length === 0) {
    throw new Error("参数「" + fieldLabel + "」解析后为空。");
  }
  const numbers = [];
  for (let i = 0; i < tokens.length; i++) {
    const parsed = Number.parseFloat(tokens[i]);
    if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
      throw new Error(
        "参数「" + fieldLabel + "」第 " + (i + 1) + " 项无法解析为数字：" + tokens[i],
      );
    }
    numbers.push(parsed);
  }
  return numbers;
}

function parseOptionalNumberList(rawValue, fieldLabel) {
  if (rawValue === undefined || rawValue === null) {
    return [];
  }
  const trimmed = String(rawValue).trim();
  if (trimmed === "") {
    return [];
  }
  return parseNumberList(rawValue, fieldLabel);
}

// ---------------------------------------------------------------------------
// Submit handlers — one per model
// ---------------------------------------------------------------------------

function handleGordon(event) {
  event.preventDefault();
  const result = document.getElementById("result-gordon");
  try {
    const form = event.currentTarget;
    const NOI_1 = parseRequiredNumber(form.elements.NOI_1.value, "NOI_1");
    const r = parseRequiredNumber(form.elements.r.value, "r");
    const g = parseRequiredNumber(form.elements.g.value, "g");
    const value = gordonPerpetuity(NOI_1, r, g);
    renderSuccess(result, value, "永续模型 (Gordon)");
  } catch (err) {
    renderError(result, err);
  }
}

function handleDCF(event) {
  event.preventDefault();
  const result = document.getElementById("result-dcf");
  try {
    const form = event.currentTarget;
    const cashFlows = parseNumberList(form.elements.cashFlows.value, "CF_t 序列");
    const r = parseRequiredNumber(form.elements.r.value, "r");
    const TV = parseRequiredNumber(form.elements.TV.value, "TV");
    const value = finiteHorizonDCF(cashFlows, r, TV);
    renderSuccess(result, value, "有限年期 DCF");
  } catch (err) {
    renderError(result, err);
  }
}

function handleCap(event) {
  event.preventDefault();
  const result = document.getElementById("result-cap");
  try {
    const form = event.currentTarget;
    const NOI = parseRequiredNumber(form.elements.NOI.value, "NOI");
    const k = parseRequiredNumber(form.elements.k.value, "k");
    const value = directCapitalisation(NOI, k);
    renderSuccess(result, value, "直接资本化法");
  } catch (err) {
    renderError(result, err);
  }
}

function handleMarketComparison(event) {
  event.preventDefault();
  const result = document.getElementById("result-mc");
  try {
    const form = event.currentTarget;
    const rows = form.querySelectorAll(".comparable-row");
    if (rows.length === 0) {
      throw new Error("至少需要一个可比案例。");
    }
    const comparables = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const priceInput = row.querySelector('input[name="price"]');
      const adjInput = row.querySelector('input[name="adjustments"]');
      const price = parseRequiredNumber(
        priceInput ? priceInput.value : "",
        "可比案例 #" + (i + 1) + " 的成交价 P",
      );
      const adjustments = parseOptionalNumberList(
        adjInput ? adjInput.value : "",
        "可比案例 #" + (i + 1) + " 的调整系数",
      );
      comparables.push({ price, adjustments });
    }
    const value = marketComparison(comparables);
    renderSuccess(result, value, "市场比较法");
  } catch (err) {
    renderError(result, err);
  }
}

function handleCost(event) {
  event.preventDefault();
  const result = document.getElementById("result-cost");
  try {
    const form = event.currentTarget;
    const L = parseRequiredNumber(form.elements.L.value, "L");
    const C_replace = parseRequiredNumber(form.elements.C_replace.value, "C_replace");
    const d = parseRequiredNumber(form.elements.d.value, "d");
    const value = costMethod(L, C_replace, d);
    renderSuccess(result, value, "成本法（折旧重置成本法）");
  } catch (err) {
    renderError(result, err);
  }
}

// ---------------------------------------------------------------------------
// Market-comparison row add / remove (purely DOM, no domain numerics)
// ---------------------------------------------------------------------------

function buildComparableRow(index) {
  const wrapper = document.createElement("div");
  wrapper.className = "comparable-row";
  wrapper.setAttribute("data-row-index", String(index));
  const humanIndex = index + 1;
  wrapper.innerHTML =
    '<div class="row-header"><span>可比案例 #' + humanIndex + '</span></div>' +
    '<div class="field">' +
    '<label>P_' + humanIndex + '：成交价（元），需 &gt; 0</label>' +
    '<input name="price" type="text" inputmode="decimal" placeholder="请输入第 ' + humanIndex + ' 个可比案例的成交价" autocomplete="off" />' +
    '<span class="hint">由当地公开成交数据获取；由使用者输入。</span>' +
    '</div>' +
    '<div class="field">' +
    '<label>第 ' + humanIndex + ' 个案例的调整系数（小数，以英文逗号或空格分隔；属性集需所有案例一致）</label>' +
    '<input name="adjustments" type="text" inputmode="decimal" placeholder="按与第 1 个案例相同的属性集顺序填入" autocomplete="off" />' +
    '<span class="hint">每一项 c_{ij} 由使用者依当地市场对该属性的边际定价输入；本应用不预置任何属性溢价数值。</span>' +
    '</div>';
  return wrapper;
}

function handleAddComparable() {
  const container = document.getElementById("mc-rows");
  if (!container) return;
  const currentCount = container.querySelectorAll(".comparable-row").length;
  container.appendChild(buildComparableRow(currentCount));
}

function handleRemoveComparable() {
  const container = document.getElementById("mc-rows");
  if (!container) return;
  const rows = container.querySelectorAll(".comparable-row");
  if (rows.length <= 1) return;
  container.removeChild(rows[rows.length - 1]);
}

// ---------------------------------------------------------------------------
// Wire-up
// ---------------------------------------------------------------------------

function wire() {
  const gordon = document.getElementById("form-gordon");
  if (gordon) gordon.addEventListener("submit", handleGordon);

  const dcf = document.getElementById("form-dcf");
  if (dcf) dcf.addEventListener("submit", handleDCF);

  const cap = document.getElementById("form-cap");
  if (cap) cap.addEventListener("submit", handleCap);

  const mc = document.getElementById("form-mc");
  if (mc) mc.addEventListener("submit", handleMarketComparison);

  const addBtn = document.getElementById("mc-add");
  if (addBtn) addBtn.addEventListener("click", handleAddComparable);
  const rmBtn = document.getElementById("mc-remove");
  if (rmBtn) rmBtn.addEventListener("click", handleRemoveComparable);

  const cost = document.getElementById("form-cost");
  if (cost) cost.addEventListener("submit", handleCost);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", wire);
} else {
  wire();
}

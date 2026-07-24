export const MathUtils = {
  round2(value) {
    if (value == null || Number.isNaN(value) || !Number.isFinite(value)) return 0;
    return math.round(value, 2);
  },

  roundSeries(series) {
    return _.map(series, v => MathUtils.round2(v));
  },

  safeDivide(numerator, denominator, fallback = 0) {
    if (!denominator || !Number.isFinite(denominator) || Math.abs(denominator) < 1e-9) return fallback;
    return numerator / denominator;
  },

  sum(series) {
    return MathUtils.round2(_.sum(series));
  },

  mean(series) {
    return MathUtils.round2(_.mean(series));
  },

  weightedAverage(rows, fallback = 0) {
    const totalWeight = _.sumBy(rows, 'weight');
    if (totalWeight <= 0) return fallback;
    const sum = _.sumBy(rows, r => r.weight * r.value);
    return MathUtils.safeDivide(sum, totalWeight, fallback);
  },

  compoundGrowth(base, ratePct, periods) {
    if (!periods || periods <= 0) return base;
    return base * Math.pow(1 + ratePct / 100, periods);
  },

  pmt(principal, monthlyRate, periods) {
    if (periods <= 0) return 0;
    if (Math.abs(monthlyRate) < 1e-12) return MathUtils.safeDivide(principal, periods);
    return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -periods));
  },

  npv(discountRate, cashFlows) {
    const rate = discountRate / 100;
    return MathUtils.round2(_.sumBy(cashFlows, (cf, i) => cf / Math.pow(1 + rate, i)));
  },

  evaluateFormula(expression, scope) {
    if (!expression) return 0;
    try {
      const result = math.evaluate(expression, scope);
      return typeof result === 'number' && Number.isFinite(result) ? MathUtils.round2(result) : 0;
    } catch (e) {
      console.warn(`[MathUtils] Invalid formula "${expression}":`, e.message);
      return 0;
    }
  },

  isValidFormula(expression) {
    try {
      math.parse(expression);
      return true;
    } catch {
      return false;
    }
  }
};
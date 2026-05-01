// ─── Normalization ────────────────────────────────────────────────────────────

export function normalizePaydex(score) {
  return Math.min(100, Math.max(0, score));
}

export function normalizeFSS(score) {
  // Range: 1001–2000
  return Math.min(100, Math.max(0, ((score - 1001) / 999) * 100));
}

export function normalizeDelinquency(score) {
  // Range: 101–1875
  return Math.min(100, Math.max(0, ((score - 101) / 1774) * 100));
}

export function normalizeFailure(score) {
  // Range: 1001–1875
  return Math.min(100, Math.max(0, ((score - 1001) / 874) * 100));
}

export function normalizeDBT(value) {
  // 0 days beyond terms → 100, 90+ → 0
  return Math.min(100, Math.max(0, 100 - (value / 90) * 100));
}

const SIZE_CODE_SCORES = {
  '5A': 100,
  '4A': 83,
  '3A': 67,
  '2A': 58,
  '1A': 50,
  BA:   42,
  BB:   33,
  CB:   25,
  CC:   17,
  DC:    8,
  DD:    0,
};

const APPRAISAL_MULTIPLIERS = {
  '1': 1.00, // High
  '2': 0.85, // Good
  '3': 0.70, // Fair
  '4': 0.50, // Limited
};

export function normalizeDnBRating(raw) {
  if (!raw) return 0;
  // e.g. "3A2" → sizeCode "3A", appraisal "2"
  const appraisal = raw.slice(-1);
  const sizeCode  = raw.slice(0, -1);
  const sizeScore  = SIZE_CODE_SCORES[sizeCode]         ?? 0;
  const multiplier = APPRAISAL_MULTIPLIERS[appraisal]   ?? 0.5;
  return Math.min(100, Math.max(0, sizeScore * multiplier));
}

// ─── Dimension scorers ────────────────────────────────────────────────────────

/**
 * aging shape:
 *   { dso, overdue_pct, outstanding, credit_limit,
 *     bucket_30, bucket_60, bucket_90, bucket_90plus, bucket_120plus }
 * All bucket values are outstanding amounts in that aging tier.
 */
export function scorePaymentBehavior(aging) {
  const {
    dso            = 0,
    overdue_pct    = 0,
    bucket_30      = 0,
    bucket_60      = 0,
    bucket_90      = 0,
    bucket_90plus  = 0,
    bucket_120plus = 0,
  } = aging;

  // DSO score — 0–30 days = excellent, degrades to 0 at 150+
  let dsoScore;
  if (dso <= 30)       dsoScore = 100;
  else if (dso <= 60)  dsoScore = 100 - ((dso - 30)  / 30) * 20;  // 100→80
  else if (dso <= 90)  dsoScore = 80  - ((dso - 60)  / 30) * 20;  // 80→60
  else if (dso <= 120) dsoScore = 60  - ((dso - 90)  / 30) * 30;  // 60→30
  else                 dsoScore = Math.max(0, 30 - ((dso - 120) / 30) * 10);

  // Overdue % score — steeper penalty above 20%
  const overdueScore = overdue_pct <= 20
    ? 100 - overdue_pct * 1.0
    : 80  - (overdue_pct - 20) * 2.0;

  // Aging bucket severity — weighted by risk tier
  const slowTotal = bucket_30 + bucket_60 + bucket_90 + bucket_90plus + bucket_120plus;
  let bucketScore = 100;
  if (slowTotal > 0) {
    const severityIndex =
      (bucket_30      * 0.5 +
       bucket_60      * 1.5 +
       bucket_90      * 3.0 +
       bucket_90plus  * 3.5 +
       bucket_120plus * 5.0) / slowTotal;
    bucketScore = Math.max(0, 100 - severityIndex * 18);
  }

  return clamp(dsoScore * 0.40 + Math.max(0, overdueScore) * 0.35 + bucketScore * 0.25);
}

/**
 * customer shape (financial fields):
 *   { revenue_cr, ebitda_pct, debt_equity, ... }
 */
export function scoreFinancialHealth(customer) {
  const {
    revenue_cr   = 0,
    ebitda_pct   = 0,
    debt_equity  = 0,
  } = customer;

  // Revenue tier (in crores)
  let revenueScore;
  if (revenue_cr >= 1000)     revenueScore = 100;
  else if (revenue_cr >= 500) revenueScore = 90;
  else if (revenue_cr >= 100) revenueScore = 75;
  else if (revenue_cr >= 50)  revenueScore = 60;
  else if (revenue_cr >= 10)  revenueScore = 45;
  else                        revenueScore = 25;

  // EBITDA margin — negative collapses score quickly
  let ebitdaScore;
  if (ebitda_pct >= 20)      ebitdaScore = 100;
  else if (ebitda_pct >= 10) ebitdaScore = 80 + (ebitda_pct - 10) * 2;
  else if (ebitda_pct >= 5)  ebitdaScore = 60 + (ebitda_pct - 5)  * 4;
  else if (ebitda_pct >= 0)  ebitdaScore = 40 + ebitda_pct * 4;
  else                       ebitdaScore = Math.max(0, 40 + ebitda_pct * 3); // <0 → fast decay

  // Debt / equity (lower is safer)
  let debtEquityScore;
  if (debt_equity <= 0.5)      debtEquityScore = 100;
  else if (debt_equity <= 1.0) debtEquityScore = 100 - (debt_equity - 0.5) / 0.5 * 20;  // 100→80
  else if (debt_equity <= 2.0) debtEquityScore = 80  - (debt_equity - 1.0) * 20;         // 80→60
  else if (debt_equity <= 3.0) debtEquityScore = 60  - (debt_equity - 2.0) * 20;         // 60→40
  else                         debtEquityScore = Math.max(0, 40 - (debt_equity - 3.0) * 13);

  return clamp(revenueScore * 0.30 + ebitdaScore * 0.45 + debtEquityScore * 0.25);
}

/**
 * Measures credit utilisation and portfolio concentration risk.
 * aging: { outstanding, credit_limit, ... }
 * totalPortfolioOutstanding: sum of all customers' outstanding
 */
export function scoreExposure(aging, totalPortfolioOutstanding) {
  const { outstanding = 0, credit_limit = 1 } = aging;
  const total = Math.max(1, totalPortfolioOutstanding);
  const limit = Math.max(1, credit_limit);

  // Utilisation = outstanding / credit_limit
  const util = outstanding / limit;
  let utilizationScore;
  if (util <= 0.50)      utilizationScore = 100;
  else if (util <= 0.70) utilizationScore = 100 - (util - 0.50) / 0.20 * 20;  // 100→80
  else if (util <= 0.90) utilizationScore = 80  - (util - 0.70) / 0.20 * 25;  // 80→55
  else if (util <= 1.00) utilizationScore = 55  - (util - 0.90) / 0.10 * 25;  // 55→30
  else                   utilizationScore = Math.max(0, 30 - (util - 1.00) * 60);

  // Concentration = this customer's share of total portfolio
  const conc = outstanding / total;
  let concentrationScore;
  if (conc <= 0.02)      concentrationScore = 100;
  else if (conc <= 0.05) concentrationScore = 100 - (conc - 0.02) / 0.03 * 20;  // 100→80
  else if (conc <= 0.10) concentrationScore = 80  - (conc - 0.05) / 0.05 * 20;  // 80→60
  else if (conc <= 0.20) concentrationScore = 60  - (conc - 0.10) / 0.10 * 25;  // 60→35
  else                   concentrationScore = Math.max(0, 35 - (conc - 0.20) * 100);

  return clamp(utilizationScore * 0.65 + concentrationScore * 0.35);
}

/**
 * customer: { tenure_years }
 */
export function scoreTenure(customer) {
  const { tenure_years = 0 } = customer;
  if (tenure_years >= 10) return 100;
  if (tenure_years >= 7)  return 85;
  if (tenure_years >= 5)  return 70;
  if (tenure_years >= 3)  return 55;
  if (tenure_years >= 2)  return 40;
  if (tenure_years >= 1)  return 25;
  return 10;
}

const INDUSTRY_SCORES = {
  Technology:      85,
  Healthcare:      80,
  Pharmaceuticals: 78,
  Manufacturing:   75,
  FMCG:            72,
  Automotive:      68,
  Construction:    60,
  Retail:          58,
  Services:        55,
  Textiles:        50,
  'Real Estate':   45,
  Media:           42,
  Hospitality:     40,
  Mining:          35,
  Shipping:        30,
};

const CITY_TIER_SCORES = {
  1: 90, // Mumbai, Delhi, Bangalore, etc.
  2: 70, // Hyderabad, Pune, Ahmedabad, etc.
  3: 45, // Smaller metros and tier-3 cities
};

/**
 * customer: { industry, city_tier }
 */
export function scoreExternalRisk(customer) {
  const { industry = 'Services', city_tier = 2 } = customer;
  const industryScore = INDUSTRY_SCORES[industry] ?? 50;
  const cityScore     = CITY_TIER_SCORES[city_tier] ?? 70;
  return clamp(industryScore * 0.70 + cityScore * 0.30);
}

/**
 * dnbData: a record from mockDnBDatabase (or live API response)
 * Weights: paydex 30%, FSS 20%, delinquency 20%, failure 15%, DBT 10%, rating 5%
 */
export function scoreDnB(dnbData) {
  if (!dnbData) return null;

  const paydexNorm      = normalizePaydex(dnbData.paydex?.score                    ?? 0);
  const fssNorm         = normalizeFSS(dnbData.financialStressScore?.score         ?? 1001);
  const delinquencyNorm = normalizeDelinquency(dnbData.delinquencyScore?.score     ?? 101);
  const failureNorm     = normalizeFailure(dnbData.failureScore?.score             ?? 1001);
  const dbtNorm         = normalizeDBT(dnbData.dbt?.value                          ?? 90);
  const ratingNorm      = normalizeDnBRating(dnbData.dnbRating?.raw               ?? '');

  return clamp(
    paydexNorm      * 0.30 +
    fssNorm         * 0.20 +
    delinquencyNorm * 0.20 +
    failureNorm     * 0.15 +
    dbtNorm         * 0.10 +
    ratingNorm      * 0.05
  );
}

// ─── Rating bands ─────────────────────────────────────────────────────────────

export function getRating(score) {
  if (score >= 75) return 'A';
  if (score >= 50) return 'B';
  if (score >= 25) return 'C';
  return 'D';
}

// ─── Base dimension weights ───────────────────────────────────────────────────

const BASE_WEIGHTS = {
  payment:  0.25,
  financial: 0.20,
  exposure: 0.15,
  tenure:   0.10,
  external: 0.10,
  dnb:      0.20,
};

// ─── Final scorer ─────────────────────────────────────────────────────────────

/**
 * @param {object} customer      - Full customer record (financial + profile fields)
 * @param {object} aging         - Aging/receivables snapshot for this customer
 * @param {object|null} dnbData  - D&B record from mockDnBAPI, or null if unavailable
 * @param {number} totalPortfolioOutstanding - Sum of outstanding across all customers
 * @returns {{ finalScore, rating, dimensions, flags }}
 */
export function calculateFinalScore(customer, aging, dnbData, totalPortfolioOutstanding) {
  const dimensions = {
    payment:  scorePaymentBehavior(aging),
    financial: scoreFinancialHealth(customer),
    exposure: scoreExposure(aging, totalPortfolioOutstanding),
    tenure:   scoreTenure(customer),
    external: scoreExternalRisk(customer),
    dnb:      dnbData ? scoreDnB(dnbData) : null,
  };

  // If no D&B data, redistribute its 20% equally across the other five dimensions
  let weights;
  if (dnbData === null) {
    const bonus = BASE_WEIGHTS.dnb / 5;
    weights = {
      payment:  BASE_WEIGHTS.payment   + bonus,
      financial: BASE_WEIGHTS.financial + bonus,
      exposure: BASE_WEIGHTS.exposure  + bonus,
      tenure:   BASE_WEIGHTS.tenure    + bonus,
      external: BASE_WEIGHTS.external  + bonus,
      dnb:      0,
    };
  } else {
    weights = { ...BASE_WEIGHTS };
  }

  let finalScore = 0;
  for (const key of Object.keys(weights)) {
    if (weights[key] > 0 && dimensions[key] !== null) {
      finalScore += dimensions[key] * weights[key];
    }
  }

  finalScore = Math.round(clamp(finalScore) * 100) / 100;
  const rating = getRating(finalScore);

  // ─── Hard flags ───────────────────────────────────────────────────────────
  const flags = [];
  const {
    outstanding    = 0,
    credit_limit   = Infinity,
    dso            = 0,
    bucket_90plus  = 0,
  } = aging;
  const { ebitda_pct = 0, tenure_years = 0 } = customer;

  if (bucket_90plus > 0)                                      flags.push('SEVERE_OVERDUE');
  if (outstanding > credit_limit)                             flags.push('OVER_LIMIT');
  if (dso > 120)                                              flags.push('CHRONIC_LATE');
  if (outstanding > credit_limit && rating === 'D')           flags.push('IMMEDIATE_HOLD');
  if (ebitda_pct < 0)                                         flags.push('FINANCIAL_STRESS');
  if (tenure_years < 2 && (rating === 'C' || rating === 'D')) flags.push('NEW_CUSTOMER_RISK');

  return { finalScore, rating, dimensions, flags };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

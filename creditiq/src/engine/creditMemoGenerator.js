const MODEL = 'claude-opus-4-7';

const SYSTEM_PROMPT = `You are a senior credit risk analyst at a manufacturing company. Generate a structured credit memo based on internal scoring data and D&B bureau information. Be concise, specific, and actionable. Always recommend a specific credit limit in INR Lacs (e.g., 450 means ₹450 Lacs = ₹4.5 Crore).`;

function buildUserPrompt(customer, aging, scores, dnbData) {
  const bucketSum = (aging.bucket_30 || 0) + (aging.bucket_60 || 0) + (aging.bucket_90 || 0)
    + (aging.bucket_90plus || 0) + (aging.bucket_120plus || 0);
  const current = Math.max(0, (aging.outstanding || 0) - bucketSum);
  const util    = aging.credit_limit > 0
    ? ((aging.outstanding / aging.credit_limit) * 100).toFixed(1)
    : 'N/A';
  const fmtL = (n) => `₹${(n / 100_000).toFixed(1)}L`;

  const dnbSection = dnbData
    ? `D&B BUREAU:
PAYDEX: ${dnbData.paydex?.score} (Industry Median: ${dnbData.paydex?.industryMedian}) — ${dnbData.paydex?.paymentBehavior}
Financial Stress Score: ${dnbData.financialStressScore?.score} | ${dnbData.financialStressScore?.riskLevel} | ${dnbData.financialStressScore?.nationalPercentile}th percentile
Delinquency Score: ${dnbData.delinquencyScore?.score} | ${dnbData.delinquencyScore?.probabilityBand} | ${dnbData.delinquencyScore?.nationalPercentile}th percentile
Failure Score: ${dnbData.failureScore?.score} | ${dnbData.failureScore?.riskLevel} | ${dnbData.failureScore?.nationalPercentile}th percentile
Days Beyond Terms (DBT): ${dnbData.dbt?.value}d (Industry Median: ${dnbData.dbt?.industryMedian}d)
D&B Rating: ${dnbData.dnbRating?.raw} — ${dnbData.dnbRating?.description}
Tradelines: ${dnbData.tradelines?.totalExperiences} total | ${dnbData.tradelines?.satisfactoryCount} satisfactory | ${dnbData.tradelines?.slowCount} slow | ${dnbData.tradelines?.negativeCount} negative
Alerts: ${dnbData.alerts?.length ? dnbData.alerts.join('; ') : 'None'}`
    : 'D&B BUREAU: Data not available';

  return `Generate a credit memo for the following customer.

CUSTOMER PROFILE:
Name: ${customer.company_name} (ID: ${customer.customer_id})
Industry: ${customer.industry} | City Tier: ${customer.city_tier} | Tenure: ${customer.tenure_years} years

FINANCIALS:
Revenue: ₹${customer.revenue_cr} Cr | EBITDA Margin: ${customer.ebitda_pct}% | Debt/Equity Ratio: ${customer.debt_equity}

RECEIVABLES & AGING:
Outstanding: ${fmtL(aging.outstanding)} | Credit Limit: ${fmtL(aging.credit_limit)} | Utilization: ${util}%
DSO: ${aging.dso} days | Overdue %: ${aging.overdue_pct}%
Aging Buckets — Current: ${fmtL(current)} | 1–30d: ${fmtL(aging.bucket_30 || 0)} | 31–60d: ${fmtL(aging.bucket_60 || 0)} | 61–90d: ${fmtL(aging.bucket_90 || 0)} | 90d+: ${fmtL((aging.bucket_90plus || 0) + (aging.bucket_120plus || 0))}

INTERNAL CREDIT SCORE:
Overall: ${scores.finalScore?.toFixed(1)}/100 (Rating: ${scores.rating})
Dimensions:
  Payment Behavior (25%): ${scores.dimensions?.payment?.toFixed(1)}
  Financial Health (20%):  ${scores.dimensions?.financial?.toFixed(1)}
  Credit Exposure (15%):   ${scores.dimensions?.exposure?.toFixed(1)}
  Relationship Tenure (10%): ${scores.dimensions?.tenure?.toFixed(1)}
  External Risk (10%):     ${scores.dimensions?.external?.toFixed(1)}
  D&B Bureau (20%):        ${scores.dimensions?.dnb != null ? scores.dimensions.dnb.toFixed(1) : 'N/A'}
Active Flags: ${scores.flags?.length ? scores.flags.join(', ') : 'None'}

${dnbSection}

Respond ONLY with valid JSON (no markdown fences, no explanation):
{
  "riskSummary": "<2–3 sentence overall risk assessment>",
  "keyConcerns": ["<concern 1>", "<concern 2>", "<concern 3>"],
  "creditTeamActions": ["<action 1>", "<action 2>", "<action 3>"],
  "collectionsTeamActions": ["<action 1>", "<action 2>"],
  "recommendedCreditLimit": <integer in INR Lacs, e.g. 450>,
  "limitRationale": "<1–2 sentences explaining why this limit was chosen>",
  "reviewDate": "<recommended next review date as YYYY-MM-DD, typically 3–12 months from today>"
}`;
}

function parseJsonResponse(text) {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object found in response');
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function FALLBACK_STRUCTURE(message) {
  return {
    error: true,
    riskSummary: message,
    keyConcerns: [],
    creditTeamActions: [],
    collectionsTeamActions: [],
    recommendedCreditLimit: null,
    limitRationale: null,
    reviewDate: null,
  };
}

export async function generateCreditMemo(customer, aging, scores, dnbData) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

  if (!apiKey) {
    return FALLBACK_STRUCTURE('API key not configured. Set VITE_ANTHROPIC_API_KEY in .env.local.');
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type':                              'application/json',
        'x-api-key':                                 apiKey,
        'anthropic-version':                         '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: 1024,
        thinking:   { type: 'adaptive' },
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [
          {
            role:    'user',
            content: buildUserPrompt(customer, aging, scores, dnbData),
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message ?? `API error ${res.status}`);
    }

    const data   = await res.json();
    const text   = data.content?.find((b) => b.type === 'text')?.text ?? '';
    const parsed = parseJsonResponse(text);

    if (!parsed) {
      return FALLBACK_STRUCTURE('Could not parse response. Raw: ' + text.slice(0, 200));
    }

    return { error: false, ...parsed };
  } catch (e) {
    return FALLBACK_STRUCTURE(e.message ?? 'Unknown error generating credit memo.');
  }
}

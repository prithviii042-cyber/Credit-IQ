const MODEL = 'claude-haiku-4-5';

const SYSTEM_PROMPT = `You are a financial news intelligence system for a credit risk platform.
Generate a realistic news sentiment assessment based on a company's financial profile.
The signals you generate MUST be consistent with the financial health data provided:
- Distressed companies (high DSO, negative EBITDA, high debt, overdue payments) → concerning signals
- Healthy companies (low DSO, positive EBITDA, low debt) → stable/positive signals
Always respond with valid JSON only. No markdown. No explanations.`;

function buildPrompt(row) {
  const {
    company_name, industry, city_tier,
    revenue_cr, ebitda_pct, debt_equity,
    dso = 0, overdue_pct = 0,
    dnbData,
  } = row;

  // Derive a simple risk tier from raw financials (flags not available yet at this pipeline stage)
  const riskTier =
    (overdue_pct > 50 || dso > 120 || ebitda_pct < 0) ? 'CRITICAL' :
    (overdue_pct > 30 || dso > 90  || debt_equity > 3) ? 'HIGH' :
    (overdue_pct > 15 || dso > 60  || debt_equity > 2) ? 'MODERATE' : 'LOW';

  const dnbLine = dnbData
    ? `D&B: PAYDEX ${dnbData.paydex?.score} | Fin. Stress: ${dnbData.financialStressScore?.riskLevel} | DBT: ${dnbData.dbt?.value}d`
    : 'D&B: Not available';

  return `Generate a news sentiment assessment for this company.

Company: ${company_name}
Industry: ${industry} | City Tier: ${city_tier}
Revenue: ₹${revenue_cr} Cr | EBITDA Margin: ${ebitda_pct}% | Debt/Equity: ${debt_equity}
DSO: ${dso}d | Overdue: ${overdue_pct}% | Risk Tier: ${riskTier}
${dnbLine}

Scoring guide (follow strictly based on Risk Tier):
- CRITICAL → verdict "Critical" or "At Risk",   score 5–35,  3 negative/severe signals
- HIGH     → verdict "At Risk" or "Cautionary",  score 20–50, 2-3 negative signals
- MODERATE → verdict "Cautionary" or "Watchlist",score 45–65, mixed signals
- LOW      → verdict "Watchlist" or "Stable",    score 65–90, mostly neutral/positive signals

Respond ONLY with valid JSON:
{
  "score": <integer 0–100>,
  "verdict": "<Stable|Watchlist|Cautionary|At Risk|Critical>",
  "signals": [
    {
      "type": "<Management|Regulatory|Product|Financial|Legal|Operational|Market>",
      "headline": "<realistic news headline, max 90 characters>",
      "impact": "<Positive|Neutral|Negative|Severe>",
      "date": "<e.g. '2 weeks ago', '3 months ago'>"
    }
  ],
  "summary": "<2–3 sentence credit analyst commentary on this company's public news environment>"
}`;
}

const FALLBACK = (msg) => ({
  error: true,
  score: 50,
  verdict: 'Watchlist',
  signals: [],
  summary: msg ?? 'Sentiment analysis unavailable.',
});

export async function analyzeSentiment(row) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) return FALLBACK('No API key configured.');

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
        max_tokens: 800,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: buildPrompt(row) }],
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message ?? `API ${res.status}`);
    }

    const data  = await res.json();
    const text  = data.content?.find((b) => b.type === 'text')?.text ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in response');

    const parsed = JSON.parse(match[0]);
    return { error: false, ...parsed };
  } catch (e) {
    return FALLBACK(e.message ?? 'Unknown error');
  }
}

const MODEL = 'claude-haiku-4-5';

const SYSTEM_PROMPT = `You are a credit risk intelligence analyst specialising in external news events.

Your job: identify real-world events that could IMPAIR a company's revenue or liquidity and therefore reduce its ability to meet payment obligations. You are NOT summarising financial ratios — those are already captured elsewhere. You are looking for NEWS EVENTS in these specific categories:

• Management Disturbance — CEO/CFO/founder exits, boardroom conflicts, key person departures, succession gaps, insider selling
• Product Recall — mandatory or voluntary recalls due to safety defects, quality failures, contamination
• Regulatory Action — fines, license suspensions, government investigations, compliance failures, import/export bans
• Product Failure — widespread defects, mass returns, quality rejections by anchor customers, production halts
• Customer Loss — departure of major clients, contract cancellations, public dissatisfaction campaigns, tender losses
• Investment Risk — failed acquisitions, large write-offs, impaired assets, aggressive debt-funded expansion
• Legal Exposure — class action suits, fraud allegations, IP disputes, criminal probes

For each signal, explain the CREDIT CONSEQUENCE: how does this event threaten revenue streams, freeze liquidity, or directly reduce payment capacity?

Score calibration — use the company's financial risk tier as a baseline, then adjust for severity of events:
- Severe external events on an already-stressed company → push score down further
- Positive stability signals on a healthy company → reinforce high score
- A single severe event (product recall, CEO fraud) can independently drop a healthy company to Cautionary

Always respond with valid JSON only. No markdown. No explanations.`;

function buildPrompt(row) {
  const {
    company_name, industry, city_tier,
    revenue_cr, ebitda_pct, debt_equity,
    dso = 0, overdue_pct = 0,
    dnbData,
  } = row;

  const riskTier =
    (overdue_pct > 50 || dso > 120 || ebitda_pct < 0) ? 'CRITICAL' :
    (overdue_pct > 30 || dso > 90  || debt_equity > 3) ? 'HIGH' :
    (overdue_pct > 15 || dso > 60  || debt_equity > 2) ? 'MODERATE' : 'LOW';

  const dnbLine = dnbData
    ? `D&B: PAYDEX ${dnbData.paydex?.score} | Stress: ${dnbData.financialStressScore?.riskLevel} | DBT: ${dnbData.dbt?.value}d`
    : 'D&B: Not available';

  return `Generate a credit risk news intelligence report for this company.

Company: ${company_name}
Sector: ${industry} | City Tier: ${city_tier}
Revenue: ₹${revenue_cr} Cr | EBITDA: ${ebitda_pct}% | D/E: ${debt_equity}
DSO: ${dso}d | Overdue: ${overdue_pct}% | Financial Risk Tier: ${riskTier}
${dnbLine}

Select 2–4 of the most credit-relevant signal types for this company given its sector and risk tier:
- Management Disturbance (leadership gaps → execution risk → revenue slippage)
- Product Recall (recall costs + lost sales → sudden liquidity drain)
- Regulatory Action (fines/shutdowns → direct cash outflow + revenue disruption)
- Product Failure (quality issues → customer attrition + returns → revenue erosion)
- Customer Loss (anchor client departure → revenue cliff → DSO deterioration)
- Investment Risk (bad M&A or write-offs → balance sheet stress → borrowing pressure)
- Legal Exposure (litigation → contingent liability → liquidity freeze)

Score guide:
- CRITICAL → verdict "Critical" or "At Risk",    score 5–35,  2–3 Severe signals
- HIGH     → verdict "At Risk" or "Cautionary",  score 20–50, 2 Negative signals
- MODERATE → verdict "Cautionary" or "Watchlist",score 45–65, mixed signals
- LOW      → verdict "Watchlist" or "Stable",    score 65–90, 1–2 Neutral/Positive signals

Rules for headlines:
- Name the company explicitly in every headline
- Be specific (name the product, regulator, client sector, or deal where relevant)
- Max 90 characters per headline

Respond ONLY with valid JSON:
{
  "score": <integer 0–100>,
  "verdict": "<Stable|Watchlist|Cautionary|At Risk|Critical>",
  "signals": [
    {
      "type": "<Management Disturbance|Product Recall|Regulatory Action|Product Failure|Customer Loss|Investment Risk|Legal Exposure>",
      "headline": "<specific news headline, max 90 chars>",
      "creditImpact": "<one sentence: exactly how this threatens revenue, liquidity, or payment capacity>",
      "impact": "<Positive|Neutral|Negative|Severe>",
      "date": "<e.g. '2 weeks ago', '3 months ago'>"
    }
  ],
  "summary": "<2–3 sentence credit analyst commentary focused on payment risk, not just financial health>"
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
        max_tokens: 1000,
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

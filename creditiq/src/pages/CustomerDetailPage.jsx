import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { useApp } from '../context/AppContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const RATING_COLORS = { A: '#16a34a', B: '#ca8a04', C: '#ea580c', D: '#dc2626' };

const RISK_BADGE = {
  'Low':       'bg-green-100 text-green-700',
  'Moderate':  'bg-yellow-100 text-yellow-700',
  'High':      'bg-orange-100 text-orange-700',
  'Very High': 'bg-red-100 text-red-700',
};

const DIMENSION_META = [
  { key: 'payment',   label: 'Payment Behavior',    weight: '25%' },
  { key: 'financial', label: 'Financial Health',     weight: '20%' },
  { key: 'exposure',  label: 'Credit Exposure',      weight: '15%' },
  { key: 'tenure',    label: 'Relationship Tenure',  weight: '10%' },
  { key: 'external',  label: 'External Risk',        weight: '10%' },
  { key: 'dnb',       label: 'D&B Bureau',           weight: '20%' },
];

const AGING_SEGMENTS = [
  { key: 'current',   name: 'Current',   fill: '#86efac' },
  { key: 'b30',       name: '1–30d',     fill: '#fde047' },
  { key: 'b60',       name: '31–60d',    fill: '#fdba74' },
  { key: 'b90',       name: '61–90d',    fill: '#fb923c' },
  { key: 'b90plus',   name: '91–120d',   fill: '#f87171' },
  { key: 'b120plus',  name: '120d+',     fill: '#dc2626' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtLac   = (n) => `₹${(n / 100_000).toFixed(1)}L`;
const fmtCr    = (n) => (n / 100_000) >= 10_000
  ? `₹${(n / 10_000_000).toFixed(1)} Cr`
  : fmtLac(n);

function buildPrompt(c) {
  const bucketSum = (c.bucket_30 || 0) + (c.bucket_60 || 0) + (c.bucket_90 || 0)
    + (c.bucket_90plus || 0) + (c.bucket_120plus || 0);
  const current = Math.max(0, (c.outstanding || 0) - bucketSum);
  const util    = c.credit_limit > 0
    ? ((c.outstanding / c.credit_limit) * 100).toFixed(1)
    : 'N/A';
  const d = c.dnbData;

  return `You are a senior credit analyst. Write a concise credit memo for this customer.

CUSTOMER: ${c.company_name} (${c.customer_id})
Industry: ${c.industry} | City Tier: ${c.city_tier} | Tenure: ${c.tenure_years} years

FINANCIALS:
Revenue: ₹${c.revenue_cr} Cr | EBITDA: ${c.ebitda_pct}% | Debt/Equity: ${c.debt_equity}

RECEIVABLES:
Outstanding: ${fmtLac(c.outstanding)} | Limit: ${fmtLac(c.credit_limit)} | Utilization: ${util}%
DSO: ${c.dso}d | Overdue: ${c.overdue_pct}%
Aging: Current ${fmtLac(current)} | 30d ${fmtLac(c.bucket_30 || 0)} | 60d ${fmtLac(c.bucket_60 || 0)} | 90d ${fmtLac(c.bucket_90 || 0)} | 90d+ ${fmtLac((c.bucket_90plus || 0) + (c.bucket_120plus || 0))}

CREDIT SCORE: ${c.finalScore}/100 (Rating: ${c.rating})
Dimensions — Payment: ${c.dimensions?.payment?.toFixed(1)}/100 | Financial: ${c.dimensions?.financial?.toFixed(1)}/100 | Exposure: ${c.dimensions?.exposure?.toFixed(1)}/100 | Tenure: ${c.dimensions?.tenure?.toFixed(1)}/100 | External: ${c.dimensions?.external?.toFixed(1)}/100 | D&B: ${c.dimensions?.dnb != null ? c.dimensions.dnb.toFixed(1) : 'N/A'}/100
Active Flags: ${c.flags?.length ? c.flags.join(', ') : 'None'}

${d ? `D&B BUREAU:
PAYDEX: ${d.paydex?.score} (Median: ${d.paydex?.industryMedian}) | ${d.paydex?.paymentBehavior}
Financial Stress: ${d.financialStressScore?.score} | ${d.financialStressScore?.riskLevel} | ${d.financialStressScore?.nationalPercentile}th pctile
Delinquency: ${d.delinquencyScore?.score} | ${d.delinquencyScore?.probabilityBand} | ${d.delinquencyScore?.nationalPercentile}th pctile
Failure: ${d.failureScore?.score} | ${d.failureScore?.riskLevel} | ${d.failureScore?.nationalPercentile}th pctile
DBT: ${d.dbt?.value}d (Industry: ${d.dbt?.industryMedian}d)
D&B Rating: ${d.dnbRating?.raw} (${d.dnbRating?.description})
Tradelines: ${d.tradelines?.totalExperiences} total | ${d.tradelines?.satisfactoryCount} satisfactory | ${d.tradelines?.slowCount} slow | ${d.tradelines?.negativeCount} negative
Alerts: ${d.alerts?.length ? d.alerts.join('; ') : 'None'}` : 'D&B data: Not available'}

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "riskSummary": "<2-3 sentences overall risk assessment>",
  "keyConcerns": ["<concern 1>", "<concern 2>", "<concern 3>"],
  "creditTeamActions": ["<action 1>", "<action 2>", "<action 3>"],
  "collectionsTeamActions": ["<action 1>", "<action 2>"],
  "recommendedCreditLimit": <integer in rupees>
}`;
}

function parseMemo(text) {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

// ─── ScoreGauge ───────────────────────────────────────────────────────────────

function ScoreGauge({ score, rating }) {
  const r  = 82;
  const cx = 110;
  const cy = 105;
  const sw = 15;

  const color     = RATING_COLORS[rating] ?? '#6b7280';
  const trackPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy}`;

  let valuePath = '';
  if (score >= 100) {
    valuePath = trackPath;
  } else if (score > 0) {
    // angle in standard math coords: 180° at left, 0° at right
    const angle = (180 - score * 1.8) * (Math.PI / 180);
    const ex    = cx + r * Math.cos(angle);
    const ey    = cy - r * Math.sin(angle);
    valuePath   = `M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
  }

  return (
    <svg viewBox="0 0 220 132" className="w-full max-w-[260px]">
      {/* Track */}
      <path d={trackPath} fill="none" stroke="#f3f4f6" strokeWidth={sw} strokeLinecap="round" />
      {/* Value */}
      {score > 0 && (
        <path d={valuePath} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      )}
      {/* Rating letter */}
      <text
        x={cx} y={cy - 4}
        textAnchor="middle" dominantBaseline="auto"
        fontSize="52" fontWeight="700" fill={color}
        fontFamily="Inter, ui-sans-serif, sans-serif"
      >
        {rating}
      </text>
      {/* Numeric score */}
      <text
        x={cx} y={cy + 22}
        textAnchor="middle"
        fontSize="17" fontWeight="600" fill="#374151"
        fontFamily="Inter, ui-sans-serif, sans-serif"
      >
        {score.toFixed(1)} / 100
      </text>
      {/* Label */}
      <text
        x={cx} y={cy + 40}
        textAnchor="middle"
        fontSize="11" fill="#9ca3af"
        fontFamily="Inter, ui-sans-serif, sans-serif"
      >
        Credit Score
      </text>
    </svg>
  );
}

// ─── DimensionScoreCard ───────────────────────────────────────────────────────

function DimensionScoreCard({ dimensions }) {
  const available = DIMENSION_META.filter((d) => dimensions[d.key] != null);
  const minScore  = Math.min(...available.map((d) => dimensions[d.key]));

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 h-full">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Score Dimensions</h3>
      <div className="flex flex-col gap-3.5">
        {DIMENSION_META.map(({ key, label, weight }) => {
          const score = dimensions[key];
          if (score == null) return null;

          const isLowest = score === minScore;
          const barColor = isLowest ? 'bg-red-500'
            : score >= 70  ? 'bg-green-500'
            : score >= 45  ? 'bg-yellow-400'
            : 'bg-orange-400';

          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-medium ${isLowest ? 'text-red-600' : 'text-gray-700'}`}>
                    {label}
                  </span>
                  {isLowest && (
                    <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium leading-none">
                      lowest
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{weight}</span>
                  <span className={`text-xs font-semibold tabular-nums w-8 text-right ${isLowest ? 'text-red-600' : 'text-gray-700'}`}>
                    {score.toFixed(0)}
                  </span>
                </div>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all ${barColor}`}
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── DnBBureauCard ────────────────────────────────────────────────────────────

function RiskBadge({ level }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${RISK_BADGE[level] ?? 'bg-gray-100 text-gray-600'}`}>
      {level}
    </span>
  );
}

function DnBBureauCard({ dnbData }) {
  if (!dnbData) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 flex items-center justify-center">
        <p className="text-sm text-gray-400">No D&B data available for this customer.</p>
      </div>
    );
  }

  const { paydex, financialStressScore: fss, delinquencyScore: del,
          failureScore: fail, dbt, dnbRating, tradelines, alerts, reportDate } = dnbData;

  const paydexDelta = paydex.score - paydex.industryMedian;
  const dbtDelta    = dbt.value - dbt.industryMedian;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-gray-900">D&B Bureau Report</h3>

      {/* PAYDEX */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">PAYDEX</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">{paydex.score}</span>
            <span className={`text-sm font-semibold ${paydexDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {paydexDelta >= 0 ? '▲' : '▼'} {Math.abs(paydexDelta)} vs median
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 italic">{paydex.paymentBehavior}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Industry median</p>
          <p className="text-lg font-semibold text-gray-600">{paydex.industryMedian}</p>
        </div>
      </div>

      {/* Risk scores */}
      <div className="grid grid-cols-1 gap-2">
        {[
          { label: 'Financial Stress', score: fss.score, level: fss.riskLevel, pctile: fss.nationalPercentile },
          { label: 'Delinquency',      score: del.score, level: del.probabilityBand, pctile: del.nationalPercentile },
          { label: 'Failure',          score: fail.score, level: fail.riskLevel, pctile: fail.nationalPercentile },
        ].map(({ label, score, level, pctile }) => (
          <div key={label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
            <span className="text-xs text-gray-600">{label}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs tabular-nums text-gray-500">{score}</span>
              <RiskBadge level={level} />
              <span className="text-xs text-gray-400 w-14 text-right">{pctile}th %ile</span>
            </div>
          </div>
        ))}
      </div>

      {/* DBT */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Days Beyond Terms</p>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-gray-900">{dbt.value}d</span>
            <span className={`text-xs font-medium ${dbtDelta <= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {dbtDelta <= 0 ? '▼' : '▲'} {Math.abs(dbtDelta)}d vs industry ({dbt.industryMedian}d)
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">D&B Rating</p>
          <p className="text-lg font-bold text-gray-900">{dnbRating.raw}</p>
          <p className="text-xs text-gray-500">{dnbRating.description}</p>
        </div>
      </div>

      {/* Tradelines */}
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Tradelines</p>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Total',    value: tradelines.totalExperiences, color: 'text-gray-900' },
            { label: 'Satisf.',  value: tradelines.satisfactoryCount, color: 'text-green-600' },
            { label: 'Slow',     value: tradelines.slowCount,         color: 'text-yellow-600' },
            { label: 'Negative', value: tradelines.negativeCount,     color: 'text-red-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center bg-gray-50 rounded-lg py-2">
              <p className={`text-lg font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-400">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Alerts */}
      {alerts?.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Alerts</p>
          <ul className="flex flex-col gap-1.5">
            {alerts.map((alert, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-orange-700 bg-orange-50 rounded-lg px-3 py-2">
                <span className="mt-0.5 shrink-0">⚠️</span>
                {alert}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer */}
      <p className="text-xs text-gray-400 border-t border-gray-100 pt-3 mt-auto">
        D&B Report Date: {reportDate}
      </p>
    </div>
  );
}

// ─── AgingBarChart ────────────────────────────────────────────────────────────

function AgingBarChart({ customer }) {
  const bucketSum = (customer.bucket_30 || 0) + (customer.bucket_60 || 0)
    + (customer.bucket_90 || 0) + (customer.bucket_90plus || 0)
    + (customer.bucket_120plus || 0);
  const current = Math.max(0, (customer.outstanding || 0) - bucketSum);

  const data = [{
    name: 'Aging',
    current,
    b30:   customer.bucket_30      || 0,
    b60:   customer.bucket_60      || 0,
    b90:   customer.bucket_90      || 0,
    b90plus:  customer.bucket_90plus  || 0,
    b120plus: customer.bucket_120plus || 0,
  }];

  const tooltipFormatter = (v) => [fmtLac(v)];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Aging Distribution</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 10, bottom: 10 }}
          barSize={80}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
          <YAxis
            tickFormatter={(v) => `₹${(v / 100_000).toFixed(0)}L`}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            width={52}
          />
          <Tooltip
            formatter={tooltipFormatter}
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
          />
          <Legend
            iconType="square"
            iconSize={10}
            wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
          />
          <ReferenceLine
            y={customer.credit_limit}
            stroke="#1D4ED8"
            strokeDasharray="6 3"
            strokeWidth={2}
            label={{
              value: `Limit ${fmtLac(customer.credit_limit)}`,
              position: 'insideTopRight',
              fill: '#1D4ED8',
              fontSize: 11,
              fontWeight: 600,
            }}
          />
          {AGING_SEGMENTS.map(({ key, name, fill }) => (
            <Bar key={key} dataKey={key} stackId="a" fill={fill} name={name} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── AiMemoPanel ─────────────────────────────────────────────────────────────

function AiMemoPanel({ customer }) {
  const [memo,    setMemo]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

  const generate = async () => {
    setLoading(true);
    setError(null);
    setMemo(null);

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type':                         'application/json',
          'x-api-key':                            apiKey,
          'anthropic-version':                    '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: 'You are a senior credit analyst at a commercial bank. You write clear, concise credit memos based on quantitative data. Always respond with valid JSON only — no markdown fences, no preamble.',
          messages: [{ role: 'user', content: buildPrompt(customer) }],
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `API error ${res.status}`);
      }

      const data   = await res.json();
      const text   = data.content?.[0]?.text ?? '';
      const parsed = parseMemo(text);

      if (!parsed) throw new Error('Could not parse response. Raw: ' + text.slice(0, 120));
      setMemo(parsed);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const copyMemo = () => {
    if (!memo) return;
    const text = [
      `CREDIT MEMO — ${customer.company_name}`,
      '',
      'RISK SUMMARY',
      memo.riskSummary,
      '',
      'KEY CONCERNS',
      ...memo.keyConcerns.map((c) => `• ${c}`),
      '',
      'CREDIT TEAM ACTIONS',
      ...memo.creditTeamActions.map((a) => `• ${a}`),
      '',
      'COLLECTIONS TEAM ACTIONS',
      ...memo.collectionsTeamActions.map((a) => `• ${a}`),
      '',
      `RECOMMENDED CREDIT LIMIT: ${fmtCr(memo.recommendedCreditLimit)}`,
    ].join('\n');
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">AI Credit Memo</h3>
        {memo && (
          <button
            onClick={copyMemo}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-2.5 py-1 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
            </svg>
            Copy Memo
          </button>
        )}
      </div>

      {/* Generate button */}
      {!loading && !memo && (
        <>
          {!apiKey ? (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-700">
              Set <code className="font-mono bg-amber-100 px-1 rounded">VITE_ANTHROPIC_API_KEY</code> in <code className="font-mono bg-amber-100 px-1 rounded">.env.local</code> to enable AI memos.
            </div>
          ) : (
            <button
              onClick={generate}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white rounded-lg transition-colors"
              style={{ backgroundColor: '#1D4ED8' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1e40af'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#1D4ED8'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
              </svg>
              Generate Credit Memo
            </button>
          )}
        </>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Analyzing credit profile…</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700">
          {error}
          <button onClick={generate} className="block mt-2 text-red-600 underline underline-offset-2">
            Retry
          </button>
        </div>
      )}

      {/* Memo output */}
      {memo && (
        <div className="flex flex-col gap-4 text-sm">
          {/* Risk Summary */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Risk Summary</p>
            <p className="text-gray-700 leading-relaxed">{memo.riskSummary}</p>
          </div>

          {/* Key Concerns */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Key Concerns</p>
            <ul className="flex flex-col gap-1">
              {memo.keyConcerns?.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-gray-700">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                  {c}
                </li>
              ))}
            </ul>
          </div>

          {/* Recommended Actions */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Recommended Actions</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-700 mb-2">Credit Team</p>
                <ul className="flex flex-col gap-1.5">
                  {memo.creditTeamActions?.map((a, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-blue-800">
                      <span className="mt-1 w-1 h-1 rounded-full bg-blue-400 shrink-0" />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-orange-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-orange-700 mb-2">Collections Team</p>
                <ul className="flex flex-col gap-1.5">
                  {memo.collectionsTeamActions?.map((a, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-orange-800">
                      <span className="mt-1 w-1 h-1 rounded-full bg-orange-400 shrink-0" />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Recommended Credit Limit callout */}
          {memo.recommendedCreditLimit != null && (
            <div className="rounded-xl border-2 p-4 text-center mt-1" style={{ borderColor: '#1D4ED8', backgroundColor: '#eff6ff' }}>
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
                Recommended Credit Limit
              </p>
              <p className="text-3xl font-bold" style={{ color: '#1D4ED8' }}>
                {fmtCr(memo.recommendedCreditLimit)}
              </p>
              {memo.recommendedCreditLimit !== customer.credit_limit && (
                <p className="text-xs text-blue-500 mt-1">
                  Current: {fmtLac(customer.credit_limit)}
                  {' '}
                  ({memo.recommendedCreditLimit > customer.credit_limit ? '▲' : '▼'}
                  {' '}
                  {fmtCr(Math.abs(memo.recommendedCreditLimit - customer.credit_limit))})
                </p>
              )}
            </div>
          )}

          {/* Re-generate */}
          <button
            onClick={generate}
            className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 self-start transition-colors"
          >
            Regenerate
          </button>
        </div>
      )}
    </div>
  );
}

// ─── CustomerDetailPage ───────────────────────────────────────────────────────

export default function CustomerDetailPage() {
  const { portfolio } = useApp();
  const { id }        = useParams();
  const navigate      = useNavigate();

  if (!portfolio) {
    return (
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-4">No data loaded.</p>
          <button
            onClick={() => navigate('/upload')}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg"
            style={{ backgroundColor: '#1D4ED8' }}
          >
            Upload Data
          </button>
        </div>
      </main>
    );
  }

  const customer = portfolio.find((c) => c.customer_id === id);

  if (!customer) {
    return (
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-4">Customer "{id}" not found.</p>
          <button onClick={() => navigate('/portfolio')} className="text-sm text-blue-700 underline">
            Back to Portfolio
          </button>
        </div>
      </main>
    );
  }

  const { rating, finalScore, dimensions, flags, dnbData } = customer;
  const ratingColor = RATING_COLORS[rating] ?? '#6b7280';

  return (
    <main className="flex-1 p-8 min-w-0">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">

        {/* Back button */}
        <button
          onClick={() => navigate('/portfolio')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors self-start"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to Portfolio
        </button>

        {/* ── SECTION 1: Header ─────────────────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            {/* Left: customer info */}
            <div className="flex flex-col gap-3 min-w-0">
              <div>
                <h1 className="text-xl font-semibold text-gray-900 leading-tight">{customer.company_name}</h1>
                <p className="text-sm text-gray-400 mt-0.5">{customer.customer_id}</p>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {[
                  { label: 'Industry',    value: customer.industry },
                  { label: 'D&B Rating',  value: dnbData?.dnbRating?.raw
                      ? `${dnbData.dnbRating.raw} — ${dnbData.dnbRating.description}`
                      : '—' },
                  { label: 'Tenure',      value: `${customer.tenure_years} years` },
                  { label: 'D&B Report',  value: dnbData?.reportDate ?? '—' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className="text-sm font-medium text-gray-800">{value}</p>
                  </div>
                ))}
              </div>

              {/* Flags row */}
              {flags?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {flags.map((f) => (
                    <span
                      key={f}
                      className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border"
                      style={
                        ['IMMEDIATE_HOLD', 'SEVERE_OVERDUE', 'OVER_LIMIT'].includes(f)
                          ? { backgroundColor: '#fef2f2', color: '#dc2626', borderColor: '#fecaca' }
                          : { backgroundColor: '#fffbeb', color: '#d97706', borderColor: '#fde68a' }
                      }
                    >
                      {['IMMEDIATE_HOLD', 'SEVERE_OVERDUE', 'OVER_LIMIT'].includes(f) ? '🔴' : '🟡'}
                      {f.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Right: gauge */}
            <div className="flex flex-col items-center shrink-0">
              <ScoreGauge score={finalScore} rating={rating} />
              <p className="text-xs font-medium mt-1" style={{ color: ratingColor }}>
                {rating === 'A' ? 'Low Risk'
                  : rating === 'B' ? 'Moderate Risk'
                  : rating === 'C' ? 'High Risk'
                  : 'Very High Risk'}
              </p>
            </div>
          </div>
        </div>

        {/* ── SECTION 2: Scorecard + D&B ───────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DimensionScoreCard dimensions={dimensions} />
          <DnBBureauCard dnbData={dnbData} />
        </div>

        {/* ── SECTION 3: Aging Chart + AI Memo ─────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AgingBarChart customer={customer} />
          <AiMemoPanel customer={customer} />
        </div>

      </div>
    </main>
  );
}

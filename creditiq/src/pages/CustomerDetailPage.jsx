import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { generateCreditMemo } from '../engine/creditMemoGenerator';
import { fmtInr } from '../utils/format';
import {
  normalizePaydex, normalizeFSS, normalizeDelinquency,
  normalizeFailure, normalizeDBT, normalizeDnBRating,
} from '../engine/scoringEngine';

// ─── Constants ────────────────────────────────────────────────────────────────

const RATING_COLORS = { A: '#16a34a', B: '#ca8a04', C: '#ea580c', D: '#dc2626' };

const RISK_BADGE = {
  'Low':       'bg-green-100 text-green-700',
  'Moderate':  'bg-yellow-100 text-yellow-700',
  'High':      'bg-orange-100 text-orange-700',
  'Very High': 'bg-red-100 text-red-700',
};

const DIMENSION_META = [
  { key: 'payment',   label: 'Payment Behavior',    weight: '23%' },
  { key: 'financial', label: 'Financial Health',     weight: '18%' },
  { key: 'exposure',  label: 'Credit Exposure',      weight: '13%' },
  { key: 'tenure',    label: 'Relationship Tenure',  weight: '9%'  },
  { key: 'external',  label: 'External Risk',        weight: '9%'  },
  { key: 'dnb',       label: 'D&B Bureau',           weight: '18%' },
  { key: 'sentiment', label: 'News Sentiment',       weight: '10%' },
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

const fmtLac = (n) => `₹${(n / 1_00_000).toFixed(1)}L`;

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
    <div style={{ width: 220, height: 132, flexShrink: 0 }}>
      <svg viewBox="0 0 220 132" width="220" height="132">
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
    </div>
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

function ScoreBar({ norm, color }) {
  const barColor = norm >= 70 ? '#16a34a' : norm >= 45 ? '#ca8a04' : norm >= 25 ? '#ea580c' : '#dc2626';
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-1.5 rounded-full" style={{ width: `${norm}%`, backgroundColor: color ?? barColor }} />
      </div>
      <span className="text-xs font-semibold tabular-nums w-6 text-right" style={{ color: color ?? barColor }}>
        {Math.round(norm)}
      </span>
    </div>
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

  const paydexNorm      = normalizePaydex(paydex.score);
  const fssNorm         = normalizeFSS(fss.score);
  const delNorm         = normalizeDelinquency(del.score);
  const failNorm        = normalizeFailure(fail.score);
  const dbtNorm         = normalizeDBT(dbt.value);
  const ratingNorm      = normalizeDnBRating(dnbRating.raw);
  const paydexDelta     = paydex.score - paydex.industryMedian;
  const dbtDelta        = dbt.value - dbt.industryMedian;

  const breakdown = [
    {
      label: 'PAYDEX',
      weight: '30%',
      raw: `${paydex.score} / 100`,
      norm: paydexNorm,
      sub: paydex.paymentBehavior,
      delta: paydexDelta >= 0 ? `▲ ${paydexDelta} vs industry median` : `▼ ${Math.abs(paydexDelta)} vs industry median`,
      deltaGood: paydexDelta >= 0,
    },
    {
      label: 'Financial Stress',
      weight: '20%',
      raw: `${fss.score}`,
      norm: fssNorm,
      sub: fss.riskLevel,
      delta: `${fss.nationalPercentile}th percentile`,
      deltaGood: fssNorm >= 50,
    },
    {
      label: 'Delinquency Risk',
      weight: '20%',
      raw: `${del.score}`,
      norm: delNorm,
      sub: del.probabilityBand,
      delta: `${del.nationalPercentile}th percentile`,
      deltaGood: delNorm >= 50,
    },
    {
      label: 'Failure Risk',
      weight: '15%',
      raw: `${fail.score}`,
      norm: failNorm,
      sub: fail.riskLevel,
      delta: `${fail.nationalPercentile}th percentile`,
      deltaGood: failNorm >= 50,
    },
    {
      label: 'Days Beyond Terms',
      weight: '10%',
      raw: `${dbt.value}d`,
      norm: dbtNorm,
      sub: dbtDelta <= 0
        ? `▼ ${Math.abs(dbtDelta)}d better than industry (${dbt.industryMedian}d)`
        : `▲ ${dbtDelta}d worse than industry (${dbt.industryMedian}d)`,
      deltaGood: dbtDelta <= 0,
    },
    {
      label: 'D&B Rating',
      weight: '5%',
      raw: dnbRating.raw,
      norm: ratingNorm,
      sub: dnbRating.description,
      deltaGood: ratingNorm >= 50,
    },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-5">
      <h3 className="text-sm font-semibold text-gray-900">D&B Bureau Report</h3>

      {/* Score breakdown */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Score Breakdown</p>
        <div className="flex flex-col gap-3">
          {breakdown.map(({ label, weight, raw, norm, sub, delta, deltaGood }) => (
            <div key={label} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-700 flex-1">{label}</span>
                <span className="text-xs text-gray-400">{weight}</span>
                <span className="text-xs tabular-nums text-gray-500 font-mono">{raw}</span>
              </div>
              <ScoreBar norm={norm} />
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 italic truncate">{sub}</span>
                {delta && (
                  <span className={`text-xs ml-auto shrink-0 ${deltaGood ? 'text-green-600' : 'text-red-500'}`}>
                    {delta}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tradelines */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Tradelines</p>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Total',    value: tradelines.totalExperiences,  color: 'text-gray-900'   },
            { label: 'Satisf.',  value: tradelines.satisfactoryCount, color: 'text-green-600'  },
            { label: 'Slow',     value: tradelines.slowCount,         color: 'text-yellow-600' },
            { label: 'Negative', value: tradelines.negativeCount,     color: 'text-red-600'    },
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
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Alerts</p>
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

      <p className="text-xs text-gray-400 border-t border-gray-100 pt-3 mt-auto">
        D&B Report Date: {reportDate}
      </p>
    </div>
  );
}

// ─── NewsSentimentCard ────────────────────────────────────────────────────────

const VERDICT_STYLES = {
  'Stable':     'bg-green-100  text-green-700',
  'Watchlist':  'bg-yellow-100 text-yellow-700',
  'Cautionary': 'bg-orange-100 text-orange-700',
  'At Risk':    'bg-red-100    text-red-700',
  'Critical':   'bg-rose-100   text-rose-700',
};

const IMPACT_STYLES = {
  'Positive': 'bg-green-50  text-green-700  border-green-200',
  'Neutral':  'bg-gray-50   text-gray-600   border-gray-200',
  'Negative': 'bg-red-50    text-red-700    border-red-200',
  'Severe':   'bg-rose-50   text-rose-700   border-rose-200',
};

const SIGNAL_TYPE_COLORS = {
  Management:   'bg-purple-50 text-purple-700',
  Regulatory:   'bg-blue-50   text-blue-700',
  Product:      'bg-cyan-50   text-cyan-700',
  Financial:    'bg-amber-50  text-amber-700',
  Legal:        'bg-red-50    text-red-700',
  Operational:  'bg-orange-50 text-orange-700',
  Market:       'bg-teal-50   text-teal-700',
};

function NewsSentimentCard({ sentimentData }) {
  if (!sentimentData) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">News Sentiment</h3>
        <p className="text-sm text-gray-400">Sentiment data not available.</p>
      </div>
    );
  }

  if (sentimentData.error) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">News Sentiment</h3>
        <p className="text-sm text-gray-400">{sentimentData.summary ?? 'Sentiment analysis unavailable.'}</p>
      </div>
    );
  }

  const { score, verdict, signals = [], summary } = sentimentData;
  const verdictClass = VERDICT_STYLES[verdict] ?? 'bg-gray-100 text-gray-600';
  const scoreColor = score >= 65 ? '#16a34a' : score >= 45 ? '#ca8a04' : score >= 25 ? '#ea580c' : '#dc2626';

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">News Sentiment</h3>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${verdictClass}`}>{verdict}</span>
      </div>

      {/* Score bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-400">Sentiment Score</span>
          <span className="text-sm font-bold tabular-nums" style={{ color: scoreColor }}>{score}</span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-2 rounded-full transition-all"
            style={{ width: `${score}%`, backgroundColor: scoreColor }}
          />
        </div>
      </div>

      {/* Signals */}
      {signals.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Signals</p>
          <ul className="flex flex-col gap-2">
            {signals.map((sig, i) => (
              <li key={i} className="border border-gray-100 rounded-lg p-3 flex flex-col gap-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${SIGNAL_TYPE_COLORS[sig.type] ?? 'bg-gray-50 text-gray-600'}`}>
                    {sig.type}
                  </span>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${IMPACT_STYLES[sig.impact] ?? IMPACT_STYLES.Neutral}`}>
                    {sig.impact}
                  </span>
                  <span className="text-xs text-gray-400 ml-auto">{sig.date}</span>
                </div>
                <p className="text-xs text-gray-700 leading-snug">{sig.headline}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Analyst Commentary</p>
          <p className="text-xs text-gray-600 leading-relaxed">{summary}</p>
        </div>
      )}
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

  const tooltipFormatter = (v) => [fmtInr(v)];

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
            tickFormatter={(v) => fmtLac(v)}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            width={62}
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

// ─── PeerComparison ───────────────────────────────────────────────────────────

function PeerComparison({ customer, portfolio }) {
  const { dso, finalScore, dnbData } = customer;
  const myPaydex = dnbData?.paydex?.score ?? null;

  const n = portfolio.length;
  if (n === 0) return null;

  const avgDso   = portfolio.reduce((s, c) => s + (c.dso || 0), 0) / n;
  const avgScore = portfolio.reduce((s, c) => s + (c.finalScore || 0), 0) / n;

  const paydexPeers = portfolio.filter((c) => c.dnbData?.paydex?.score != null);
  const avgPaydex   = paydexPeers.length
    ? paydexPeers.reduce((s, c) => s + c.dnbData.paydex.score, 0) / paydexPeers.length
    : null;

  const metrics = [
    {
      label:          'Days Sales Outstanding',
      unit:           'd',
      mine:           dso,
      avg:            avgDso,
      lowerIsBetter:  true,
      fmt:            (v) => `${Math.round(v)}`,
    },
    {
      label:          'PAYDEX Score',
      unit:           '',
      mine:           myPaydex,
      avg:            avgPaydex,
      lowerIsBetter:  false,
      fmt:            (v) => `${Math.round(v)}`,
    },
    {
      label:          'Credit Score',
      unit:           '/100',
      mine:           finalScore,
      avg:            avgScore,
      lowerIsBetter:  false,
      fmt:            (v) => v.toFixed(1),
    },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">
        Peer Comparison
        <span className="text-xs font-normal text-gray-400 ml-2">vs. portfolio average ({n} customers)</span>
      </h3>
      <div className="grid grid-cols-3 gap-4">
        {metrics.map(({ label, unit, mine, avg, lowerIsBetter, fmt }) => {
          if (mine == null || avg == null) {
            return (
              <div key={label} className="rounded-xl bg-gray-50 p-4 text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-2">{label}</p>
                <p className="text-sm text-gray-400">No data</p>
              </div>
            );
          }

          const diff      = mine - avg;
          const isGood    = lowerIsBetter ? diff <= 0 : diff >= 0;
          const diffAbs   = Math.abs(diff);
          const arrowUp   = diff > 0;
          const diffLabel = `${arrowUp ? '+' : '−'}${diffAbs < 1 ? diffAbs.toFixed(1) : Math.round(diffAbs)}`;

          return (
            <div key={label} className="rounded-xl bg-gray-50 p-4 text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-3">{label}</p>
              <p className="text-2xl font-bold text-gray-900 tabular-nums">
                {fmt(mine)}<span className="text-sm font-medium text-gray-500">{unit}</span>
              </p>
              <div className={`flex items-center justify-center gap-1 mt-1.5 text-xs font-semibold ${isGood ? 'text-green-600' : 'text-red-600'}`}>
                <span>{arrowUp ? '▲' : '▼'}</span>
                <span>{diffLabel} vs avg</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Avg: {fmt(avg)}{unit}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── AiMemoPanel ─────────────────────────────────────────────────────────────

function AiMemoPanel({ customer }) {
  const [memo,    setMemo]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const hasApiKey = !!import.meta.env.VITE_ANTHROPIC_API_KEY;

  const generate = async () => {
    setLoading(true);
    setError(null);
    setMemo(null);

    const { finalScore, rating, dimensions, flags, dnbData, ...rest } = customer;
    const scores = { finalScore, rating, dimensions, flags };

    const result = await generateCreditMemo(rest, rest, scores, dnbData ?? null);

    if (result.error) {
      setError(result.riskSummary);
    } else {
      setMemo(result);
    }
    setLoading(false);
  };

  const copyMemo = () => {
    if (!memo) return;
    const limitLacs = memo.recommendedCreditLimit;
    const lines = [
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
      `RECOMMENDED CREDIT LIMIT: ₹${limitLacs}L`,
      memo.limitRationale ? `RATIONALE: ${memo.limitRationale}` : '',
      memo.reviewDate ? `NEXT REVIEW: ${memo.reviewDate}` : '',
    ].filter(Boolean);
    navigator.clipboard.writeText(lines.join('\n'));
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

      {/* Generate / no-key state */}
      {!loading && !memo && (
        <>
          {!hasApiKey ? (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-700">
              Set <code className="font-mono bg-amber-100 px-1 rounded">VITE_ANTHROPIC_API_KEY</code> in{' '}
              <code className="font-mono bg-amber-100 px-1 rounded">.env.local</code> to enable AI memos.
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
            <div className="rounded-xl border-2 p-4 mt-1" style={{ borderColor: '#1D4ED8', backgroundColor: '#eff6ff' }}>
              <div className="text-center">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
                  Recommended Credit Limit
                </p>
                <p className="text-3xl font-bold" style={{ color: '#1D4ED8' }}>
                  ₹{memo.recommendedCreditLimit}L
                </p>
                {(() => {
                  const recRaw     = memo.recommendedCreditLimit * 100_000;
                  const currentRaw = customer.credit_limit;
                  if (recRaw === currentRaw) return null;
                  const diffL = Math.abs(memo.recommendedCreditLimit - currentRaw / 100_000).toFixed(0);
                  return (
                    <p className="text-xs text-blue-500 mt-1">
                      Current: {fmtLac(currentRaw)}
                      {' '}
                      ({recRaw > currentRaw ? '▲' : '▼'} ₹{diffL}L)
                    </p>
                  );
                })()}
              </div>
              {memo.limitRationale && (
                <p className="text-xs text-blue-700 mt-3 leading-relaxed border-t border-blue-200 pt-3">
                  {memo.limitRationale}
                </p>
              )}
            </div>
          )}

          {/* Review Date */}
          {memo.reviewDate && (
            <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              <span>Next review: <span className="font-medium text-gray-700">{memo.reviewDate}</span></span>
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

  const { rating, finalScore, dimensions, flags, dnbData, sentimentData } = customer;
  const ratingColor = RATING_COLORS[rating] ?? '#6b7280';

  return (
    <main className="flex-1 p-6 min-w-0">
      <div className="flex flex-col gap-6">

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

        {/* ── SECTION 2.5: Peer Comparison ─────────────────────────────────── */}
        <PeerComparison customer={customer} portfolio={portfolio} />

        {/* ── SECTION 2.7: News Sentiment ──────────────────────────────────── */}
        <NewsSentimentCard sentimentData={sentimentData} />

        {/* ── SECTION 3: Aging Chart + AI Memo ─────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AgingBarChart customer={customer} />
          <AiMemoPanel customer={customer} />
        </div>

      </div>
    </main>
  );
}

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis } from 'recharts';
import { useApp } from '../context/AppContext';

// ─── Config ───────────────────────────────────────────────────────────────────

const RATING_STYLES = {
  A: { pill: 'bg-green-100 text-green-700',  score: 'text-green-600'  },
  B: { pill: 'bg-yellow-100 text-yellow-700', score: 'text-yellow-600' },
  C: { pill: 'bg-orange-100 text-orange-700', score: 'text-orange-500' },
  D: { pill: 'bg-red-100 text-red-700',       score: 'text-red-600'    },
};

const RATING_ORDER = { A: 0, B: 1, C: 2, D: 3 };

// IMMEDIATE_HOLD / SEVERE_OVERDUE / OVER_LIMIT → 🔴, rest → 🟡
const CRITICAL_FLAGS = new Set(['IMMEDIATE_HOLD', 'SEVERE_OVERDUE', 'OVER_LIMIT']);

const SORT_DEFAULT_DIR = { score: 'desc', dso: 'desc', outstanding: 'desc', rating: 'asc' };

const AGING_LEGEND = [
  { key: 'current', label: 'Current',  fill: '#86efac', bg: 'bg-green-300'  },
  { key: 'b30',     label: '1–30d',    fill: '#fde047', bg: 'bg-yellow-300' },
  { key: 'b60',     label: '31–60d',   fill: '#fdba74', bg: 'bg-orange-300' },
  { key: 'b90',     label: '61–90d',   fill: '#fb923c', bg: 'bg-orange-400' },
  { key: 'b90p',    label: '91–120d',  fill: '#f87171', bg: 'bg-red-400'    },
  { key: 'b120p',   label: '120d+',    fill: '#dc2626', bg: 'bg-red-600'    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLac(n) {
  const lac = n / 100_000;
  if (lac >= 10_000) return `₹${(lac / 100).toFixed(1)}Cr`;
  return `₹${lac.toFixed(1)}L`;
}

function fmtNum(n) {
  return (n / 100_000).toFixed(1);
}

function utilColor(pct) {
  if (pct > 100) return 'text-red-600 font-semibold';
  if (pct > 90)  return 'text-red-500 font-medium';
  if (pct > 70)  return 'text-orange-500';
  return 'text-gray-600';
}

function dsoColor(dso) {
  if (dso > 120) return 'text-red-600 font-medium';
  if (dso > 90)  return 'text-orange-500';
  if (dso > 60)  return 'text-yellow-600';
  return 'text-gray-600';
}

function ovdColor(pct) {
  if (pct > 50) return 'text-red-600 font-medium';
  if (pct > 25) return 'text-orange-500';
  return 'text-gray-600';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RatingBadge({ rating }) {
  const style = RATING_STYLES[rating]?.pill ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold select-none ${style}`}>
      {rating}
    </span>
  );
}

function ScoreCell({ score, rating }) {
  const color = RATING_STYLES[rating]?.score ?? 'text-gray-900';
  return <span className={`font-semibold tabular-nums ${color}`}>{score.toFixed(1)}</span>;
}

function FlagsCell({ flags }) {
  if (!flags?.length) return <span className="text-gray-200 text-xs">—</span>;
  return (
    <div className="flex items-center gap-0.5">
      {flags.map((f) => (
        <span
          key={f}
          title={f.replace(/_/g, ' ')}
          className="cursor-default text-sm leading-none"
          aria-label={f}
        >
          {CRITICAL_FLAGS.has(f) ? '🔴' : '🟡'}
        </span>
      ))}
    </div>
  );
}

function AgingBar({ customer }) {
  const { outstanding, bucket_30, bucket_60, bucket_90, bucket_90plus, bucket_120plus } = customer;
  const bucketSum = (bucket_30 || 0) + (bucket_60 || 0) + (bucket_90 || 0) + (bucket_90plus || 0) + (bucket_120plus || 0);
  const current   = Math.max(0, (outstanding || 0) - bucketSum);

  const data = [{
    name: 'a',
    current,
    b30:   bucket_30      || 0,
    b60:   bucket_60      || 0,
    b90:   bucket_90      || 0,
    b90p:  bucket_90plus  || 0,
    b120p: bucket_120plus || 0,
  }];

  return (
    <BarChart
      width={100}
      height={10}
      data={data}
      layout="vertical"
      margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
      barCategoryGap="0%"
      barSize={10}
    >
      <XAxis type="number" hide domain={[0, outstanding || 1]} />
      <YAxis type="category" dataKey="name" hide />
      {AGING_LEGEND.map(({ key, fill }) => (
        <Bar key={key} dataKey={key} stackId="a" fill={fill} isAnimationActive={false} />
      ))}
    </BarChart>
  );
}

function SummaryCard({ label, value, sub, valueClass }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-semibold leading-none ${valueClass ?? 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1.5">{sub}</p>}
    </div>
  );
}

function SortIcon({ field, sortBy, sortDir }) {
  if (sortBy !== field) return <span className="text-gray-300 ml-1 font-normal">↕</span>;
  return <span className="text-blue-600 ml-1 font-normal">{sortDir === 'asc' ? '↑' : '↓'}</span>;
}

// ─── PortfolioPage ────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const { portfolio } = useApp();
  const navigate = useNavigate();

  const [search,         setSearch]         = useState('');
  const [ratingFilter,   setRatingFilter]   = useState('All');
  const [industryFilter, setIndustryFilter] = useState('All');
  const [sortBy,         setSortBy]         = useState('score');
  const [sortDir,        setSortDir]        = useState('desc');

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!portfolio) {
    return (
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-900 mb-1">No portfolio loaded</p>
          <p className="text-sm text-gray-500 mb-5">Upload customer and aging data to get started.</p>
          <button
            onClick={() => navigate('/upload')}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
            style={{ backgroundColor: '#1D4ED8' }}
          >
            Go to Upload
          </button>
        </div>
      </main>
    );
  }

  // ── Summary stats ──────────────────────────────────────────────────────────
  const totalOutstanding = portfolio.reduce((s, c) => s + (c.outstanding || 0), 0);
  const avgDSO           = Math.round(portfolio.reduce((s, c) => s + (c.dso || 0), 0) / portfolio.length);
  const atRisk           = portfolio.filter((c) => c.rating === 'C' || c.rating === 'D').length;

  // ── Derived filter options ─────────────────────────────────────────────────
  const industries = useMemo(() => {
    const set = new Set(portfolio.map((c) => c.industry).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [portfolio]);

  // ── Sort handler ───────────────────────────────────────────────────────────
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir(SORT_DEFAULT_DIR[field] ?? 'desc');
    }
  };

  // ── Filtered + sorted rows ─────────────────────────────────────────────────
  const rows = useMemo(() => {
    let data = portfolio;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter((c) => c.company_name?.toLowerCase().includes(q) || c.customer_id?.toLowerCase().includes(q));
    }
    if (ratingFilter !== 'All')   data = data.filter((c) => c.rating === ratingFilter);
    if (industryFilter !== 'All') data = data.filter((c) => c.industry === industryFilter);

    return [...data].sort((a, b) => {
      let av, bv;
      switch (sortBy) {
        case 'score':       av = a.finalScore;              bv = b.finalScore;              break;
        case 'dso':         av = a.dso;                     bv = b.dso;                     break;
        case 'outstanding': av = a.outstanding;             bv = b.outstanding;             break;
        case 'rating':      av = RATING_ORDER[a.rating]??9; bv = RATING_ORDER[b.rating]??9; break;
        default:            av = a.finalScore;              bv = b.finalScore;
      }
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [portfolio, search, ratingFilter, industryFilter, sortBy, sortDir]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <main className="flex-1 p-8 min-w-0">
      <div className="max-w-screen-xl mx-auto">

        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Portfolio Overview</h1>
          <p className="text-sm text-gray-500 mt-1">{portfolio.length} customers scored</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <SummaryCard
            label="Total Customers"
            value={portfolio.length}
            sub={`${portfolio.filter(c => c.rating === 'A').length} rated A`}
          />
          <SummaryCard
            label="Total Outstanding"
            value={formatLac(totalOutstanding)}
            sub="across all borrowers"
          />
          <SummaryCard
            label="Avg DSO"
            value={`${avgDSO}d`}
            sub="days sales outstanding"
            valueClass={avgDSO > 60 ? 'text-orange-500' : 'text-gray-900'}
          />
          <SummaryCard
            label="At-Risk Customers"
            value={atRisk}
            sub="rating C or D"
            valueClass={atRisk > 0 ? 'text-red-600' : 'text-gray-900'}
          />
        </div>

        {/* Filter bar */}
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 mb-4 flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative min-w-52 flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name or ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Rating pills */}
          <div className="flex items-center gap-1">
            {['All', 'A', 'B', 'C', 'D'].map((r) => {
              const active = ratingFilter === r;
              const rStyle = RATING_STYLES[r]?.pill;
              return (
                <button
                  key={r}
                  onClick={() => setRatingFilter(r)}
                  className={[
                    'px-2.5 py-1 text-xs font-medium rounded-md border transition-colors',
                    active
                      ? r === 'All'
                        ? 'bg-gray-900 text-white border-gray-900'
                        : `${rStyle} border-transparent`
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700',
                  ].join(' ')}
                >
                  {r === 'All' ? 'All' : `${r}`}
                </button>
              );
            })}
          </div>

          {/* Industry */}
          <select
            value={industryFilter}
            onChange={(e) => setIndustryFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {industries.map((ind) => (
              <option key={ind} value={ind}>{ind === 'All' ? 'All Industries' : ind}</option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value); setSortDir(SORT_DEFAULT_DIR[e.target.value] ?? 'desc'); }}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="score">Sort: Score</option>
            <option value="rating">Sort: Rating</option>
            <option value="dso">Sort: DSO</option>
            <option value="outstanding">Sort: Outstanding</option>
          </select>

          <button
            onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
            title={sortDir === 'asc' ? 'Switch to descending' : 'Switch to ascending'}
            className="w-8 h-8 flex items-center justify-center text-sm border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {sortDir === 'asc' ? '↑' : '↓'}
          </button>

          <span className="text-xs text-gray-400 ml-auto tabular-nums">
            {rows.length} / {portfolio.length}
          </span>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {[
                    { label: 'Customer',     align: 'left',   field: null          },
                    { label: 'Industry',     align: 'left',   field: null          },
                    { label: 'Rating',       align: 'center', field: 'rating'      },
                    { label: 'Score',        align: 'right',  field: 'score'       },
                    { label: 'Limit (₹L)',   align: 'right',  field: null          },
                    { label: 'O/S (₹L)',     align: 'right',  field: 'outstanding' },
                    { label: 'Util %',       align: 'right',  field: null          },
                    { label: 'DSO',          align: 'right',  field: 'dso'         },
                    { label: 'Ovd %',        align: 'right',  field: null          },
                    { label: 'PAYDEX',       align: 'right',  field: null          },
                    { label: 'Aging Mix',    align: 'left',   field: null          },
                    { label: 'Flags',        align: 'left',   field: null          },
                    { label: '',             align: 'left',   field: null          },
                  ].map(({ label, align, field }) => (
                    <th
                      key={label}
                      onClick={field ? () => handleSort(field) : undefined}
                      className={[
                        'px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap',
                        `text-${align}`,
                        field ? 'cursor-pointer select-none hover:text-gray-700' : '',
                      ].join(' ')}
                    >
                      {label}
                      {field && <SortIcon field={field} sortBy={sortBy} sortDir={sortDir} />}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-4 py-16 text-center text-sm text-gray-400">
                      No customers match the current filters.
                    </td>
                  </tr>
                ) : (
                  rows.map((c, i) => {
                    const util = c.credit_limit > 0
                      ? ((c.outstanding / c.credit_limit) * 100).toFixed(1)
                      : null;
                    const paydex = c.dnbData?.paydex?.score ?? '—';

                    return (
                      <tr
                        key={c.customer_id}
                        onClick={() => navigate(`/customer/${c.customer_id}`)}
                        className={[
                          'border-b border-gray-50 cursor-pointer transition-colors hover:bg-blue-50/40 group',
                          i % 2 === 1 ? 'bg-gray-50/30' : 'bg-white',
                        ].join(' ')}
                      >
                        {/* Customer name + ID */}
                        <td className="px-4 py-3 min-w-44">
                          <p className="font-medium text-gray-900 leading-snug whitespace-nowrap">{c.company_name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{c.customer_id}</p>
                        </td>

                        {/* Industry */}
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{c.industry}</td>

                        {/* Rating badge */}
                        <td className="px-4 py-3 text-center">
                          <RatingBadge rating={c.rating} />
                        </td>

                        {/* Score */}
                        <td className="px-4 py-3 text-right">
                          <ScoreCell score={c.finalScore} rating={c.rating} />
                        </td>

                        {/* Credit limit */}
                        <td className="px-4 py-3 text-right tabular-nums text-gray-500 text-xs">
                          {fmtNum(c.credit_limit)}
                        </td>

                        {/* Outstanding */}
                        <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-800">
                          {fmtNum(c.outstanding)}
                        </td>

                        {/* Utilization */}
                        <td className={`px-4 py-3 text-right tabular-nums text-xs ${utilColor(Number(util))}`}>
                          {util !== null ? `${util}%` : '—'}
                        </td>

                        {/* DSO */}
                        <td className={`px-4 py-3 text-right tabular-nums text-xs ${dsoColor(c.dso)}`}>
                          {c.dso}
                        </td>

                        {/* Overdue % */}
                        <td className={`px-4 py-3 text-right tabular-nums text-xs ${ovdColor(c.overdue_pct)}`}>
                          {c.overdue_pct}%
                        </td>

                        {/* PAYDEX */}
                        <td className="px-4 py-3 text-right tabular-nums text-xs text-gray-600">
                          {paydex}
                        </td>

                        {/* Aging mini bar */}
                        <td className="px-4 py-3">
                          <AgingBar customer={c} />
                        </td>

                        {/* Flags */}
                        <td className="px-4 py-3 min-w-16">
                          <FlagsCell flags={c.flags} />
                        </td>

                        {/* Row action */}
                        <td className="px-3 py-3 text-right">
                          <span className="text-gray-200 group-hover:text-blue-500 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Aging bar legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 px-1">
          {AGING_LEGEND.map(({ bg, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={`w-3 h-2 rounded-sm ${bg}`} />
              <span className="text-xs text-gray-400">{label}</span>
            </div>
          ))}
        </div>

      </div>
    </main>
  );
}

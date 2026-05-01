import { NavLink } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { calcPortfolioHealth } from '../utils/format';

const NAV_ITEMS = [
  { to: '/upload',    label: 'Upload' },
  { to: '/portfolio', label: 'Portfolio' },
];

const HEALTH_COLORS = {
  A: { bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500'  },
  B: { bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  C: { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
  D: { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500'    },
};

export default function Navbar() {
  const { portfolio } = useApp();
  const health = calcPortfolioHealth(portfolio);
  const colorKey = health?.label?.[0] ?? null;
  const colors   = colorKey ? (HEALTH_COLORS[colorKey] ?? HEALTH_COLORS.D) : null;

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-8">
        <span className="text-base font-semibold tracking-tight text-gray-900">
          Credit<span style={{ color: '#1D4ED8' }}>IQ</span>
        </span>

        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                [
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50',
                ].join(' ')
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Portfolio Health badge */}
        {health && colors && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium">Portfolio Health</span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${colors.bg} ${colors.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
              {health.label}
            </span>
            <span className="text-xs text-gray-400 tabular-nums">{health.score.toFixed(1)}</span>
          </div>
        )}
      </div>
    </header>
  );
}

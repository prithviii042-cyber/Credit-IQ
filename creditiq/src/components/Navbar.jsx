import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/upload', label: 'Upload' },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/customer', label: 'Customer Detail' },
];

export default function Navbar() {
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
      </div>
    </header>
  );
}

export default function Portfolio() {
  return (
    <main className="flex-1 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Portfolio Overview</h1>
        <p className="text-sm text-gray-500 mb-8">Summary of all borrowers and risk metrics.</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total Borrowers', value: '—' },
            { label: 'Avg Credit Score', value: '—' },
            { label: 'Default Rate', value: '—' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{stat.label}</p>
              <p className="text-3xl font-semibold text-gray-900">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 flex items-center justify-center h-64 text-sm text-gray-400">
          Upload a portfolio to see charts and data.
        </div>
      </div>
    </main>
  );
}

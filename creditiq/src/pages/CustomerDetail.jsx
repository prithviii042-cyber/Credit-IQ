export default function CustomerDetail() {
  return (
    <main className="flex-1 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Customer Detail</h1>
        <p className="text-sm text-gray-500 mb-8">Individual borrower credit analysis and score breakdown.</p>

        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {['Credit Score', 'Income', 'Debt-to-Income Ratio', 'Payment History', 'Risk Tier'].map((field) => (
            <div key={field} className="flex items-center justify-between px-6 py-4">
              <span className="text-sm font-medium text-gray-700">{field}</span>
              <span className="text-sm text-gray-400">—</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

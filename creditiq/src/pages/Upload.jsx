export default function Upload() {
  return (
    <main className="flex-1 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Upload Portfolio</h1>
        <p className="text-sm text-gray-500 mb-8">Import a CSV file to analyze your credit portfolio.</p>

        <div className="border-2 border-dashed border-gray-200 rounded-xl bg-white flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
            <svg className="w-6 h-6 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-900">Drop your CSV here, or <span className="text-blue-700 cursor-pointer hover:underline">browse</span></p>
            <p className="text-xs text-gray-400 mt-1">Supports .csv files up to 50 MB</p>
          </div>
        </div>
      </div>
    </main>
  );
}

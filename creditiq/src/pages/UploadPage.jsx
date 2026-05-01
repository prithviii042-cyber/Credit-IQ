import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import { mockDnBAPI } from '../data/dnbMockData';
import { calculateFinalScore } from '../engine/scoringEngine';
import { analyzeSentiment } from '../engine/sentimentAnalyzer';
import { useApp } from '../context/AppContext';

// ─── Column schemas ───────────────────────────────────────────────────────────

const CUSTOMER_COLS = [
  'customer_id', 'company_name', 'revenue_cr', 'ebitda_pct',
  'debt_equity', 'tenure_years', 'industry', 'city_tier', 'credit_limit',
];

const AGING_COLS = [
  'customer_id', 'outstanding', 'dso', 'overdue_pct',
  'bucket_30', 'bucket_60', 'bucket_90', 'bucket_90plus', 'bucket_120plus',
];

// ─── Sample data ──────────────────────────────────────────────────────────────

const SAMPLE_CUSTOMERS = `customer_id,company_name,revenue_cr,ebitda_pct,debt_equity,tenure_years,industry,city_tier,credit_limit
C001,Apex Manufacturing LLC,450,14.2,1.2,8,Manufacturing,1,5000000
C002,Brightstone Retail Group Inc,120,6.8,2.1,4,Retail,2,2000000
C003,Crestview Logistics Partners,85,3.1,2.8,6,Services,2,1500000
C004,Delta Precision Components,920,18.5,0.6,12,Manufacturing,1,8000000
C005,Eastfield Construction Services,210,11.4,1.5,7,Construction,2,3000000
C006,FrontRange Healthcare Solutions,175,5.2,2.4,3,Healthcare,1,2500000
C007,Granite Peak Technology Corp,680,21.3,0.8,9,Technology,1,7000000
C008,Harbor View Wholesale Distributors,55,1.2,3.6,5,Retail,3,1000000
C009,Ironwood Capital Advisors,340,16.8,1.1,6,Services,1,4000000
C010,Juniper Valley Foods Inc,290,8.9,1.9,4,FMCG,2,3500000
C011,Keystone Industrial Supply,1250,22.1,0.4,15,Manufacturing,1,10000000
C012,Lakeshore Media Ventures,45,-2.3,4.1,2,Media,2,800000
C013,Meridian Staffing Solutions LLC,380,13.7,1.3,7,Services,1,5000000
C014,Northgate Energy Resources,520,10.1,1.7,5,Automotive,2,6000000
C015,Oakridge Pharmaceutical Group,145,4.6,2.7,3,Pharmaceuticals,1,2000000`;

const SAMPLE_AGING = `customer_id,outstanding,dso,overdue_pct,bucket_30,bucket_60,bucket_90,bucket_90plus,bucket_120plus
C001,1250000,26,4,50000,0,0,0,0
C002,1720000,46,28,320000,162000,0,0,0
C003,1380000,72,55,150000,200000,180000,150000,79000
C004,3800000,21,0,0,0,0,0,0
C005,1850000,38,12,150000,72000,0,0,0
C006,2100000,58,35,350000,200000,120000,65000,0
C007,4200000,24,3,126000,0,0,0,0
C008,940000,95,72,80000,120000,160000,200000,117000
C009,2750000,34,8,220000,0,0,0,0
C010,2980000,52,22,380000,180000,96000,0,0
C011,5200000,18,0,0,0,0,0,0
C012,710000,78,65,80000,120000,100000,100000,62000
C013,3100000,30,6,186000,0,0,0,0
C014,4100000,42,15,360000,180000,75000,0,0
C015,1850000,62,42,250000,200000,150000,100000,77000`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const IDLE_FILE = { status: 'idle', data: null, filename: null, error: null };

function parseCsv(source, requiredCols) {
  return new Promise((resolve) => {
    Papa.parse(source, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: ({ data, meta }) => {
        const fields = meta.fields ?? [];
        const missing = requiredCols.filter((c) => !fields.includes(c));
        if (missing.length) {
          resolve({ status: 'error', data: null, error: `Missing columns: ${missing.join(', ')}` });
        } else {
          resolve({ status: 'valid', data, error: null });
        }
      },
      error: (err) => resolve({ status: 'error', data: null, error: err.message }),
    });
  });
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconUpload({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  );
}

function IconCheck({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function IconX({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function IconSparkle({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
  );
}

// ─── DropZone ─────────────────────────────────────────────────────────────────

function DropZone({ label, hint, columns, fileState, onFile, disabled }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const { status, filename, error } = fileState;

  const handleFile = useCallback(
    async (file) => {
      if (!file || disabled) return;
      const result = await parseCsv(file, columns);
      onFile({ ...result, filename: file.name });
    },
    [columns, disabled, onFile],
  );

  const onDragOver = (e) => {
    e.preventDefault();
    if (!disabled) setDragging(true);
  };
  const onDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false);
  };
  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };
  const onClick = () => { if (!disabled) inputRef.current?.click(); };
  const onChange = (e) => {
    handleFile(e.target.files?.[0]);
    e.target.value = '';
  };

  const zoneClass =
    dragging        ? 'border-blue-500 bg-blue-50/60' :
    status === 'valid'  ? 'border-green-400 bg-green-50/40' :
    status === 'error'  ? 'border-red-400 bg-red-50/40' :
    disabled        ? 'border-gray-200 bg-gray-50 opacity-60' :
                      'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50';

  const iconBg =
    status === 'valid'  ? 'bg-green-100' :
    status === 'error'  ? 'bg-red-100' :
    dragging        ? 'bg-blue-100' :
                      'bg-gray-100';

  return (
    <div className="flex flex-col gap-3">
      {/* Zone */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={`Upload ${label}`}
        onClick={onClick}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onKeyDown={(e) => e.key === 'Enter' && onClick()}
        className={[
          'border-2 border-dashed rounded-xl transition-colors select-none',
          disabled ? 'cursor-not-allowed' : 'cursor-pointer',
          zoneClass,
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="sr-only"
          onChange={onChange}
          disabled={disabled}
        />

        <div className="px-6 py-8 flex flex-col items-center gap-3 text-center">
          {/* Status icon */}
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${iconBg}`}>
            {status === 'valid'  ? <IconCheck className="w-5 h-5 text-green-600" /> :
             status === 'error'  ? <IconX     className="w-5 h-5 text-red-500"   /> :
                                   <IconUpload className="w-5 h-5 text-gray-400"  />}
          </div>

          {/* Label + hint */}
          <div>
            <p className="text-sm font-semibold text-gray-800">{label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{hint}</p>
          </div>

          {/* Contextual message */}
          {dragging && (
            <p className="text-xs font-medium text-blue-700">Release to upload</p>
          )}
          {!dragging && status === 'idle' && (
            <p className="text-xs text-gray-400">
              Drop CSV here or{' '}
              <span className="text-blue-700 font-medium underline underline-offset-2">browse</span>
            </p>
          )}
          {status === 'valid' && (
            <p className="text-xs font-medium text-green-700 break-all max-w-xs">{filename}</p>
          )}
          {status === 'error' && (
            <p className="text-xs font-medium text-red-600 break-all max-w-xs">{error}</p>
          )}
        </div>
      </div>

      {/* Column hint */}
      <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
          Expected columns
        </p>
        <div className="flex flex-wrap gap-1">
          {columns.map((col) => (
            <code
              key={col}
              className="text-xs bg-white border border-gray-200 rounded px-1.5 py-0.5 font-mono text-gray-600"
            >
              {col}
            </code>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Processing panel ─────────────────────────────────────────────────────────

function ProcessingPanel({ pipeline }) {
  const { status, progress, total, message } = pipeline;
  const pct = total > 0 ? Math.round((progress / total) * 100) : 0;

  const barColor =
    status === 'done'  ? 'bg-green-500' :
    status === 'error' ? 'bg-red-500'   :
                         'bg-blue-600';

  const barWidth = status === 'done' ? '100%' : `${pct}%`;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-gray-800">{message}</p>
        {status !== 'done' && status !== 'error' && (
          <span className="text-sm tabular-nums text-gray-400">{pct}%</span>
        )}
      </div>

      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: barWidth }}
        />
      </div>

      {status === 'done' && (
        <p className="text-xs text-green-600 font-medium mt-2">Redirecting to portfolio…</p>
      )}
      {status === 'error' && (
        <p className="text-xs text-red-600 font-medium mt-2">
          Please check your files and try again.
        </p>
      )}
    </div>
  );
}

// ─── UploadPage ───────────────────────────────────────────────────────────────

export default function UploadPage() {
  const [customerFile, setCustomerFile] = useState(IDLE_FILE);
  const [agingFile,    setAgingFile]    = useState(IDLE_FILE);
  const [pipeline, setPipeline] = useState({
    status: 'idle', progress: 0, total: 0, message: '',
  });

  const { setPortfolio } = useApp();
  const navigate = useNavigate();
  const pipelineRunning = useRef(false);

  // Auto-start when both files are valid
  useEffect(() => {
    if (
      customerFile.status === 'valid' &&
      agingFile.status === 'valid' &&
      !pipelineRunning.current
    ) {
      pipelineRunning.current = true;
      runPipeline(customerFile.data, agingFile.data);
    }
  }, [customerFile.status, agingFile.status]);

  async function runPipeline(customersData, agingData) {
    // 1. Merge on customer_id
    setPipeline({ status: 'merging', progress: 0, total: customersData.length, message: 'Merging datasets…' });

    const agingMap = Object.fromEntries(agingData.map((r) => [r.customer_id, r]));
    const merged = customersData
      .filter((c) => agingMap[c.customer_id])
      .map((c) => ({
        ...agingMap[c.customer_id],
        ...c,
        credit_limit: c.credit_limit, // customer's credit_limit wins
      }));

    if (merged.length === 0) {
      setPipeline({ status: 'error', progress: 0, total: 0, message: 'No matching customer_ids found between the two files.' });
      pipelineRunning.current = false;
      return;
    }

    const totalOutstanding = merged.reduce((sum, r) => sum + (Number(r.outstanding) || 0), 0);

    // 2. Sequentially fetch D&B data
    const dnbResults = [];
    for (let i = 0; i < merged.length; i++) {
      setPipeline({
        status: 'fetching',
        progress: i,
        total: merged.length,
        message: `Fetching D&B data… ${i + 1} / ${merged.length}`,
      });
      const dnbResult = await mockDnBAPI(merged[i].customer_id);
      dnbResults.push(dnbResult.error ? null : dnbResult.data);
    }

    // 3. Sentiment analysis in batches of 5
    const BATCH = 5;
    const sentimentResults = new Array(merged.length).fill(null);
    for (let i = 0; i < merged.length; i += BATCH) {
      setPipeline({
        status: 'sentiment',
        progress: i,
        total: merged.length,
        message: `Analyzing news sentiment… ${Math.min(i + BATCH, merged.length)} / ${merged.length}`,
      });
      const batch = merged.slice(i, i + BATCH).map((row, j) => ({ ...row, dnbData: dnbResults[i + j] }));
      const batchSentiments = await Promise.all(batch.map((r) => analyzeSentiment(r)));
      batchSentiments.forEach((s, j) => { sentimentResults[i + j] = s; });
    }

    // 4. Calculate final scores
    setPipeline({
      status: 'scoring',
      progress: merged.length,
      total: merged.length,
      message: 'Calculating final scores…',
    });

    const results = merged.map((row, i) => {
      const dnbData = dnbResults[i];
      const sentimentData = sentimentResults[i];

      const customerObj = {
        revenue_cr:   Number(row.revenue_cr)   || 0,
        ebitda_pct:   Number(row.ebitda_pct)   || 0,
        debt_equity:  Number(row.debt_equity)  || 0,
        tenure_years: Number(row.tenure_years) || 0,
        industry:     String(row.industry      || 'Services'),
        city_tier:    Number(row.city_tier)    || 2,
      };

      const agingObj = {
        outstanding:    Number(row.outstanding)    || 0,
        credit_limit:   Number(row.credit_limit)   || 0,
        dso:            Number(row.dso)            || 0,
        overdue_pct:    Number(row.overdue_pct)    || 0,
        bucket_30:      Number(row.bucket_30)      || 0,
        bucket_60:      Number(row.bucket_60)      || 0,
        bucket_90:      Number(row.bucket_90)      || 0,
        bucket_90plus:  Number(row.bucket_90plus)  || 0,
        bucket_120plus: Number(row.bucket_120plus) || 0,
      };

      const scored = calculateFinalScore(customerObj, agingObj, dnbData, sentimentData, totalOutstanding);

      return {
        customer_id:  row.customer_id,
        company_name: String(row.company_name || dnbData?.companyName || row.customer_id),
        ...customerObj,
        ...agingObj,
        dnbData,
        sentimentData,
        ...scored,
      };
    });

    setPipeline({
      status: 'done',
      progress: merged.length,
      total: merged.length,
      message: `Analysis complete — ${results.length} customers scored`,
    });
    setPortfolio(results);
    setTimeout(() => navigate('/portfolio'), 900);
  }

  const loadSampleData = async () => {
    // Allow re-running if called again
    pipelineRunning.current = false;
    setPipeline({ status: 'idle', progress: 0, total: 0, message: '' });

    const [cf, af] = await Promise.all([
      parseCsv(SAMPLE_CUSTOMERS, CUSTOMER_COLS),
      parseCsv(SAMPLE_AGING,     AGING_COLS),
    ]);

    setCustomerFile({ ...cf, filename: 'sample_customers.csv' });
    setAgingFile({    ...af, filename: 'sample_aging.csv'     });
  };

  const isProcessing = pipeline.status !== 'idle' && pipeline.status !== 'error';

  // Wrap setters so a fresh file upload resets the pipeline
  const handleCustomerFile = (state) => {
    pipelineRunning.current = false;
    setPipeline({ status: 'idle', progress: 0, total: 0, message: '' });
    setCustomerFile(state);
  };
  const handleAgingFile = (state) => {
    pipelineRunning.current = false;
    setPipeline({ status: 'idle', progress: 0, total: 0, message: '' });
    setAgingFile(state);
  };

  return (
    <main className="flex-1 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Upload Portfolio Data</h1>
          <p className="text-sm text-gray-500 mt-1">
            Import customer financials and AR aging data to generate credit scores.
          </p>
        </div>

        {/* Drop zones */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          <DropZone
            label="Customer Financials"
            hint="customers.csv"
            columns={CUSTOMER_COLS}
            fileState={customerFile}
            onFile={handleCustomerFile}
            disabled={isProcessing}
          />
          <DropZone
            label="AR Aging Data"
            hint="aging.csv"
            columns={AGING_COLS}
            fileState={agingFile}
            onFile={handleAgingFile}
            disabled={isProcessing}
          />
        </div>

        {/* Load Sample Data */}
        {!isProcessing && (
          <div className="flex justify-center mb-8">
            <button
              onClick={loadSampleData}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 active:bg-blue-200 transition-colors"
            >
              <IconSparkle className="w-4 h-4" />
              Load Sample Data
            </button>
          </div>
        )}

        {/* Processing panel */}
        {pipeline.status !== 'idle' && (
          <ProcessingPanel pipeline={pipeline} />
        )}
      </div>
    </main>
  );
}

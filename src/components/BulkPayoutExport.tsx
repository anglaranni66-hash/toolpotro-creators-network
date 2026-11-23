import React, { useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { BKashIcon, NagadIcon } from './BrandIcons';
import { authFetch } from '../utils/authFetch';

export const BulkPayoutExport: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const res = await authFetch('/api/wallet/export-csv');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setExportError(errData.error || 'CSV ডাউনলোড করতে সমস্যা হয়েছে।');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `toolpotro_bulk_payouts_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError('সার্ভারের সাথে সংযোগ করা যায়নি।');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-800 border border-slate-200 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-slate-950">
                বিকাশ ও নগদ বাল্ক পে-আউট এক্সপোর্ট (Bulk MFS CSV)
              </h3>
              <div className="flex items-center gap-1">
                <BKashIcon className="w-3.5 h-3.5 rounded shrink-0" />
                <NagadIcon className="w-3.5 h-3.5 rounded shrink-0" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              bKash Merchant Bulk Portal এবং Nagad Disbursement ফর্ম্যাটে ১-ক্লিকে CSV ফাইল ডাউনলোড করুন।
            </p>
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={isExporting}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-colors shadow-xs flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
        >
          <Download className="w-4 h-4 text-emerald-100" />
          <span>{isExporting ? 'এক্সপোর্ট হচ্ছে...' : 'Export Payout CSV'}</span>
        </button>
      </div>

      {exportError && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 font-semibold">
          {exportError}
        </p>
      )}
    </div>
  );
};

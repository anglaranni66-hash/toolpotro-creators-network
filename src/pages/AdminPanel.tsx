import React, { useState, useEffect } from 'react';
import { Campaign, Submission } from '../types';
import { LiveHealthMonitor } from '../components/LiveHealthMonitor';
import { AdminReviewPanel } from '../components/AdminReviewPanel';
import { AdminCampaignModal } from '../components/AdminCampaignModal';
import { BulkPayoutExport } from '../components/BulkPayoutExport';
import { SubmissionsTable } from '../components/SubmissionsTable';
import { useAuth } from '../context/AuthContext';
import { authFetch } from '../utils/authFetch';
import { ShieldAlert, BarChart3, DollarSign } from 'lucide-react';

interface AdminPanelProps {
  campaigns: Campaign[];
  onRefreshCampaigns: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  campaigns,
  onRefreshCampaigns,
}) => {
  const { hydrationVersion, currentUser } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSubmissions = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const res = await authFetch('/api/submissions');
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data);
      }
    } catch (err) {
      console.error('Failed to load submissions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
    const interval = setInterval(fetchSubmissions, 6000);
    return () => clearInterval(interval);
  }, [hydrationVersion, currentUser?.uid]);

  const totalPaidOut = submissions
    .filter(s => s.status === 'approved')
    .reduce((sum, s) => sum + (s.finalPayout || 0), 0);

  const pendingReviewCount = submissions.filter(
    s => s.status === 'needs_manual_review' || s.status === 'high_value_pending' || s.status === 'appeal_pending'
  ).length;

  return (
    <div className="space-y-6">
      
      {/* Admin Stat Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold border border-amber-200">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold block uppercase tracking-wider">পেন্ডিং রিভিউ কিউ</span>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-950 tabular-nums">
              {pendingReviewCount} টি ভিডিও
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold border border-emerald-200">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold block uppercase tracking-wider">অনুমোদিত মোট রিওয়ার্ড</span>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-950 tabular-nums">
              ৳{totalPaidOut.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold border border-slate-200">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold block uppercase tracking-wider">সক্রিয় ক্যাম্পেইন</span>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-950 tabular-nums">
              {campaigns.length} টি চলমান
            </div>
          </div>
        </div>

      </div>

      {/* Live System Health Monitor */}
      <LiveHealthMonitor />

      {/* Manual Review Panel with 1-Click Approve (ওকে) */}
      <AdminReviewPanel
        submissions={submissions}
        onActionComplete={fetchSubmissions}
      />

      {/* Dynamic Campaign Creator & Manager Form */}
      <AdminCampaignModal
        campaigns={campaigns}
        onCampaignUpdated={onRefreshCampaigns}
      />

      {/* Bulk MFS Export Component */}
      <BulkPayoutExport />

      {/* Full Submissions Ledger */}
      <SubmissionsTable
        submissions={submissions}
        isLoading={isLoading}
        onRefresh={fetchSubmissions}
        isAdminView={true}
      />

    </div>
  );
};

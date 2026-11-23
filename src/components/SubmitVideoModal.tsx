import React, { useState } from 'react';
import { Campaign } from '../types';
import { useAuth } from '../context/AuthContext';
import { syncSubmissionToFirestore } from '../services/firestoreSync';
import { authFetch } from '../utils/authFetch';
import { Send, Link2, AlertCircle, CheckCircle2, Sparkles, Clock, LogIn } from 'lucide-react';

interface SubmitVideoModalProps {
  campaigns: Campaign[];
  onSubmissionSuccess: () => void;
}

export const SubmitVideoModal: React.FC<SubmitVideoModalProps> = ({ campaigns, onSubmissionSuccess }) => {
  const { currentUser, loginWithGoogle, refreshWallet } = useAuth();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(campaigns[0]?.id || '');
  const [url, setUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId) || campaigns[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !currentUser) return;

    setStatusMessage(null);
    setIsSubmitting(true);

    try {
      const res = await authFetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          campaignId: selectedCampaignId || selectedCampaign?.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatusMessage({
          type: 'error',
          text: data.error || 'ভিডিও সাবমিট ব্যর্থ হয়েছে। লিঙ্কটি সঠিকভাবে চেক করুন।',
        });
      } else {
        if (data?.submission) {
          void syncSubmissionToFirestore(data.submission);
        }
        setStatusMessage({
          type: 'success',
          text: 'ভিডিও সফলভাবে জমা হয়েছে! সিস্টেম দ্রুত যাচাই সম্পন্ন করবে।',
        });
        setUrl('');
        onSubmissionSuccess();
        setTimeout(async () => {
          await refreshWallet();
          onSubmissionSuccess();
        }, 1500);
      }
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'সার্ভারে সংযোগে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
      <div className="border-b border-slate-100 pb-3">
        <h2 className="text-base font-bold text-slate-950 flex items-center gap-2">
          ভিডিও লিংক সাবমিট করুন
          <span className="bg-slate-100 text-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded border border-slate-200">
            অটোমেটেড পাইপলাইন
          </span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          YouTube Short, Facebook Reel বা TikTok ভিডিও লিংক দিয়ে জমা দিন।
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Campaign Selector */}
        <div>
          <label className="text-xs font-bold text-slate-800 block mb-1.5">
            সক্রিয় ক্যাম্পেইন নির্বাচন করুন:
          </label>
          <select
            value={selectedCampaignId}
            onChange={(e) => setSelectedCampaignId(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 font-medium focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
          >
            {campaigns.map((camp) => (
              <option key={camp.id} value={camp.id}>
                {camp.title} — ৳{camp.cpmRate} CPM ({camp.validationMode === 'first_30s' ? 'First 30s Rule' : 'Full Script'})
              </option>
            ))}
          </select>

          {selectedCampaign && (
            <div className="mt-2.5 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="font-bold text-slate-900 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-slate-500" />
                  সিপিএম রেট: ৳{selectedCampaign.cpmRate} / ১,০০০ ভিউজ
                </span>
                <span className="text-[11px] font-semibold bg-white text-slate-700 px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  {selectedCampaign.validationMode === 'first_30s'
                    ? 'প্রথম ১৫-৩০ সেকেন্ড'
                    : 'ফুল স্ক্রিপ্ট'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Video URL Input */}
        <div>
          <label className="text-xs font-bold text-slate-800 block mb-1.5">
            ভিডিও লিংক:
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Link2 className="w-4 h-4" />
            </div>
            <input
              type="url"
              placeholder="https://youtube.com/shorts/... অথবা https://facebook.com/reel/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-mono"
              required
            />
          </div>
        </div>

        {/* Status Notification */}
        {statusMessage && (
          <div
            className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Action Button */}
        {currentUser ? (
          <button
            type="submit"
            disabled={isSubmitting || !url.trim()}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-lg text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <Send className="w-4 h-4" />
            <span>{isSubmitting ? 'যাচাই হচ্ছে...' : 'ভিডিও লিংক জমা দিন'}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={loginWithGoogle}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-lg text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <LogIn className="w-4 h-4" />
            <span>সাবমিট করতে Google দিয়ে লগইন করুন</span>
          </button>
        )}
      </form>
    </div>
  );
};

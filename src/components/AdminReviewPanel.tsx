import React, { useState } from 'react';
import { Submission, FallbackReason } from '../types';
import { authFetch } from '../utils/authFetch';
import {
  Check,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Bot,
  Sparkles,
  RotateCcw,
  Link as LinkIcon,
  UserCheck,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import { YouTubeIcon, FacebookIcon, InstagramIcon, TikTokIcon } from './BrandIcons';

interface AdminReviewPanelProps {
  submissions: Submission[];
  onActionComplete: () => void;
}

function formatDateTimeBn(iso?: string): string {
  if (!iso) return 'অজানা';
  try {
    return new Intl.DateTimeFormat('bn-BD', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function fallbackBadgeText(reason?: FallbackReason): string {
  switch (reason) {
    case 'api_limit_or_error':
      return 'AI API লিমিট / এরর';
    case 'metadata_fetch_unavailable':
      return 'ভিউ/ক্যাপশন অটো-ফেচ হয়নি';
    case 'audio_unavailable_for_ai':
      return 'অডিও স্ট্রিম অনুপলব্ধ';
    case 'high_value_20k':
      return 'হাই-ভ্যালু (>২০k ভিউ)';
    case 'noisy_audio':
      return 'নয়েজি / অস্পষ্ট অডিও';
    case 'low_confidence':
      return '৫০-৭৯% স্কোর';
    default:
      return 'ম্যানুয়ালি যাচাই';
  }
}

export const AdminReviewPanel: React.FC<AdminReviewPanelProps> = ({
  submissions,
  onActionComplete,
}) => {
  const [activeTab, setActiveTab] = useState<'pending_ai' | 'user_appeals'>('pending_ai');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isBulkRequeuing, setIsBulkRequeuing] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [viewsOverrides, setViewsOverrides] = useState<Record<string, string>>({});
  const [payoutOverrides, setPayoutOverrides] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const pendingManualQueue = submissions.filter(
    (s) => s.status === 'needs_manual_review' || s.status === 'high_value_pending'
  );
  const userAppealsQueue = submissions.filter((s) => s.status === 'appeal_pending');
  const currentList = activeTab === 'pending_ai' ? pendingManualQueue : userAppealsQueue;

  const handleApprove = async (submission: Submission) => {
    setProcessingId(submission.id);
    setFeedback(null);
    const vStr = viewsOverrides[submission.id];
    const pStr = payoutOverrides[submission.id];
    try {
      const res = await authFetch(`/api/submissions/${submission.id}/manual-approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overrideViews: vStr ? Number(vStr) : undefined,
          overridePayout: pStr ? Number(pStr) : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ type: 'success', text: data.message });
        onActionComplete();
      } else {
        setFeedback({ type: 'error', text: data.error || 'অনুমোদন ব্যর্থ হয়েছে।' });
      }
    } catch {
      setFeedback({ type: 'error', text: 'সার্ভারের সাথে সংযোগ ব্যর্থ হয়েছে।' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRequeueSingle = async (submission: Submission) => {
    setProcessingId(submission.id);
    setFeedback(null);
    try {
      const res = await authFetch(`/api/submissions/${submission.id}/requeue`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ type: 'success', text: data.message });
        onActionComplete();
      } else {
        setFeedback({ type: 'error', text: data.error || 'AI কিউতে পাঠানো যায়নি।' });
      }
    } catch {
      setFeedback({ type: 'error', text: 'সার্ভারের সাথে সংযোগ ব্যর্থ হয়েছে।' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRequeueAll = async () => {
    setIsBulkRequeuing(true);
    setFeedback(null);
    try {
      const res = await authFetch('/api/submissions/requeue-all', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ type: 'success', text: data.message });
        onActionComplete();
      } else {
        setFeedback({ type: 'error', text: data.error || 'সবগুলো AI কিউতে পাঠানো ব্যর্থ হয়েছে।' });
      }
    } catch {
      setFeedback({ type: 'error', text: 'সার্ভারের সাথে সংযোগ ব্যর্থ হয়েছে।' });
    } finally {
      setIsBulkRequeuing(false);
    }
  };

  const handleReject = async (submission: Submission, isAppeal: boolean) => {
    if (!rejectionReason.trim()) {
      setFeedback({ type: 'error', text: 'অনুগ্রহ করে বাতিলের কারণ লিখুন।' });
      return;
    }

    setProcessingId(submission.id);
    setFeedback(null);
    try {
      const endpoint = isAppeal
        ? `/api/submissions/${submission.id}/permanent-reject`
        : `/api/submissions/${submission.id}/manual-reject`;

      const res = await authFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectionReason.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRejectingId(null);
        setRejectionReason('');
        setFeedback({ type: 'success', text: 'সাবমিশনটি রিজেক্ট করা হয়েছে।' });
        onActionComplete();
      } else {
        setFeedback({ type: 'error', text: data.error || 'বাতিলকরণ ব্যর্থ হয়েছে।' });
      }
    } catch {
      setFeedback({ type: 'error', text: 'সার্ভারের সাথে সংযোগ ব্যর্থ হয়েছে।' });
    } finally {
      setProcessingId(null);
    }
  };

  const renderPlatformIcon = (platform: string) => {
    const p = platform.toLowerCase();
    if (p.includes('youtube')) return <YouTubeIcon className="w-4 h-4 shrink-0" />;
    if (p.includes('facebook')) return <FacebookIcon className="w-4 h-4 shrink-0" />;
    if (p.includes('instagram')) return <InstagramIcon className="w-4 h-4 shrink-0" />;
    if (p.includes('tiktok')) return <TikTokIcon className="w-4 h-4 shrink-0" />;
    return null;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold text-sm shadow-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-950">
              ম্যানুয়ালি যাচাই ও পে-আউট অনুমোদন প্যানেল
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            AI API লিমিট/এরর, অসম্পূর্ণ ডেটা, ২০k+ ভিউ ও আপিল ভিডিও এখান থেকে ম্যানুয়ালি Approve (ওকে) করুন অথবা API ঠিক হলে আবার AI-তে পাঠান।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {pendingManualQueue.length > 0 && activeTab === 'pending_ai' && (
            <button
              type="button"
              onClick={handleRequeueAll}
              disabled={isBulkRequeuing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isBulkRequeuing ? 'animate-spin' : ''}`} />
              <span>সবগুলো একসাথে AI-তে পাঠান ({pendingManualQueue.length})</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200/60">
            <button
              type="button"
              onClick={() => setActiveTab('pending_ai')}
              className={`text-xs font-bold px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'pending_ai'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>ম্যানুয়ালি যাচাই ({pendingManualQueue.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('user_appeals')}
              className={`text-xs font-bold px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'user_appeals'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>User Appeals ({userAppealsQueue.length})</span>
            </button>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-lg text-xs font-bold border flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <span>{feedback.text}</span>
          <button type="button" onClick={() => setFeedback(null)} className="px-2 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Tab Queue Items */}
      {currentList.length === 0 ? (
        <div className="py-10 text-center text-slate-400">
          <Check className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
          <p className="text-sm font-bold text-slate-700">
            {activeTab === 'pending_ai' ? 'সকল ম্যানুয়াল রিভিউ ক্লিয়ার আছে!' : 'কোনো আপিল পেন্ডিং নেই!'}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            বর্তমানে ম্যানুয়াল অনুমোদনের জন্য কোনো ভিডিও অপেক্ষায় নেই।
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {currentList.map((item) => (
            <div
              key={item.id}
              className={`p-4 sm:p-5 rounded-xl border space-y-3 transition-colors ${
                activeTab === 'user_appeals'
                  ? 'border-amber-200 bg-amber-50/20'
                  : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
              }`}
            >
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-950">{item.campaignTitle}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-white border border-slate-200 text-slate-800 px-2 py-0.5 rounded">
                      {renderPlatformIcon(item.platform)}
                      <span>{item.platform.replace('_', ' ')}</span>
                    </span>

                    {item.status === 'appeal_pending' ? (
                      <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 border border-amber-200">
                        <RotateCcw className="w-3 h-3 text-amber-600 animate-spin" />
                        ক্রিয়েটর পুনঃনিরীক্ষণ আপিল
                      </span>
                    ) : item.status === 'high_value_pending' ? (
                      <span className="bg-purple-50 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded border border-purple-200 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-purple-600" />
                        হাই-ভ্যালু রিভিউ (&gt;২০k ভিউজ)
                      </span>
                    ) : (
                      <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-300 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        {fallbackBadgeText(item.aiFallbackReason)}
                      </span>
                    )}

                    {item.hasBrandLink && (
                      <span className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded font-bold flex items-center gap-1 border border-emerald-200">
                        <LinkIcon className="w-2.5 h-2.5" />
                        অফিশিয়াল লিংক যুক্ত
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2 flex-wrap">
                    <span>
                      ক্রিয়েটর: <strong className="text-slate-800">{item.userName}</strong> ({item.userEmail})
                    </span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 font-sans text-slate-700 font-semibold">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      জমা: {formatDateTimeBn(item.createdAt)}
                    </span>
                  </div>
                </div>

                <a
                  href={item.originalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-900 hover:text-emerald-700 bg-white hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-300 shrink-0 transition-colors cursor-pointer"
                >
                  <span>ভিডিওটি দেখুন</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {item.status === 'appeal_pending' && item.appealReason && (
                <div className="p-3 bg-white border border-amber-200 rounded-lg space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-950 flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                      ক্রিয়েটরের আপিল ব্যাখ্যা:
                    </span>
                    {item.appealSubmittedAt && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        {formatDateTimeBn(item.appealSubmittedAt)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-800 bg-amber-50/50 p-2 rounded font-medium">
                    "{item.appealReason}"
                  </p>
                </div>
              )}

              {/* Metrics & Manual Adjustment Inputs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-white p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-500 block">মোট ভিউজ (এডিটেবল):</span>
                  <input
                    type="number"
                    min={0}
                    placeholder={String(item.views || 0)}
                    value={viewsOverrides[item.id] ?? ''}
                    onChange={(e) => setViewsOverrides((p) => ({ ...p, [item.id]: e.target.value }))}
                    className="w-full mt-0.5 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">লাইক / রেশিও:</span>
                  <strong className="text-slate-900 font-mono block mt-1.5 tabular-nums">
                    {item.likes.toLocaleString()} ({((item.likeRatio || 0) * 100).toFixed(1)}%)
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">পেনাল্টি কর্তন:</span>
                  <strong
                    className={`font-mono block mt-1.5 ${
                      item.penaltyPercentage > 0 ? 'text-red-600' : 'text-emerald-600'
                    }`}
                  >
                    -{item.penaltyPercentage}%
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">পে-আউট ৳ (এডিটেবল):</span>
                  <input
                    type="number"
                    min={0}
                    placeholder={`৳${item.finalPayout || 0}`}
                    value={payoutOverrides[item.id] ?? ''}
                    onChange={(e) => setPayoutOverrides((p) => ({ ...p, [item.id]: e.target.value }))}
                    className="w-full mt-0.5 bg-emerald-50/60 border border-emerald-200 rounded px-2 py-1 text-xs font-mono font-bold text-emerald-950"
                  />
                </div>
              </div>

              {/* Notes & Scraped Comments */}
              <div className="text-xs bg-slate-100/70 p-3 rounded-lg border border-slate-200 text-slate-800 space-y-2">
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1">
                    <Bot className="w-3.5 h-3.5 text-slate-600" />
                    Gemini AI / পাইপলাইন বিবরণ:
                  </span>
                  <span className="font-mono tabular-nums">কনফিডেন্স: {item.geminiConfidence}%</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  {item.aiErrorDetail ||
                    item.reviewNotes ||
                    'ভিডিওটি ম্যানুয়ালি যাচাইয়ের জন্য অপেক্ষায় রয়েছে।'}
                </p>
                {item.sampleComments && item.sampleComments.length > 0 && (
                  <div className="pt-2 border-t border-slate-200/80 space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      সংগৃহীত কমেন্ট নমুনা ({item.sampleComments.length}):
                    </span>
                    <ul className="space-y-1">
                      {item.sampleComments.map((cmt, idx) => (
                        <li key={idx} className="text-[11px] text-slate-700 bg-white px-2.5 py-1 rounded border border-slate-200">
                          “{cmt}”
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {rejectingId === item.id ? (
                <div className="bg-red-50 p-3.5 rounded-lg border border-red-200 space-y-2">
                  <label className="text-xs font-bold text-red-900 block">বাতিল করার কারণ লিখুন:</label>
                  <input
                    type="text"
                    placeholder="যেমন: ভিডিওতে ক্যাম্পেইনের নির্ধারিত কথা বা লিংক পাওয়া যায়নি।"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full bg-white border border-red-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-hidden"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setRejectingId(null)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                    >
                      বাতিল
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(item, item.status === 'appeal_pending')}
                      disabled={processingId === item.id}
                      className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      {item.status === 'appeal_pending' ? 'Permanently Reject' : 'Confirm Reject'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
                  {item.status !== 'appeal_pending' && (
                    <button
                      type="button"
                      onClick={() => handleRequeueSingle(item)}
                      disabled={processingId === item.id}
                      className="px-3.5 py-2 text-xs font-bold text-slate-800 bg-white hover:bg-slate-100 rounded-lg transition-colors border border-slate-300 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${processingId === item.id ? 'animate-spin' : ''}`}
                      />
                      <span>আবার AI দিয়ে যাচাই করুন</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setRejectingId(item.id);
                      setRejectionReason('ক্যাম্পেইনের নির্ধারিত নিয়ম ও ডায়লগ সঠিকভাবে পূরণ করা হয়নি।');
                    }}
                    disabled={processingId === item.id}
                    className="px-3.5 py-2 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors border border-red-200 cursor-pointer"
                  >
                    {item.status === 'appeal_pending' ? 'Permanently Reject' : 'Reject'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApprove(item)}
                    disabled={processingId === item.id}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2 rounded-lg transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>
                      Approve (ওকে){' '}
                      {payoutOverrides[item.id]
                        ? `— Credit ৳${Number(payoutOverrides[item.id]).toLocaleString()}`
                        : item.finalPayout > 0
                          ? `— Credit ৳${item.finalPayout.toLocaleString()}`
                          : ''}
                    </span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

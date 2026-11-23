import React, { useState } from 'react';
import { Submission, FallbackReason } from '../types';
import { authFetch } from '../utils/authFetch';
import {
  ExternalLink,
  CheckCircle2,
  Clock,
  XCircle,
  ShieldCheck,
  Eye,
  ThumbsUp,
  MessageSquare,
  Bot,
  ChevronRight,
  Sparkles,
  Layers,
  Hourglass,
  Calendar,
  Send,
  Link as LinkIcon,
  RotateCcw,
  AlertTriangle,
  Check,
  RefreshCw,
} from 'lucide-react';
import { YouTubeIcon, FacebookIcon, InstagramIcon, TikTokIcon } from './BrandIcons';

interface SubmissionsTableProps {
  submissions: Submission[];
  isLoading: boolean;
  onRefresh: () => void;
  isAdminView?: boolean;
}

function formatSubmissionDateTime(isoString?: string): string {
  if (!isoString) return 'অজানা সময়';
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('bn-BD', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return isoString;
  }
}

function getFallbackReasonLabel(reason?: FallbackReason): string {
  switch (reason) {
    case 'api_limit_or_error':
      return 'AI API লিমিট / এরর';
    case 'metadata_fetch_unavailable':
      return 'লাইভ ভিউ/ক্যাপশন অটো-ফেচ হয়নি';
    case 'audio_unavailable_for_ai':
      return 'অডিও স্ট্রিম পাওয়া যায়নি';
    case 'high_value_20k':
      return 'হাই-ভ্যালু (>২০k ভিউ)';
    case 'noisy_audio':
      return 'অস্পষ্ট / নয়েজি অডিও';
    case 'low_confidence':
      return '৫০-৭৯% কনফিডেন্স';
    default:
      return 'ম্যানুয়ালি যাচাই প্রয়োজন';
  }
}

export const SubmissionsTable: React.FC<SubmissionsTableProps> = ({
  submissions,
  onRefresh,
  isAdminView = false,
}) => {
  const [activeFilter, setActiveFilter] = useState<
    'all' | 'in_queue' | 'manual_review' | 'approved' | 'rejected' | 'appeals'
  >('all');
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);

  // Appeal Modal State
  const [appealModalItem, setAppealModalItem] = useState<Submission | null>(null);
  const [appealReason, setAppealReason] = useState('');
  const [isSubmittingAppeal, setIsSubmittingAppeal] = useState(false);
  const [appealMessage, setAppealMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Admin Action States inside Table / Detail Drawer
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [isBulkRequeuing, setIsBulkRequeuing] = useState(false);
  const [actionBanner, setActionBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [customViewsInput, setCustomViewsInput] = useState<string>('');
  const [customPayoutInput, setCustomPayoutInput] = useState<string>('');

  const totalCount = submissions.length;
  const inQueueList = submissions.filter((s) =>
    isAdminView
      ? s.status === 'pending' || s.status === 'processing'
      : s.status === 'pending' ||
        s.status === 'processing' ||
        s.status === 'needs_manual_review' ||
        s.status === 'high_value_pending'
  );
  const manualReviewList = isAdminView
    ? submissions.filter((s) => s.status === 'needs_manual_review' || s.status === 'high_value_pending')
    : [];
  const approvedList = submissions.filter((s) => s.status === 'approved');
  const rejectedList = submissions.filter(
    (s) => s.status === 'rejected' || s.status === 'permanently_rejected'
  );
  const appealsList = submissions.filter((s) => s.status === 'appeal_pending');

  let filtered = submissions;
  if (activeFilter === 'in_queue') filtered = inQueueList;
  else if (activeFilter === 'manual_review' && isAdminView) filtered = manualReviewList;
  else if (activeFilter === 'approved') filtered = approvedList;
  else if (activeFilter === 'rejected') filtered = rejectedList;
  else if (activeFilter === 'appeals') filtered = appealsList;

  const handleOpenDetail = (item: Submission) => {
    setSelectedSubmission(item);
    setCustomViewsInput(item.views > 0 ? String(item.views) : '');
    setCustomPayoutInput(item.finalPayout > 0 ? String(item.finalPayout) : '');
  };

  const handleOpenAppealModal = (item: Submission, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setAppealModalItem(item);
    setAppealReason('');
    setAppealMessage(null);
  };

  const handleSubmitAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appealModalItem) return;
    if (!appealReason.trim()) {
      setAppealMessage({ type: 'error', text: 'অনুগ্রহ করে আপিল করার বিস্তারিত কারণ লিখুন।' });
      return;
    }

    setIsSubmittingAppeal(true);
    setAppealMessage(null);

    try {
      const res = await authFetch(`/api/submissions/${appealModalItem.id}/appeal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appealReason: appealReason.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAppealMessage({ type: 'success', text: data.message || 'আপিল সফলভাবে জমা হয়েছে!' });
        setTimeout(() => {
          setAppealModalItem(null);
          onRefresh();
        }, 1200);
      } else {
        setAppealMessage({ type: 'error', text: data.error || 'আপিল জমা দেওয়া সম্ভব হয়নি।' });
      }
    } catch {
      setAppealMessage({ type: 'error', text: 'সার্ভারের সাথে যোগাযোগ করা যায়নি। পুনরায় চেষ্টা করুন।' });
    } finally {
      setIsSubmittingAppeal(false);
    }
  };

  const handleRequeueSingle = async (item: Submission, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActionLoadingId(item.id);
    setActionBanner(null);
    try {
      const res = await authFetch(`/api/submissions/${item.id}/requeue`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionBanner({ type: 'success', text: data.message });
        if (selectedSubmission?.id === item.id) setSelectedSubmission(null);
        onRefresh();
      } else {
        setActionBanner({ type: 'error', text: data.error || 'পুনরায় AI কিউতে পাঠানো যায়নি।' });
      }
    } catch {
      setActionBanner({ type: 'error', text: 'সার্ভার সংযোগ ব্যর্থ হয়েছে।' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRequeueAll = async () => {
    setIsBulkRequeuing(true);
    setActionBanner(null);
    try {
      const res = await authFetch('/api/submissions/requeue-all', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionBanner({ type: 'success', text: data.message });
        onRefresh();
      } else {
        setActionBanner({ type: 'error', text: data.error || 'সবগুলো AI কিউতে পাঠানো ব্যর্থ হয়েছে।' });
      }
    } catch {
      setActionBanner({ type: 'error', text: 'সার্ভার সংযোগ ব্যর্থ হয়েছে।' });
    } finally {
      setIsBulkRequeuing(false);
    }
  };

  const handleAdminQuickApprove = async (
    item: Submission,
    options?: { views?: number; payout?: number },
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();
    setActionLoadingId(item.id);
    setActionBanner(null);
    try {
      const res = await authFetch(`/api/submissions/${item.id}/manual-approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overrideViews: options?.views,
          overridePayout: options?.payout,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionBanner({ type: 'success', text: data.message });
        if (selectedSubmission?.id === item.id) setSelectedSubmission(null);
        onRefresh();
      } else {
        setActionBanner({ type: 'error', text: data.error || 'অনুমোদন ব্যর্থ হয়েছে।' });
      }
    } catch {
      setActionBanner({ type: 'error', text: 'সার্ভার সংযোগ ব্যর্থ হয়েছে।' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAdminQuickReject = async (item: Submission, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActionLoadingId(item.id);
    setActionBanner(null);
    try {
      const res = await authFetch(`/api/submissions/${item.id}/manual-reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'অ্যাডমিন ম্যানুয়ালি যাচাই করে ক্যাম্পেইন শর্তাবলী পূরণ না হওয়ায় বাতিল করেছেন।',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionBanner({ type: 'success', text: 'সাবমিশনটি রিজেক্ট করা হয়েছে।' });
        if (selectedSubmission?.id === item.id) setSelectedSubmission(null);
        onRefresh();
      } else {
        setActionBanner({ type: 'error', text: data.error || 'বাতিল করা যায়নি।' });
      }
    } catch {
      setActionBanner({ type: 'error', text: 'সার্ভার সংযোগ ব্যর্থ হয়েছে।' });
    } finally {
      setActionLoadingId(null);
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

  const getStatusBadge = (item: Submission) => {
    const { status, queuePosition, aiFallbackReason } = item;

    if (!isAdminView) {
      switch (status) {
        case 'approved':
          return (
            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 text-[11px] font-bold px-2.5 py-0.5 rounded border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              অ্যাপ্রুভড (টাকা যোগ হয়েছে)
            </span>
          );
        case 'appeal_pending':
          return (
            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 text-[11px] font-bold px-2.5 py-0.5 rounded border border-amber-300">
              <RotateCcw className="w-3.5 h-3.5 text-amber-600 animate-spin" />
              আপিল প্রক্রিয়াধীন
            </span>
          );
        case 'permanently_rejected':
          return (
            <span className="inline-flex items-center gap-1 bg-slate-200 text-slate-700 text-[11px] font-bold px-2.5 py-0.5 rounded">
              <XCircle className="w-3.5 h-3.5 text-slate-500" />
              স্থায়ীভাবে বাতিল
            </span>
          );
        case 'rejected':
          return (
            <span className="inline-flex items-center gap-1 bg-red-50 text-red-800 text-[11px] font-bold px-2.5 py-0.5 rounded border border-red-200">
              <XCircle className="w-3.5 h-3.5 text-red-600" />
              রিজেক্টেড
            </span>
          );
        case 'pending':
        case 'processing':
        case 'needs_manual_review':
        case 'high_value_pending':
        default:
          return (
            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 text-[11px] font-bold px-2.5 py-0.5 rounded border border-blue-200">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              রিভিউতে রয়েছে
            </span>
          );
      }
    }

    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 text-[11px] font-bold px-2.5 py-0.5 rounded border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            অ্যাপ্রুভড (টাকা যোগ হয়েছে)
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 text-[11px] font-bold px-2.5 py-0.5 rounded border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
            Processing (এআই অডিট চলছে)
          </span>
        );
      case 'needs_manual_review':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 text-[11px] font-bold px-2.5 py-0.5 rounded border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            ম্যানুয়ালি যাচাই ({getFallbackReasonLabel(aiFallbackReason)})
          </span>
        );
      case 'high_value_pending':
        return (
          <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-800 text-[11px] font-bold px-2.5 py-0.5 rounded border border-purple-200">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
            ম্যানুয়ালি যাচাই (হাই-ভ্যালু &gt;২০k)
          </span>
        );
      case 'appeal_pending':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 text-[11px] font-bold px-2.5 py-0.5 rounded border border-amber-300">
            <RotateCcw className="w-3.5 h-3.5 text-amber-600 animate-spin" />
            আপিল প্রক্রিয়াধীন
          </span>
        );
      case 'permanently_rejected':
        return (
          <span className="inline-flex items-center gap-1 bg-slate-200 text-slate-700 text-[11px] font-bold px-2.5 py-0.5 rounded">
            <XCircle className="w-3.5 h-3.5 text-slate-500" />
            স্থায়ীভাবে বাতিল
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 bg-red-50 text-red-800 text-[11px] font-bold px-2.5 py-0.5 rounded border border-red-200">
            <XCircle className="w-3.5 h-3.5 text-red-600" />
            রিজেক্টেড
          </span>
        );
      case 'pending':
      default:
        if (queuePosition !== undefined && queuePosition > 0) {
          return (
            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 text-[11px] font-bold px-2.5 py-0.5 rounded border border-slate-200">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              AI কিউ #{queuePosition} (অপেক্ষমান)
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-[11px] font-bold px-2.5 py-0.5 rounded border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            AI রিভিউ কিউতে রয়েছে
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Counter Summary Cards */}
      <div className={`grid grid-cols-2 ${isAdminView ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-3`}>
        <div
          onClick={() => setActiveFilter('all')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            activeFilter === 'all'
              ? 'bg-white border-emerald-700 shadow-xs ring-1 ring-emerald-700'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">মোট সাবমিট</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-950 mt-1 tabular-nums">{totalCount}</div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">সর্বমোট জমাকৃত লিংক</span>
        </div>

        <div
          onClick={() => setActiveFilter('in_queue')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            activeFilter === 'in_queue'
              ? 'bg-white border-blue-600 shadow-xs ring-1 ring-blue-600'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">রিভিউতে রয়েছে</span>
            <Hourglass className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-extrabold text-blue-800 mt-1 tabular-nums">{inQueueList.length}</div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">যাচাই প্রক্রিয়াধীন</span>
        </div>

        {isAdminView && (
          <div
            onClick={() => setActiveFilter('manual_review')}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              activeFilter === 'manual_review'
                ? 'bg-white border-amber-600 shadow-xs ring-1 ring-amber-600'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">ম্যানুয়ালি যাচাই</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-extrabold text-amber-800 mt-1 tabular-nums">
              {manualReviewList.length}
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">API এরর / ম্যানুয়াল রিভিউ</span>
          </div>
        )}

        <div
          onClick={() => setActiveFilter('approved')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            activeFilter === 'approved'
              ? 'bg-white border-emerald-600 shadow-xs ring-1 ring-emerald-600'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">অনুমোদিত</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-1 tabular-nums">{approvedList.length}</div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">ওয়ালেটে টাকা যোগ হয়েছে</span>
        </div>

        <div
          onClick={() => setActiveFilter('rejected')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            isAdminView ? 'col-span-2 lg:col-span-1' : ''
          } ${
            activeFilter === 'rejected'
              ? 'bg-white border-red-600 shadow-xs ring-1 ring-red-600'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-red-700 uppercase tracking-wider">বাতিল / আপিল</span>
            <XCircle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-extrabold text-red-700 mt-1 tabular-nums">{rejectedList.length}</div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">আপিল করার সুযোগ রয়েছে</span>
        </div>
      </div>

      {actionBanner && (
        <div
          className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between gap-2 border ${
            actionBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <span>{actionBanner.text}</span>
          <button
            type="button"
            onClick={() => setActionBanner(null)}
            className="text-xs px-2 py-0.5 rounded hover:bg-black/5 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Ledger Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Top Header with Filter Buttons */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-950 text-base">
              {isAdminView ? 'সকল জমাকৃত ভিডিওর তালিকা ও স্ট্যাটাস (Admin Ledger)' : 'আপনার জমাকৃত ভিডিওর তালিকা ও স্ট্যাটাস'}
            </h3>
            <p className="text-xs text-slate-500">
              {isAdminView
                ? 'সাবমিশনের তারিখ ও সময়, লাইভ ভিউজ, এনগেজমেন্ট এবং ম্যানুয়াল/AI যাচাই অবস্থা'
                : 'আপনার জমাকৃত ভিডিওর তারিখ, ভিউজ ও পেমেন্ট স্ট্যাটাস'}
            </p>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 flex-wrap">
            <button
              onClick={() => setActiveFilter('all')}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer border whitespace-nowrap ${
                activeFilter === 'all'
                  ? 'bg-emerald-500/15 text-emerald-950 border-emerald-500/40 shadow-xs backdrop-blur-xs'
                  : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200/80 border-transparent'
              }`}
            >
              সবগুলো ({totalCount})
            </button>
            <button
              onClick={() => setActiveFilter('in_queue')}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer border whitespace-nowrap ${
                activeFilter === 'in_queue'
                  ? 'bg-emerald-500/15 text-emerald-950 border-emerald-500/40 shadow-xs backdrop-blur-xs'
                  : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200/80 border-transparent'
              }`}
            >
              রিভিউতে ({inQueueList.length})
            </button>
            {isAdminView && (
              <button
                onClick={() => setActiveFilter('manual_review')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer border whitespace-nowrap flex items-center gap-1 ${
                  activeFilter === 'manual_review'
                    ? 'bg-amber-500/15 text-amber-950 border-amber-500/50 shadow-xs backdrop-blur-xs'
                    : 'bg-amber-50/90 text-amber-800 hover:bg-amber-100/80 border-amber-200/70'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>ম্যানুয়ালি যাচাই ({manualReviewList.length})</span>
              </button>
            )}
            <button
              onClick={() => setActiveFilter('approved')}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer border whitespace-nowrap ${
                activeFilter === 'approved'
                  ? 'bg-emerald-500/15 text-emerald-950 border-emerald-500/40 shadow-xs backdrop-blur-xs'
                  : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200/80 border-transparent'
              }`}
            >
              অ্যাপ্রুভড ({approvedList.length})
            </button>
            <button
              onClick={() => setActiveFilter('rejected')}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer border whitespace-nowrap ${
                activeFilter === 'rejected'
                  ? 'bg-emerald-500/15 text-emerald-950 border-emerald-500/40 shadow-xs backdrop-blur-xs'
                  : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200/80 border-transparent'
              }`}
            >
              রিজেক্টেড ({rejectedList.length})
            </button>
            {appealsList.length > 0 && (
              <button
                onClick={() => setActiveFilter('appeals')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer border whitespace-nowrap ${
                  activeFilter === 'appeals'
                    ? 'bg-emerald-500/15 text-emerald-950 border-emerald-500/40 shadow-xs backdrop-blur-xs'
                    : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200/80 border-transparent'
                }`}
              >
                আপিল ({appealsList.length})
              </button>
            )}
          </div>
        </div>

        {/* Admin Bulk Re-Queue Bar inside "ম্যানুয়ালি যাচাই" */}
        {isAdminView && activeFilter === 'manual_review' && manualReviewList.length > 0 && (
          <div className="p-4 bg-amber-50/70 border-b border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-amber-950 space-y-0.5">
              <strong className="font-bold flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-amber-700" />
                API লিমিট / অটো-ফেচ ব্যর্থ হওয়া ভিডিওগুলো এখানে সুরক্ষিত রয়েছে
              </strong>
              <p className="text-amber-800">
                আপনি নিজে প্রতিটি ভিডিও দেখে <strong>Approve (ওকে)</strong> করতে পারেন, অথবা API ঠিক হলে সবগুলো একসাথে আবার AI কিউতে পাঠাতে পারেন।
              </p>
            </div>
            <button
              type="button"
              onClick={handleRequeueAll}
              disabled={isBulkRequeuing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-xs transition-colors flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isBulkRequeuing ? 'animate-spin' : ''}`} />
              <span>
                {isBulkRequeuing
                  ? 'AI কিউতে পাঠানো হচ্ছে...'
                  : `সবগুলো একসাথে AI যাচাইয়ে পাঠান (${manualReviewList.length})`}
              </span>
            </button>
          </div>
        )}

        {/* Video Items */}
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Bot className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">এই ক্যাটাগরিতে কোনো ভিডিও নেই।</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeFilter === 'manual_review'
                ? 'API সমস্যা বা অসম্পূর্ণ ডেটার কারণে আটকে থাকা কোনো ভিডিও বর্তমানে নেই।'
                : 'উপরের যেকোনো ক্যাম্পেইনে ক্লিক করে গাইডলাইন দেখে ভিডিও লিংক জমা দিন।'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((item) => {
              const isManualItem =
                item.status === 'needs_manual_review' || item.status === 'high_value_pending';

              return (
                <div
                  key={item.id}
                  onClick={() => handleOpenDetail(item)}
                  className="p-4 sm:p-5 hover:bg-slate-50 transition-colors cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Left: Info & Platform */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-50 text-slate-800 border border-slate-200">
                        {renderPlatformIcon(item.platform)}
                        <span>{item.platform.replace('_', ' ')}</span>
                      </span>
                      {getStatusBadge(item)}

                      {/* Exact Submission Date & Time */}
                      <span
                        className="text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80 flex items-center gap-1 font-medium"
                        title={`সাবমিটের সময়: ${item.createdAt}`}
                      >
                        <Calendar className="w-3 h-3 text-slate-500" />
                        <span>জমা: {formatSubmissionDateTime(item.createdAt)}</span>
                      </span>

                      {item.hasBrandLink && (
                        <span className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded font-bold flex items-center gap-1 border border-emerald-200">
                          <LinkIcon className="w-2.5 h-2.5" />
                          অফিশিয়াল লিংক যুক্ত
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-900 truncate">
                      <span className="truncate">{item.campaignTitle}</span>
                      {isAdminView && (
                        <span className="text-[11px] font-medium text-slate-500 shrink-0">
                          • {item.userName} ({item.userEmail})
                        </span>
                      )}
                      <a
                        href={item.originalUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-slate-400 hover:text-emerald-700 p-0.5 shrink-0"
                        title="ভিডিও লিংক দেখুন"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    {isAdminView && item.aiErrorDetail && isManualItem && (
                      <p className="text-[11px] text-amber-800 bg-amber-50/70 px-2.5 py-1 rounded border border-amber-200/70 line-clamp-1">
                        কারণ: {item.aiErrorDetail}
                      </p>
                    )}

                    {/* Public metrics */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-mono">
                      <span className="flex items-center gap-1 font-semibold text-slate-700 tabular-nums">
                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                        {item.views.toLocaleString()} ভিউজ
                        {isAdminView && item.hasLiveMetrics === false && (
                          <span className="text-[10px] text-amber-700 font-sans">(অটো-ফেচ হয়নি)</span>
                        )}
                      </span>
                      <span className="flex items-center gap-1 tabular-nums">
                        <ThumbsUp className="w-3.5 h-3.5 text-slate-400" />
                        {item.likes.toLocaleString()} লাইক
                      </span>
                      <span className="flex items-center gap-1 tabular-nums">
                        <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                        {item.comments.toLocaleString()} কমেন্ট
                      </span>
                    </div>
                  </div>

                  {/* Right: AI, Payout & Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
                    {isAdminView && (
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                          Gemini AI
                        </span>
                        <div className="flex items-center gap-1 font-mono text-xs font-bold text-slate-800 tabular-nums justify-end">
                          <Sparkles className="w-3 h-3 text-slate-500" />
                          <span>{item.geminiConfidence || 0}% স্কোর</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium block">
                          {item.brandMentioned ? '✓ কিওয়ার্ড সনাক্ত' : 'যাচাই অবস্থা'}
                        </span>
                      </div>
                    )}

                    <div className="text-right min-w-[85px]">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                        {item.status === 'approved' ? 'অর্জিত আয়' : 'সম্ভাব্য আয়'}
                      </span>
                      <div className="text-base sm:text-lg font-bold text-slate-950 tabular-nums">
                        ৳{item.finalPayout.toLocaleString()}
                      </div>
                      {item.penaltyPercentage > 0 && (
                        <span className="text-[10px] font-bold text-red-600 block">
                          -{item.penaltyPercentage}% পেনাল্টি
                        </span>
                      )}
                    </div>

                    {/* Admin inline controls for Manual Review items */}
                    {isAdminView && isManualItem && (
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => handleRequeueSingle(item, e)}
                          disabled={actionLoadingId === item.id}
                          title="আবার AI দিয়ে যাচাই করুন"
                          className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-300 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw
                            className={`w-3 h-3 ${actionLoadingId === item.id ? 'animate-spin' : ''}`}
                          />
                          <span>আবার AI</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleAdminQuickApprove(item, undefined, e)}
                          disabled={actionLoadingId === item.id}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleAdminQuickReject(item, e)}
                          disabled={actionLoadingId === item.id}
                          className="bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-red-200 cursor-pointer disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}

                    {/* Creator Appeal button for rejected items */}
                    {!isAdminView && item.status === 'rejected' && (
                      <button
                        type="button"
                        onClick={(e) => handleOpenAppealModal(item, e)}
                        className="bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-xs transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>আপিল করুন</span>
                      </button>
                    )}

                    <ChevronRight className="w-4 h-4 text-slate-400 hidden sm:block" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Audit Drawer Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  ভিডিও ভেরিফিকেশন ও অডিট রিপোর্ট
                </span>
                <h3 className="text-base font-bold text-slate-950 mt-0.5 font-mono">
                  আইডি: {selectedSubmission.id}
                </h3>
                <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                  <Calendar className="w-3 h-3" />
                  জমাদানের তারিখ ও সময়: <strong>{formatSubmissionDateTime(selectedSubmission.createdAt)}</strong>
                </span>
              </div>
              <button
                onClick={() => setSelectedSubmission(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 rounded hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl flex items-center justify-between border border-slate-200 gap-2">
              <div>
                <span className="text-xs text-slate-500 block">বর্তমান স্ট্যাটাস:</span>
                <div className="mt-0.5">{getStatusBadge(selectedSubmission)}</div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs text-slate-500 block">নির্ধারিত রিওয়ার্ড:</span>
                <span className="text-xl font-bold text-slate-950 tabular-nums">
                  ৳{selectedSubmission.finalPayout.toLocaleString()}
                </span>
              </div>
            </div>

            {isAdminView && selectedSubmission.aiErrorDetail && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 space-y-1">
                <strong className="block font-bold">ম্যানুয়াল রিভিউ কারণ:</strong>
                <p>{selectedSubmission.aiErrorDetail}</p>
              </div>
            )}

            {selectedSubmission.rejectionReason && (
              <div className="p-3.5 bg-red-50 border border-red-200 text-red-900 rounded-xl text-xs space-y-1">
                <strong className="block font-bold">বাতিল হওয়ার কারণ:</strong>
                <p>{selectedSubmission.rejectionReason}</p>
                {!isAdminView && selectedSubmission.status === 'rejected' && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const s = selectedSubmission;
                        setSelectedSubmission(null);
                        handleOpenAppealModal(s);
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>পুনঃনিরীক্ষণ আপিল করুন (Request Re-check)</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {selectedSubmission.appealReason && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-1">
                <strong className="block font-bold flex items-center gap-1">
                  <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                  আপিল বিবরণ:
                </strong>
                <p className="italic bg-white p-2 rounded border border-amber-200/60 font-medium">
                  "{selectedSubmission.appealReason}"
                </p>
                {selectedSubmission.appealSubmittedAt && (
                  <span className="text-[10px] text-amber-700 block font-mono">
                    আপিলের সময়: {formatSubmissionDateTime(selectedSubmission.appealSubmittedAt)}
                  </span>
                )}
              </div>
            )}

            {/* Engagement & Fetched Details */}
            <div className="space-y-1.5 text-xs text-slate-700">
              <span className="font-bold text-slate-900 block">এনগেজমেন্ট ও অডিট বিবরণ:</span>
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono text-[11px]">
                <div>
                  ভিউ সংখ্যা: <strong className="tabular-nums">{selectedSubmission.views.toLocaleString()}</strong>
                </div>
                <div>
                  লাইক রেশিও:{' '}
                  <strong className="tabular-nums">{((selectedSubmission.likeRatio || 0) * 100).toFixed(1)}%</strong>
                </div>
                <div>
                  কমেন্ট: <strong className="tabular-nums">{selectedSubmission.comments.toLocaleString()}</strong>
                </div>
                <div>
                  পেনাল্টি কর্তন:{' '}
                  <strong className={selectedSubmission.penaltyPercentage > 0 ? 'text-red-600' : 'text-emerald-600'}>
                    {selectedSubmission.penaltyPercentage}%
                  </strong>
                </div>
              </div>
            </div>

            {/* Gemini AI Voice Report & Scraped Comments (Admin Only) */}
            {isAdminView && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span className="flex items-center gap-1.5">
                    <Bot className="w-4 h-4 text-slate-600" />
                    Gemini AI অডিও ও স্ক্রিপ্ট অ্যানালাইসিস
                  </span>
                  <span className="font-mono tabular-nums">{selectedSubmission.geminiConfidence}% কনফিডেন্স</span>
                </div>
                <div className="text-slate-700 text-[11px] space-y-1">
                  <div>
                    ব্র্যান্ড / ডায়লগ যাচাই:{' '}
                    <strong>{selectedSubmission.brandMentioned ? 'হ্যাঁ (সনাক্ত হয়েছে)' : 'সনাক্ত হয়নি / পেন্ডিং'}</strong>
                  </div>
                  {selectedSubmission.mentionTimestamp && (
                    <div>
                      নির্ধারিত সময়: <strong className="font-mono">{selectedSubmission.mentionTimestamp}</strong>
                    </div>
                  )}
                  {selectedSubmission.reviewNotes && (
                    <p className="pt-1 text-slate-600 italic border-t border-slate-200">
                      "{selectedSubmission.reviewNotes}"
                    </p>
                  )}
                  {selectedSubmission.sampleComments && selectedSubmission.sampleComments.length > 0 && (
                    <div className="pt-2 border-t border-slate-200 space-y-1">
                      <span className="font-bold text-slate-700 block">
                        ভিডিওর কমেন্ট নমুনা ({selectedSubmission.sampleComments.length}):
                      </span>
                      <ul className="space-y-1">
                        {selectedSubmission.sampleComments.map((cmt, idx) => (
                          <li key={idx} className="bg-white px-2.5 py-1 rounded border border-slate-200 text-slate-700">
                            “{cmt}”
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Admin Manual Override & Re-queue Tools inside Modal */}
            {isAdminView &&
              (selectedSubmission.status === 'needs_manual_review' ||
                selectedSubmission.status === 'high_value_pending' ||
                selectedSubmission.status === 'appeal_pending') && (
                <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-3">
                  <span className="text-xs font-bold text-emerald-950 block">
                    অ্যাডমিন ম্যানুয়াল ভেরিফিকেশন ও পে-আউট নিয়ন্ত্রণ:
                  </span>
                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        ভিউ সংখ্যা (ঐচ্ছিক):
                      </label>
                      <input
                        type="number"
                        min={0}
                        placeholder="যেমন: 5000"
                        value={customViewsInput}
                        onChange={(e) => setCustomViewsInput(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                        পে-আউট ৳ (ঐচ্ছিক):
                      </label>
                      <input
                        type="number"
                        min={0}
                        placeholder="স্বয়ংক্রিয় CPM"
                        value={customPayoutInput}
                        onChange={(e) => setCustomPayoutInput(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleRequeueSingle(selectedSubmission)}
                      disabled={actionLoadingId === selectedSubmission.id}
                      className="bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>আবার AI দিয়ে যাচাই</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdminQuickReject(selectedSubmission)}
                      disabled={actionLoadingId === selectedSubmission.id}
                      className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold px-3 py-2 rounded-lg cursor-pointer"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleAdminQuickApprove(selectedSubmission, {
                          views: customViewsInput ? Number(customViewsInput) : undefined,
                          payout: customPayoutInput ? Number(customPayoutInput) : undefined,
                        })
                      }
                      disabled={actionLoadingId === selectedSubmission.id}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Approve (ওকে)</span>
                    </button>
                  </div>
                </div>
              )}

            <div className="pt-1">
              <a
                href={selectedSubmission.originalUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 rounded-lg transition-colors shadow-xs"
              >
                <ExternalLink className="w-4 h-4" />
                <span>ভিডিওটি সরাসরি দেখুন</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Appeal "Request Re-check" Modal */}
      {appealModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <RotateCcw className="w-3.5 h-3.5" />
                  পুনঃনিরীক্ষণ আপিল (Request Re-check)
                </span>
                <h3 className="text-base font-bold text-slate-950 mt-0.5">{appealModalItem.campaignTitle}</h3>
              </div>
              <button
                onClick={() => setAppealModalItem(null)}
                disabled={isSubmittingAppeal}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 rounded hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {appealMessage && (
              <div
                className={`p-3 rounded-lg text-xs font-bold ${
                  appealMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {appealMessage.text}
              </div>
            )}

            <form onSubmit={handleSubmitAppeal} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 block">
                  ভিডিওতে কোথায় রুলস অনুসরণ করা হয়েছে তা উল্লেখ করুন:
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="যেমন: ভিডিওর ১২ সেকেন্ডে নির্ধারিত ডায়লগ বলা হয়েছে এবং ক্যাপশনে অফিশিয়াল লিংক রয়েছে। অনুগ্রহ করে ম্যানুয়ালি রিভিউ করুন।"
                  value={appealReason}
                  onChange={(e) => setAppealReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 rounded-lg p-3 text-xs text-slate-900 focus:outline-hidden resize-none leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setAppealModalItem(null)}
                  disabled={isSubmittingAppeal}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAppeal || !appealReason.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2.5 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingAppeal ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                      <span>জমা হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>আপিল জমা দিন</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

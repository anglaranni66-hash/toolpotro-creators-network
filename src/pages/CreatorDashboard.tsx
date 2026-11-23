import React, { useState, useEffect } from 'react';
import { Campaign, Submission } from '../types';
import { useAuth } from '../context/AuthContext';
import { WalletCard } from '../components/WalletCard';
import { CampaignCard } from '../components/CampaignCard';
import { CampaignDetailPage } from './CampaignDetailPage';
import { SubmissionsTable } from '../components/SubmissionsTable';
import { authFetch } from '../utils/authFetch';
import { Sparkles, RefreshCw, CheckCircle, Flame, Wallet, ChevronDown, LogIn } from 'lucide-react';

interface CreatorDashboardProps {
  campaigns: Campaign[];
}

export const CreatorDashboard: React.FC<CreatorDashboardProps> = ({ campaigns }) => {
  const { currentUser, loginWithGoogle, refreshWallet, hydrationVersion } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCampaignForModal, setSelectedCampaignForModal] = useState<Campaign | null>(null);
  const [showWallet, setShowWallet] = useState(false);

  const fetchSubmissions = async () => {
    if (!currentUser) {
      setSubmissions([]);
      return;
    }
    setIsLoading(true);
    try {
      const res = await authFetch('/api/submissions');
      if (res.ok) {
        const data: Submission[] = await res.json();
        setSubmissions(data);
        if (data.some((s) => s.status === 'pending' || s.status === 'processing')) {
          void authFetch('/api/worker/tick', { method: 'POST' }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('Failed to load submissions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
    if (!currentUser) return;
    const interval = setInterval(fetchSubmissions, 6000);
    return () => clearInterval(interval);
  }, [hydrationVersion, currentUser?.uid]);

  // Filter only active campaigns for creators
  const activeCampaigns = campaigns.filter(c => c.isActive !== false && c.status !== 'paused');

  // If a campaign is selected by user, show the dedicated full-page view
  if (selectedCampaignForModal) {
    return (
      <CampaignDetailPage
        campaign={selectedCampaignForModal}
        onBack={() => setSelectedCampaignForModal(null)}
        onSubmissionSuccess={() => {
          fetchSubmissions();
          refreshWallet();
        }}
      />
    );
  }

  return (
    <div className="space-y-8">
      
      {/* 1. Header Banner & Quick Refresh (Toolpotro Emerald Glass Style) */}
      <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-emerald-900 text-white p-6 sm:p-7 rounded-2xl border border-emerald-700/40 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative overflow-hidden backdrop-blur-md">
        <div className="absolute -right-8 -bottom-8 w-56 h-56 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="space-y-2 max-w-3xl relative z-10">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-900/80 backdrop-blur-md text-emerald-200 text-[11px] font-bold px-2.5 py-0.5 rounded border border-emerald-600/40 inline-flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>টুলপত্র ক্রিয়েটর নেটওয়ার্ক</span>
            </span>
            <span className="text-emerald-200/70 text-xs font-mono hidden md:inline">
              creators.toolpotro.com
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            কি নিয়ে ভিডিও বানাবেন? নিচের ক্যাম্পেইনগুলো বেছে নিন!
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100/90 font-normal leading-relaxed">
            যেকোনো ক্যাম্পেইনের কার্ডে ক্লিক করে ভিডিও বানানোর ডেসক্রিপশন, ডায়লগ ও ট্যাগ দেখুন। ভিডিও বানিয়ে লিংক সাবমিট করলেই ২৪ ঘণ্টার মধ্যে রিভিউ হয়ে ওয়ালেটে টাকা যোগ হবে।
          </p>
        </div>

        {/* Actions: Refresh and Toggle Wallet */}
        <div className="flex flex-col sm:items-end gap-2.5 shrink-0 relative z-10 w-full sm:w-auto">
          <button
            onClick={() => {
              fetchSubmissions();
              refreshWallet();
            }}
            disabled={isLoading}
            className="w-full sm:w-44 flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-950 bg-white hover:bg-emerald-50 px-4 py-2.5 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-700' : ''}`} />
            <span>রিফ্রেশ</span>
          </button>

          {currentUser ? (
            <button
              type="button"
              onClick={() => setShowWallet(prev => !prev)}
              className={`w-full sm:w-44 flex items-center justify-center gap-2 text-xs font-bold px-4 py-2.5 rounded-lg shadow-xs transition-all cursor-pointer border ${
                showWallet
                  ? 'bg-emerald-500/25 text-white border-emerald-400/60 backdrop-blur-md ring-1 ring-emerald-400/40'
                  : 'bg-emerald-900/80 hover:bg-emerald-800 text-emerald-100 border-emerald-700/60 hover:border-emerald-500/60 backdrop-blur-md'
              }`}
            >
              <Wallet className="w-3.5 h-3.5 text-emerald-300" />
              <span>{showWallet ? 'ওয়ালেট বন্ধ করুন' : 'ওয়ালেট ও ব্যালেন্স'}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-emerald-300 transition-transform duration-200 ${showWallet ? 'rotate-180' : ''}`} />
            </button>
          ) : (
            <button
              type="button"
              onClick={loginWithGoogle}
              className="w-full sm:w-44 flex items-center justify-center gap-2 text-xs font-bold px-4 py-2.5 rounded-lg shadow-xs transition-all cursor-pointer bg-emerald-500 hover:bg-emerald-400 text-emerald-950"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Google লগইন করুন</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Wallet & Balance Overview (Collapsible - Hidden by Default) */}
      {currentUser && showWallet && (
        <div className="transition-all duration-300 ease-in-out">
          <WalletCard onClose={() => setShowWallet(false)} />
        </div>
      )}

      {/* 3. Primary Feature: Campaign Showcase Feed */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-950 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>চলমান ক্যাম্পেইন সমূহ ({activeCampaigns.length})</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ক্যাম্পেইনে ক্লিক করলেই ভিডিও তৈরির স্ক্রিপ্ট গাইডলাইন এবং লিংক সাবমিট করার ফর্ম দেখতে পাবেন
            </p>
          </div>

          <div className="text-xs text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 self-start sm:self-auto border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>সাপোর্ট: YouTube, Facebook, TikTok, Instagram</span>
          </div>
        </div>

        {/* Campaign Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {activeCampaigns.map((camp) => (
            <CampaignCard
              key={camp.id}
              campaign={camp}
              onSelect={(selected) => setSelectedCampaignForModal(selected)}
            />
          ))}
        </div>
      </section>

      {/* 4. Creator's Submission Tracking & Status Ledger */}
      <section className="space-y-4 pt-6 border-t border-slate-200">
        {currentUser ? (
          <SubmissionsTable
            submissions={submissions}
            isLoading={isLoading}
            isAdminView={false}
            onRefresh={() => {
              fetchSubmissions();
              refreshWallet();
            }}
          />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3 shadow-xs">
            <h3 className="text-base font-bold text-slate-950">
              আপনার জমাকৃত ভিডিওর স্ট্যাটাস ও আয় দেখতে লগইন করুন
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Google অ্যাকাউন্ট দিয়ে সাইন-ইন করলে আপনার নিজস্ব জমাকৃত ভিডিও, পেমেন্ট স্ট্যাটাস এবং বিকাশ/নগদ ওয়ালেট সম্পূর্ণ গোপনীয়তার সাথে দেখতে পাবেন।
            </p>
            <div>
              <button
                type="button"
                onClick={loginWithGoogle}
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2.5 rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Google দিয়ে লগইন করুন</span>
              </button>
            </div>
          </div>
        )}
      </section>

    </div>
  );
};

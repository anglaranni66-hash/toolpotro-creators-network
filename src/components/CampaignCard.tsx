import React from 'react';
import { Campaign } from '../types';
import { Clock, Eye, Sparkles, ArrowRight, Video } from 'lucide-react';
import { YouTubeIcon, FacebookIcon, InstagramIcon, TikTokIcon } from './BrandIcons';

interface CampaignCardProps {
  campaign: Campaign;
  onSelect: (campaign: Campaign) => void;
}

export const CampaignCard: React.FC<CampaignCardProps> = ({ campaign, onSelect }) => {
  return (
    <div
      onClick={() => onSelect(campaign)}
      className="group relative bg-white rounded-xl border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden"
    >
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        
        {/* Top Header: Category & Countdown */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 uppercase tracking-wider">
              {campaign.category || 'ক্যাম্পেইন'}
            </span>

            {/* Countdown / Days remaining */}
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 tabular-nums">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{campaign.daysRemaining !== undefined ? `আর ${campaign.daysRemaining} দিন বাকি` : 'চলমান'}</span>
            </span>
          </div>

          {/* Campaign Title */}
          <h3 className="text-base sm:text-lg font-bold text-slate-950 group-hover:text-emerald-700 transition-colors leading-snug line-clamp-2">
            {campaign.title}
          </h3>
        </div>

        {/* Earning & Requirement Metrics */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* CPM Earning Box */}
          <div className="bg-emerald-50/60 p-3 rounded-lg border border-emerald-200/70">
            <span className="text-[11px] text-emerald-900 font-bold block uppercase tracking-wider">
              সিপিএম রেট
            </span>
            <div className="text-lg sm:text-xl font-extrabold text-emerald-700 flex items-baseline gap-1 mt-0.5 tabular-nums">
              <span>৳{campaign.cpmRate}</span>
              <span className="text-[11px] text-slate-500 font-normal">/ ১k ভিউ</span>
            </div>
          </div>

          {/* Min Views Requirement Box */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/70">
            <span className="text-[11px] text-slate-500 font-semibold block uppercase tracking-wider">
              মিনিমাম ভিউজ
            </span>
            <div className="text-lg sm:text-xl font-extrabold text-slate-900 flex items-center gap-1.5 mt-0.5 tabular-nums">
              <Eye className="w-4 h-4 text-slate-500 shrink-0" />
              <span>{campaign.minViews.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Short Rule Highlight */}
        <div className="flex items-center gap-2 text-xs text-slate-700 bg-amber-50/70 px-3 py-2 rounded-lg border border-amber-200/60">
          <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span className="font-bold text-slate-900 shrink-0">ভিডিও নিয়ম:</span>
          <span className="text-slate-700 truncate">
            {campaign.validationMode === 'first_30s'
              ? 'প্রথম ১৫-৩০ সেকেন্ডে টুলপত্র (Toolpotro) ডায়লগ বাধ্যতামূলক'
              : 'ভিডিও জুড়ে টুলপত্র (Toolpotro) বিষয়বস্তু থাকতে হবে'}
          </span>
        </div>

        {/* Supported Platforms with Authentic Official Brand Logos */}
        <div className="space-y-2 pt-1 border-t border-slate-100">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-slate-500 uppercase tracking-wider">
              সাপোর্টেড প্ল্যাটফর্ম:
            </span>
            <span className="text-slate-600 font-medium">যেকোনোটিতে আপলোড</span>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded bg-slate-50 text-slate-800 border border-slate-200">
              <YouTubeIcon className="w-4 h-4 shrink-0" />
              <span>YouTube</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded bg-slate-50 text-slate-800 border border-slate-200">
              <FacebookIcon className="w-4 h-4 shrink-0" />
              <span>Facebook</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded bg-slate-50 text-slate-800 border border-slate-200">
              <TikTokIcon className="w-4 h-4 shrink-0" />
              <span>TikTok</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded bg-slate-50 text-slate-800 border border-slate-200">
              <InstagramIcon className="w-4 h-4 shrink-0" />
              <span>Instagram</span>
            </span>
          </div>
        </div>

        {/* Action Button (Toolpotro Emerald) */}
        <div className="pt-1">
          <div className="w-full py-2.5 px-4 bg-emerald-600 group-hover:bg-emerald-700 text-white font-bold rounded-lg flex items-center justify-center gap-2 text-xs sm:text-sm transition-colors shadow-xs">
            <Video className="w-4 h-4" />
            <span>গাইডলাইন দেখুন ও ভিডিও জমা দিন</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

      </div>
    </div>
  );
};

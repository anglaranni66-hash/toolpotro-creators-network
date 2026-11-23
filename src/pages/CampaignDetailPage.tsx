import React, { useState, useMemo } from 'react';
import { Campaign } from '../types';
import { useAuth } from '../context/AuthContext';
import { syncSubmissionToFirestore } from '../services/firestoreSync';
import { authFetch } from '../utils/authFetch';
import {
  ArrowLeft,
  Clock,
  Copy,
  Check,
  Send,
  Link2,
  AlertCircle,
  CheckCircle2,
  Share2,
  FileText,
  Volume2,
  ExternalLink,
  CheckSquare,
  Video,
  Sparkles,
  ChevronRight,
  Tag,
  LogIn,
} from 'lucide-react';
import { YouTubeIcon, FacebookIcon, InstagramIcon, TikTokIcon } from '../components/BrandIcons';

interface CampaignDetailPageProps {
  campaign: Campaign;
  onBack: () => void;
  onSubmissionSuccess: () => void;
}

type PlatformKey = 'youtube' | 'facebook' | 'instagram' | 'tiktok';

export const CampaignDetailPage: React.FC<CampaignDetailPageProps> = ({
  campaign,
  onBack,
  onSubmissionSuccess,
}) => {
  const { currentUser, loginWithGoogle, refreshWallet } = useAuth();
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformKey>('youtube');
  const [url, setUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Copy tracking states for 1-tap feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  // Helper to format text with naturally clickable URLs (safe, selectable & copyable)
  const renderRichContentWithLinks = (text?: string) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return (
      <div className="whitespace-pre-line leading-relaxed text-xs sm:text-sm text-slate-800 select-text">
        {parts.map((part, index) => {
          if (part.match(urlRegex)) {
            return (
              <a
                key={index}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-700 hover:text-emerald-950 font-bold underline inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 transition-colors break-all"
              >
                <span>{part}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            );
          }
          return <span key={index}>{part}</span>;
        })}
      </div>
    );
  };

  // URL Platform Detection
  const detectedPlatform = useMemo(() => {
    if (!url.trim()) return null;
    const lower = url.toLowerCase();
    if (lower.includes('youtube.com/shorts') || lower.includes('youtu.be') || lower.includes('youtube.com/watch')) {
      return {
        key: 'youtube' as PlatformKey,
        label: 'YouTube Shorts / Video',
        icon: <YouTubeIcon className="w-4 h-4 shrink-0" />,
        color: 'text-red-900 bg-red-50 border-red-200',
      };
    }
    if (lower.includes('facebook.com') || lower.includes('fb.watch')) {
      return {
        key: 'facebook' as PlatformKey,
        label: 'Facebook Reels / Video',
        icon: <FacebookIcon className="w-4 h-4 shrink-0" />,
        color: 'text-blue-900 bg-blue-50 border-blue-200',
      };
    }
    if (lower.includes('instagram.com/reel') || lower.includes('instagram.com/p')) {
      return {
        key: 'instagram' as PlatformKey,
        label: 'Instagram Reel / Post',
        icon: <InstagramIcon className="w-4 h-4 shrink-0" />,
        color: 'text-pink-900 bg-pink-50 border-pink-200',
      };
    }
    if (lower.includes('tiktok.com')) {
      return {
        key: 'tiktok' as PlatformKey,
        label: 'TikTok Video',
        icon: <TikTokIcon className="w-4 h-4 shrink-0" />,
        color: 'text-slate-900 bg-slate-100 border-slate-300',
      };
    }
    return {
      key: null,
      label: 'অপরিচিত সোশ্যাল প্ল্যাটফর্ম',
      icon: <span className="text-xs">⚠️</span>,
      color: 'text-amber-900 bg-amber-50 border-amber-200',
    };
  }, [url]);

  // Universal Guideline (Condition 1)
  const universalGuideline = useMemo(() => {
    return (
      campaign.commonGuideline ||
      campaign.scriptGuide ||
      '১. ভিডিওর শুরুতে টুলপত্র ওয়েবসাইটে অর্ডার দেওয়ার দৃশ্য অথবা ডেলিভারির প্যাকেট আনবক্সিং দেখাবেন।\n২. পণ্যের মান, প্যাকেজিং ও ব্যবহারের অভিজ্ঞতা ক্যামেরার সামনে তুলে ধরবেন।\n৩. প্রথম ১৫-৩০ সেকেন্ডের মধ্যে টুলপত্র (Toolpotro)-এর নাম স্পষ্টভাবে উচ্চারণ করবেন এবং দ্রুত ডেলিভারির বিষয়টি হাইলাইট করবেন।'
    );
  }, [campaign]);

  // Platform Specific Guidelines (Conditions 2, 3, 4)
  const platformData = useMemo(() => {
    const pg = campaign.platformGuidelines;
    const p = pg ? pg[selectedPlatform] : undefined;

    const defaultLink = p?.linkUrl || 'https://toolpotro.com';

    if (selectedPlatform === 'youtube') {
      const titleText =
        p?.titleRule ||
        p?.captionOrTitleRule ||
        'ঘরে বসেই সেরা প্রোডাক্ট টুলপত্রে! | Toolpotro Review & Unboxing';
      const descText =
        p?.descriptionRule ||
        p?.descriptionOrCommentRule ||
        p?.captionOrDescription ||
        `ভিডিও ডেসক্রিপশনের প্রথম বা দ্বিতীয় লাইনে সরাসরি অফিশিয়াল লিংক ${defaultLink} দিন এবং নিচে কিওয়ার্ড পেস্ট করুন।`;
      const tagsList =
        p?.tags && p.tags.length > 0
          ? p.tags
          : (p?.keywords && p.keywords.length > 0 ? p.keywords : ['toolpotro', 'online shopping bd', 'unboxing', 'fast delivery']);
      const hashtagsList =
        p?.hashtags && p.hashtags.length > 0
          ? p.hashtags
          : ['#Toolpotro', '#টুলপত্র', '#ToolpotroReview', '#YouTubeShorts'];

      return {
        titleLabel: 'Condition 2: Title Guideline & Required Title Text / Keywords',
        titleContent: titleText,
        descLabel: 'Condition 3: Description Guideline & Exact Description Text (with Official Website Link)',
        descContent: descText,
        linkUrl: defaultLink,
        tagsLabel: 'Condition 4: Video Tags & Search Keywords',
        tags: tagsList,
        hashtags: hashtagsList,
      };
    }

    if (selectedPlatform === 'facebook') {
      const captionText =
        p?.captionText ||
        p?.captionOrTitleRule ||
        p?.captionOrDescription ||
        'ঝামেলা ছাড়াই সেরা প্রোডাক্টের নির্ভরযোগ্য ঠিকানা টুলপত্র (Toolpotro)! দ্রুত ডেলিভারি ও দারুণ কোয়ালিটি।';
      const commentRule =
        p?.pinnedCommentRule ||
        p?.descriptionOrCommentRule ||
        p?.linkPlacementRule ||
        `ভিডিও পোস্ট করার পর প্রথম কমেন্টে (Pinned Comment) অথবা ক্যাপশনের শুরুতে ${defaultLink} লিংক যুক্ত করে পিন করে রাখুন।`;
      const hashtagsList =
        p?.hashtags && p.hashtags.length > 0
          ? p.hashtags
          : ['#Toolpotro', '#টুলপত্র', '#FacebookReels', '#OnlineShoppingBD'];

      return {
        titleLabel: 'Condition 2: Post Caption / Title Text',
        titleContent: captionText,
        descLabel: 'Condition 3: First Comment / Pinned Comment Text & Product Link Rules',
        descContent: commentRule,
        linkUrl: defaultLink,
        tagsLabel: 'Condition 4: Facebook Video Tags & Keywords',
        tags: p?.tags && p.tags.length > 0 ? p.tags : (p?.keywords && p.keywords.length > 0 ? p.keywords : ['টুলপত্র', 'Toolpotro', 'অনলাইন শপিং']),
        hashtags: hashtagsList,
      };
    }

    if (selectedPlatform === 'instagram') {
      const captionText =
        p?.captionText ||
        p?.captionOrTitleRule ||
        p?.captionOrDescription ||
        'Quality products delivered right to your doorstep! ✨ অর্ডার করতে ভিজিট করুন বায়ো লিংকে। #Toolpotro';
      const bioRule =
        p?.bioLinkRule ||
        p?.descriptionOrCommentRule ||
        p?.linkPlacementRule ||
        `আপনার ইনস্টাগ্রাম বায়ো লিংক (Bio Link) অথবা ইনস্টাগ্রাম স্টোরির লিংক স্টিকারে ${defaultLink} যুক্ত করুন।`;
      const hashtagsList =
        p?.hashtags && p.hashtags.length > 0
          ? p.hashtags
          : ['#Toolpotro', '#ToolpotroReels', '#InstaDhaka', '#টুলপত্র'];

      return {
        titleLabel: 'Condition 2: Reel Caption Text',
        titleContent: captionText,
        descLabel: 'Condition 3: Bio Link Instructions & Required Story Link Sticker text',
        descContent: bioRule,
        linkUrl: defaultLink,
        tagsLabel: 'Condition 4: Instagram Video Tags & Keywords',
        tags: p?.tags && p.tags.length > 0 ? p.tags : (p?.keywords && p.keywords.length > 0 ? p.keywords : ['টুলপত্র', 'Toolpotro', 'InstaBD']),
        hashtags: hashtagsList,
      };
    }

    // TikTok
    const captionText =
      p?.captionText ||
      p?.captionOrTitleRule ||
      p?.captionOrDescription ||
      'সেরা প্রোডাক্ট খুঁজছেন? এখনই দেখুন টুলপত্রে (Toolpotro)! #Toolpotro #FYP';
    const bioRule =
      p?.bioLinkRule ||
      p?.descriptionOrCommentRule ||
      p?.linkPlacementRule ||
      `আপনার টিকটক প্রোফাইল বায়োতে (Bio Link) অথবা ভিডিওর ক্যাপশনে ${defaultLink} লিংক উল্লেখ করুন।`;
    const hashtagsList =
      p?.hashtags && p.hashtags.length > 0
        ? p.hashtags
        : ['#Toolpotro', '#টুলপত্র', '#TikTokBangladesh', '#FYP'];

    return {
      titleLabel: 'Condition 2: TikTok Caption Text',
      titleContent: captionText,
      descLabel: 'Condition 3: Profile Bio / Website Link Instructions',
      descContent: bioRule,
      linkUrl: defaultLink,
      tagsLabel: 'Condition 4: TikTok Video Tags & Keywords',
      tags: p?.tags && p.tags.length > 0 ? p.tags : (p?.keywords && p.keywords.length > 0 ? p.keywords : ['টুলপত্র', 'Toolpotro', 'TikTokBD']),
      hashtags: hashtagsList,
    };
  }, [campaign, selectedPlatform]);

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
          campaignId: campaign.id,
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
          text: data.message || 'আপনার ভিডিও সফলভাবে কিউতে জমা হয়েছে! রিভিউ সম্পন্ন হলে ওয়ালেটে টাকা যোগ হবে।',
        });
        setUrl('');
        onSubmissionSuccess();
        setTimeout(async () => {
          await refreshWallet();
        }, 1200);
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
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      
      {/* 1. TOP NAVIGATION & BREADCRUMBS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>সকল ক্যাম্পেইনে ফিরে যান</span>
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 hidden sm:inline" />
          <span className="text-slate-400 hidden sm:inline">ক্যাম্পেইন গাইডলাইন</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 hidden sm:inline" />
          <span className="font-semibold text-slate-800 truncate max-w-xs">{campaign.title}</span>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="bg-emerald-50 text-emerald-800 text-[11px] font-bold px-2.5 py-0.5 rounded border border-emerald-200">
            লাইভ ক্যাম্পেইন
          </span>
          <span className="text-slate-600 text-xs font-semibold flex items-center gap-1 tabular-nums">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{campaign.daysRemaining !== undefined ? `আর ${campaign.daysRemaining} দিন বাকি` : 'চলমান'}</span>
          </span>
        </div>
      </div>

      {/* 2. CAMPAIGN HERO BANNER CARD (Translucent Emerald Glass) */}
      <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-emerald-900 text-white p-6 sm:p-8 rounded-2xl border border-emerald-700/50 shadow-sm relative overflow-hidden backdrop-blur-md">
        <div className="absolute -right-8 -bottom-8 w-56 h-56 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="space-y-3 relative z-10 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-emerald-900/80 backdrop-blur-md text-emerald-200 text-[11px] font-bold px-2.5 py-0.5 rounded uppercase tracking-wider border border-emerald-600/40">
              {campaign.category || 'ক্যাম্পেইন'}
            </span>
            <span className="text-emerald-200/80 text-xs font-medium flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>ইউজিসি ক্রিয়েটর রিওয়ার্ড</span>
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white leading-tight tracking-tight">
            {campaign.title}
          </h1>

          <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed font-normal">
            {campaign.description}
          </p>
        </div>

        {/* Quick Specs Grid (Translucent Emerald Panels) */}
        <div className="mt-6 pt-5 border-t border-emerald-800/60 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs relative z-10">
          <div className="bg-emerald-900/40 backdrop-blur-sm p-3 rounded-lg border border-emerald-700/40">
            <span className="text-[11px] text-emerald-300/80 block mb-0.5 font-medium">সিপিএম রেট</span>
            <strong className="text-base sm:text-lg font-bold text-emerald-300 tabular-nums">৳{campaign.cpmRate} / ১k</strong>
          </div>

          <div className="bg-emerald-900/40 backdrop-blur-sm p-3 rounded-lg border border-emerald-700/40">
            <span className="text-[11px] text-emerald-300/80 block mb-0.5 font-medium">মিনিমাম ভিউজ</span>
            <strong className="text-base sm:text-lg font-bold text-white tabular-nums">{campaign.minViews?.toLocaleString()}</strong>
          </div>

          <div className="bg-emerald-900/40 backdrop-blur-sm p-3 rounded-lg border border-emerald-700/40">
            <span className="text-[11px] text-emerald-300/80 block mb-0.5 font-medium">সর্বোচ্চ পে-আউট</span>
            <strong className="text-base sm:text-lg font-bold text-white tabular-nums">৳{campaign.maxPayoutPerVideo?.toLocaleString() || '২০,০০০'}</strong>
          </div>

          <div className="bg-emerald-900/40 backdrop-blur-sm p-3 rounded-lg border border-emerald-700/40">
            <span className="text-[11px] text-emerald-300/80 block mb-0.5 font-medium">অডিও যাচাইয়ের নিয়ম</span>
            <strong className="text-xs sm:text-sm font-bold text-emerald-100 truncate block">
              {campaign.validationMode === 'first_30s' ? 'প্রথম ১৫-৩০ সেকেন্ড' : 'ফুল স্ক্রিপ্ট'}
            </strong>
          </div>
        </div>
      </div>

      {/* 3. CONDITION 1: ALWAYS DISPLAYED PROMINENTLY AT THE TOP AS UNIVERSAL INSTRUCTION CARD */}
      <div className="bg-white rounded-xl border border-emerald-200 p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-100 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
              ১
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-950 flex items-center gap-2">
                <Video className="w-4 h-4 text-emerald-700" />
                <span>Condition 1: সর্বজনীন ভিডিও গাইডলাইন (Universal Video Guideline - All Platforms)</span>
              </h2>
              <span className="text-[11px] text-emerald-800 font-medium">
                YouTube, Facebook, Instagram এবং TikTok—সব প্ল্যাটফর্মের ভিডিও তৈরির জন্য এই শর্ত প্রযোজ্য।
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => copyToClipboard(universalGuideline, 'universal_guideline')}
            className="self-start sm:self-auto text-xs text-emerald-800 hover:text-emerald-950 font-bold bg-emerald-50 hover:bg-emerald-100 px-3.5 py-1.5 rounded-lg border border-emerald-300 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copiedKey === 'universal_guideline' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-emerald-700" />}
            <span>{copiedKey === 'universal_guideline' ? 'গাইডলাইন কপি হয়েছে!' : 'গাইডলাইন কপি'}</span>
          </button>
        </div>

        <div className="p-4 bg-emerald-50/50 rounded-lg border border-emerald-200/70 select-text leading-relaxed">
          {renderRichContentWithLinks(universalGuideline)}
        </div>

        {/* Spoken Audio Rule Prompt */}
        {campaign.requiredDialogues && (
          <div className="bg-amber-50/80 p-3.5 rounded-lg border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
              <Volume2 className="w-4 h-4 text-amber-600 shrink-0" />
              <span>বাধ্যতামূলক স্পোকেন ডায়লগ (প্রথম ১৫-৩০ সেকেন্ডে):</span>
              <span className="font-semibold text-amber-900 select-text">"{campaign.requiredDialogues}"</span>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(campaign.requiredDialogues, 'spoken_dialogue')}
              className="text-xs text-amber-950 font-bold bg-white hover:bg-amber-100 px-3 py-1 rounded border border-amber-300 flex items-center gap-1 shrink-0 self-start sm:self-auto cursor-pointer"
            >
              {copiedKey === 'spoken_dialogue' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-amber-700" />}
              <span>{copiedKey === 'spoken_dialogue' ? 'কপি হয়েছে' : 'ডায়লগ কপি'}</span>
            </button>
          </div>
        )}
      </div>

      {/* 4. PLATFORM SELECTOR BUTTONS WITH AUTHENTIC OFFICIAL BRAND ICONS */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <label className="text-xs sm:text-sm font-bold text-slate-950 uppercase tracking-wider flex items-center gap-2">
            <Share2 className="w-4 h-4 text-emerald-600" />
            <span>সোশ্যাল প্ল্যাটফর্ম বেছে নিয়ে প্ল্যাটফর্ম-নির্দিষ্ট গাইডলাইন দেখুন:</span>
          </label>
          <span className="text-xs text-slate-500 font-medium">
            নিচের প্ল্যাটফর্ম অনুযায়ী Conditions 2, 3 & 4 পরিবর্তিত হবে
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            type="button"
            onClick={() => setSelectedPlatform('youtube')}
            className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              selectedPlatform === 'youtube'
                ? 'bg-emerald-500/15 border-emerald-600 text-emerald-950 font-bold shadow-xs backdrop-blur-xs'
                : 'bg-white/90 border-slate-200/80 text-slate-700 hover:bg-emerald-500/5 hover:border-emerald-300/60'
            }`}
          >
            <div className="flex items-center gap-2">
              <YouTubeIcon className="w-4 h-4 shrink-0" />
              <span className="text-xs sm:text-sm font-bold">YouTube</span>
            </div>
            <span className={`text-[11px] font-medium ${selectedPlatform === 'youtube' ? 'text-emerald-800' : 'text-slate-500'}`}>
              Shorts / Video
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedPlatform('facebook')}
            className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              selectedPlatform === 'facebook'
                ? 'bg-emerald-500/15 border-emerald-600 text-emerald-950 font-bold shadow-xs backdrop-blur-xs'
                : 'bg-white/90 border-slate-200/80 text-slate-700 hover:bg-emerald-500/5 hover:border-emerald-300/60'
            }`}
          >
            <div className="flex items-center gap-2">
              <FacebookIcon className="w-4 h-4 shrink-0" />
              <span className="text-xs sm:text-sm font-bold">Facebook</span>
            </div>
            <span className={`text-[11px] font-medium ${selectedPlatform === 'facebook' ? 'text-emerald-800' : 'text-slate-500'}`}>
              Reels / Post
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedPlatform('instagram')}
            className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              selectedPlatform === 'instagram'
                ? 'bg-emerald-500/15 border-emerald-600 text-emerald-950 font-bold shadow-xs backdrop-blur-xs'
                : 'bg-white/90 border-slate-200/80 text-slate-700 hover:bg-emerald-500/5 hover:border-emerald-300/60'
            }`}
          >
            <div className="flex items-center gap-2">
              <InstagramIcon className="w-4 h-4 shrink-0" />
              <span className="text-xs sm:text-sm font-bold">Instagram</span>
            </div>
            <span className={`text-[11px] font-medium ${selectedPlatform === 'instagram' ? 'text-emerald-800' : 'text-slate-500'}`}>
              Reels / Post
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedPlatform('tiktok')}
            className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              selectedPlatform === 'tiktok'
                ? 'bg-emerald-500/15 border-emerald-600 text-emerald-950 font-bold shadow-xs backdrop-blur-xs'
                : 'bg-white/90 border-slate-200/80 text-slate-700 hover:bg-emerald-500/5 hover:border-emerald-300/60'
            }`}
          >
            <div className="flex items-center gap-2">
              <TikTokIcon className="w-4 h-4 shrink-0" />
              <span className="text-xs sm:text-sm font-bold">TikTok</span>
            </div>
            <span className={`text-[11px] font-medium ${selectedPlatform === 'tiktok' ? 'text-emerald-800' : 'text-slate-500'}`}>
              Short Video
            </span>
          </button>
        </div>
      </div>

      {/* 5. NUMBERED STEP-BY-STEP PLATFORM GUIDELINE */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4 shadow-xs">
        
        {/* Platform Guidance Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
          <h2 className="text-sm sm:text-base font-bold text-slate-950 flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-emerald-600" />
            <span>
              {selectedPlatform === 'youtube' && 'YouTube এর জন্য নির্দেশাবলী ও টেক্সট'}
              {selectedPlatform === 'facebook' && 'Facebook এর জন্য নির্দেশাবলী ও টেক্সট'}
              {selectedPlatform === 'instagram' && 'Instagram এর জন্য নির্দেশাবলী ও টেক্সট'}
              {selectedPlatform === 'tiktok' && 'TikTok এর জন্য নির্দেশাবলী ও টেক্সট'}
            </span>
          </h2>
          <span className="text-xs text-slate-500 font-medium">
            প্রতিটি টেক্সট বক্সে ১-ট্যাপে কপি করার সুবিধা রয়েছে
          </span>
        </div>

        {/* Step-by-Step Cards */}
        <div className="space-y-3.5">
          
          {/* STEP 1: General Video Rules */}
          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-900">
                <span className="w-5 h-5 rounded bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold shrink-0">
                  ১
                </span>
                <Video className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Step 1: সাধারণ ভিডিও মেকিং রুলস (General Video Rules):</span>
              </div>
              <span className="text-[11px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Condition 1
              </span>
            </div>
            <p className="text-xs text-slate-600 pl-7 leading-relaxed">
              ভিডিও ধারণ করার সময় ওপরের <strong>Condition 1 (সর্বজনীন ভিডিও গাইডলাইন)</strong> মেনে চলুন। ভিডিওর শুরুতে পণ্যের মান ক্লোজআপে দেখাবেন এবং প্রথম ১৫-৩০ সেকেন্ডে টুলপত্র (Toolpotro)-এর নাম স্পষ্ট উচ্চারণ করবেন।
            </p>
          </div>

          {/* STEP 2: Condition 2 - Title / Caption */}
          <div className="p-4 rounded-lg border border-slate-200 bg-white space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-900">
                <span className="w-5 h-5 rounded bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold shrink-0">
                  ২
                </span>
                <FileText className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Step 2: {platformData.titleLabel}</span>
              </div>

              {platformData.titleContent && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(platformData.titleContent, 'title_copy')}
                  className="self-start sm:self-auto text-xs text-emerald-800 hover:text-emerald-950 font-bold bg-emerald-50 hover:bg-emerald-100 px-3 py-1 rounded-md border border-emerald-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedKey === 'title_copy' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-emerald-700" />}
                  <span>{copiedKey === 'title_copy' ? 'কপি হয়েছে!' : '১-ট্যাপে কপি'}</span>
                </button>
              )}
            </div>

            <div className="pl-7 select-text leading-relaxed text-xs sm:text-sm text-slate-800 font-medium bg-slate-50 p-3 rounded border border-slate-200/60">
              {renderRichContentWithLinks(platformData.titleContent)}
            </div>
          </div>

          {/* STEP 3: Condition 3 - Description / Comment / Bio Link */}
          <div className="p-4 rounded-lg border border-slate-200 bg-white space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-900">
                <span className="w-5 h-5 rounded bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold shrink-0">
                  ৩
                </span>
                <Link2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Step 3: {platformData.descLabel}</span>
              </div>

              <div className="flex items-center gap-2">
                {platformData.descContent && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(platformData.descContent, 'desc_copy')}
                    className="text-xs text-slate-800 hover:text-slate-950 font-bold bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded-md border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedKey === 'desc_copy' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                    <span>{copiedKey === 'desc_copy' ? 'কপি হয়েছে!' : 'টেক্সট কপি'}</span>
                  </button>
                )}

                {platformData.linkUrl && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(platformData.linkUrl, 'link_copy')}
                    className="text-xs text-emerald-800 hover:text-emerald-950 font-bold bg-emerald-50 hover:bg-emerald-100 px-3 py-1 rounded-md border border-emerald-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedKey === 'link_copy' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-emerald-600" />}
                    <span>{copiedKey === 'link_copy' ? 'লিংক কপি হয়েছে!' : 'লিংক কপি'}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="pl-7 select-text leading-relaxed text-xs sm:text-sm text-slate-800 font-medium bg-slate-50 p-3 rounded border border-slate-200/60">
              {renderRichContentWithLinks(platformData.descContent)}
            </div>

            {platformData.linkUrl && (
              <div className="pl-7 pt-1 flex items-center gap-2 text-xs">
                <span className="font-semibold text-slate-500">অফিশিয়াল ওয়েবসাইট লিংক:</span>
                <a
                  href={platformData.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-emerald-700 hover:underline font-bold inline-flex items-center gap-1"
                >
                  <span>{platformData.linkUrl}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>

          {/* STEP 4: Condition 4 - Video Tags & Keywords */}
          <div className="p-4 rounded-lg border border-slate-200 bg-white space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-900">
                <span className="w-5 h-5 rounded bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold shrink-0">
                  ৪
                </span>
                <Tag className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Step 4: {platformData.tagsLabel}</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {platformData.tags && platformData.tags.length > 0 && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(platformData.tags.join(', '), 'tags_copy')}
                    className="text-xs text-slate-800 hover:text-slate-950 font-bold bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded-md border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedKey === 'tags_copy' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                    <span>{copiedKey === 'tags_copy' ? 'ট্যাগ কপি হয়েছে!' : 'সব ট্যাগ কপি'}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2.5 pl-7">
              {selectedPlatform !== 'youtube' ? (
                <div className="text-xs text-amber-900 bg-amber-50/80 border border-amber-200/80 rounded-lg px-3 py-2 font-medium leading-relaxed">
                  💡 চাইলে এই ট্যাগগুলো ব্যবহার করতে পারেন, এতে আপনার ভিউ বেশি হবে এবং আর্নিং বেশি হবে। <strong>(বাধ্যতামূলক নয়)</strong>
                </div>
              ) : (
                <span className="text-[11px] font-semibold text-emerald-800 block">
                  ইউটিউব ভিডিও ট্যাগ / সার্চ কিওয়ার্ড (ভিডিওর ট্যাগে অবশ্যই যুক্ত করবেন):
                </span>
              )}

              {/* Tags */}
              {platformData.tags && platformData.tags.length > 0 && (
                <div>
                  <div className="flex flex-wrap gap-1.5 select-text">
                    {platformData.tags.map((t, idx) => (
                      <span
                        key={idx}
                        className="bg-slate-100 text-slate-800 border border-slate-200 font-mono text-[11px] px-2 py-0.5 rounded"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* 6. URL SUBMISSION INTEGRATION (FULL PAGE FORM) */}
      <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="text-sm font-bold text-slate-950 flex items-center gap-2 uppercase tracking-wider">
            <Link2 className="w-4 h-4 text-emerald-600" />
            ভিডিও পাবলিশ করা শেষ? এখানে লিঙ্ক দিয়ে জমা দিন:
          </span>
          <span className="text-xs text-emerald-800 font-semibold bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
            ২৪ ঘণ্টায় অটো-যাচাই
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div>
              <input
                type="url"
                placeholder="https://youtube.com/shorts/... অথবা https://facebook.com/reel/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-600 font-mono shadow-2xs"
                required
              />
            </div>

            {/* Live Platform Auto-detection Feedback Banner */}
            {url.trim() && detectedPlatform && (
              <div className={`p-3 rounded-lg border text-xs font-semibold flex items-center justify-between gap-2 ${detectedPlatform.color}`}>
                <div className="flex items-center gap-2">
                  <span>{detectedPlatform.icon}</span>
                  <span>শনাক্তকৃত প্ল্যাটফর্ম: <strong>{detectedPlatform.label}</strong></span>
                </div>
                {detectedPlatform.key && detectedPlatform.key !== selectedPlatform && (
                  <button
                    type="button"
                    onClick={() => setSelectedPlatform(detectedPlatform.key!)}
                    className="text-[11px] underline hover:text-black font-bold cursor-pointer"
                  >
                    ট্যাব পরিবর্তন করুন
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Status Notifications */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-lg text-xs sm:text-sm font-semibold flex items-start gap-2.5 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                  : 'bg-red-50 text-red-900 border border-red-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {currentUser ? (
            <button
              type="submit"
              disabled={isSubmitting || !url.trim()}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm sm:text-base py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>যাচাই ও প্রসেসিং কিউতে জমা হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>যাচাইয়ের জন্য ভিডিও লিংক সাবমিট করুন</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={loginWithGoogle}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm sm:text-base py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <LogIn className="w-4 h-4" />
              <span>সাবমিট করতে Google দিয়ে লগইন করুন</span>
            </button>
          )}
        </form>
      </div>

      {/* 7. BOTTOM NAVIGATION BACK BUTTON */}
      <div className="flex justify-center pt-2">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-950 bg-white hover:bg-slate-50 px-5 py-2.5 rounded-lg border border-slate-300 shadow-2xs transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>সকল ক্যাম্পেইনে ফিরে যান</span>
        </button>
      </div>

    </div>
  );
};

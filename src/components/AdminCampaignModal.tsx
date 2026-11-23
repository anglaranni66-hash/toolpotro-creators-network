import React, { useState } from 'react';
import { Campaign, PlatformGuidelinesMap } from '../types';
import { syncCampaignToFirestore } from '../services/firestoreSync';
import { authFetch } from '../utils/authFetch';
import {
  PlusCircle,
  Sliders,
  Power,
  Edit3,
  Volume2,
  Settings,
  Video,
  Link2,
  Tag,
  Hash,
  FileText,
} from 'lucide-react';
import { YouTubeIcon, FacebookIcon, InstagramIcon, TikTokIcon } from './BrandIcons';

interface AdminCampaignModalProps {
  campaigns: Campaign[];
  onCampaignUpdated: () => void;
}

type TabType = 'common' | 'youtube' | 'facebook' | 'instagram' | 'tiktok';

export const AdminCampaignModal: React.FC<AdminCampaignModalProps> = ({
  campaigns,
  onCampaignUpdated,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('common');

  // Common Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [brandName, setBrandName] = useState('Toolpotro (টুলপত্র)');
  const [brandKeywords, setBrandKeywords] = useState('Toolpotro, টুলপত্র, Toolpotro App, toolpotro.com');
  const [hashtags, setHashtags] = useState('#Toolpotro, #টুলপত্র, #ToolpotroCreators');
  
  // CONDITION 1: Global Video Creation Guideline (Common for ALL Platforms)
  const [commonGuideline, setCommonGuideline] = useState(
    '১. ভিডিওর শুরুতেই টুলপত্র ওয়েবসাইটে অর্ডার দেওয়ার দৃশ্য অথবা ডেলিভারির প্যাকেট আনবক্সিং দেখাবেন।\n২. পণ্যের মান, প্যাকেজিং ও ব্যবহারের অভিজ্ঞতা ক্যামেরার সামনে তুলে ধরবেন।\n৩. প্রথম ১৫-৩০ সেকেন্ডের মধ্যে টুলপত্র (Toolpotro)-এর নাম স্পষ্টভাবে উচ্চারণ করবেন এবং দ্রুত ডেলিভারির বিষয়টি হাইলাইট করবেন।'
  );
  
  const [requiredDialogues, setRequiredDialogues] = useState(
    'ভিডিওর প্রথম ১৫-৩০ সেকেন্ডে বলুন: "সেরা মানের সব পণ্য এখন সহজেই পাচ্ছি টুলপত্র (Toolpotro)-এ!"'
  );
  const [cpmRate, setCpmRate] = useState(200);
  const [validationMode, setValidationMode] = useState<'first_30s' | 'full_script'>('first_30s');
  const [minViews, setMinViews] = useState(1000);
  const [minLikeRatio, setMinLikeRatio] = useState(3.5);
  const [minCommentRatio, setMinCommentRatio] = useState(0.4);
  const [maxPayout, setMaxPayout] = useState(20000);
  const [endDate, setEndDate] = useState('2026-11-30');
  const [category, setCategory] = useState('ই-কমার্স ও লাইফস্টাইল');

  // YouTube Specific Guideline State
  const [ytTitleRule, setYtTitleRule] = useState('');
  const [ytDescRule, setYtDescRule] = useState('');
  const [ytLinkUrl, setYtLinkUrl] = useState('https://toolpotro.com');
  const [ytTags, setYtTags] = useState('toolpotro, toolpotro review, online shopping bd, unboxing, fast delivery');
  const [ytHashtags, setYtHashtags] = useState('#Toolpotro, #টুলপত্র, #YouTubeShorts, #ToolpotroReview');

  // Facebook Specific Guideline State
  const [fbCaptionText, setFbCaptionText] = useState('');
  const [fbPinnedCommentRule, setFbPinnedCommentRule] = useState('');
  const [fbLinkUrl, setFbLinkUrl] = useState('https://toolpotro.com');
  const [fbTags, setFbTags] = useState('টুলপত্র, Toolpotro, অনলাইন শপিং');
  const [fbHashtags, setFbHashtags] = useState('#Toolpotro, #টুলপত্র, #FacebookReels, #OnlineShoppingBD');

  // Instagram Specific Guideline State
  const [igCaptionText, setIgCaptionText] = useState('');
  const [igBioLinkRule, setIgBioLinkRule] = useState('');
  const [igLinkUrl, setIgLinkUrl] = useState('https://toolpotro.com');
  const [igTags, setIgTags] = useState('টুলপত্র, Toolpotro, InstaBD');
  const [igHashtags, setIgHashtags] = useState('#Toolpotro, #ToolpotroReels, #InstaDhaka, #টুলপত্র');

  // TikTok Specific Guideline State
  const [ttCaptionText, setTtCaptionText] = useState('');
  const [ttBioLinkRule, setTtBioLinkRule] = useState('');
  const [ttLinkUrl, setTtLinkUrl] = useState('https://toolpotro.com');
  const [ttTags, setTtTags] = useState('টুলপত্র, Toolpotro, TikTokBD');
  const [ttHashtags, setTtHashtags] = useState('#Toolpotro, #টুলপত্র, #TikTokBangladesh, #FYP');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const openCreateForm = () => {
    setEditingCampaignId(null);
    setActiveTab('common');
    setTitle('');
    setDescription('');
    setBrandName('Toolpotro (টুলপত্র)');
    setBrandKeywords('Toolpotro, টুলপত্র, Toolpotro App');
    setHashtags('#Toolpotro, #টুলপত্র, #ToolpotroCreators');
    setCommonGuideline(
      '১. ভিডিওর শুরুতেই টুলপত্র ওয়েবসাইটে অর্ডার দেওয়ার দৃশ্য অথবা ডেলিভারির প্যাকেট আনবক্সিং দেখাবেন।\n২. পণ্যের মান, প্যাকেজিং ও ব্যবহারের অভিজ্ঞতা ক্যামেরার সামনে তুলে ধরবেন।\n৩. প্রথম ১৫-৩০ সেকেন্ডের মধ্যে টুলপত্র (Toolpotro)-এর নাম স্পষ্টভাবে উচ্চারণ করবেন এবং দ্রুত ডেলিভারির বিষয়টি হাইলাইট করবেন।'
    );
    setRequiredDialogues('ভিডিওর প্রথম ১৫-৩০ সেকেন্ডে বলুন: "সেরা মানের সব পণ্য এখন সহজেই পাচ্ছি টুলপত্র (Toolpotro)-এ!"');
    setCpmRate(200);
    setValidationMode('first_30s');
    setMinViews(1000);
    setMinLikeRatio(3.5);
    setMinCommentRatio(0.4);
    setMaxPayout(20000);
    setEndDate('2026-11-30');
    setCategory('ই-কমার্স ও লাইফস্টাইল');

    setYtTitleRule('ঘরে বসেই সেরা প্রোডাক্ট টুলপত্রে! | Toolpotro Review & Unboxing');
    setYtDescRule('ভিডিও ডেসক্রিপশনের প্রথম বা দ্বিতীয় লাইনে সরাসরি অফিশিয়াল লিংক https://toolpotro.com দিন এবং নিচে কিওয়ার্ড পেস্ট করুন।');
    setYtLinkUrl('https://toolpotro.com');
    setYtTags('toolpotro, toolpotro review, online shopping bd, unboxing, fast delivery');
    setYtHashtags('#Toolpotro, #টুলপত্র, #ToolpotroReview, #YouTubeShorts');

    setFbCaptionText('ঝামেলা ছাড়াই আসল পণ্যের নির্ভরযোগ্য ঠিকানা টুলপত্র (Toolpotro)! দ্রুত ডেলিভারি ও দারুণ কোয়ালিটি।');
    setFbPinnedCommentRule('ভিডিও পোস্ট করার পর প্রথম কমেন্টে (Pinned Comment) অথবা ক্যাপশনের শুরুতে https://toolpotro.com লিংক যুক্ত করে পিন করে রাখুন।');
    setFbLinkUrl('https://toolpotro.com');
    setFbTags('টুলপত্র, Toolpotro, অনলাইন শপিং');
    setFbHashtags('#Toolpotro, #টুলপত্র, #FacebookReels, #OnlineShoppingBD');

    setIgCaptionText('Quality products delivered right to your doorstep! ✨ অর্ডার করতে ভিজিট করুন বায়ো লিংকে। #Toolpotro');
    setIgBioLinkRule('আপনার ইনস্টাগ্রাম বায়ো লিংক (Bio Link) অথবা ইনস্টাগ্রাম স্টোরির লিংক স্টিকারে https://toolpotro.com যুক্ত করুন।');
    setIgLinkUrl('https://toolpotro.com');
    setIgTags('টুলপত্র, Toolpotro, InstaBD');
    setIgHashtags('#Toolpotro, #ToolpotroReels, #InstaDhaka, #টুলপত্র');

    setTtCaptionText('সেরা প্রোডাক্ট খুঁজছেন? এখনই দেখুন টুলপত্রে (Toolpotro)! #Toolpotro #FYP');
    setTtBioLinkRule('আপনার টিকটক প্রোফাইল বায়োতে (Bio Link) অথবা ভিডিওর ক্যাপশনে toolpotro.com লিংক উল্লেখ করুন।');
    setTtLinkUrl('https://toolpotro.com');
    setTtTags('টুলপত্র, Toolpotro, TikTokBD');
    setTtHashtags('#Toolpotro, #টুলপত্র, #TikTokBangladesh, #FYP');

    setIsOpen(true);
  };

  const openEditForm = (camp: Campaign) => {
    setEditingCampaignId(camp.id);
    setActiveTab('common');
    setTitle(camp.title);
    setDescription(camp.description);
    setBrandName(camp.brandName);
    setBrandKeywords(camp.brandKeywords ? camp.brandKeywords.join(', ') : 'Toolpotro, টুলপত্র');
    setHashtags(camp.hashtags ? camp.hashtags.join(', ') : '#Toolpotro, #টুলপত্র');
    setCommonGuideline(camp.commonGuideline || camp.scriptGuide || '');
    setRequiredDialogues(camp.requiredDialogues || '');
    setCpmRate(camp.cpmRate);
    setValidationMode(camp.validationMode);
    setMinViews(camp.minViews);
    setMinLikeRatio(Number(((camp.minLikeRatio || 0.035) * 100).toFixed(1)));
    setMinCommentRatio(Number(((camp.minCommentRatio || 0.004) * 100).toFixed(2)));
    setMaxPayout(camp.maxPayoutPerVideo || 20000);
    setEndDate(camp.endDate || '2026-11-30');
    setCategory(camp.category || 'ই-কমার্স ও লাইফস্টাইল');

    const pg = camp.platformGuidelines;
    
    // YouTube
    const yt = pg?.youtube;
    setYtTitleRule(yt?.titleRule || yt?.captionOrTitleRule || 'ঘরে বসেই সেরা প্রোডাক্ট টুলপত্রে!');
    setYtDescRule(yt?.descriptionRule || yt?.descriptionOrCommentRule || yt?.captionOrDescription || 'ভিডিও ডেসক্রিপশনের শীর্ষে অফিশিয়াল লিংক দিন।');
    setYtLinkUrl(yt?.linkUrl || 'https://toolpotro.com');
    setYtTags(yt?.tags ? yt.tags.join(', ') : (yt?.keywords ? yt.keywords.join(', ') : 'toolpotro, unboxing, review'));
    setYtHashtags(yt?.hashtags ? yt.hashtags.join(', ') : '#Toolpotro, #টুলপত্র, #YouTubeShorts');

    // Facebook
    const fb = pg?.facebook;
    setFbCaptionText(fb?.captionText || fb?.captionOrTitleRule || fb?.captionOrDescription || 'টুলপত্রে ঘরে বসেই পাচ্ছেন সেরা মানের পণ্য!');
    setFbPinnedCommentRule(fb?.pinnedCommentRule || fb?.descriptionOrCommentRule || fb?.linkPlacementRule || 'পোস্টের ১ম কমেন্টে অফিশিয়াল লিংক পিন করুন।');
    setFbLinkUrl(fb?.linkUrl || 'https://toolpotro.com');
    setFbTags(fb?.tags ? fb.tags.join(', ') : (fb?.keywords ? fb.keywords.join(', ') : 'টুলপত্র, Toolpotro, অনলাইন শপিং'));
    setFbHashtags(fb?.hashtags ? fb.hashtags.join(', ') : '#Toolpotro, #টুলপত্র, #FacebookReels');

    // Instagram
    const ig = pg?.instagram;
    setIgCaptionText(ig?.captionText || ig?.captionOrTitleRule || ig?.captionOrDescription || 'Quality products delivered right at your door! #Toolpotro');
    setIgBioLinkRule(ig?.bioLinkRule || ig?.descriptionOrCommentRule || ig?.linkPlacementRule || 'ইনস্টাগ্রাম বায়ো লিংক অথবা স্টোরি লিংক স্টিকারে toolpotro.com দিন।');
    setIgLinkUrl(ig?.linkUrl || 'https://toolpotro.com');
    setIgTags(ig?.tags ? ig.tags.join(', ') : (ig?.keywords ? ig.keywords.join(', ') : 'টুলপত্র, Toolpotro, InstaBD'));
    setIgHashtags(ig?.hashtags ? ig.hashtags.join(', ') : '#Toolpotro, #ToolpotroReels, #টুলপত্র');

    // TikTok
    const tt = pg?.tiktok;
    setTtCaptionText(tt?.captionText || tt?.captionOrTitleRule || tt?.captionOrDescription || 'টুলপত্রের সেরা প্রোডাক্ট রিভিউ! #Toolpotro #FYP');
    setTtBioLinkRule(tt?.bioLinkRule || tt?.descriptionOrCommentRule || tt?.linkPlacementRule || 'আপনার প্রোফাইল বায়োতে toolpotro.com লিংক উল্লেখ করুন।');
    setTtLinkUrl(tt?.linkUrl || 'https://toolpotro.com');
    setTtTags(tt?.tags ? tt.tags.join(', ') : (tt?.keywords ? tt.keywords.join(', ') : 'টুলপত্র, Toolpotro, TikTokBD'));
    setTtHashtags(tt?.hashtags ? tt.hashtags.join(', ') : '#Toolpotro, #টুলপত্র, #TikTokBangladesh');

    setIsOpen(true);
  };

  const handleToggleActive = async (campaign: Campaign) => {
    const newActiveState = !(campaign.isActive !== false && campaign.status !== 'paused');
    try {
      const res = await authFetch(`/api/campaigns/${campaign.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newActiveState }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.campaign) {
          void syncCampaignToFirestore(data.campaign);
        }
        onCampaignUpdated();
      }
    } catch (err) {
      console.error('Failed to toggle campaign state:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !brandName.trim()) {
      setErrorMsg('ক্যাম্পেইনের টাইটেল ও ব্র্যান্ডের নাম আবশ্যক।');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    const parseTags = (raw: string) => raw.split(',').map((s) => s.trim()).filter(Boolean);
    const parseHashtags = (raw: string) =>
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => (s.startsWith('#') ? s : `#${s}`));

    const ytTagList = parseTags(ytTags);
    const fbTagList = parseTags(fbTags);
    const igTagList = parseTags(igTags);
    const ttTagList = parseTags(ttTags);

    const platformGuidelines: PlatformGuidelinesMap = {
      youtube: {
        titleRule: ytTitleRule.trim(),
        descriptionRule: ytDescRule.trim(),
        tags: ytTagList,
        linkUrl: ytLinkUrl.trim() || 'https://toolpotro.com',
        hashtags: parseHashtags(ytHashtags),
        keywords: ytTagList,
        titleKeywords: ytTagList,
        captionOrTitleRule: ytTitleRule.trim(),
        descriptionOrCommentRule: ytDescRule.trim(),
        captionOrDescription: ytDescRule.trim(),
        videoCreationGuide: commonGuideline.trim(),
        audioRule: requiredDialogues.trim(),
      },
      facebook: {
        captionText: fbCaptionText.trim(),
        pinnedCommentRule: fbPinnedCommentRule.trim(),
        tags: fbTagList,
        linkUrl: fbLinkUrl.trim() || 'https://toolpotro.com',
        hashtags: parseHashtags(fbHashtags),
        keywords: fbTagList,
        captionOrTitleRule: fbCaptionText.trim(),
        descriptionOrCommentRule: fbPinnedCommentRule.trim(),
        captionOrDescription: fbCaptionText.trim(),
        videoCreationGuide: commonGuideline.trim(),
        audioRule: requiredDialogues.trim(),
      },
      instagram: {
        captionText: igCaptionText.trim(),
        bioLinkRule: igBioLinkRule.trim(),
        tags: igTagList,
        linkUrl: igLinkUrl.trim() || 'https://toolpotro.com',
        hashtags: parseHashtags(igHashtags),
        keywords: igTagList,
        captionOrTitleRule: igCaptionText.trim(),
        descriptionOrCommentRule: igBioLinkRule.trim(),
        captionOrDescription: igCaptionText.trim(),
        videoCreationGuide: commonGuideline.trim(),
        audioRule: requiredDialogues.trim(),
      },
      tiktok: {
        captionText: ttCaptionText.trim(),
        bioLinkRule: ttBioLinkRule.trim(),
        tags: ttTagList,
        linkUrl: ttLinkUrl.trim() || 'https://toolpotro.com',
        hashtags: parseHashtags(ttHashtags),
        keywords: ttTagList,
        captionOrTitleRule: ttCaptionText.trim(),
        descriptionOrCommentRule: ttBioLinkRule.trim(),
        captionOrDescription: ttCaptionText.trim(),
        videoCreationGuide: commonGuideline.trim(),
        audioRule: requiredDialogues.trim(),
      },
    };

    const derivedBrandKeywords = Array.from(
      new Set([
        ...brandKeywords.split(',').map((s) => s.trim()).filter(Boolean),
        ...ytTagList,
        ...fbTagList,
        ...igTagList,
        ...ttTagList,
      ])
    );

    const payload = {
      title: title.trim(),
      description: description.trim(),
      commonGuideline: commonGuideline.trim(),
      scriptGuide: commonGuideline.trim(),
      brandName: brandName.trim(),
      brandKeywords: derivedBrandKeywords.length > 0 ? derivedBrandKeywords : ['Toolpotro', 'টুলপত্র'],
      hashtags: hashtags.split(',').map((s) => (s.trim().startsWith('#') ? s.trim() : `#${s.trim()}`)).filter(Boolean),
      requiredDialogues: requiredDialogues.trim(),
      cpmRate: Number(cpmRate),
      validationMode,
      minViews: Number(minViews),
      minLikeRatio: Number(minLikeRatio) / 100,
      minCommentRatio: Number(minCommentRatio) / 100,
      maxPayoutPerVideo: Number(maxPayout),
      endDate,
      category,
      platformGuidelines,
    };

    try {
      const url = editingCampaignId ? `/api/campaigns/${editingCampaignId}` : '/api/campaigns';
      const method = editingCampaignId ? 'PUT' : 'POST';

      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        setErrorMsg(err.error || 'ক্যাম্পেইন সেভ করতে সমস্যা হয়েছে।');
      } else {
        const saved = await res.json();
        const campaignDoc = saved?.campaign || saved;
        if (campaignDoc?.id) {
          void syncCampaignToFirestore(campaignDoc);
        }
        setIsOpen(false);
        onCampaignUpdated();
      }
    } catch (err: any) {
      setErrorMsg('সার্ভারের সাথে সংযোগে সমস্যা দেখা দিয়েছে।');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-6">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-950 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-slate-700" />
            <span>ক্যাম্পেইন ও প্ল্যাটফর্ম গাইডলাইন ম্যানেজার (Campaign & Guideline Rules)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            সর্বজনীন ভিডিও গাইডলাইন (Condition 1) এবং প্রতিটি প্ল্যাটফর্মের (YouTube, Facebook, Instagram, TikTok) সুনির্দিষ্ট শর্তাবলী কনফিগার করুন।
          </p>
        </div>

        <button
          onClick={openCreateForm}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs self-start sm:self-auto cursor-pointer"
        >
          <PlusCircle className="w-4 h-4 text-white" />
          <span>নতুন ক্যাম্পেইন তৈরি করুন</span>
        </button>
      </div>

      {/* Existing Campaigns List */}
      <div className="space-y-3">
        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
          বর্তমান ক্যাম্পেইনসমূহ ({campaigns.length}):
        </span>

        <div className="grid grid-cols-1 gap-3">
          {campaigns.map((camp) => {
            const isCurrentlyActive = camp.isActive !== false && camp.status !== 'paused';
            return (
              <div
                key={camp.id}
                className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isCurrentlyActive
                    ? 'bg-white border-slate-200 hover:border-slate-300'
                    : 'bg-slate-50 border-slate-200 opacity-60'
                }`}
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-950">{camp.title}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        isCurrentlyActive
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {isCurrentlyActive ? 'চলমান (Active)' : 'বন্ধ রয়েছে (Disabled)'}
                    </span>
                    <span className="text-[11px] font-mono text-slate-900 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200 tabular-nums">
                      ৳{camp.cpmRate} CPM
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-4 gap-y-0.5">
                    <span>শেষ তারিখ: <strong className="text-slate-800">{camp.endDate || 'চলমান'}</strong></span>
                    <span>রুল: <strong className="text-slate-800">{camp.validationMode === 'first_30s' ? 'প্রথম ১৫-৩০ সেকেন্ড' : 'ফুল স্ক্রিপ্ট'}</strong></span>
                    <span>মিনিমাম ভিউজ: <strong className="text-slate-800 tabular-nums">{camp.minViews?.toLocaleString()}</strong></span>
                  </div>

                  {/* Configured Platform Icons */}
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">প্ল্যাটফর্ম:</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-50 text-slate-800 border border-slate-200">
                      <YouTubeIcon className="w-3.5 h-3.5 shrink-0" />
                      <span>YouTube</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-50 text-slate-800 border border-slate-200">
                      <FacebookIcon className="w-3.5 h-3.5 shrink-0" />
                      <span>Facebook</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-50 text-slate-800 border border-slate-200">
                      <InstagramIcon className="w-3.5 h-3.5 shrink-0" />
                      <span>Instagram</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-50 text-slate-800 border border-slate-200">
                      <TikTokIcon className="w-3.5 h-3.5 shrink-0" />
                      <span>TikTok</span>
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(camp)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer ${
                      isCurrentlyActive
                        ? 'bg-white hover:bg-red-50 text-red-600 border-red-200'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>{isCurrentlyActive ? 'ডিজেবল করুন' : 'চালু করুন'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openEditForm(camp)}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-emerald-700" />
                    <span>এডিট ও গাইডলাইন</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal / Form Drawer for Create or Edit with Tab Switcher */}
      {isOpen && (
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 bg-slate-50 rounded-xl border border-slate-300 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h4 className="text-sm font-bold text-slate-950 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-slate-700" />
                <span>{editingCampaignId ? 'ক্যাম্পেইনের প্ল্যাটফর্ম গাইডলাইন ও রুলস এডিট' : 'নতুন ক্যাম্পেইন ও প্ল্যাটফর্ম গাইডলাইন তৈরি'}</span>
              </h4>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Condition 1 (সর্বজনীন ভিডিও নিয়ম) এবং প্রতিটি প্ল্যাটফর্মের জন্য সুনির্দিষ্ট শর্তাবলী ইনপুট দিন।
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs font-bold text-slate-500 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-200 cursor-pointer"
            >
              বন্ধ করুন ✕
            </button>
          </div>

          {/* Form Tabs Switcher */}
          <div className="flex flex-wrap gap-1.5 bg-white p-1 rounded-lg border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab('common')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                activeTab === 'common'
                  ? 'bg-emerald-500/15 text-emerald-950 border-emerald-500/40 shadow-xs backdrop-blur-xs font-bold'
                  : 'border-transparent text-slate-600 hover:text-emerald-900 hover:bg-emerald-500/10'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>১. সাধারণ সেটিংস ও Condition 1</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('youtube')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                activeTab === 'youtube'
                  ? 'bg-emerald-500/15 text-emerald-950 border-emerald-500/40 shadow-xs backdrop-blur-xs font-bold'
                  : 'border-transparent text-slate-600 hover:text-emerald-900 hover:bg-emerald-500/10'
              }`}
            >
              <YouTubeIcon className="w-3.5 h-3.5 shrink-0" />
              <span>২. YouTube</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('facebook')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                activeTab === 'facebook'
                  ? 'bg-emerald-500/15 text-emerald-950 border-emerald-500/40 shadow-xs backdrop-blur-xs font-bold'
                  : 'border-transparent text-slate-600 hover:text-emerald-900 hover:bg-emerald-500/10'
              }`}
            >
              <FacebookIcon className="w-3.5 h-3.5 shrink-0" />
              <span>৩. Facebook</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('instagram')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                activeTab === 'instagram'
                  ? 'bg-emerald-500/15 text-emerald-950 border-emerald-500/40 shadow-xs backdrop-blur-xs font-bold'
                  : 'border-transparent text-slate-600 hover:text-emerald-900 hover:bg-emerald-500/10'
              }`}
            >
              <InstagramIcon className="w-3.5 h-3.5 shrink-0" />
              <span>৪. Instagram</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('tiktok')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                activeTab === 'tiktok'
                  ? 'bg-emerald-500/15 text-emerald-950 border-emerald-500/40 shadow-xs backdrop-blur-xs font-bold'
                  : 'border-transparent text-slate-600 hover:text-emerald-900 hover:bg-emerald-500/10'
              }`}
            >
              <TikTokIcon className="w-3.5 h-3.5 shrink-0" />
              <span>৫. TikTok</span>
            </button>
          </div>

          {/* TAB 1: COMMON RULES & CONDITION 1 */}
          {activeTab === 'common' && (
            <div className="space-y-4 pt-1">
              
              {/* CONDITION 1: Dedicated Multi-line Rich Input Box for General Video Guidelines */}
              <div className="bg-white p-4 sm:p-5 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center gap-2 text-slate-950 font-bold text-xs sm:text-sm">
                  <span className="w-5 h-5 rounded bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold shrink-0">
                    ১
                  </span>
                  <Video className="w-4 h-4 text-emerald-700" />
                  <span>Condition 1: সর্বজনীন ভিডিও তৈরির গাইডলাইন (Global Video Guidelines - Common for ALL Platforms)</span>
                </div>
                <p className="text-[11px] text-slate-500 pl-7">
                  ভিডিওর শুরু কিভাবে হবে, ব্র্যান্ডের পরিচয়, অডিও কোয়ালিটি রিকোয়ারমেন্ট এবং ডায়লগ ফ্লো বিস্তারিত লিখুন। এটি YouTube, Facebook, TikTok এবং Instagram—সব প্ল্যাটফর্মের ক্রিয়েটরদের জন্য সার্বজনীনভাবে প্রযোজ্য হবে।
                </p>
                <div className="pl-7 pt-1">
                  <textarea
                    rows={4}
                    value={commonGuideline}
                    onChange={(e) => setCommonGuideline(e.target.value)}
                    placeholder="১. ভিডিওর শুরুতে টুলপত্র অ্যাপে অর্ডার দেওয়ার দৃশ্য বা ব্যাগ আনবক্সিং দেখাবেন...\n২. তাজা সবজি বা নদীর মাছের ফ্রেশনেস তুলে ধরবেন...\n৩. প্রথম ১৫-৩০ সেকেন্ডে টুলপত্রের ব্র্যান্ড নেম ও দ্রুত ডেলিভারির প্রশংসা করবেন..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-xs sm:text-sm text-slate-900 leading-relaxed font-sans focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                    required
                  />
                </div>
              </div>

              {/* Spoken Brand Dialogue Rule */}
              <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-1.5">
                <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-slate-600" />
                  <span>অডিওতে বাধ্যতামূলক ডায়লগ (Spoken Audio Dialogue):</span>
                </label>
                <input
                  type="text"
                  value={requiredDialogues}
                  onChange={(e) => setRequiredDialogues(e.target.value)}
                  placeholder='ভিডিওর প্রথম ১৫-৩০ সেকেন্ডে বলুন: "বাজারের ঝামেলা শেষ! মাত্র ৩০ মিনিটে ফ্রেশ শাকসবজি ও মাছ পাচ্ছি টুলপত্র অ্যাপে।"'
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-medium"
                />
              </div>

              {/* Title & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white p-3.5 rounded-lg border border-slate-200">
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    ক্যাম্পেইন শিরোনাম (Title):
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="যেমন: টুলপত্র বাজার মেগা ক্যাম্পেইন"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900"
                    required
                  />
                </div>

                <div className="bg-white p-3.5 rounded-lg border border-slate-200">
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    ক্যাটাগরি:
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="যেমন: গ্রোসারি ও কাঁচাবাজার"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900"
                  />
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-lg border border-slate-200">
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  ক্যাম্পেইনের সংক্ষিপ্ত বর্ণনা (Description):
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="ক্যাম্পেইন সম্পর্কে সংক্ষিপ্ত বর্ণনা..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900"
                  required
                />
              </div>

              <div className="bg-white p-3.5 rounded-lg border border-slate-200">
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  ব্র্যান্ডের নাম (Brand Name):
                </label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900"
                  required
                />
              </div>

              {/* Rates, Minimums, and End Date */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    সিপিএম রেট (৳ / ১k):
                  </label>
                  <input
                    type="number"
                    value={cpmRate}
                    onChange={(e) => setCpmRate(Number(e.target.value))}
                    min={1}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-mono tabular-nums"
                    required
                  />
                </div>

                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    মিনিমাম ভিউজ:
                  </label>
                  <input
                    type="number"
                    value={minViews}
                    onChange={(e) => setMinViews(Number(e.target.value))}
                    min={500}
                    step={500}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-mono tabular-nums"
                    required
                  />
                </div>

                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    সর্বোচ্চ পে-আউট (৳):
                  </label>
                  <input
                    type="number"
                    value={maxPayout}
                    onChange={(e) => setMaxPayout(Number(e.target.value))}
                    min={1000}
                    step={1000}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-mono tabular-nums"
                    required
                  />
                </div>

                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    ক্যাম্পেইন শেষ তারিখ:
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-mono"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: YOUTUBE SPECIFIC GUIDELINES */}
          {activeTab === 'youtube' && (
            <div className="space-y-4 pt-1 bg-white p-4 sm:p-5 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs sm:text-sm">
                  <YouTubeIcon className="w-5 h-5 shrink-0" />
                  <span>YouTube Shorts / Video নির্দিষ্ট শর্তাবলী (Conditions 2, 3 & 4)</span>
                </div>
                <span className="text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-medium">
                  ✓ Condition 1 সার্বজনীনভাবে যুক্ত
                </span>
              </div>

              {/* Condition 2 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-slate-600" />
                  <span>Condition 2: Title Guideline & Required Title Text / Keywords:</span>
                </label>
                <textarea
                  rows={2}
                  value={ytTitleRule}
                  onChange={(e) => setYtTitleRule(e.target.value)}
                  placeholder="যেমন: ঢাকার মধ্যে ৩০ মিনিটে তাজা কাঁচাবাজার টুলপত্রে! | Toolpotro Fresh Grocery Delivery"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900"
                />
              </div>

              {/* Condition 3 */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Link2 className="w-4 h-4 text-slate-600" />
                  <span>Condition 3: Description Guideline & Exact Description Text (with Official Website Link):</span>
                </label>
                <textarea
                  rows={3}
                  value={ytDescRule}
                  onChange={(e) => setYtDescRule(e.target.value)}
                  placeholder="ভিডিও ডেসক্রিপশনের প্রথম বা দ্বিতীয় লাইনে সরাসরি অফিশিয়াল লিংক দিন এবং নিচে কিওয়ার্ড ও হ্যাশট্যাগ পেস্ট করুন।"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 leading-relaxed"
                />
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
                  <span className="text-[11px] font-semibold text-slate-600 shrink-0">অফিশিয়াল ওয়েবসাইট লিংক:</span>
                  <input
                    type="url"
                    value={ytLinkUrl}
                    onChange={(e) => setYtLinkUrl(e.target.value)}
                    placeholder="https://toolpotro.com"
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-mono"
                  />
                </div>
              </div>

              {/* Condition 4 */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-slate-600" />
                  <span>Condition 4: Video Tags & Search Keywords (কমা দিয়ে লিখুন):</span>
                </label>
                <input
                  type="text"
                  value={ytTags}
                  onChange={(e) => setYtTags(e.target.value)}
                  placeholder="toolpotro, offer, fashion, dhaka bazar, fresh grocery"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono"
                />
                <div className="pt-1">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="text-[11px] font-bold text-slate-600 block">
                      ইউটিউব হ্যাশট্যাগ (Hashtags):
                    </label>
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      শুধুমাত্র অ্যাডমিন সংরক্ষণ (ইউজারের সামনে শো হবে না)
                    </span>
                  </div>
                  <input
                    type="text"
                    value={ytHashtags}
                    onChange={(e) => setYtHashtags(e.target.value)}
                    placeholder="#Toolpotro, #টুলপত্র, #YouTubeShorts, #GroceryDelivery"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FACEBOOK SPECIFIC GUIDELINES */}
          {activeTab === 'facebook' && (
            <div className="space-y-4 pt-1 bg-white p-4 sm:p-5 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs sm:text-sm">
                  <FacebookIcon className="w-5 h-5 shrink-0" />
                  <span>Facebook Reels / Video নির্দিষ্ট শর্তাবলী (Conditions 2 & 3)</span>
                </div>
                <span className="text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-medium">
                  ✓ Condition 1 সার্বজনীনভাবে যুক্ত
                </span>
              </div>

              {/* Condition 2 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-slate-600" />
                  <span>Condition 2: Post Caption / Title Text:</span>
                </label>
                <textarea
                  rows={3}
                  value={fbCaptionText}
                  onChange={(e) => setFbCaptionText(e.target.value)}
                  placeholder="বাজারের রোদে ছোটাছুটি শেষ! টুলপত্র অ্যাপে ঘরে বসেই পাচ্ছি তাজা কাঁচাবাজার মাত্র ৩০ মিনিটে..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 leading-relaxed"
                />
              </div>

              {/* Condition 3 */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Link2 className="w-4 h-4 text-slate-600" />
                  <span>Condition 3: First Comment / Pinned Comment Text & Product Link Rules:</span>
                </label>
                <textarea
                  rows={2}
                  value={fbPinnedCommentRule}
                  onChange={(e) => setFbPinnedCommentRule(e.target.value)}
                  placeholder="ভিডিও পোস্ট করার পর প্রথম কমেন্টে (Pinned Comment) অথবা ক্যাপশনের শুরুতে https://toolpotro.com লিংক যুক্ত করে পিন করে রাখুন।"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900"
                />
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
                  <span className="text-[11px] font-semibold text-slate-600 shrink-0">প্রোডাক্ট / ওয়েবসাইট লিংক:</span>
                  <input
                    type="url"
                    value={fbLinkUrl}
                    onChange={(e) => setFbLinkUrl(e.target.value)}
                    placeholder="https://toolpotro.com"
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-mono"
                  />
                </div>
              </div>

              {/* Facebook Video Tags & Keywords */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-slate-600" />
                  <span>Condition 4: Video Tags & Search Keywords (কমা দিয়ে লিখুন):</span>
                </label>
                <input
                  type="text"
                  value={fbTags}
                  onChange={(e) => setFbTags(e.target.value)}
                  placeholder="টুলপত্র, Toolpotro Bazar, কাঁচাবাজার ডেলিভারি"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono"
                />
              </div>

              {/* Facebook Hashtags (Admin-only archive) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Hash className="w-4 h-4 text-slate-600" />
                    <span>ফেসবুক হ্যাশট্যাগ (Hashtags):</span>
                  </label>
                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    শুধুমাত্র অ্যাডমিন সংরক্ষণ (ইউজারের সামনে শো হবে না)
                  </span>
                </div>
                <input
                  type="text"
                  value={fbHashtags}
                  onChange={(e) => setFbHashtags(e.target.value)}
                  placeholder="#Toolpotro, #টুলপত্র, #FacebookReels, #DhakaBazar"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono"
                />
              </div>
            </div>
          )}

          {/* TAB 4: INSTAGRAM SPECIFIC GUIDELINES */}
          {activeTab === 'instagram' && (
            <div className="space-y-4 pt-1 bg-white p-4 sm:p-5 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs sm:text-sm">
                  <InstagramIcon className="w-5 h-5 shrink-0" />
                  <span>Instagram Reel / Post নির্দিষ্ট শর্তাবলী (Conditions 2 & 3)</span>
                </div>
                <span className="text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-medium">
                  ✓ Condition 1 সার্বজনীনভাবে যুক্ত
                </span>
              </div>

              {/* Condition 2 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-slate-600" />
                  <span>Condition 2: Reel Caption Text:</span>
                </label>
                <textarea
                  rows={3}
                  value={igCaptionText}
                  onChange={(e) => setIgCaptionText(e.target.value)}
                  placeholder="Freshness delivered right to your kitchen in 30 minutes! 🥦🐟 অর্ডার করতে ভিজিট করুন বায়ো লিংকে..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 leading-relaxed"
                />
              </div>

              {/* Condition 3 */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Link2 className="w-4 h-4 text-slate-600" />
                  <span>Condition 3: Bio Link Instructions & Required Story Link Sticker text:</span>
                </label>
                <textarea
                  rows={2}
                  value={igBioLinkRule}
                  onChange={(e) => setIgBioLinkRule(e.target.value)}
                  placeholder="আপনার ইনস্টাগ্রাম বায়ো লিংক (Bio Link) অথবা ইনস্টাগ্রাম স্টোরির লিংক স্টিকারে https://toolpotro.com যুক্ত করুন।"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900"
                />
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
                  <span className="text-[11px] font-semibold text-slate-600 shrink-0">বায়ো / স্টোরি ওয়েবসাইট লিংক:</span>
                  <input
                    type="url"
                    value={igLinkUrl}
                    onChange={(e) => setIgLinkUrl(e.target.value)}
                    placeholder="https://toolpotro.com"
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-mono"
                  />
                </div>
              </div>

              {/* Instagram Video Tags & Keywords */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-slate-600" />
                  <span>Condition 4: Video Tags & Search Keywords (কমা দিয়ে লিখুন):</span>
                </label>
                <input
                  type="text"
                  value={igTags}
                  onChange={(e) => setIgTags(e.target.value)}
                  placeholder="টুলপত্র, Toolpotro, InstaBazar"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono"
                />
              </div>

              {/* Instagram Hashtags (Admin-only archive) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Hash className="w-4 h-4 text-slate-600" />
                    <span>ইনস্টাগ্রাম হ্যাশট্যাগ (Hashtags):</span>
                  </label>
                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    শুধুমাত্র অ্যাডমিন সংরক্ষণ (ইউজারের সামনে শো হবে না)
                  </span>
                </div>
                <input
                  type="text"
                  value={igHashtags}
                  onChange={(e) => setIgHashtags(e.target.value)}
                  placeholder="#Toolpotro, #ToolpotroReels, #InstaDhaka, #টুলপত্র"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono"
                />
              </div>
            </div>
          )}

          {/* TAB 5: TIKTOK SPECIFIC GUIDELINES */}
          {activeTab === 'tiktok' && (
            <div className="space-y-4 pt-1 bg-white p-4 sm:p-5 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs sm:text-sm">
                  <TikTokIcon className="w-5 h-5 shrink-0" />
                  <span>TikTok নির্দিষ্ট শর্তাবলী (Conditions 2 & 3)</span>
                </div>
                <span className="text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-medium">
                  ✓ Condition 1 সার্বজনীনভাবে যুক্ত
                </span>
              </div>

              {/* Condition 2 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-slate-600" />
                  <span>Condition 2: TikTok Caption Text:</span>
                </label>
                <textarea
                  rows={2}
                  value={ttCaptionText}
                  onChange={(e) => setTtCaptionText(e.target.value)}
                  placeholder="মেহমান আসছে আর বাজার শেষ? ৩০ মিনিটে সমাধান টুলপত্র অ্যাপে! #Toolpotro #FreshGrocery #FYP"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 leading-relaxed"
                />
              </div>

              {/* Condition 3 */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Link2 className="w-4 h-4 text-slate-600" />
                  <span>Condition 3: Profile Bio / Website Link Instructions:</span>
                </label>
                <textarea
                  rows={2}
                  value={ttBioLinkRule}
                  onChange={(e) => setTtBioLinkRule(e.target.value)}
                  placeholder="আপনার টিকটক প্রোফাইল বায়োতে (Bio Link) অথবা ভিডিওর ক্যাপশনে toolpotro.com লিংক উল্লেখ করুন।"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900"
                />
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
                  <span className="text-[11px] font-semibold text-slate-600 shrink-0">বায়ো ওয়েবসাইট লিংক:</span>
                  <input
                    type="url"
                    value={ttLinkUrl}
                    onChange={(e) => setTtLinkUrl(e.target.value)}
                    placeholder="https://toolpotro.com"
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-mono"
                  />
                </div>
              </div>

              {/* TikTok Video Tags & Keywords */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-slate-600" />
                  <span>Condition 4: Video Tags & Search Keywords (কমা দিয়ে লিখুন):</span>
                </label>
                <input
                  type="text"
                  value={ttTags}
                  onChange={(e) => setTtTags(e.target.value)}
                  placeholder="টুলপত্র, Toolpotro, TikTokGrocery"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono"
                />
              </div>

              {/* TikTok Hashtags (Admin-only archive) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Hash className="w-4 h-4 text-slate-600" />
                    <span>টিকটক হ্যাশট্যাগ (Hashtags):</span>
                  </label>
                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    শুধুমাত্র অ্যাডমিন সংরক্ষণ (ইউজারের সামনে শো হবে না)
                  </span>
                </div>
                <input
                  type="text"
                  value={ttHashtags}
                  onChange={(e) => setTtHashtags(e.target.value)}
                  placeholder="#Toolpotro, #টুলপত্র, #TikTokBangladesh, #FYP, #FreshGrocery"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono"
                />
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-100 text-red-800 rounded-lg text-xs font-bold">
              {errorMsg}
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs font-bold text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg cursor-pointer transition-colors"
            >
              বাতিল
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-6 py-2.5 rounded-lg transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'সেভ হচ্ছে...' : editingCampaignId ? 'আপডেট সম্পন্ন করুন' : 'ক্যাম্পেইন প্রকাশ করুন'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
